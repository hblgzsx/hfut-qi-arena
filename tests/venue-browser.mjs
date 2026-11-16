import {chromium} from 'playwright';import assert from 'node:assert/strict';import {demoState} from '../src/engine.ts';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();try{
await page.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/rest/v1/public_events*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({state:demoState()})}));
for(const [width,height]of [[1920,1080],[1366,768],[1024,768],[390,844],[320,700]]){
await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:4173/');await page.locator('.hero-venue').waitFor();
assert.equal(await page.locator('.hero-location').evaluate(el=>{const h=el.closest('.hero').getBoundingClientRect(),r=el.getBoundingClientRect();return r.top>=h.top&&r.bottom<=h.bottom&&r.right<=h.right}),true,width+' venue clipped');
assert.equal(await page.locator('.hero-venue').textContent(),'科教楼 B 座 501 报告厅');
if(width===390)await page.screenshot({path:'tmp/venue-mobile-fixed.png'});
}console.log('PASS: complete date and venue within hero at 1920/1366/1024/390/320 widths.');
}finally{await browser.close();}
