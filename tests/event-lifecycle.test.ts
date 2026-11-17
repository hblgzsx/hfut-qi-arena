import test from 'node:test';import assert from 'node:assert/strict';
import {assertUniqueEventName,eventIsActive} from '../src/event-settings.ts';
test('竞赛名称忽略空白与英文大小写，编辑时排除自身，其他同名仍禁止',()=>{
 const events=[{id:'one',name:'HFUT 棋类友谊赛'},{id:'two',name:'春季赛'}];
 assert.throws(()=>assertUniqueEventName(' hfut　棋类友谊赛 ',events),/同名/);
 assert.doesNotThrow(()=>assertUniqueEventName('hfut棋类友谊赛',events,'one'));
 assert.throws(()=>assertUniqueEventName('春季赛',events,'one'),/同名/);
});
test('裁判时间以北京时间解析：含开始、不含结束，跨日、非法及设备时区无关',()=>{
 const e={startsAt:'2026-11-29T23:00',endsAt:'2026-11-30T01:00'};
 assert.equal(eventIsActive(e,Date.parse('2026-11-29T14:59:59Z')),false);
 assert.equal(eventIsActive(e,Date.parse('2026-11-29T15:00:00Z')),true);
 assert.equal(eventIsActive(e,Date.parse('2026-11-29T16:59:59Z')),true);
 assert.equal(eventIsActive(e,Date.parse('2026-11-29T17:00:00Z')),false);
 assert.equal(eventIsActive({startsAt:'invalid',endsAt:'invalid'}),false);
});
