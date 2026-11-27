import test from 'node:test';
import assert from 'node:assert/strict';
import {backupSettings,defaultEvent,validateEvent} from '../src/event-settings.ts';
import {demoState,validateState} from '../src/engine.ts';
test('旧赛事默认关闭，间隔默认十分钟，开关与间隔可随时修改并随备份保留',()=>{
 assert.deepEqual(backupSettings(defaultEvent()),{enabled:false,intervalMinutes:10});
 const event=validateEvent({...defaultEvent(),autoBackup:{enabled:true,intervalMinutes:10}});
 assert.deepEqual(backupSettings(event),{enabled:true,intervalMinutes:10});
 const next=validateEvent({...event,autoBackup:{enabled:false,intervalMinutes:5}});
 assert.deepEqual(backupSettings(next),{enabled:false,intervalMinutes:5});
 const state=demoState();state.event=event;
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))).event?.autoBackup,event.autoBackup);
});
test('拒绝无效备份间隔与开关，其他赛事字段校验继续生效',()=>{
 for(const intervalMinutes of [0,-1,121,1.5,NaN,Infinity,'10']){
  assert.throws(()=>validateEvent({...defaultEvent(),autoBackup:{enabled:true,intervalMinutes}}));
 }
 for(const enabled of [undefined,'true',1])assert.throws(()=>validateEvent({...defaultEvent(),autoBackup:{enabled,intervalMinutes:10}}));
 for(const intervalMinutes of [1,10,120])assert.doesNotThrow(()=>validateEvent({...defaultEvent(),autoBackup:{enabled:true,intervalMinutes}}));
});
