import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoState, buildBracket, validateState } from '../src/engine.ts';
import { applyCloudScore, matchSignature, redactState } from '../src/cloud-policy.ts';
import type { Result } from '../src/engine.ts';
const r:Result={kind:'played',games:['A'],referee:'伪造姓名',reason:'',first:'A',updatedAt:'old'};
test('公开快照与裁判资料脱敏，完整名单保留在管理端',()=>{
  const s=demoState();s.tournaments.gomoku.players[0].phone='13800000000';s.tournaments.gomoku.players[0].qq='12345678';
  const pub=redactState(s,'public'),ref=redactState(s,'referee'),admin=redactState(s,'admin');
  assert.ok(!JSON.stringify(pub).includes('13800000000'));assert.ok(!JSON.stringify(pub).includes('2026010001'));assert.ok(!JSON.stringify(ref).includes('13800000000'));assert.equal(ref.tournaments.gomoku.players[0].studentId,'2026010001');assert.equal(admin.tournaments.gomoku.players[0].phone,'13800000000');assert.doesNotThrow(()=>validateState(pub));assert.equal(s.tournaments.gomoku.players[0].phone,'13800000000');
});
test('裁判提交绑定已登录身份，过期签名和已结束对局更正被拒绝',()=>{
  const s=demoState(),m=buildBracket(s.tournaments.gomoku).flat().find(m=>m.ready&&!m.resolved)!;
  const input={sport:'gomoku' as const,id:m.id,result:r,expectedSignature:matchSignature(s,'gomoku',m.id)};
  const next=applyCloudScore(s,input,'referee','已审核裁判');assert.equal(next.tournaments.gomoku.results[m.id].referee,'已审核裁判');
  assert.throws(()=>applyCloudScore(next,input,'referee','其他裁判'),/其他裁判更新/);
  const current={...input,expectedSignature:matchSignature(next,'gomoku',m.id)};
  assert.throws(()=>applyCloudScore(next,current,'referee','其他裁判'),/管理员/);
  assert.doesNotThrow(()=>applyCloudScore(next,current,'admin','管理员'));
});
test('不同对局可以在最新状态上合并，未覆盖另一场成绩；重抽后旧签名失效',()=>{
  const s=demoState(),[a,b]=buildBracket(s.tournaments.gomoku).flat().filter(m=>m.ready&&!m.resolved);
  const signatureA=matchSignature(s,'gomoku',a.id),signatureB=matchSignature(s,'gomoku',b.id);
  const next=applyCloudScore(s,{sport:'gomoku',id:a.id,result:r,expectedSignature:signatureA},'referee','裁判甲');
  const merged=applyCloudScore(next,{sport:'gomoku',id:b.id,result:r,expectedSignature:signatureB},'referee','裁判乙');
  assert.ok(merged.tournaments.gomoku.results[a.id]);assert.ok(merged.tournaments.gomoku.results[b.id]);
  merged.tournaments.gomoku.drawnAt='redrawn';assert.throws(()=>applyCloudScore(merged,{sport:'gomoku',id:a.id,result:r,expectedSignature:signatureA},'admin','管理员'));
});
test('管理员可直接裁定胜方且不伪造局分，保留修改前后与原因；裁判不能越权直接判胜',()=>{
  const s=demoState(),m=buildBracket(s.tournaments.gomoku)[0].find(m=>m.resolved&&m.ready)!;
  const input={sport:'gomoku' as const,id:m.id,result:{...r,kind:'adjudicated' as const,games:[],winner:'B' as const,reason:'核对纸质记录，原胜方有误'},expectedSignature:matchSignature(s,'gomoku',m.id)};
  assert.throws(()=>applyCloudScore(s,input,'referee','裁判'));
  const next=applyCloudScore(s,input,'admin','超级管理员');
  const after=buildBracket(next.tournaments.gomoku)[0].find(x=>x.id===m.id)!;
  assert.equal(after.winner,m.b.id);assert.deepEqual(after.result?.games,[]);
  assert.ok(next.audit[0].message.includes('超级管理员'));assert.ok(next.audit[0].message.includes('→'));assert.ok(next.audit[0].message.includes('原胜方有误'));
});
