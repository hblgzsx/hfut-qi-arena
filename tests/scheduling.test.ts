import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,emptyTournament,buildBracket,setResult,validateState} from '../src/engine.ts';
import {prepareDraw,dispatchTables,occupied,tableKey,assertSafeCorrection} from '../src/scheduling.ts';
import {scheduleAction,mayScoreTable,assertNoLiveReplacement} from '../src/schedule-actions.ts';

function roster(n=16) {
  const state=emptyState();
  for(const sport of ['gomoku','junqi'] as const) {
    state.tournaments[sport]={...emptyTournament(sport),players:Array.from({length:n},(_,i)=>({
      id:sport+i,name:'同学'+i,studentId:'00'+i,college:'学院',gender:'',phone:'',qq:''
    }))};
  }
  return state;
}
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
