import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {emptyState} from '../src/engine.ts';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'admin'}})));
await page.route('**/auth/v1/**',r=>r.fulfill({json:{user:{id:'admin'}}}));
await page.routeWebSocket('wss://**/*',ws=>ws.onMessage(()=>{}));
await page.route('**/functions/v1/tournament',r=>{const b=r.request().postDataJSON();requests.push(b);if(b.action==='events')return r.fulfill({json:{events:[]}});if(b.action==='members')return r.fulfill({json:{profiles:[{id:'judge',display_name:'测试裁判',email:'judge@example.test',role:'referee'}]}});return r.fulfill({json:{state:emptyState(),unavailable:true,profile:{id:'admin',display_name:'测试管理员',role:'superadmin'}}});});
const studio=page.getByRole('dialog',{name:'创建竞赛工作室'});
async function open(){await page.getByRole('button',{name:'创建新竞赛',exact:true}).click();await studio.waitFor();}
try{
 await page.goto('http://127.0.0.1:4291/');await open();await page.getByLabel('比赛名称',{exact:true}).fill('未完成创建测试');await page.getByLabel('比赛地点',{exact:true}).fill('保留测试地点');await page.getByLabel('创建赛事密码',{exact:true}).fill('TEST-EVENT-PASSWORD');await page.getByLabel('确认创建赛事密码',{exact:true}).fill('TEST-EVENT-PASSWORD');
 await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByLabel('五子棋棋盘数',{exact:true}).fill('2');
 await page.getByRole('button',{name:'五子棋 1 号桌添加裁判',exact:true}).click();await page.getByLabel('搜索可用裁判').fill('测试裁判');await page.locator('.picker-results button').filter({hasText:'测试裁判'}).click();await page.getByRole('button',{name:'完成添加',exact:true}).click();assert.equal(await studio.count(),1);assert.equal(await page.getByRole('region',{name:'添加负责裁判'}).count(),0);assert.equal(await studio.locator('.judge-chips').getByText('测试裁判',{exact:true}).count(),1);
 await page.getByRole('button',{name:'五子棋 2 号桌添加裁判',exact:true}).click();await page.getByLabel('搜索可用裁判').press('Escape');assert.equal(await studio.count(),1);assert.equal(await page.getByRole('region',{name:'添加负责裁判'}).count(),0);
 await studio.press('Escape');assert.equal(await studio.count(),1);
 await page.locator('.workspace-overlay').dispatchEvent('mousedown');assert.equal(await studio.count(),1);
 await studio.getByRole('button',{name:'关闭弹窗'}).click();await open();assert.equal(await page.getByLabel('五子棋棋盘数',{exact:true}).inputValue(),'2');assert.equal(await studio.locator('.judge-chips').getByText('测试裁判',{exact:true}).count(),1);
 await page.getByRole('button',{name:'赛事信息',exact:true}).click();assert.equal(await page.getByLabel('比赛名称',{exact:true}).inputValue(),'未完成创建测试');assert.equal(await page.getByLabel('比赛地点',{exact:true}).inputValue(),'保留测试地点');assert.equal(await page.getByLabel('创建赛事密码',{exact:true}).inputValue(),'TEST-EVENT-PASSWORD');
 const stored=await page.evaluate(()=>localStorage.getItem('qi-event-creation-draft-v1:admin'));assert.ok(stored);assert.equal(stored.includes('TEST-EVENT-PASSWORD'),false);
 await page.reload();await open();assert.equal(await page.getByLabel('比赛名称',{exact:true}).inputValue(),'未完成创建测试');assert.equal(await page.getByLabel('创建赛事密码',{exact:true}).inputValue(),'');await page.getByLabel('创建赛事密码',{exact:true}).fill('TEST-NEW-PASSWORD');await page.getByLabel('确认创建赛事密码',{exact:true}).fill('TEST-NEW-PASSWORD');await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'下一步',exact:true}).click();assert.equal(await page.getByLabel('五子棋棋盘数',{exact:true}).inputValue(),'2');assert.equal(await studio.locator('.judge-chips').getByText('测试裁判',{exact:true}).count(),1);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'五子棋 2 号桌添加裁判',exact:true}).click();await page.getByRole('button',{name:'完成添加',exact:true}).click();assert.equal(await studio.count(),1);
 assert.equal(requests.filter(b=>b.action==='create-event').length,0);assert.deepEqual(errors,[]);console.log('PASS: finish adding referee stays in wizard desktop/mobile; nested Escape isolation; outer backdrop protection; close/reopen retains all fields and bindings; refresh restores nonsecret draft; password never persisted; no accidental creation.');
}finally{await browser.close();}
