import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {emptyState,emptyTournament,validateState} from '../src/engine.ts';
import {defaultEvent} from '../src/event-settings.ts';
import {prepareDraw,dispatchTables,tableKey} from '../src/scheduling.ts';
import {scheduleAction} from '../src/schedule-actions.ts';
const browser=await chromium.launch({channel:'msedge',headless:true});
let state=emptyState(),locked=true;
const referee={id:'floor-ref',role:'referee',display_name:'桌一裁判',email:'ref@example.test'};
const time=ms=>new Date(ms+8*3600000).toISOString().slice(0,16);
state.event={...defaultEvent(),startsAt:time(Date.now()-60000),endsAt:time(Date.now()+3600000)};
for(const sport of ['gomoku','junqi']){
 state.tournaments[sport]={...emptyTournament(sport),players:Array.from({length:16},(_,i)=>({id:sport+i,name:sport+'同学'+i,studentId:sport+i,college:'学院',gender:'',phone:'',qq:''}))};
 state=prepareDraw(state,sport,[],[],'fixture'+sport);
}
state.schedule.bindings={[referee.id]:[tableKey('gomoku',1)]};
state.schedule.running=true;state=dispatchTables(state);state=validateState(state);
const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'});
const errors=[];
await context.addInitScript(()=>{
 localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'floor-ref',last_sign_in_at:new Date().toISOString()}}));
});
await context.route('**/auth/v1/**',r=>r.fulfill({json:{user:{id:referee.id}}}));
await context.route('**/rest/v1/public_events*',r=>r.fulfill({json:{state}}));
await context.route('**/functions/v1/tournament',async r=>{
 const body=r.request().postDataJSON();
 if(body.action==='events')return r.fulfill({json:{events:[{id:'hfut-2026',...state.event}],serverNow:Date.now()}});
 if(body.action==='unlock-event'){
  if(body.password!=='TEST-ONLY-FLOOR')return r.fulfill({status:400,json:{error:'赛事密码错误'}});
  locked=false;return r.fulfill({json:{secret:'fixture-grant'}});
 }
 if(locked)return r.fulfill({json:{state:emptyState(),profile:referee,locked:true}});
 if(body.action==='schedule')state=scheduleAction(state,body.command);
 return r.fulfill({json:{state,profile:referee}});
});
await context.routeWebSocket('wss://**/*',ws=>ws.onMessage(()=>{}));
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4288/');
 await page.getByRole('heading',{name:'进入当前赛事'}).waitFor();
 await page.getByLabel('赛事密码').fill('wrong');await page.getByRole('button',{name:'验证并进入'}).click();
 await page.getByText('赛事密码错误',{exact:true}).waitFor();
 await page.getByLabel('赛事密码').fill('TEST-ONLY-FLOOR');await page.getByRole('button',{name:'验证并进入'}).click();
 await page.locator('.referee-matches>button').first().waitFor();
 assert.equal(await page.locator('.referee-matches>button').count(),1);
 const own=state.schedule.assignments.find(a=>a.sport==='gomoku'&&a.table===1);
 assert.ok((await page.locator('.referee-matches').innerText()).includes(own.match));
 await page.locator('.referee-sports').getByRole('button',{name:/军棋/}).click();
 assert.equal(await page.locator('.referee-matches>button').count(),0);
 await page.goto('http://127.0.0.1:4288/?screen=1&view=both');
 await page.getByRole('button',{name:'棋盘总览'}).click();
 await page.locator('.arena-floor .floor-tables button').nth(14).waitFor();
 for(const [width,height]of [[390,844],[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});
  assert.equal(await page.locator('.arena-floor .floor-tables button').count(),15);
  assert.ok(await page.locator('.arena-floor .floor-tables button').evaluateAll(items=>items.every(el=>{
   const r=el.getBoundingClientRect();return r.height>0&&r.bottom<=innerHeight&&r.right<=innerWidth;
  })));
  if(width===1920&&process.env.FLOOR_CAPTURE)await page.screenshot({path:process.env.FLOOR_CAPTURE});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: event password gate, incorrect password, binding-filtered referee list, all 15 tables on mobile/768p/1080p.');
}finally{await browser.close();}
