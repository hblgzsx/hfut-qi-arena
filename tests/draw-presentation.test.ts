import test from 'node:test';
import assert from 'node:assert/strict';
import {draw,emptyTournament} from '../src/engine.ts';
import {drawPresentation} from '../src/draw-presentation.ts';
test('逐人揭晓完整覆盖锁定签位，抽出后池子缩减，不改变对手或轮空',()=>{
 for(const n of [2,7,16,89,256]){const t=draw({...emptyTournament('gomoku'),players:Array.from({length:n},(_,i)=>({id:'p'+i,name:'选手'+i,studentId:'id'+i,college:'学院',phone:'',qq:'',gender:''}))},'presentation-'+n),before=JSON.stringify(t),p=drawPresentation(t);
 assert.equal(p.verified,true);assert.equal(p.reveals.length,n);const pool=new Set(t.players.map(p=>p.id));for(const step of p.reveals){assert.ok(pool.delete(step.playerId));assert.equal(t.seeds[step.slot],step.playerId);assert.equal(step.bye,step.opponentId===null);}assert.equal(pool.size,0);assert.equal(JSON.stringify(t),before);assert.equal(p.reveals.filter(r=>r.bye).length,t.seeds.length-n);
 }
});
test('重复或缺失签位阻止展示，不把历史不同算法结果伪装为验证成功',()=>{
 assert.throws(()=>drawPresentation(emptyTournament('junqi')),/锁定/);const t=draw({...emptyTournament('junqi'),players:['a','b'].map(id=>({id,name:id,studentId:id,college:'学院',phone:'',qq:'',gender:''}))},'valid');t.seeds=[t.seeds[0],t.seeds[0]];assert.throws(()=>drawPresentation(t),/不一致/);
});
