import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { demoState,buildBracket,setResult } from '../src/engine.ts';
let state=demoState();
const original=structuredClone(state),t=state.tournaments.gomoku,m=buildBracket(t).flat().find(m=>m.ready&&!m.resolved);
const next=structuredClone(state);
next.tournaments.gomoku=setResult(t,m.id,{kind:'played',games:['A'],first:'A',reason:'',referee:'测试裁判',updatedAt:new Date().toISOString()});
next.revision=crypto.randomUUID();
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768}});const page=await context.newPage();
try {
 await context.addInitScript(()=>{
  localStorage.setItem('qi-arena-speech-v1',JSON.stringify({enabled:true,voice:'',style:'standard',duration:8}));
  window.__speeches=[];window.__popups=0;
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  let timer;
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'Microsoft Huihui',voiceURI:'huihui',lang:'zh-CN',localService:true}],addEventListener(){},removeEventListener(){},cancel(){clearTimeout(timer);},speak(u){window.__speeches.push(u.text);timer=setTimeout(()=>u.onend?.(),30000);}}});
  document.addEventListener('DOMContentLoaded',()=>new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n instanceof Element){if(n.matches('.result-broadcast'))window.__popups++;window.__popups+=n.querySelectorAll('.result-broadcast').length;}}).observe(document.body,{childList:true,subtree:true}));
 });
 await context.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/rest/v1/public_events*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({state})}));
 await page.goto('http://127.0.0.1:4173/?screen=1&view=both');
 await page.locator('.arena-clock').getByText('云端已同步',{exact:true}).waitFor();
 const second=await context.newPage();await second.goto('http://127.0.0.1:4173/?screen=1&view=both');await second.locator('.arena-clock').getByText('云端已同步',{exact:true}).waitFor();
 const controller=await context.newPage();await controller.goto('http://127.0.0.1:4173/');await controller.locator('.local-badge').getByText('云端已同步',{exact:true}).waitFor();
 next.tournaments.gomoku.results[m.id].updatedAt=new Date().toISOString();state=next;await second.evaluate(()=>window.dispatchEvent(new Event('online')));await controller.evaluate(()=>window.dispatchEvent(new Event('online')));await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 let popup=page.getByRole('dialog',{name:'赛果播报'});
 await popup.waitFor();await page.waitForTimeout(300);if(await second.evaluate(()=>window.__speeches.length))popup=second.getByRole('dialog',{name:'赛果播报'});
 assert.equal(await page.evaluate(()=>window.__speeches.length)+await second.evaluate(()=>window.__speeches.length),1);assert.equal(await controller.evaluate(()=>window.__speeches.length),0);
 // Same result arrives with changed non-result metadata, then stale and current snapshots.
 state=structuredClone(next);state.tournaments.gomoku.results[m.id].referee='';
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(300);
 state=original;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(300);
 state=next;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForTimeout(23000);assert.equal(await popup.count(),1,'Long speech must remain in the SAME popup');
 assert.equal(await page.evaluate(()=>window.__speeches.length)+await second.evaluate(()=>window.__speeches.length),1);assert.equal(await controller.evaluate(()=>window.__speeches.length),0);
 await popup.waitFor({state:'detached',timeout:15000});
 await page.waitForTimeout(3000);
 assert.equal(await page.evaluate(()=>window.__popups),1,'Repeated snapshots must not reopen popup');
 assert.equal(await page.evaluate(()=>window.__speeches.length)+await second.evaluate(()=>window.__speeches.length),1);assert.equal(await controller.evaluate(()=>window.__speeches.length),0);
 assert.equal(await popup.count(),0);
 // A new server timestamp with the same actual score must not repeat speech.
 state=structuredClone(next);state.tournaments.gomoku.results[m.id].updatedAt='2030-01-01T00:00:00.000Z';state.revision=crypto.randomUUID();
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(2500);
 assert.equal(await page.evaluate(()=>window.__speeches.length)+await second.evaluate(()=>window.__speeches.length),1);
 await page.getByRole('button',{name:'关闭赛果播报'}).click();
 assert.equal(await page.getByRole('button',{name:'跳过后续演示播报'}).count(),0);
  console.log('PASS: repeated/stale/metadata snapshots produce exactly one popup per display and one utterance across two screens; controller is silent; 30-second voice finishes inside that popup.');
} finally {await browser.close();}
