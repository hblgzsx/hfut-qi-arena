import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {emptyState} from '../src/engine.ts';
import {defaultEvent} from '../src/event-settings.ts';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1366,height:1000}});
const state=emptyState();state.event=defaultEvent();
let people=[{id:'old',display_name:'旧裁判',email:'old@example.test',role:'referee'}];const requests=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'admin'}})));
await page.route('**/auth/v1/**',r=>r.fulfill({json:{user:{id:'admin'}}}));
await page.route('**/functions/v1/tournament',r=>{const b=r.request().postDataJSON();requests.push(b);if(b.action==='members')return r.fulfill({json:{profiles:people}});if(b.action==='events')return r.fulfill({json:{events:[]}});if(b.action==='create-referee'){const p={id:b.email,display_name:b.displayName,email:b.email,role:'referee'};people.push(p);return r.fulfill({json:{referee:p,credential:{displayName:b.displayName,email:b.email,password:'TEST-ONLY-'+b.displayName}}});}return r.fulfill({json:{state,profile:{id:'admin',display_name:'测试管理员',role:'superadmin'}}});});
await page.routeWebSocket('wss://**/*',ws=>ws.onMessage(()=>{}));
async function exportSheet(panel){const wait=page.waitForEvent('download',{timeout:10000});await panel.getByRole('button',{name:'导出所选裁判 XLSX',exact:true}).click();let file;try{file=await wait;}catch(e){console.log('EXPORT STATUS',await panel.innerText(),errors);throw e;}const book=XLSX.read(await fs.readFile(await file.path()));return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:''});}
try{
 await page.goto('http://127.0.0.1:4291/?event=hfut-2026');await page.getByRole('button',{name:'测试管理员',exact:true}).click();
 const account=page.getByRole('dialog',{name:'账号与权限中心'}),existing=account.getByRole('region',{name:'管理员导出裁判信息'});
 await page.waitForFunction(()=>document.querySelector('section[aria-label="管理员导出裁判信息"] summary small')?.textContent.includes('1 / 1'));
 if(await existing.locator('details').getAttribute('open')===null)await existing.locator('summary').click();assert.equal(await existing.getByLabel('导出字段 密码').isChecked(),false);
 assert.deepEqual(await exportSheet(existing),[{姓名:'旧裁判',邮箱:'old@example.test'}]);
 await existing.getByLabel('导出字段 密码').check();assert.match((await exportSheet(existing))[0].密码,/不可读取/);assert.equal(requests.filter(r=>r.action==='reset-referee').length,0);
 await account.getByLabel('裁判姓名',{exact:true}).fill('新裁判');await account.getByLabel('裁判邮箱',{exact:true}).fill('new@example.test');await account.getByRole('button',{name:'生成裁判账号与随机密码'}).click();
 const single=account.getByRole('region',{name:'导出当前裁判登录信息'});await single.waitFor();assert.equal(await single.getByLabel('导出字段 密码').isChecked(),false);
 let wait=page.waitForEvent('download');await single.getByRole('button',{name:'导出所选裁判 TXT'}).click();assert.ok(!(await fs.readFile(await (await wait).path(),'utf8')).includes('TEST-ONLY'));
 let warned=false;page.once('dialog',async d=>{warned=true;await d.dismiss();});await account.getByRole('button',{name:'关闭弹窗'}).click();assert.equal(warned,true);assert.equal(await account.count(),1);
 await single.getByLabel('导出字段 密码').check();wait=page.waitForEvent('download');await single.getByRole('button',{name:'导出所选裁判 TXT'}).click();assert.match(await fs.readFile(await (await wait).path(),'utf8'),/TEST-ONLY-新裁判/);
 await account.getByRole('button',{name:'已保存，关闭密码'}).click();
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['姓名','邮箱'],['甲裁判','a@example.test'],['乙裁判','b@example.test']]),'裁判');
 await account.getByLabel('上传裁判 XLSX').setInputFiles({name:'fixture.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(book,{type:'buffer',bookType:'xlsx'})});await account.getByRole('button',{name:'确认创建本批裁判'}).click();
 const bulk=account.getByRole('region',{name:'选择裁判和账号字段后导出'});await bulk.locator('summary').click();await bulk.getByLabel('导出字段 密码').check();await bulk.getByLabel('导出字段 邮箱').uncheck();await bulk.getByLabel('导出 乙裁判 b@example.test').uncheck();
 assert.deepEqual(await exportSheet(bulk),[{姓名:'甲裁判',密码:'TEST-ONLY-甲裁判'}]);
 warned=false;page.once('dialog',async d=>{warned=true;await d.dismiss();});await account.getByRole('button',{name:'关闭弹窗'}).click();assert.equal(warned,true);
 await bulk.getByLabel('搜索导出裁判').fill('乙裁判');await bulk.getByRole('button',{name:'全选搜索结果'}).click();await exportSheet(bulk);
 await fs.mkdir('tmp',{recursive:true});await page.screenshot({path:'tmp/裁判账号选择导出.png',fullPage:true});
 await account.getByRole('button',{name:'关闭弹窗'}).click();assert.equal(await account.count(),0);assert.deepEqual(errors,[]);assert.equal(requests.filter(r=>r.action==='reset-referee').length,0);
 console.log('PASS: administrator-only account exports, selectable people and fields, password opt-in, unreadable old password, no reset, password-free export keeps save warning, partial batch export keeps other credentials unsaved.');
}finally{await browser.close();}
