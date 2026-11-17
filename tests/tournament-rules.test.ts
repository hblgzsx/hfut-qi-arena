import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyTournament,draw,buildBracket,setResult,standings,configureRules,descendants,validateState,emptyState} from '../src/engine.ts';
import type {Tournament,Result} from '../src/engine.ts';
import {defaultRules} from '../src/tournament-rules.ts';
import {announcementText} from '../src/announcement-text.ts';
import {matchSignature,applyCloudScore} from '../src/cloud-policy.ts';
const make=(n:number,count:0|1|2=2)=>draw({...emptyTournament('gomoku'),rules:{...defaultRules(),bronzeCount:count},players:Array.from({length:n},(_,i)=>({id:'p'+i,name:'选手'+i,studentId:''+i,college:'学院',phone:'',qq:'',gender:''}))},'config-test');
const win=(t:Tournament,id:string,side:'A'|'B'='A')=>{const m=buildBracket(t).flat().find(m=>m.id===id)!;return setResult(t,id,{kind:'played',games:m.bestOf===1?[side]:[side,side],first:'A',referee:'裁判',reason:'',updatedAt:new Date().toISOString()});};
test('新赛事默认末三轮三局两胜；未带规则的历史赛事保留旧赛制',()=>{
 for(const n of [7,16,32,64,128,256]){const t=make(n),rs=buildBracket(t);assert.deepEqual(rs.map((r,i)=>r[0].bestOf),rs.map((_,i)=>rs.length-i<=3?3:1));}
 const t=make(64);delete t.rules;assert.deepEqual(buildBracket(t).map(r=>r[0].bestOf),[1,1,3,3,3,3]);
});
test('单季军由半决赛负方产生，赛果、冠军与更正路径独立且可导出备份',()=>{
 for(const n of [4,7,8,32,64]){
  let t=make(n,1);while(buildBracket(t).flat().some(m=>!m.resolved)){const ready=buildBracket(t).flat().filter(m=>m.ready&&!m.resolved);assert.ok(ready.length);for(const m of ready)t=win(t,m.id);}
  const rounds=buildBracket(t),bronze=rounds.flat().find(m=>m.id==='BRONZE')!,p=standings(t);assert.equal(p.bronze.length,1);assert.equal(p.bronze[0],bronze.winner);assert.notEqual(p.champion,bronze.winner);assert.notEqual(p.runnerUp,bronze.winner);
  assert.equal(rounds.flat().filter(m=>m.result).length,n);assert.ok(descendants(t,rounds.at(-2)![0].id).includes('BRONZE'));
  const text=announcementText({sport:'gomoku',match:bronze,name:'季军选手',opponent:'对手',champion:false});assert.match(text,/获得本项目季军/);assert.doesNotMatch(text,/晋级下一轮/);
  const s=emptyState();s.tournaments.gomoku=t;assert.doesNotThrow(()=>validateState(JSON.parse(JSON.stringify(s))));
  const finalScore=t.results[rounds.at(-1)![0].id];t=setResult(t,bronze.id,null);assert.deepEqual(t.results[rounds.at(-1)![0].id],finalScore);t=win(t,bronze.id);
  t=win(t,rounds.at(-2)![0].id,'B');assert.equal(t.results.BRONZE,undefined);assert.equal(t.results[rounds.at(-1)![0].id],undefined);
 }
});
test('0/2 名季军与不足人数、弃权边界不伪造名次',()=>{
 for(const count of [0,1,2] as const)for(const n of [2,3,4,7]){let t=make(n,count);while(buildBracket(t).flat().some(m=>!m.resolved)){for(const m of buildBracket(t).flat().filter(m=>m.ready&&!m.resolved))t=win(t,m.id);}assert.equal(standings(t).bronze.length,count===0?0:count===1?(n>=4?1:0):n===2?0:n===3?1:2);}
 let t=make(4,1);const m=buildBracket(t)[0][0];const r:Result={kind:'forfeit',games:[],winner:'A',first:'A',reason:'对方弃权',referee:'裁判',updatedAt:new Date().toISOString()};t=setResult(t,m.id,r);t=win(t,'R1-M2');const b=buildBracket(t).flat().find(m=>m.id==='BRONZE')!;assert.equal(b.ready,false);assert.equal(standings(t).bronze.length,0);
});
test('单场覆盖、轮次继承、已录入保护、裁判旧签名与非法配置',()=>{
 let t=make(8);t=configureRules(t,{...t.rules!,quarterfinal:1,overrides:{'R1-M1':3}});assert.deepEqual(buildBracket(t)[0].map(m=>m.bestOf),[3,1,1,1]);
 const s=emptyState();s.tournaments.gomoku=t;const signature=matchSignature(s,'gomoku','R1-M2');const updated=structuredClone(s);updated.tournaments.gomoku=configureRules(t,{...t.rules!,overrides:{...t.rules!.overrides,'R1-M2':3}});
 assert.throws(()=>applyCloudScore(updated,{sport:'gomoku',id:'R1-M2',expectedSignature:signature,result:{kind:'played',games:['A'],first:'A',reason:'',referee:'裁判',updatedAt:''}},'referee','裁判'));
 t=win(t,'R1-M1');assert.throws(()=>configureRules(t,{...t.rules!,overrides:{'R1-M1':1}}),/已有成绩/);assert.throws(()=>configureRules(t,{...t.rules!,bronzeCount:0}),/季军人数/);assert.throws(()=>configureRules(t,{...t.rules!,bronzeCount:3} as never));
 const partial=make(8);const p=setResult(partial,'R1-M1',{kind:'played',games:['A'],first:'A',reason:'',referee:'裁判',updatedAt:''});assert.throws(()=>configureRules(p,{...p.rules!,quarterfinal:1}),/已有成绩/);
});
