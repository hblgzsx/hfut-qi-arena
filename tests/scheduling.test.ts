import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,emptyTournament,buildBracket,setResult,validateState} from '../src/engine.ts';
import {prepareDraw,dispatchTables,occupied,tableKey,assertSafeCorrection,emptySchedule,validateTableBindings} from '../src/scheduling.ts';
import {scheduleAction,mayScoreTable,assertNoLiveReplacement,replaceRegistration,scheduleProtected} from '../src/schedule-actions.ts';
import {defaultEvent,restMinutes} from '../src/event-settings.ts';

function roster(n=16) {
  const state=emptyState();
  state.schedule=emptySchedule();
  for(const sport of ['gomoku','junqi'] as const)for(let i=1;i<=state.schedule.counts[sport];i++)state.schedule.bindings['judge-'+sport+i]=[tableKey(sport,i)];
  for(const sport of ['gomoku','junqi'] as const) {
    state.tournaments[sport]={...emptyTournament(sport),players:Array.from({length:n},(_,i)=>({
      id:sport+i,name:'同学'+i,studentId:'00'+i,college:'学院',gender:'',phone:'',qq:''
    }))};
  }
  return state;
}

test('重新导入名单清空旧调度，保留棋盘与裁判；现场占桌时禁止替换',()=>{
 const original=prepareDraw(roster(8),'gomoku',[],[],'old-import');
 const replacement=roster(6).tournaments;
 const next=replaceRegistration(original,replacement);
 assert.deepEqual(next.schedule!.bindings,original.schedule!.bindings);
 assert.deepEqual(next.schedule!.counts,original.schedule!.counts);
 assert.deepEqual(next.schedule!.queues,{gomoku:[],junqi:[]});assert.deepEqual(next.schedule!.assignments,[]);assert.equal(next.schedule!.running,false);
 assert.doesNotThrow(()=>validateState(next));assert.notDeepEqual(original.schedule!.queues,next.schedule!.queues);
 original.schedule!.running=true;const live=dispatchTables(original,1000);
 assert.throws(()=>replaceRegistration(live,replacement),/现场对局/);
});

test('每桌需裁判，同一裁判只能一桌，同桌可多裁判',()=>{
  const s=emptySchedule();s.counts={gomoku:1,junqi:1};
  assert.throws(()=>validateTableBindings(s),/尚未指定裁判/);
  s.bindings={r1:['gomoku:1','junqi:1']};
  assert.throws(()=>validateTableBindings(s),/一名裁判只能/);
  s.bindings={r1:['gomoku:1'],r2:['junqi:1'],r3:['gomoku:1']};
  assert.doesNotThrow(()=>validateTableBindings(s));
  let state=prepareDraw(roster(8),'gomoku',[],[],'uncovered');
  state.schedule!.bindings={};state.schedule!.running=true;
  assert.equal(dispatchTables(state,1000).schedule!.assignments.length,0);
  assert.throws(()=>scheduleAction(state,{type:'start'}),/尚未指定裁判/);
  state.schedule!.running=false;
  assert.throws(()=>scheduleAction(state,{type:'configure',counts:s.counts,bindings:{r1:['gomoku:1','junqi:1']}}),/一名裁判只能/);
});
test('未到场者移出抽签，优先只调整对局顺序，刷新保持签位与队列',()=>{
  const original=roster(9);
  const state=prepareDraw(original,'gomoku',['gomoku8'],['gomoku3'],'stable');
  assert.equal(state.tournaments.gomoku.players.length,8);
  assert.ok(!state.tournaments.gomoku.seeds.includes('gomoku8'));
  const priorityMatch=buildBracket(state.tournaments.gomoku)[0].find(m=>m.a.id==='gomoku3'||m.b.id==='gomoku3')!;
  assert.equal(state.schedule!.queues.gomoku[0],priorityMatch.id);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))).schedule,state.schedule);
  const withoutPriority=prepareDraw(original,'gomoku',['gomoku8'],[],'stable');
  assert.deepEqual(withoutPriority.tournaments.gomoku.seeds,state.tournaments.gomoku.seeds);
});
test('15 桌容量、跨项同学不重复占用，分配重试幂等',()=>{
  let state=prepareDraw(roster(32),'gomoku',[],[],'g');
  state=prepareDraw(state,'junqi',[],[],'j');
  state.schedule!.running=true;
  state=dispatchTables(state,1000);
  const active=state.schedule!.assignments.filter(occupied);
  assert.equal(active.filter(a=>a.sport==='gomoku').length,10);
  assert.ok(active.filter(a=>a.sport==='junqi').length<=5);
  const ids=active.flatMap(a=>a.players.map(id=>state.tournaments[a.sport].players.find(p=>p.id===id)!.studentId));
  assert.equal(new Set(ids).size,ids.length);
  assert.strictEqual(dispatchTables(state,1000),state);
});
test('部分比分继续占桌，完赛补台，休息180秒后可跨轮开赛',()=>{
  let state=prepareDraw(roster(4),'gomoku',[],[],'rest');
  state.schedule!.counts.gomoku=1;state.schedule!.running=true;
  state=dispatchTables(state,1000);
  const a=state.schedule!.assignments[0];
  const result={kind:'played' as const,games:['A' as const],first:'A' as const,referee:'裁判',reason:'',updatedAt:new Date().toISOString()};
  state.tournaments.gomoku=setResult(state.tournaments.gomoku,a.match,result);
  const partial=dispatchTables(state,2000);
  assert.equal(partial.schedule!.assignments[0].status,'called');
  state.tournaments.gomoku=setResult(state.tournaments.gomoku,a.match,{...result,games:['A','A']});
  state=dispatchTables(state,2000);
  assert.equal(state.schedule!.assignments.length,2);
  const second=state.schedule!.assignments[1];
  state.tournaments.gomoku=setResult(state.tournaments.gomoku,second.match,{...result,games:['A','A']});
  state=dispatchTables(state,3000);
  assert.equal(state.schedule!.assignments.filter(occupied).length,0);
  assert.equal(dispatchTables(state,182999).schedule!.assignments.filter(occupied).length,0);
  state=dispatchTables(state,183000);
  assert.equal(state.schedule!.assignments.at(-1)!.match,'R2-M1');
});
test('中途改变休息时间按上场结束时刻重算，零间隔立即补台，已叫号和对手不变',()=>{
 let state=prepareDraw(roster(4),'gomoku',[],[],'mid-rest');state.event=defaultEvent();state.schedule!.counts.gomoku=2;state.schedule!.running=true;state=dispatchTables(state,1000);
 const active=state.schedule!.assignments.filter(occupied);for(const a of active)state.tournaments.gomoku=setResult(state.tournaments.gomoku,a.match,{kind:'played',games:['A','A'],first:'A',referee:'裁判',reason:'',updatedAt:new Date().toISOString()});
 state=dispatchTables(state,2000);assert.equal(state.schedule!.assignments.filter(occupied).length,0);const signature=JSON.stringify([state.tournaments,state.schedule!.queues,state.schedule!.bindings]);
 const longer=scheduleAction(state,{type:'rest',minutes:5},62000);assert.equal(restMinutes(longer.event),5);assert.equal(dispatchTables(longer,301999).schedule!.assignments.filter(occupied).length,0);assert.equal(dispatchTables(longer,302000).schedule!.assignments.filter(occupied).length,1);
 const shorter=scheduleAction(longer,{type:'rest',minutes:1},62000);assert.equal(shorter.schedule!.assignments.filter(occupied).length,1);assert.equal(JSON.stringify([shorter.tournaments,shorter.schedule!.queues,shorter.schedule!.bindings]),signature);
 const called=shorter.schedule!.assignments.find(occupied)!;const changed=scheduleAction(shorter,{type:'rest',minutes:120},63000);assert.equal(changed.schedule!.assignments.find(a=>a.id===called.id)!.status,'called');assert.deepEqual(changed.schedule!.assignments.find(a=>a.id===called.id)!.players,called.players);
 const zero=scheduleAction(state,{type:'rest',minutes:0},2000);assert.equal(zero.schedule!.assignments.filter(occupied).length,1);for(const minutes of [-1,121,0.5,'3'])assert.throws(()=>scheduleAction(state,{type:'rest',minutes},2000));
 assert.ok(scheduleProtected(state,longer));
});
test('裁判绑定由后端规则检查，未分配或非负责棋盘不可提交',()=>{
  let state=prepareDraw(roster(8),'gomoku',[],[],'bind');
  state.schedule!.running=true;state=dispatchTables(state,1000);
  const a=state.schedule!.assignments[0];
  state.schedule!.bindings={r1:[tableKey(a.sport,a.table)]};
  assert.equal(mayScoreTable(state,'r1',a.sport,a.match),true);
  assert.equal(mayScoreTable(state,'other',a.sport,a.match),false);
  assert.equal(mayScoreTable(state,'r1',a.sport,'R3-M1'),false);
});
test('叫号播报实际桌号与两人，含跨轮；开赛不能取消，运行中不能覆盖抽签',()=>{
  let state=prepareDraw(roster(8),'gomoku',[],[],'calls');
  state.schedule!.running=true;state=dispatchTables(state,1000);
  const a=state.schedule!.assignments[0],call=state.schedule!.calls[0];
  assert.match(call.text,/五子棋 1 号桌/);
  for(const id of a.players)assert.ok(call.text.includes(state.tournaments.gomoku.players.find(p=>p.id===id)!.name));
  state=scheduleAction(state,{type:'begin',assignment:a.id},1000);
  assert.throws(()=>scheduleAction(state,{type:'cancel',assignment:a.id},1000),/仅能取消/);
  const next=structuredClone(state);next.tournaments.gomoku.seeds.reverse();
  assert.throws(()=>assertNoLiveReplacement(state,next),/不能覆盖/);
  assert.doesNotThrow(()=>assertSafeCorrection(state,'gomoku',a.match));
});
