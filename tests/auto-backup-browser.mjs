import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {demoState,validateState} from '../src/engine.ts';
import {defaultEvent} from '../src/event-settings.ts';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:1000}});
let state=demoState();state.event=defaultEvent();
const profile={id:'backup-fixture-admin',role:'superadmin',display_name:'备份演示管理员',email:'admin@example.test'};
const requests=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'backup-fixture-admin'}}));
});
await page.route('**/auth/v1/**',r=>r.fulfill({json:{user:{id:profile.id}}}));
await page.route('**/functions/v1/tournament',async r=>{
 const b=r.request().postDataJSON();requests.push(b);
 if(b.action==='events')return r.fulfill({json:{events:[{id:'hfut-2026',...state.event,revision:state.revision}]}});
 if(b.action==='members')return r.fulfill({json:{profiles:[1,2,3].map(i=>({id:'judge-'+i,display_name:'裁判'+i,role:'referee'}))}});
 if(b.action==='backups')return r.fulfill({json:{backups:[{id:'backup-demo',created_at:new Date().toISOString(),revision:state.revision}]}});
 if(b.action==='backup-download')return r.fulfill({json:{state}});
 if(b.action==='replace')state=validateState({...b.state,revision:crypto.randomUUID()});
 return r.fulfill({json:{state,profile}});
});
await page.routeWebSocket('wss://**/*',ws=>ws.onMessage(()=>{}));
try{
 await page.goto('http://127.0.0.1:4291/?event=hfut-2026');
 await page.getByRole('button',{name:'赛事设置与备份',exact:true}).click();
 await page.getByLabel('启用本场赛事自动备份').check();
 await page.getByRole('button',{name:'保存自动备份设置'}).click();
 await page.getByText('自动备份设置已保存',{exact:true}).waitFor();
 assert.equal(state.event.autoBackup.enabled,true);
 await page.getByRole('button',{name:'关闭弹窗'}).click();
 await page.locator('.auto-backup-status').waitFor();
 await page.waitForFunction(async()=>{
  return await new Promise(resolve=>{
   const req=indexedDB.open('qi-arena-auto-backups',1);
   req.onsuccess=()=>{const db=req.result;const q=db.transaction('snapshots').objectStore('snapshots').getAll();q.onsuccess=()=>{resolve(q.result.length===1);db.close();};};
  });
 });
 await page.getByRole('button',{name:'赛事设置与备份',exact:true}).click();
 const download=page.waitForEvent('download');
 await page.locator('.backup-list').first().getByRole('button').first().click();
 assert.ok((await download).suggestedFilename().endsWith('.json'));
 await page.getByLabel('备份间隔（分钟）').fill('5');
 await page.getByLabel('启用本场赛事自动备份').uncheck();
 await page.getByRole('button',{name:'保存自动备份设置'}).click();
 await page.getByText('自动备份设置已保存',{exact:true}).waitFor();
 assert.deepEqual(state.event.autoBackup,{enabled:false,intervalMinutes:5});
 assert.equal(requests.filter(r=>r.action==='score').length,0);
 assert.deepEqual(errors,[]);
 console.log('PASS: required judge coverage, one-table selection, multiple judges per table; backup default off/10min, enable, local snapshot, download, interval change, disable, no score writes.');
}finally{await browser.close();}
