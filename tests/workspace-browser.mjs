import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {demoState,emptyState,validateState} from '../src/engine.ts';
import {defaultEvent} from '../src/event-settings.ts';
import {emptySchedule,SPORTS,tableKey,prepareDraw,dispatchTables} from '../src/scheduling.ts';
const output=process.env.WORKSPACE_OUTPUT||'output/pdf';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
let members=[['j1','裁判甲'],['j2','裁判乙'],['j3','裁判丙']].map(([id,display_name])=>({id,display_name,email:id+'@example.test',role:'referee'}));
const state1=demoState();state1.event={...defaultEvent(),name:'现场资料验证赛事'};state1.schedule=emptySchedule();
for(const sp of SPORTS)for(let i=1;i<=state1.schedule.counts[sp];i++){const id=sp+i;members.push({id,display_name:'负责裁判'+sp+i,email:id+'@example.test',role:'referee'});state1.schedule.bindings[id]=[tableKey(sp,i)];}
let prepared=prepareDraw(prepareDraw(state1,'gomoku',[],[],'printg'),'junqi',[],[],'printj');prepared.schedule.running=true;prepared=dispatchTables(prepared);
const other=emptyState();other.event={...defaultEvent(),name:'另一场独立赛事'};other.schedule=emptySchedule();other.schedule.counts={gomoku:1,junqi:1};other.schedule.bindings={j1:['gomoku:1'],j2:['junqi:1']};
const states={'event-one':prepared,'event-two':other};const requests=[],errors=[];let createdPayload;
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('sb-nwvxamfgfbqbmamqfjcr-auth-token',JSON.stringify({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'admin'}}));localStorage.setItem('qi-theme','dark');});
await page.route('**/auth/v1/**',r=>r.fulfill({json:{user:{id:'admin'}}}));
await page.route('**/functions/v1/tournament',async r=>{const b=r.request().postDataJSON();requests.push(b);const profile={id:'admin',role:'superadmin',display_name:'演示管理员'};
 if(b.action==='events')return r.fulfill({json:{events:Object.entries(states).map(([id,s])=>({id,...s.event,revision:s.revision})),deletedEvents:[],serverNow:Date.now()}});
 if(b.action==='members')return r.fulfill({json:{profiles:members}});
 if(b.action==='create-referee'){const p={id:'j4',display_name:b.displayName,email:b.email,role:'referee'};members.push(p);return r.fulfill({json:{referee:p,credential:{displayName:p.display_name,email:p.email,password:'TEST-ONLY-LOGIN'}}});}
 if(b.action==='create-event'){createdPayload=validateState(b.state);states['created-event']=createdPayload;return r.fulfill({json:{eventId:'created-event',state:createdPayload}});}
 return r.fulfill({json:{state:states[b.eventId]??emptyState(),profile,unavailable:!states[b.eventId]}});
});
await page.routeWebSocket('wss://**/*',ws=>ws.onMessage(()=>{}));
async function selectJudge(table,judge){await page.getByRole('button',{name:table+'添加裁判',exact:true}).click();await page.getByLabel('搜索可用裁判').fill(judge);await page.locator('.picker-results button').filter({hasText:judge}).click();await page.getByRole('button',{name:'完成添加',exact:true}).click();}
async function pdf(button,name){const wait=page.waitForEvent('download',{timeout:60000});await page.getByRole('button',{name:button,exact:true}).click();const file=await wait;assert.ok(file.suggestedFilename().endsWith('.pdf'));await file.saveAs(path.join(output,name));}
try{
 await page.goto('http://127.0.0.1:4291/');await page.getByRole('heading',{name:'先选一场比赛，再进入现场。'}).waitFor();assert.equal(await page.getByRole('button',{name:'现场调度',exact:true}).count(),0);
 await page.getByRole('button',{name:'创建新竞赛',exact:true}).click();await page.getByLabel('比赛名称',{exact:true}).fill('编排创建验证赛事');
 await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('alert').filter({hasText:'赛事密码'}).waitFor();
 await page.getByLabel('创建赛事密码',{exact:true}).fill('TEST-EVENT-ONLY');await page.getByLabel('确认创建赛事密码',{exact:true}).fill('WRONG-EVENT-ONLY');
 await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('alert').filter({hasText:'不一致'}).waitFor();await page.getByLabel('确认创建赛事密码',{exact:true}).fill('TEST-EVENT-ONLY');
 await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'下一步',exact:true}).click();
 await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('alert').filter({hasText:'尚未指定裁判'}).waitFor();
 await page.getByLabel('五子棋棋盘数',{exact:true}).fill('2');
 await selectJudge('五子棋 1 号桌','裁判甲');await selectJudge('五子棋 1 号桌','裁判乙');
 await page.getByRole('button',{name:'五子棋 2 号桌添加裁判',exact:true}).click();await page.getByLabel('搜索可用裁判').fill('裁判甲');assert.equal(await page.locator('.picker-results button').count(),0);
 await page.getByRole('button',{name:'新建裁判',exact:true}).click();await page.getByLabel('新裁判姓名').fill('新裁判丁');await page.getByLabel('新裁判邮箱').fill('new@example.test');await page.getByRole('button',{name:'创建并加入此桌'}).click();await page.getByText('新账号已创建，请先保存登录信息').waitFor();
 const credentialPanel=page.getByRole('region',{name:'导出此裁判登录信息'});await credentialPanel.getByLabel('导出字段 密码').check();const credential=page.waitForEvent('download');await credentialPanel.getByRole('button',{name:'导出所选裁判 TXT'}).click();assert.ok((await credential).suggestedFilename().endsWith('.txt'));await page.getByRole('button',{name:'完成添加',exact:true}).click();
 await page.locator('.composer-toolbar').getByRole('button',{name:/军棋/}).click();await page.getByLabel('军棋棋盘数',{exact:true}).fill('1');await selectJudge('军棋 1 号桌','裁判丙');
 await page.locator('.composer-toolbar').getByRole('button',{name:/五子棋/}).click();
 await page.screenshot({path:path.join(output,'棋盘裁判编排-桌面.png'),fullPage:true});
 await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.screenshot({path:path.join(output,'棋盘裁判编排-白色.png'),fullPage:true});await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('.full-workspace').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await page.screenshot({path:path.join(output,'棋盘裁判编排-手机.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'下一步',exact:true}).click();assert.equal(await page.getByLabel('启用本场赛事自动备份').isChecked(),false);
 assert.equal(await page.getByLabel('备份间隔（分钟）').inputValue(),'10');
 await pdf('下载裁判安排 PDF','裁判安排-未发布草稿.pdf');
 await page.getByRole('button',{name:'核对完成，创建竞赛'}).click();await page.getByRole('heading',{name:'确认创建新竞赛'}).waitFor();await page.getByRole('button',{name:'确认创建竞赛',exact:true}).click();await page.waitForURL('**?event=created-event');
 assert.equal(Object.values(createdPayload.schedule.bindings).filter(a=>a.length).length,4);assert.equal(createdPayload.schedule.bindings.j1[0],'gomoku:1');assert.equal(createdPayload.schedule.bindings.j4[0],'gomoku:2');
 assert.equal(requests.find(r=>r.action==='create-event').password,'TEST-EVENT-ONLY');assert.equal(JSON.stringify(createdPayload).includes('TEST-EVENT-ONLY'),false);
 await page.goto('http://127.0.0.1:4291/?event=event-one');await page.getByRole('button',{name:'现场调度',exact:true}).click();await page.getByRole('heading',{name:'现场资料验证赛事',exact:true}).waitFor();
 await page.getByRole('button',{name:'资料与打印',exact:true}).click();await pdf('下载裁判安排 PDF','裁判与棋盘安排-演示.pdf');
 await page.getByRole('button',{name:'现场对阵与候场',exact:true}).click();await pdf('下载对阵候场 PDF','现场对阵与候场-演示.pdf');
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'打印对阵候场',exact:true}).click();const printed=await popup;await printed.waitForLoadState();assert.match(await printed.locator('body').innerText(),/现场资料验证赛事/);await printed.close();
 await page.getByRole('button',{name:'比赛成绩归档',exact:true}).click();await pdf('下载比赛成绩 PDF','比赛成绩归档-演示.pdf');
 await page.getByRole('button',{name:'检录与抽签',exact:true}).click();assert.ok(await page.locator('.floor-roll>div').count()<=12);await page.getByPlaceholder('姓名或学号').fill('不存在的同学');assert.equal(await page.locator('.floor-roll>div').count(),0);
 await page.getByLabel('切换竞赛').selectOption('event-two');await page.waitForURL('**?event=event-two');await page.getByRole('button',{name:'现场调度',exact:true}).click();await page.getByRole('heading',{name:'另一场独立赛事',exact:true}).waitFor();assert.equal(await page.locator('.floor-grid .floor-tables button').count(),2);assert.equal(await page.locator('.floor-panel').innerText().then(t=>t.includes('现场资料验证赛事')),false);
 await page.goto('http://127.0.0.1:4291/?event=missing-event');await page.getByRole('heading',{name:'先选一场比赛，再进入现场。'}).waitFor();assert.equal(await page.getByRole('button',{name:'现场调度',exact:true}).count(),0);
 assert.deepEqual(errors,[]);assert.equal(requests.some(r=>r.action==='score'),false);console.log('PASS: event lobby gating, wizard validation, table-based assignment, distinct judges, inline account creation, draft PDF, 3 saved-event PDF reports, print, responsive layout, paged search, event isolation, unavailable event gating.');
}finally{await browser.close();}
