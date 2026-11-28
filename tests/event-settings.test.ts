import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultEvent,validateEvent,eventDate,restMinutes} from '../src/event-settings.ts';
import {demoState,validateState} from '../src/engine.ts';
import {redactState} from '../src/cloud-policy.ts';
test('竞赛信息兼容旧备份，云端公开快照保留基本信息，拒绝空学院与反向时间',()=>{
 const old=demoState();assert.doesNotThrow(()=>validateState(old));
 const event=validateEvent({...defaultEvent(),name:' 自定义棋赛 ',colleges:['经济学院']});
 assert.equal(event.name,'自定义棋赛');old.event=event;
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(old))).event,event);
 assert.deepEqual(redactState(old,'public').event,event);
 assert.match(eventDate(event),/29/);
 for(const invalid of [{name:' '},{venue:''},{colleges:[]},{colleges:['经济学院','经济学院']},{endsAt:event.startsAt},{startsAt:'invalid'}])assert.throws(()=>validateEvent({...event,...invalid}));
});
test('旧赛事默认休息3分钟，新设置可设0至120分钟并随公开快照和备份保留',()=>{
 assert.equal(restMinutes(),3);for(const value of [0,1,3,10,120]){const state=demoState();state.event=validateEvent({...defaultEvent(),restMinutes:value});assert.equal(restMinutes(validateState(JSON.parse(JSON.stringify(state))).event),value);assert.equal(restMinutes(redactState(state,'public').event),value);}
 for(const value of [-1,121,1.5,NaN,Infinity,'3',null])assert.throws(()=>validateEvent({...defaultEvent(),restMinutes:value}));
});
