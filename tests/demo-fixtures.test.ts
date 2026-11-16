import {test} from 'node:test';
import assert from 'node:assert/strict';
import {competitionDemo,DEMO_SIZES} from '../src/demo-fixtures.ts';
import {validateState,buildBracket} from '../src/engine.ts';
test('32—256 人双项目演示均为有效虚拟名单，最大 512 人，无联系方式和真实账号',()=>{
 for(const n of DEMO_SIZES){const s=competitionDemo(n);assert.doesNotThrow(()=>validateState(s));
 for(const t of Object.values(s.tournaments)){assert.equal(t.players.length,n);assert.equal(t.seeds.length,n);assert.equal(new Set(t.players.map(p=>p.studentId)).size,n);assert.equal(new Set(t.players.map(p=>p.name)).size,n);assert.ok(t.players.every(p=>p.name&&!p.phone&&!p.qq));assert.ok(buildBracket(t).flat().some(m=>m.ready&&!m.resolved));assert.equal(t.demo,true);}}
 assert.throws(()=>competitionDemo(257));
});
