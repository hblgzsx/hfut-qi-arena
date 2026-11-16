import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {demoState} from '../src/engine.ts';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:900}});
let state=demoState(),reads=0,saves=0;
const profile={id:'test-superadmin',role:'superadmin',email:'test@example.test',display_name:'测试管理员'};
try{
 await page.addInitScript(()=>localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'test-superadmin',email:'test@example.test',last_sign_in_at:new Date().toISOString()}})));
 await page.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/auth/v1/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({user:{id:profile.id,email:profile.email}})}));
 await page.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/functions/v1/tournament',async r=>{
  const b=r.request().postDataJSON();
  if(b.action==='replace'){assert.equal(b.expectedRevision,state.revision);state=b.state;state.revision=crypto.randomUUID();saves++;}else reads++;
  await r.fulfill({contentType:'application/json',body:JSON.stringify({state,profile})});
 });
 await page.goto('http://127.0.0.1:4173/');
 await page.locator('.local-badge').getByText('云端已同步',{exact:true}).waitFor();
 const badge=page.locator('.sidebar-university img');
 assert.equal(await badge.evaluate(img=>img.complete&&img.naturalWidth>0),true);
 await page.getByRole('button',{name:'荣誉与奖品',exact:true}).click();
 const card=page.locator('.prize-card').first();
 await card.getByRole('button',{name:/编辑奖品/}).click();
 await card.getByLabel('奖品名称').fill('图片持久化测试奖品');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=800;const x=c.getContext('2d');x.fillStyle='#efb64b';x.fillRect(0,0,1200,800);return c.toDataURL('image/png').split(',')[1];});
 const upload={name:'prize.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
 await card.locator('input[type=file]').setInputFiles(upload);
 await card.locator('.prize-visual img').waitFor();
 const image=await card.locator('.prize-visual img').getAttribute('src');
 assert.ok(image.startsWith('data:image/'));
 const before=reads;
 await page.waitForTimeout(11500);
 assert.ok(reads>before,'Real 10-second cloud polling must run during editing');
 assert.equal(await card.locator('.prize-visual img').getAttribute('src'),image,'Polling must preserve image draft');
 assert.equal(await card.getByLabel('奖品名称').inputValue(),'图片持久化测试奖品');
 // Selecting the same file a second time must work.
 await card.getByRole('button',{name:'移除图片'}).click();
 await card.locator('input[type=file]').setInputFiles(upload);
 await card.locator('.prize-visual img').waitFor();
 await card.getByRole('button',{name:'保存奖品',exact:true}).click();
 await card.getByRole('button',{name:/编辑奖品/}).waitFor();
 assert.equal(saves,1);assert.equal(state.prizes.gomoku[0].image,image);
 await page.waitForTimeout(10500);
 assert.equal(await card.locator('.prize-visual img').getAttribute('src'),image,'Saved image survives polling');
 await page.reload();await page.getByRole('button',{name:'荣誉与奖品',exact:true}).click();
 await page.locator('.prize-card').first().locator('.prize-visual img').waitFor();
 assert.equal(await page.locator('.prize-card').first().locator('.prize-visual img').getAttribute('src'),image,'Saved image survives reload');
 await page.screenshot({path:'tmp/prize-persistent.png',fullPage:true});
 console.log('PASS: badge loads; image and text survive live polling while editing, same-file reupload works, saved image survives polling and reload.');
}finally{await browser.close();}
