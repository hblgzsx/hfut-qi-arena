import {chromium} from 'playwright';import assert from 'node:assert/strict';import {demoState} from '../src/engine.ts';
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
const profile={id:'admin',role:'superadmin',display_name:'管理员',email:'test@example.test'};let state=demoState();
try{
 await context.addInitScript(()=>localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'test',refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'admin'}})));
 await context.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/auth/v1/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({user:{id:'admin'}})}));
 await context.route('https://nwvxamfgfbqbmamqfjcr.supabase.co/functions/v1/tournament',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({state,profile,events:[]})}));
 await page.goto('http://127.0.0.1:4173/');await page.getByRole('button',{name:'颁奖背景 / PPTX'}).click();
 await page.getByRole('option',{name:'第 5 / 5 页',exact:true}).waitFor({state:'attached',timeout:30000});await page.getByText('内置颁奖模板.pptx',{exact:true}).waitFor();
 await page.getByLabel('上传背景 PPTX').setInputFiles('public/backgrounds/awards.pptx');await page.getByRole('option',{name:'第 5 / 5 页',exact:true}).waitFor({state:'attached',timeout:30000});
 await page.getByLabel('背景页码').selectOption('3');await page.getByLabel('PPTX 背景预览').getByText('军棋 · 荣耀颁奖',{exact:true}).waitFor();
 assert.ok(await page.locator('.pptx-preview-slide-wrapper').evaluate(el=>el.getBoundingClientRect().width)>1000,'Presentation must fill the display');await page.screenshot({path:'tmp/pptx-awards-screen.png'});
 await page.getByRole('button',{name:'下一页',exact:true}).click();await page.getByLabel('PPTX 背景预览').getByText('五子棋 · 荣耀颁奖',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'下一页',exact:true}).isDisabled(),true);
 await page.keyboard.press('ArrowLeft');assert.equal(await page.getByLabel('背景页码').inputValue(),'3');
 await page.getByRole('button',{name:'退出展示',exact:true}).click();await page.getByRole('button',{name:'颁奖背景 / PPTX'}).click();await page.getByRole('option',{name:'第 5 / 5 页',exact:true}).waitFor({state:'attached'});
 await page.reload();await page.getByRole('button',{name:'颁奖背景 / PPTX'}).click();await page.getByRole('option',{name:'第 5 / 5 页',exact:true}).waitFor({state:'attached'});
 await page.getByText('awards.pptx',{exact:true}).waitFor();
 await page.getByLabel('上传背景 PPTX').setInputFiles({name:'bad.pptx',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});await page.locator('.backdrop-error').waitFor();
 console.log('PASS: five-slide PPTX upload, military/gomoku awards rendering, page navigation, keyboard, local persistence and invalid-file feedback.');
}finally{await browser.close();}
