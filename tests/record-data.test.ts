import test from 'node:test';import assert from 'node:assert/strict';
import {demoState,buildBracket,draw,setResult,emptyTournament} from '../src/engine.ts';import {recordReady,recordRows} from '../src/record-data.ts';import {applyCloudScore,matchSignature} from '../src/cloud-policy.ts';
test('超级管理员更正保留原裁判，首次录入署名超级管理员，档案仍记录真实操作人',()=>{
 let state=demoState();const m=buildBracket(state.tournaments.gomoku).flat().find(m=>m.ready&&m.result)!;
 state.tournaments.gomoku.results[m.id].referee='原裁判';
 const result={kind:'adjudicated' as const,games:[],winner:'B' as const,reason:'核对记录后更正',referee:'伪造姓名',first:'A' as const,updatedAt:new Date().toISOString()};
 state=applyCloudScore(state,{sport:'gomoku',id:m.id,result,expectedSignature:matchSignature(state,'gomoku',m.id)},'superadmin','真实管理账号');assert.equal(state.tournaments.gomoku.results[m.id].referee,'原裁判');assert.match(state.audit[0].message,/真实管理账号/);
 const fresh=buildBracket(state.tournaments.gomoku).flat().find(m=>m.ready&&!m.result)!;state=applyCloudScore(state,{sport:'gomoku',id:fresh.id,result,expectedSignature:matchSignature(state,'gomoku',fresh.id)},'superadmin','真实管理账号');assert.equal(state.tournaments.gomoku.results[fresh.id].referee,'超级管理员');
});
test('记录表逐局转换先后手和胜方，不伪造弃权比分，完成后开放导出',()=>{
 let t=emptyTournament('gomoku');t.players=demoState().tournaments.gomoku.players.slice(0,2);t=draw(t,'pdf-check');assert.equal(recordReady(t),false);
 t=setResult(t,'R1-M1',{kind:'played',games:['B','D','A','B'],first:'B',referee:'裁判甲',reason:'',updatedAt:new Date().toISOString()});assert.equal(recordReady(t),true);const rows=recordRows(t);assert.deepEqual(rows.map(r=>r.winner),['A','和棋','B','B']);assert.equal(rows[0].a?.id,buildBracket(t)[0][0].b.id);assert.equal(rows[1].a?.id,buildBracket(t)[0][0].a.id);
 t=setResult(t,'R1-M1',{kind:'forfeit',games:[],winner:'A',first:'A',referee:'裁判甲',reason:'对方弃权',updatedAt:new Date().toISOString()});assert.equal(recordRows(t).length,1);assert.equal(recordRows(t)[0].winner,'A（弃权）');assert.match(recordRows(t)[0].detail,/非实赛/);
});
