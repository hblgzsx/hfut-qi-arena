import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {emptyState,emptyTournament,draw,buildBracket,setResult,standings,validateState} from '../src/engine.ts';
import {applyCloudScore} from '../src/cloud-policy.ts';
let state=emptyState(),submissions=0;
state.tournaments.gomoku=draw({...emptyTournament('gomoku'),players:Array.from({length:4},(_,i)=>({id:'p'+i,name:'选手'+i,studentId:'000'+i,college:'学院',phone:'',qq:'',gender:''}))},'rules-browser');
const profile={id:'test-admin',role:'superadmin',email:'test@example.test',display_name:'测试管理员'};
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
try{
 await context.addInitScript(()=>localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'test-admin',last_sign_in_at:new Date().toISOString()}})));
 await context.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/auth/v1/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({user:{id:profile.id,email:profile.email}})}));
 await context.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/functions/v1/tournament',async r=>{const b=r.request().postDataJSON();if(b.action==='replace'){state=validateState(b.state);state.revision=crypto.randomUUID();}if(b.action==='score'){state=applyCloudScore(state,b,'admin',profile.display_name);submissions++;}await r.fulfill({contentType:'application/json',body:JSON.stringify({state,profile,events:[]})});});
 await page.goto('http://127.0.0.1:4173/');await page.getByRole('button',{name:'竞赛规则',exact:true}).click();await page.getByRole('button',{name:'配置赛制与季军人数'}).click();
 const modal=page.getByRole('dialog');await modal.getByLabel('季军人数',{exact:true}).selectOption('1');await modal.getByLabel('半决赛',{exact:true}).selectOption('1');await modal.locator('summary').click();await modal.getByLabel('R1-M1赛制',{exact:true}).selectOption('3');
 await modal.getByRole('button',{name:'保存赛制与奖项'}).click();await modal.waitFor({state:'detached'});
 assert.deepEqual(buildBracket(state.tournaments.gomoku)[0].map(m=>m.bestOf),[3,1]);assert.ok(buildBracket(state.tournaments.gomoku).flat().find(m=>m.id==='BRONZE'));
 await page.getByRole('button',{name:'晋级对阵',exact:false}).first().click();
 // First BO3 semifinal records two wins; UI uses the configured match target.
 await page.locator('.match-card.ready').first().click();await page.getByPlaceholder('填写裁判姓名').fill('裁判');await page.getByRole('button',{name:'A 方胜',exact:true}).click();await page.getByRole('button',{name:'A 方胜',exact:true}).click();await page.getByRole('button',{name:'保存并展示晋级'}).click();
 assert.equal(submissions,1);assert.equal(buildBracket(state.tournaments.gomoku)[0][0].resolved,true);
 // Finish the other semifinal, then verify the playoff appears as a separate scorable match.
 const t=state.tournaments.gomoku,m=buildBracket(t)[0][1];state={...state,revision:crypto.randomUUID(),tournaments:{...state.tournaments,gomoku:setResult(t,m.id,{kind:'played',games:['A'],first:'A',referee:'裁判',reason:'',updatedAt:new Date().toISOString()})}};
 await page.reload();await page.getByRole('button',{name:'竞赛规则',exact:true}).click();await page.getByRole('button',{name:'配置赛制与季军人数'}).click();assert.equal(await page.getByLabel('季军人数',{exact:true}).isDisabled(),true);await page.locator('summary').click();assert.equal(await page.getByLabel('R1-M1赛制',{exact:true}).isDisabled(),true);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 const screen=await context.newPage();await screen.goto('http://127.0.0.1:4173/?screen=1');await screen.getByRole('button',{name:'晋级树',exact:true}).click();await screen.locator('.arena-bronze').waitFor();assert.equal(await screen.locator('.arena-bronze').isEnabled(),true);await screen.screenshot({path:'tmp/bronze-playoff-screen.png'});await screen.close();
 await page.getByRole('button',{name:'录入成绩',exact:true}).click();const row=page.locator('.record-list>button').filter({hasText:'BRONZE'});await row.click();await page.getByPlaceholder('填写裁判姓名').fill('裁判');await page.getByRole('button',{name:'A 方胜',exact:true}).click();await page.getByRole('button',{name:'A 方胜',exact:true}).click();await page.getByRole('button',{name:'保存并展示晋级'}).click();
 assert.equal(submissions,2);assert.equal(standings(state.tournaments.gomoku).bronze.length,1);assert.equal(standings(state.tournaments.gomoku).champion,null);
 await page.getByRole('button',{name:'荣誉与奖品',exact:true}).click();assert.match(await page.locator('.prizes-intro').textContent(),/季军 1 名/);assert.match(await page.locator('.prize-rank').last().textContent(),/1 WINNER/);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'竞赛规则',exact:true}).click();await page.getByRole('button',{name:'配置赛制与季军人数'}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'tmp/rules-config-mobile.png',fullPage:true});
 console.log('PASS: rules configure per round and per match, BO3 UI, locked scores/awards, independent bronze scoring and screen, correct podium, mobile layout.');
}finally{await browser.close();}
