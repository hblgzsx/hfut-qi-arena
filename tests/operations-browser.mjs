import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {emptyState,emptyTournament,validateState} from '../src/engine.ts';
import {defaultEvent} from '../src/event-settings.ts';
import {emptySchedule,prepareDraw} from '../src/scheduling.ts';
import {scheduleAction} from '../src/schedule-actions.ts';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1366,height:950}});
let state=emptyState();state.event=defaultEvent();state.schedule=emptySchedule();state.schedule.counts={gomoku:1,junqi:1};state.schedule.bindings={j1:['gomoku:1'],j2:['junqi:1']};
for(const sp of ['gomoku','junqi']){state.tournaments[sp]={...emptyTournament(sp),players:Array.from({length:4},(_,i)=>({id:sp+i,name:sp+'选手'+i,studentId:sp+i,college:'测试学院',gender:'',phone:'',qq:''}))};state=prepareDraw(state,sp,[],[],'ops'+sp);}
const profile={id:'admin',role:'superadmin',display_name:'测试管理员'},members=['j1','j2','j3'].map((id,i)=>({id,role:'referee',display_name:'裁判'+(i+1),email:id+'@example.test'}));let commands=0;const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'admin'}})));
await page.route('**/auth/v1/**',r=>r.fulfill({json:{user:{id:'admin'}}}));
await page.route('**/functions/v1/tournament',r=>{const b=r.request().postDataJSON();if(b.action==='members')return r.fulfill({json:{profiles:members}});if(b.action==='events')return r.fulfill({json:{events:[{id:'operation-test',...state.event}],serverNow:Date.now()}});if(b.action==='schedule'){commands++;if(b.password!=='TEST-ONLY-EVENT')return r.fulfill({status:400,json:{error:'赛事密码错误'}});if(b.expectedRevision!==state.revision)return r.fulfill({status:409,json:{error:'现场已更新'}});state=validateState(scheduleAction(state,b.command));state.revision=crypto.randomUUID();}return r.fulfill({json:{state,profile}});});
await page.routeWebSocket('wss://**/*',ws=>ws.onMessage(()=>{}));
try{
 await page.goto('http://127.0.0.1:4291/?event=operation-test');await page.getByRole('button',{name:'现场调度',exact:true}).click();
 assert.equal(await page.getByLabel('当前赛事密码',{exact:true}).count(),0);
 await page.getByRole('button',{name:'开始 / 恢复自动叫号'}).click();let dialog=page.getByRole('dialog',{name:'确认现场修改'});await dialog.waitFor();assert.equal(commands,0);await dialog.getByRole('button',{name:'取消',exact:true}).click();assert.equal(commands,0);
 await page.getByRole('button',{name:'棋盘与裁判',exact:true}).click();await page.getByRole('button',{name:'五子棋 1 号桌添加裁判',exact:true}).click();await page.getByLabel('搜索可用裁判').fill('裁判3');await page.locator('.picker-results button').filter({hasText:'裁判3'}).click();await page.getByRole('button',{name:'完成添加',exact:true}).click();
 assert.equal(commands,0);await page.getByRole('button',{name:'保存棋盘与裁判绑定',exact:true}).click();dialog=page.getByRole('dialog',{name:'确认现场修改'});await dialog.waitFor();assert.equal(commands,0);
 await dialog.getByLabel('当前赛事密码',{exact:true}).fill('WRONG-PASSWORD');await dialog.getByLabel('本次修改原因').fill('增补一名裁判');await dialog.getByRole('button',{name:'验证并保存修改'}).click();await dialog.getByRole('alert').filter({hasText:'赛事密码错误'}).waitFor();assert.equal(state.schedule.bindings.j3,undefined);
 await dialog.getByLabel('当前赛事密码',{exact:true}).fill('TEST-ONLY-EVENT');await dialog.getByRole('button',{name:'验证并保存修改'}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual(state.schedule.bindings.j3,['gomoku:1']);assert.equal(commands,2);
 await page.getByRole('button',{name:'现场运行',exact:true}).click();await page.getByRole('button',{name:'开始 / 恢复自动叫号'}).click();dialog=page.getByRole('dialog',{name:'确认现场修改'});await dialog.getByLabel('当前赛事密码',{exact:true}).fill('TEST-ONLY-EVENT');await dialog.getByLabel('本次修改原因').fill('现场准备完成');await page.screenshot({path:'tmp/修改后再验证.png'});await dialog.getByRole('button',{name:'验证并保存修改'}).click();await dialog.waitFor({state:'hidden'});assert.equal(state.schedule.running,true);assert.equal(state.schedule.assignments.length,2);
 assert.equal(await page.getByLabel('当前赛事密码',{exact:true}).count(),0);assert.deepEqual(errors,[]);console.log('PASS: no upfront password form, editing and cancel make no mutations, password verified only after save, wrong password preserves state, successful changes dispatch only after confirmation.');
}finally{await browser.close();}
