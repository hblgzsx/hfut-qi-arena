import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestOf, bracketSize, buildBracket, demoState, descendants, draw, emptyState, emptyTournament, setResult, standings, validateState } from '../src/engine.ts';
import type { Player, Result, Tournament } from '../src/engine.ts';
const players = (n: number): Player[] => Array.from({length:n},(_,i)=>({ id:`p${i}`, name:`选手${i}`, studentId:`000${i}`, college:'学院', phone:'',qq:'',gender:'' }));
const create = (n: number, seed='test') => draw({...emptyTournament('junqi'),players:players(n)},seed);
const result = (games: Result['games']): Result => ({kind:'played',games,reason:'',referee:'裁判',first:'A',updatedAt:new Date().toISOString()});
const win = (t:Tournament,id:string) => {const m=buildBracket(t).flat().find(m=>m.id===id)!; return setResult(t,id,result(m.bestOf===1?['A']:['A','A']));};

test('2—256 人的随机赛程均覆盖全名单，无空对局，最终恰有 n-1 场实赛与唯一冠军',()=>{
  for(let n=2;n<=256;n++) {
    let t=create(n,`seed-${n}`); const rounds=buildBracket(t);
    assert.equal(t.seeds.length,bracketSize(n));
    assert.equal(new Set(t.seeds.filter(Boolean)).size,n);
    assert.equal(rounds[0].filter(m=>m.bye).length,bracketSize(n)-n);
    assert.ok(rounds[0].every(m=>m.a.id||m.b.id));
    let played=0;
    while(!buildBracket(t).at(-1)![0].resolved){
      const ready=buildBracket(t).flat().filter(m=>m.ready&&!m.resolved);
      assert.ok(ready.length>0,`n=${n} 不能卡住`);
      for(const m of ready){t=win(t,m.id);played++;}
    }
    assert.equal(played,n-1);assert.ok(standings(t).champion);
    const s=emptyState();s.tournaments.junqi=t;assert.doesNotThrow(()=>validateState(s));
  }
});
test('7 人为 8 签位与三轮：BO3、BO3、BO3；64 人为六轮',()=>{
  const t=create(7),rounds=buildBracket(t);
  assert.equal(rounds.length,3);assert.equal(rounds[0].filter(m=>m.bye).length,1);
  assert.deepEqual(rounds.map(r=>r[0].bestOf),[3,3,3]);
  assert.deepEqual(Array.from({length:6},(_,r)=>bestOf(r,6)),[1,1,1,3,3,3]);
});
test('随机种子可复现，不同种子改变签位，拒绝不足 2 人、重复学号和超过 256 人',()=>{
  assert.deepEqual(create(47,'abc').seeds,create(47,'abc').seeds);
  assert.notDeepEqual(create(47,'abc').seeds,create(47,'def').seeds);
  assert.throws(()=>create(0));assert.throws(()=>create(1));assert.throws(()=>create(257));
  const p=players(2);p[1].studentId=p[0].studentId;assert.throws(()=>draw({...emptyTournament('gomoku'),players:p}));
});
test('三局两胜支持部分局分、和棋续赛，拒绝胜负已定后的额外局',()=>{
  let t=create(2);t=setResult(t,'R1-M1',result(['D','A','B']));
  assert.equal(buildBracket(t)[0][0].resolved,false);
  t=setResult(t,'R1-M1',result(['D','A','B','A']));assert.ok(standings(t).champion);
  assert.throws(()=>setResult(t,'R1-M1',result(['A','A','B'])));
  assert.throws(()=>setResult(t,'R1-M1',result([])));
  assert.throws(()=>setResult(t,'R1-M1',{...result(['A']),referee:''}));
});
test('上游未定禁止录入；修改旧结果清空对应路径但保留无关分支',()=>{
  let t=create(8);assert.throws(()=>win(t,'R2-M1'));
  for(const r of buildBracket(t))for(const m of r){if(buildBracket(t).flat().find(x=>x.id===m.id)?.ready)t=win(t,m.id);}
  assert.ok(standings(t).champion);assert.deepEqual(descendants(t,'R1-M1'),['R2-M1','R3-M1']);
  t=setResult(t,'R1-M1',result(['B','B']));assert.ok(t.results['R2-M2']);assert.ok(t.results['R1-M2']);assert.equal(t.results['R2-M1'],undefined);assert.equal(t.results['R3-M1'],undefined);assert.equal(standings(t).champion,null);
});
test('双弃权空位向下传播，另一分支胜者自动晋级，不伪造比赛与奖项',()=>{
  let t=create(4);t=setResult(t,'R1-M1',{...result([]),kind:'double',reason:'双方迟到'});t=win(t,'R1-M2');
  const final=buildBracket(t).at(-1)![0];assert.equal(final.bye,true);assert.equal(final.resolved,true);assert.ok(standings(t).champion);assert.equal(standings(t).runnerUp,null);assert.equal(standings(t).bronze.length,1);
});
test('正常比赛按 1:1:2 产生荣誉；2 人无季军，3 人仅一个季军',()=>{
  for(const n of [2,3,4,7,16]){let t=create(n);while(!buildBracket(t).at(-1)![0].resolved){for(const m of buildBracket(t).flat().filter(m=>m.ready&&!m.resolved))t=win(t,m.id);}const p=standings(t);assert.ok(p.champion);assert.ok(p.runnerUp);assert.equal(p.bronze.length,n===2?0:n===3?1:2);}
});
test('备份校验拦截重复签位、越权赛果、恶意图片和结构错误',()=>{
  const s=demoState();assert.doesNotThrow(()=>validateState(s));
  const bad=structuredClone(s);bad.tournaments.junqi.seeds[1]=bad.tournaments.junqi.seeds[0];assert.throws(()=>validateState(bad));
  const extra=structuredClone(s);extra.tournaments.junqi.results['R99-M1']=result(['A']);assert.throws(()=>validateState(extra));
  const image=structuredClone(s);image.prizes.junqi[0].image='javascript:alert(1)';assert.throws(()=>validateState(image));
  assert.throws(()=>validateState({version:1}));
});
