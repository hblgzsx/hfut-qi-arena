import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {emptyState,emptyTournament,validateState} from '../src/engine.ts';
import {defaultEvent} from '../src/event-settings.ts';
import {prepareDraw,dispatchTables,tableKey} from '../src/scheduling.ts';
import {scheduleAction} from '../src/schedule-actions.ts';
const browser=await chromium.launch({channel:'msedge',headless:true});
let state=emptyState(),locked=true,adminMode=false;
const referee={id:'floor-ref',role:'referee',display_name:'桌一裁判',email:'ref@example.test'};
const time=ms=>new Date(ms+8*3600000).toISOString().slice(0,16);
state.event={...defaultEvent(),startsAt:time(Date.now()-60000),endsAt:time(Date.now()+3600000)};
for(const sport of ['gomoku','junqi']){
 state.tournaments[sport]={...emptyTournament(sport),players:Array.from({length:32},(_,i)=>({id:sport+i,name:i%3===0?'阿卜杜热合曼·测试长姓名':i%3===1?'王同学':sport+'同学'+i,studentId:sport+i,college:'学院',gender:'',phone:'',qq:''}))};
 state=prepareDraw(state,sport,[],[],'fixture'+sport);
}
state.schedule.bindings={[referee.id]:[tableKey('gomoku',1)]};
for(const sport of ['gomoku','junqi'])for(let table=1;table<=state.schedule.counts[sport];table++)if(sport!=='gomoku'||table!==1)state.schedule.bindings[sport+table]=[tableKey(sport,table)];
state.schedule.running=true;state=dispatchTables(state);state=validateState(state);
state.schedule.assignments[0].status='playing';
state.schedule.assignments=state.schedule.assignments.filter(a=>a.sport!=='junqi'||a.table!==5);
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
 if(body.action==='members')return r.fulfill({json:{profiles:[]}});
 if(body.action==='unlock-event'){
  if(body.password!=='TEST-ONLY-FLOOR')return r.fulfill({status:400,json:{error:'赛事密码错误'}});
  locked=false;return r.fulfill({json:{secret:'fixture-grant'}});
 }
 if(locked)return r.fulfill({json:{state:emptyState(),profile:referee,locked:true}});
 if(body.action==='schedule')state=scheduleAction(state,body.command);
 return r.fulfill({json:{state,profile:adminMode?{...referee,role:'superadmin'}:referee}});
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
 for(const [width,height]of [[390,844],[844,390],[1280,720],[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.arena-floor .floor-tables button').count(),15);
  assert.ok(await page.locator('.arena-floor .floor-tables button').evaluateAll(items=>items.every(el=>{
   const r=el.getBoundingClientRect();return r.height>=30&&r.bottom<=innerHeight&&r.right<=innerWidth;
  })));
  const overflow=await page.locator('.arena-floor .floor-card').evaluateAll(items=>items.flatMap(card=>{
   const bounds=card.getBoundingClientRect();return [...card.querySelectorAll('.floor-card-body,.floor-card-body>*')].flatMap(el=>{const r=el.getBoundingClientRect();return r.left<bounds.left-1||r.top<bounds.top-1||r.right>bounds.right+1||r.bottom>bounds.bottom+1?[{text:el.textContent,card:bounds.toJSON(),element:r.toJSON()}]:[];});
  }));assert.deepEqual(overflow,[],`${width}x${height}: text exceeds table card`);
  assert.ok(await page.locator('.floor-card-body').evaluateAll(items=>items.every(el=>el.scrollHeight<=el.clientHeight+1)),`${width}x${height}: card content clipped vertically`);
  assert.ok(await page.locator('.floor-card-duel').evaluateAll(items=>items.every(el=>el.clientHeight>=parseFloat(getComputedStyle(el).fontSize))),`${width}x${height}: names squeezed by metadata`);
  assert.ok(await page.locator('.floor-card-duel>span').evaluateAll(items=>items.every(el=>getComputedStyle(el).textOverflow==='ellipsis'&&getComputedStyle(el).whiteSpace==='nowrap')));
  if(process.env.FLOOR_OUTPUT){await fs.mkdir(process.env.FLOOR_OUTPUT,{recursive:true});await page.screenshot({path:process.env.FLOOR_OUTPUT+`/棋盘总览-${width}x${height}.png`});}
  if(width===1920&&process.env.FLOOR_CAPTURE)await page.screenshot({path:process.env.FLOOR_CAPTURE});
 }
 await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));if(process.env.FLOOR_OUTPUT)await page.screenshot({path:process.env.FLOOR_OUTPUT+'/棋盘总览-白色.png'});
 adminMode=true;await page.goto('http://127.0.0.1:4288/?event=hfut-2026');await page.getByRole('button',{name:'现场调度',exact:true}).click();await page.locator('.floor-panel .floor-card').nth(14).waitFor();
 for(const [width,height]of [[1366,768],[390,844]]){await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const clipped=await page.locator('.floor-panel .floor-card').evaluateAll(items=>items.filter(el=>{const card=el.getBoundingClientRect();return [...el.querySelectorAll('.floor-card-body>*')].some(child=>{const r=child.getBoundingClientRect();return r.right>card.right+1||r.bottom>card.bottom+1||r.left<card.left-1||r.top<card.top-1;});}).map(el=>el.textContent));assert.deepEqual(clipped,[],`admin ${width}: text overflow`);}
 assert.deepEqual(errors,[]);
 console.log('PASS: event password gate, binding-filtered referee list; 15 visible tables; long names, called/playing/idle text contained at 390x844, 844x390, 720p/768p/1080p.');
}finally{await browser.close();}
