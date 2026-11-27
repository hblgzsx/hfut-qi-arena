import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {emptyState} from '../src/engine.ts';
const browser=await chromium.launch({channel:'msedge',headless:true});
const output=process.env.REFEREE_OUTPUT||'tmp';
const errors=[],requests=[];
const people=Array.from({length:1203},(_,i)=>({id:'j'+i,display_name:'测试裁判'+String(i).padStart(4,'0'),email:'judge'+i+'@example.test',role:'referee',created_at:'2026-11-20T10:00:00Z'}));
people.push({id:'root',display_name:'测试超管',email:'root@example.test',role:'superadmin'});
let race=false;
async function open(role){
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'root'}}));localStorage.setItem('qi-theme','dark');});
 await page.route('**/auth/v1/**',r=>r.fulfill({json:{user:{id:'root'}}}));
 await page.routeWebSocket('wss://**/*',ws=>ws.onMessage(()=>{}));
 await page.route('**/functions/v1/tournament',r=>{
  const b=r.request().postDataJSON();requests.push(b);
  if(b.action==='events')return r.fulfill({json:{events:[],deletedEvents:[]}});
  if(b.action==='members')return r.fulfill({json:{profiles:[]}});
  if(b.action==='members-page'){
   let rows=people.filter(p=>b.group==='deleted'?p.deleted_at:!p.deleted_at&&(b.group==='privileged'?['admin','superadmin'].includes(p.role):p.role===b.group));
   rows=rows.filter(p=>(p.display_name+' '+p.email).includes(b.query));
   return r.fulfill({json:{profiles:rows.slice((b.page-1)*b.pageSize,b.page*b.pageSize),total:rows.length,counts:{referee:people.filter(p=>p.role==='referee').length,deleted:people.filter(p=>p.deleted_at).length,blocked:0}}});
  }
  if(b.action==='referee-delete-check')return r.fulfill({json:{target:people.find(p=>p.id===b.userId),bindings:b.userId==='j0'||b.userId==='j2'&&race?[{id:'history',name:'历史绑定赛事',deleted:true,tables:['gomoku:1']}]:[]}});
  if(b.action==='delete-referee'){
   if(b.userId==='j2'){race=true;return r.fulfill({status:409,json:{error:'此裁判仍绑定比赛，请先解除全部比赛绑定后再删除'}});}
   const p=people.find(p=>p.id===b.userId);assert.equal(b.confirmEmail,p.email);p.deleted_at=new Date().toISOString();p.role='blocked';return r.fulfill({json:{ok:true}});
  }
  if(b.action==='restore-referee'){const p=people.find(p=>p.id===b.userId);assert.equal(b.confirmEmail,p.email);p.deleted_at=null;p.role='referee';return r.fulfill({json:{ok:true}});}
  return r.fulfill({json:{state:emptyState(),unavailable:true,profile:{id:'root',display_name:'测试超管',role}}});
 });
 await page.goto('http://127.0.0.1:4291/');await page.getByRole('button',{name:'测试超管',exact:true}).click();await page.getByLabel('选择裁判 测试裁判0000 judge0@example.test').waitFor();return page;
}
try{
 const page=await open('superadmin');
 assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('.manager-table tbody tr').count(),20);
 assert.equal(requests.filter(b=>b.action==='members').length,0);
 await page.getByLabel('选择裁判 测试裁判0000 judge0@example.test').check();await page.getByRole('button',{name:'下一页',exact:true}).click();await page.getByLabel('选择裁判 测试裁判0020 judge20@example.test').check();
 assert.match(await page.locator('.manager-selection').innerText(),/已跨页选择 2 人/);
 assert.equal(requests.filter(b=>b.action==='members-page').at(-1).page,2);
 await page.getByLabel('裁判每页数量').selectOption('50');await page.getByLabel('选择裁判 测试裁判0049 judge49@example.test').waitFor();assert.equal(await page.locator('.manager-table tbody tr').count(),50);
 await page.getByLabel('搜索裁判目录').fill('judge1202@');await page.getByLabel('选择裁判 测试裁判1202 judge1202@example.test').waitFor();assert.equal(await page.locator('.manager-table tbody tr').count(),1);
 await page.getByLabel('搜索裁判目录').fill('');await page.getByLabel('选择裁判 测试裁判0000 judge0@example.test').waitFor();
 await page.getByRole('button',{name:'删除裁判 测试裁判0000 judge0@example.test',exact:true}).click();
 const deletion=page.getByRole('dialog',{name:'删除裁判确认'});await deletion.getByText('历史绑定赛事',{exact:true}).waitFor();assert.equal(await deletion.getByRole('button',{name:'确认删除裁判'}).isEnabled(),false);assert.match(await deletion.innerText(),/已删除比赛/);await deletion.getByRole('button',{name:'取消',exact:true}).click();
 await page.getByRole('button',{name:'删除裁判 测试裁判0001 judge1@example.test',exact:true}).click();await deletion.getByLabel('确认裁判邮箱').fill('wrong@example.test');assert.equal(await deletion.getByRole('button',{name:'确认删除裁判'}).isEnabled(),false);await deletion.getByLabel('确认裁判邮箱').fill('judge1@example.test');await deletion.getByRole('button',{name:'确认删除裁判'}).click();await deletion.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'已删除裁判',exact:true}).click();await page.getByRole('button',{name:'恢复',exact:true}).click();const restore=page.getByRole('dialog',{name:'恢复裁判'});await restore.getByLabel('确认裁判邮箱').fill('judge1@example.test');await restore.getByRole('button',{name:'确认恢复裁判'}).click();await restore.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'裁判目录',exact:true}).click();await page.getByRole('button',{name:'删除裁判 测试裁判0002 judge2@example.test',exact:true}).click();await deletion.getByLabel('确认裁判邮箱').fill('judge2@example.test');await deletion.getByRole('button',{name:'确认删除裁判'}).click();await deletion.getByText('历史绑定赛事',{exact:true}).waitFor();assert.equal(await deletion.getByRole('button',{name:'确认删除裁判'}).isEnabled(),false);assert.match(await deletion.innerText(),/此裁判仍绑定比赛/);await deletion.getByRole('button',{name:'取消',exact:true}).click();
 await page.getByRole('button',{name:'管理员权限',exact:true}).click();await page.getByRole('button',{name:'管理 测试超管 root@example.test',exact:true}).waitFor();assert.equal(await page.locator('.manager-table tbody tr').count(),1);assert.equal(await page.locator('.manager-delete').count(),0);
 await page.getByRole('button',{name:'裁判目录',exact:true}).click();await page.getByLabel('裁判每页数量').selectOption('10');await page.getByLabel('选择裁判 测试裁判0000 judge0@example.test').waitFor();
 await fs.mkdir(output,{recursive:true});await page.screenshot({path:path.join(output,'裁判管理中心-桌面.png'),fullPage:true});await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.screenshot({path:path.join(output,'裁判管理中心-白色.png'),fullPage:true});await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'裁判管理中心-手机.png'),fullPage:true});
 const admin=await open('admin');assert.equal(await admin.getByRole('button',{name:'已删除裁判',exact:true}).count(),0);assert.equal(await admin.getByRole('button',{name:'管理员权限',exact:true}).count(),0);assert.equal(await admin.locator('.manager-delete').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: 1,203 referees server pagination/search; independent full-page workspace; cross-page export selection; role separation; history bindings prevent deletion; typed email; delete/restore; concurrent new binding blocks submission; dark/light/mobile layout.');
}finally{await browser.close();}
