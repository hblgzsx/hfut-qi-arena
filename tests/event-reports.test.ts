import test from 'node:test';
import assert from 'node:assert/strict';
import {demoState} from '../src/engine.ts';
import {buildBracket,emptyState} from '../src/engine.ts';
import {defaultEvent} from '../src/event-settings.ts';
import {emptySchedule,prepareDraw,dispatchTables,tableKey,SPORTS} from '../src/scheduling.ts';
import {refereeReport,eventReport,reportNotice,reportHtml} from '../src/event-reports.ts';
function fixture(){let state=demoState();state.event={...defaultEvent(),name:'公开赛事 <测试>'};state.schedule=emptySchedule();const members=[];for(const sp of SPORTS)for(let i=1;i<=state.schedule.counts[sp];i++){const id=sp+i;state.schedule.bindings[id]=[tableKey(sp,i)];members.push({id,display_name:'裁判'+id,email:'PRIVATE@example.test',password:'NEVER-IN-PDF'});}for(const sp of SPORTS)state=prepareDraw(state,sp,[],[],'report'+sp);state.schedule.running=true;state=dispatchTables(state);return {state,members};}
test('裁判资料按桌汇总，多人同桌，发群文本无登录凭证',()=>{const {state,members}=fixture();state.schedule!.bindings.extra=['gomoku:1'];members.push({id:'extra',display_name:'协助裁判',email:'extra@example.test',password:'SECRET'});const r=refereeReport(state.event!,state.schedule!,members,state.revision);assert.equal(r.sections[0].rows.length,10);assert.match(r.sections[0].rows[0][1],/协助裁判/);const content=JSON.stringify(r)+reportNotice(r)+reportHtml(r);assert.ok(!content.includes('@example.test'));assert.ok(!content.includes('NEVER-IN-PDF'));assert.match(reportHtml(r),/&lt;测试&gt;/);state.schedule!.bindings={};assert.throws(()=>refereeReport(state.event!,state.schedule!,members),/尚未指定裁判/);});
test('对阵与候场以已保存快照生成，不给未上场对局伪造桌号或名次',()=>{const {state,members}=fixture();const before=JSON.stringify(state);const schedule=eventReport(state,'schedule',members),result=eventReport(state,'results',members);assert.equal(schedule.sections[0].rows.length,10);assert.equal(schedule.sections[3].rows.length,5);assert.match(schedule.notes[0],/不等于固定桌号/);assert.ok(schedule.sections.some(s=>s.title.includes('完整对阵')));assert.equal(JSON.stringify(state),before);assert.match(result.sections[0].rows[0][1],/尚未产生/);assert.ok(!JSON.stringify(schedule).includes(state.tournaments.gomoku.players[0].studentId));});
test('首轮顺序按已锁定队列完整导出，轮空单列，无虚构棋盘和个人登录资料',()=>{
 const {state}=fixture();state.schedule!.assignments=[];state.schedule!.running=false;
 const before=JSON.stringify(state),r=eventReport(state,'first-round');
 for(const sp of SPORTS){const rounds=buildBracket(state.tournaments[sp]),games=rounds[0].filter(m=>m.a.id&&m.b.id),section=r.sections.find(s=>s.title===({gomoku:'五子棋',junqi:'军棋'}[sp])+' · 第一轮实赛顺序')!;assert.deepEqual(section.rows.map(row=>row[0].split(' / ')[1]),state.schedule!.queues[sp].filter(id=>games.some(m=>m.id===id)));assert.ok(section.rows.every(row=>row[2].includes('待现场叫号')));assert.equal(r.sections.find(s=>s.title===({gomoku:'五子棋',junqi:'军棋'}[sp])+' · 第一轮轮空')!.rows.length,rounds[0].filter(m=>m.bye).length);}
 assert.equal(JSON.stringify(state),before);assert.ok(!JSON.stringify(r).includes(state.tournaments.gomoku.players[0].studentId));assert.throws(()=>eventReport(emptyState(),'first-round'),/尚未生成抽签/);
 state.schedule!.queues.gomoku=[];assert.throws(()=>eventReport(state,'first-round'),/不完整/);
});
