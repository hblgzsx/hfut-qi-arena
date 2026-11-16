import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {competitionDemo} from '../src/demo-fixtures.ts';
const state=competitionDemo(256),browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1920,height:1080}});
try{
await page.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/rest/v1/public_events*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({state})}));
await page.goto('http://127.0.0.1:4173/?screen=1&view=both');
await page.locator('.contest-player').nth(511).waitFor();
assert.equal(await page.locator('.contest-player').count(),512);
const check=()=>page.locator('.contest-player').evaluateAll(els=>els.every(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&b.top>=0&&b.bottom<=innerHeight&&b.right<=innerWidth}));
assert.equal(await check(),true);await fs.mkdir('tmp',{recursive:true});await page.screenshot({path:'tmp/competition-512-1080.png'});
await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(300);assert.equal(await check(),true);
assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);await page.screenshot({path:'tmp/competition-512-768.png'});
await page.getByRole('button',{name:'晋级树',exact:true}).click();await page.locator('.fit-bracket').first().waitFor();assert.equal(await page.locator('.fit-name').filter({hasText:/赵|钱|孙|李|周|吴|郑|王|冯|陈|褚|卫|蒋|沈|韩|杨|朱|秦|许|何|吕|施|张|孔|曹|严|华|金|魏|陶|姜|谢/}).count()>512,true);
await page.getByRole('button',{name:'退出展示',exact:true}).click();
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
console.log('PASS: all 512 names visible in dual sport contest board at 1080p and 768p; no scroll; bracket switch and mobile layout.');
}finally{await browser.close();}
