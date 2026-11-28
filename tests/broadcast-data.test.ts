import test from 'node:test';
import assert from 'node:assert/strict';
import {demoState,buildBracket,setResult} from '../src/engine.ts';
import {emptySchedule,prepareDraw,dispatchTables} from '../src/scheduling.ts';
import {broadcastRows} from '../src/broadcast-data.ts';
test('播报控制台只重播当前有效赛果，已开赛、结束、取消、重抽及双方不符的叫号均失效',()=>{
 let state=demoState();state.schedule=emptySchedule();state.schedule.counts={gomoku:2,junqi:1};state.schedule.bindings={a:['gomoku:1'],b:['gomoku:2'],c:['junqi:1']};state=prepareDraw(state,'gomoku',[],[],'broadcast-data');state=prepareDraw(state,'junqi',[],[],'broadcast-j');state.schedule!.running=true;state=dispatchTables(state);
 const a=state.schedule!.assignments[0],call=state.schedule!.calls.find(c=>c.assignment===a.id)!;
 assert.equal(broadcastRows(state).find(r=>r.callId===call.id)?.valid,true);
 const match=buildBracket(state.tournaments[a.sport]).flat().find(m=>m.id===a.match)!;assert.ok(call.text.includes(match.bestOf===1?'一局定胜负':'三局两胜'));
 const legacy=structuredClone(state);legacy.schedule!.calls.find(c=>c.id===call.id)!.text='旧版叫号';assert.ok(broadcastRows(legacy).find(r=>r.callId===call.id)!.text.includes(match.bestOf===1?'一局定胜负':'三局两胜'));
 const rules=structuredClone(state),tournament=rules.tournaments[a.sport];tournament.rules={bronzeCount:2,preliminary:1,quarterfinal:3,semifinal:3,final:3,bronze:3,overrides:{[a.match]:match.bestOf===1?3:1}};assert.ok(broadcastRows(rules).find(r=>r.callId===call.id)!.text.includes(match.bestOf===1?'三局两胜':'一局定胜负'));
 for(const status of ['playing','finished','cancelled'] as const){const s=structuredClone(state);s.schedule!.assignments[0].status=status;assert.equal(broadcastRows(s).find(r=>r.callId===call.id)?.valid,false);}
 const redraw=structuredClone(state);redraw.schedule!.draws[a.sport]='old';assert.equal(broadcastRows(redraw).find(r=>r.callId===call.id)?.valid,false);
 const mismatch=structuredClone(state);mismatch.schedule!.assignments[0].players.reverse();assert.equal(broadcastRows(mismatch).find(r=>r.callId===call.id)?.valid,false);
 const t=state.tournaments[a.sport],m=buildBracket(t).flat().find(m=>m.id===a.match)!;
 state.tournaments[a.sport]=setResult(t,m.id,{kind:'played',games:m.bestOf===1?['A']:['A','A'],first:'A',referee:'测试',reason:'',updatedAt:'2026-11-28T01:00:00Z'});
 const old=broadcastRows(state).find(r=>r.kind==='result')!;assert.ok(old.text.includes(t.players.find(p=>p.id===m.a.id)!.name));assert.equal(broadcastRows(state).find(r=>r.callId===call.id)?.valid,false);
 state.tournaments[a.sport]=setResult(state.tournaments[a.sport],m.id,{kind:'forfeit',games:[],winner:'B',first:'A',referee:'测试',reason:'弃权更正',updatedAt:'2026-11-28T01:01:00Z'});
 const rows=broadcastRows(state).filter(r=>r.kind==='result');assert.equal(rows.length,1);assert.notEqual(rows[0].id,old.id);assert.ok(rows[0].text.includes('弃权'));assert.ok(rows[0].text.includes(t.players.find(p=>p.id===m.b.id)!.name));
});
