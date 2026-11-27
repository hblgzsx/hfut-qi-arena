import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {demoState} from '../src/engine.ts';
import {defaultEvent} from '../src/event-settings.ts';
import {prepareDraw,dispatchTables,emptySchedule} from '../src/scheduling.ts';
const browser=await chromium.launch({channel:'msedge',headless:true});
const beijing=ms=>new Date(ms+8*3600000).toISOString().slice(0,16);
let state=demoState();state.event={...defaultEvent(),startsAt:beijing(Date.now()-3600000),endsAt:beijing(Date.now()+3600000)};
state.schedule=emptySchedule();state.schedule.bindings={judge:['gomoku:1'],other:['gomoku:2']};
state=prepareDraw(state,'gomoku',[],[],'roles');state=prepareDraw(state,'junqi',[],[],'roles-j');state.schedule.running=true;state=dispatchTables(state);
const adminLabels=['赛事设置与备份','添加竞赛','操作记录','现场调度','抽签','导出记录','导出记录 PDF','参赛选手'];
try{
 for(const role of ['public','pending','referee']){
  const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
  const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(role!=='public')await page.addInitScript(()=>localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'judge'}})));
  const profile={id:'judge',display_name:'负责一桌裁判',email:'judge@example.test',role};
  await page.route('**/auth/v1/**',r=>r.fulfill({json:{user:{id:'judge'}}}));
  await page.route('**/rest/v1/public_events**',r=>r.fulfill({json:{state}}));
  await page.route('**/functions/v1/tournament',r=>{const b=r.request().postDataJSON();requests.push(b);return r.fulfill({json:b.action==='events'?{events:[{id:'hfut-2026',...state.event}],serverNow:Date.now()}:{state,profile}});});
  await page.routeWebSocket('wss://**/*',ws=>ws.onMessage(()=>{}));
  await page.goto('http://127.0.0.1:4291/?event=hfut-2026');
  if(role==='referee'){
   await page.getByText('裁判录分台',{exact:true}).waitFor();
   await page.locator('.referee-matches>button').first().waitFor();
   assert.equal(await page.locator('.referee-matches>button').count(),1);
   await page.getByRole('button',{name:/账号/}).click();
   assert.equal(await page.getByRole('heading',{name:'创建裁判账号',exact:true}).count(),0);
  }else{
   await page.getByRole('button',{name:'棋盘现场总览',exact:true}).waitFor();
   await page.getByRole('button',{name:'晋级对阵',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'录入成绩',exact:true}).count(),0);
   await page.getByRole('button',{name:role==='public'?'邮箱登录':'负责一桌裁判',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:/注册|申请/}).count(),0);
  }
  for(const label of adminLabels)assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),0,role+': '+label);
  assert.equal(requests.some(r=>['members','backups','audit'].includes(r.action)),false);
  assert.equal(await page.locator('.credential-export').count(),0);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: public/pending/referee cannot see admin tools or registration, no privileged API requests; referee sees only own table.');
}finally{await browser.close();}
