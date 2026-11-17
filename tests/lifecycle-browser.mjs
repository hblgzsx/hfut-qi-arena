import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import XLSX from 'xlsx';
import {demoState,emptyState,validateState} from '../src/engine.ts';import {defaultEvent} from '../src/event-settings.ts';
const initial=validateState(demoState());initial.event={...defaultEvent(),name:'测试原竞赛'};
const second=emptyState();second.event={...defaultEvent(),name:'另一竞赛'};
const records=new Map([['hfut-2026',{state:initial,deleted:false}],['event-other',{state:second,deleted:false}]]);
const profile={id:'admin',role:'superadmin',display_name:'测试管理员',email:'admin@example.test'};let lastRules,created=0,deleted=0;
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
try{
 await context.addInitScript(()=>localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'test',refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'admin'}})));
 await context.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/auth/v1/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({user:{id:'admin'}})}));
 await context.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/functions/v1/tournament',async r=>{const b=r.request().postDataJSON(),row=records.get(b.eventId);let data={state:row?.deleted?emptyState():row?.state??emptyState(),profile,unavailable:!row||row.deleted};
  if(b.action==='events'){const items=[...records].map(([id,r])=>({id,...r.state.event,revision:r.state.revision,deletedAt:r.deleted?'now':null}));data={events:items.filter(i=>!i.deletedAt),deletedEvents:items.filter(i=>i.deletedAt),serverNow:Date.now()};}
  if(b.action==='create-event'){lastRules=b.state.tournaments;records.set('event-new',{state:b.state,deleted:false});data={state:b.state,eventId:'event-new'};}
  if(b.action==='delete-event'){assert.equal(b.expectedRevision,row.state.revision);assert.equal(b.confirmName,row.state.event.name);row.deleted=true;deleted++;data={ok:true};}
  if(b.action==='restore-event'){row.deleted=false;data={ok:true};}
  if(b.action==='members')data={profiles:[profile]};
  if(b.action==='create-referee'){created++;if(b.email==='exists@example.test'){await r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'邮箱已注册'})});return;}data={credential:{email:b.email,displayName:b.displayName,password:'TEST-password-Only-234!'}};}
  await r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:4173/');await page.getByRole('button',{name:'添加竞赛',exact:true}).waitFor();
 const before=await page.getByLabel('当前北京时间').textContent();await page.waitForFunction(v=>document.querySelector('[aria-label="当前北京时间"]').textContent!==v,before);assert.match(before,/\d{4}\/\d{2}\/\d{2}.*\d{2}:\d{2}:\d{2}/);
 await page.getByRole('button',{name:'切换为白色主题'}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.screenshot({path:'tmp/light-console.png',fullPage:true});
 const ratios=await page.evaluate(()=>{const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),lum=a=>a.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);return ['.page-heading h1','.hero h2','.hero-location','.sidebar nav button.active','.topbar .today'].map(sel=>{let el=document.querySelector(sel),bg=el;while(bg&&rgb(getComputedStyle(bg).backgroundColor)[3]===0)bg=bg.parentElement;const a=lum(rgb(getComputedStyle(el).color)),b=lum(rgb(getComputedStyle(bg??document.documentElement).backgroundColor));return {sel,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});});for(const r of ratios)assert.ok(r.ratio>=4.5,JSON.stringify(r));
 await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.getByRole('button',{name:'添加竞赛',exact:true}).click();let form=page.locator('.event-form');await form.getByLabel('比赛名称',{exact:true}).fill('规则创建测试');
 await form.getByLabel('五子棋季军人数',{exact:true}).selectOption('1');await form.getByLabel('五子棋决赛',{exact:true}).selectOption('1');await form.getByLabel('军棋季军人数',{exact:true}).selectOption('0');
 await page.screenshot({path:'tmp/light-event-form.png',fullPage:true});await form.getByRole('button',{name:'下一步：确认创建'}).click();await page.getByRole('button',{name:'确认创建竞赛',exact:false}).click();await page.waitForURL('**event=event-new');
 assert.equal(lastRules.gomoku.rules.bronzeCount,1);assert.equal(lastRules.gomoku.rules.final,1);assert.equal(lastRules.junqi.rules.bronzeCount,0);assert.match(await page.locator('.sport-note').textContent(),/冠 · 亚 · 季/);
 await page.getByRole('button',{name:'赛事设置与备份',exact:true}).click();await page.getByRole('button',{name:/删除当前竞赛/}).click();const confirm=page.getByRole('button',{name:'确认删除此竞赛'});assert.equal(await confirm.isDisabled(),true);await page.getByLabel('输入完整比赛名称确认').fill('错误名称');assert.equal(await confirm.isDisabled(),true);await page.getByLabel('输入完整比赛名称确认').fill('规则创建测试');await confirm.click();await page.waitForURL('**event=hfut-2026');assert.equal(deleted,1);assert.equal(records.get('hfut-2026').state.tournaments.gomoku.players.length,16);
 await page.getByRole('button',{name:'赛事设置与备份',exact:true}).click();await page.getByRole('button',{name:/已删除竞赛/}).click();await page.getByRole('button',{name:'恢复竞赛',exact:true}).click();await page.waitForURL('**event=event-new');assert.equal(records.get('event-new').deleted,false);
 await page.getByRole('button',{name:'测试管理员',exact:false}).first().click();await page.getByRole('heading',{name:'Excel 批量创建裁判'}).waitFor();
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['姓名','邮箱'],['测试裁判甲','ref1@example.test'],['测试裁判乙','exists@example.test']]),'名单');
 await page.getByLabel('上传裁判 XLSX').setInputFiles({name:'referees.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(book,{type:'buffer',bookType:'xlsx'})});await page.getByRole('button',{name:'确认创建本批裁判'}).click();await page.getByText(/本批处理完成/).waitFor();assert.equal(created,2);assert.match(await page.locator('.bulk-referees').textContent(),/成功 1 人 · 失败 1 人/);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载账号结果 XLSX'}).click();const file=await download;const results=XLSX.utils.sheet_to_json(XLSX.read(await fs.readFile(await file.path())).Sheets['账号结果']);assert.equal(results[0].邮箱,'ref1@example.test');assert.equal(results[0].随机密码,'TEST-password-Only-234!');assert.equal(results[1].创建状态,'创建失败');assert.equal(results[1].随机密码,'');
 await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('button',{name:'切换为黑色主题'}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 console.log('PASS: current header clock, persistent light/dark themes with text contrast, creation rules, typed deletion/recovery, batch referee import, partial failures and XLSX credentials export.');
}finally{await browser.close();}
