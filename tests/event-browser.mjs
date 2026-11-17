import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {demoState,validateState} from '../src/engine.ts';
let state=validateState(demoState()),saves=0,creates=0;const records=new Map();const profile={id:'test-admin',email:'admin@example.test',role:'superadmin',display_name:'测试管理员'};
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
try{
 await context.addInitScript(()=>localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'test-admin',last_sign_in_at:new Date().toISOString()}})));
 await context.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/auth/v1/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({user:{id:profile.id,email:profile.email}})}));
 await context.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/functions/v1/tournament',async r=>{const b=r.request().postDataJSON();if(b.action==='events'){await r.fulfill({contentType:'application/json',body:JSON.stringify({events:[{id:'hfut-2026',name:'原竞赛'},{id:'event-test',name:'全新正式竞赛'}]})});return;}if(b.action==='create-event'){records.set('hfut-2026',structuredClone(state));records.set('event-test',b.state);creates++;await r.fulfill({contentType:'application/json',body:JSON.stringify({eventId:'event-test',state:b.state})});return;}if(b.eventId==='event-test')state=records.get('event-test');if(b.action==='replace'){assert.equal(b.expectedRevision,state.revision);state=b.state;state.revision=crypto.randomUUID();saves++;}await r.fulfill({contentType:'application/json',body:JSON.stringify({state,profile})});});
 await page.goto('http://127.0.0.1:4173/');await page.getByRole('button',{name:'添加竞赛',exact:true}).waitFor();
 await page.getByRole('button',{name:'赛事设置与备份',exact:true}).click();await page.getByRole('button',{name:/编辑竞赛信息/}).click();
 let form=page.locator('.event-form');await form.getByLabel('比赛名称',{exact:true}).fill('春季研究生棋类竞赛');await form.getByLabel('比赛地点',{exact:true}).fill('学术报告厅 201');
 await form.getByLabel('开始时间（北京时间）').fill('2027-03-21T09:00');await form.getByLabel('结束时间（北京时间）').fill('2027-03-21T17:00');
 await form.getByLabel('其他举办学院').fill('数学学院');await form.getByRole('button',{name:'添加学院',exact:true}).click();
 const old=JSON.stringify(state.tournaments);await form.getByRole('button',{name:'保存竞赛信息'}).click();await form.waitFor({state:'detached'});
 assert.equal(saves,1);assert.equal(JSON.stringify(state.tournaments),old);assert.ok(state.event.colleges.includes('数学学院'));
 assert.equal(await page.locator('.hero-venue').textContent(),'学术报告厅 201');assert.match(await page.locator('.breadcrumb').textContent(),/春季研究生棋类竞赛/);
 await page.reload();await page.locator('.hero-venue').getByText('学术报告厅 201').waitFor();
 const screen=await context.newPage();await screen.goto('http://127.0.0.1:4173/?screen=1');await screen.locator('.arena-title h1').getByText('春季研究生棋类竞赛',{exact:false}).waitFor();assert.match(await screen.locator('.arena-title').textContent(),/学术报告厅 201/);await screen.close();
 await page.getByRole('button',{name:'添加竞赛',exact:true}).click();form=page.locator('.event-form');await form.getByLabel('比赛名称',{exact:true}).fill('全新正式竞赛');await form.getByRole('button',{name:'下一步：确认创建'}).click();
 assert.equal(saves,1,'No reset before confirmation');await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(state.tournaments.gomoku.players.length,16);
 await form.getByRole('button',{name:'下一步：确认创建'}).click();await page.getByRole('button',{name:'确认创建竞赛',exact:false}).click();await page.waitForURL('**event=event-test');await page.locator('.hero-venue').waitFor();
 assert.equal(saves,1);assert.equal(creates,1);assert.equal(records.get('hfut-2026').tournaments.gomoku.players.length,16);assert.equal(state.event.name,'全新正式竞赛');assert.equal(state.tournaments.gomoku.players.length,0);assert.equal(state.tournaments.junqi.players.length,0);assert.equal(state.tournaments.gomoku.demo,false);
 console.log('PASS: edit preserves scores; colleges/time/venue persist and reach display; new competition requires confirmation then starts independently without overwriting history.');
}finally{await browser.close();}
