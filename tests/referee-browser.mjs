import {chromium} from 'playwright';import assert from 'node:assert/strict';import {demoState} from '../src/engine.ts';import {defaultEvent} from '../src/event-settings.ts';import {applyCloudScore} from '../src/cloud-policy.ts';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:390,height:844}});let state=demoState(),submissions=0;const profile={id:'test-referee',role:'referee',email:'ref@example.test',display_name:'测试裁判'};
const beijing=ms=>new Date(ms+8*3600000).toISOString().slice(0,16);state.event={...defaultEvent(),startsAt:beijing(Date.now()-3600000),endsAt:beijing(Date.now()+3600000)};let active=true;
try{
await page.addInitScript(()=>{localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'test-referee',email:'ref@example.test',last_sign_in_at:new Date().toISOString()}}));});
await page.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/auth/v1/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({user:{id:profile.id,email:profile.email}})}));
await page.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/functions/v1/tournament',async r=>{const b=r.request().postDataJSON();if(b.action==='events'){await r.fulfill({contentType:'application/json',body:JSON.stringify({serverNow:Date.now(),events:active?[{id:'hfut-2026',...state.event}]:[]})});return;}if(b.action==='score'){state=applyCloudScore(state,b,'referee',profile.display_name);submissions++;}await r.fulfill({contentType:'application/json',body:JSON.stringify({state,profile})});});
await page.goto('http://127.0.0.1:4173/');await page.getByText('裁判录分台',{exact:true}).waitFor();
assert.equal(await page.locator('.sidebar').count(),0);assert.equal(await page.getByRole('button',{name:'播报队列：关',exact:true}).count(),1);
assert.equal(await page.getByRole('button',{name:/赛事设置与备份/}).count(),0);
await page.getByPlaceholder('姓名、学号或场次').fill('不存在');assert.equal(await page.getByText('没有匹配的对局').count(),1);
await page.getByPlaceholder('姓名、学号或场次').fill('');await page.locator('.referee-matches>button').first().click();
await page.getByRole('button',{name:'A 方胜',exact:true}).click();assert.equal(await page.getByPlaceholder('填写裁判姓名').getAttribute('readonly'),'');
await page.getByRole('button',{name:'保存并返回待录列表'}).click();await page.getByText('录入本场赛果',{exact:true}).waitFor();assert.equal(submissions,1);
assert.equal(await page.getByRole('dialog',{name:'赛果播报'}).count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.screenshot({path:'tmp/referee-focused-mobile.png',fullPage:true});
await page.getByRole('button',{name:/已结束/}).first().click();assert.ok(await page.locator('.referee-matches>button:disabled').count());
active=false;await page.reload();await page.getByRole('heading',{name:'暂无进行中的竞赛'}).waitFor();assert.equal(await page.locator('.referee-matches').count(),0);assert.equal(await page.getByRole('button',{name:'查看现场大屏'}).count(),0);
console.log('PASS: referee dedicated mobile workspace, default queue off, search, locked identity, score save returns to list, finished matches readonly, no horizontal overflow.');
}finally{await browser.close();}
