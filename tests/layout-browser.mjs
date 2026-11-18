import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { demoState } from '../src/engine.ts';
const base = process.argv[2] || 'http://127.0.0.1:4173';
const browser = await chromium.launch({channel:'msedge', headless:true});
const page = await browser.newPage({reducedMotion:'reduce'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/rest/v1/public_events*', route=>route.fulfill({json:{state:demoState()}}));
try {
  await page.goto(base);
  for (const width of [320,390,768,1024,1440,1920]) {
    await page.setViewportSize({width,height:width<700?844:900});
    for(const theme of ['dark','light']) {
      if(await page.locator('html').getAttribute('data-theme')!==theme) await page.locator('.theme-toggle:visible').click();
      for(const sport of ['五子棋','军棋']) {
        await page.locator('.sport-tabs').getByRole('button',{name:new RegExp(sport)}).click();
        assert.equal(await page.locator('.hero').evaluate(hero=>{
          const box=s=>hero.querySelector(s).getBoundingClientRect();
          const a=box('.hero-copy'), b=box('.hero-art'), board=box('.chessboard'), label=box('.hero-board-label');
          return (a.right<=b.left+1 || b.bottom<=a.top+1) && board.top>=label.bottom-1 && board.right<=b.right+1 && board.bottom<=b.bottom+1 && document.documentElement.scrollWidth<=innerWidth+1;
        }),true,width+' '+theme+' '+sport);
      }
    }
    await page.locator('nav').getByRole('button',{name:'晋级对阵'}).click();
    assert.ok(await page.locator('.bracket-toolbar').evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1 && document.documentElement.scrollWidth<=innerWidth+1),'bracket '+width);
    await page.locator('nav').getByRole('button',{name:'赛事总览'}).click();
    if(width===390) {
      await page.getByRole('button',{name:'赛事工具'}).click();
      await page.getByRole('button',{name:'赛事设置与备份'}).waitFor();
      await page.getByRole('button',{name:'赛事工具'}).click();
    }
    console.log('layout OK', width);
  }
  await page.locator('.theme-toggle:visible').click();
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.sport-tabs').getByRole('button',{name:/五子棋/}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'现场大屏',exact:true}).click();
  await page.getByRole('button',{name:'双赛同屏'}).click();
  for(const width of [390,1366,1920]) {
    await page.setViewportSize({width,height:width===1366?768:900});
    assert.equal(await page.locator('.arena-sport').count(),2);
    assert.ok(await page.locator('.arena-sport').evaluateAll(items=>items.every(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight+1 && r.right<=innerWidth+1 && r.height>0;})));
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
