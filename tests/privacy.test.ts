import {test} from 'node:test';import assert from 'node:assert/strict';
import {demoState,validateState} from '../src/engine.ts';import {redactState} from '../src/cloud-policy.ts';
test('旧报名和旧备份的联系方式及 QQ 在读取、保存和备份验证中剔除，缺失字段仍可使用',()=>{
 const s=demoState();s.tournaments.gomoku.players[0].phone='13800138000';s.tournaments.gomoku.players[0].qq='987654321';
 for(const role of ['public','referee','admin'] as const){const sanitized=redactState(s,role);assert.equal('phone' in sanitized.tournaments.gomoku.players[0],false);assert.equal('qq' in sanitized.tournaments.gomoku.players[0],false);}
 const safe=validateState(JSON.parse(JSON.stringify(s)));assert.doesNotMatch(JSON.stringify(safe),/13800138000|987654321|"phone"|"qq"/);assert.doesNotThrow(()=>validateState(safe));assert.equal(safe.tournaments.gomoku.players[0].studentId,'2026010001');
});
