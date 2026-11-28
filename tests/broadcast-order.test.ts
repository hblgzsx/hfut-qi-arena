import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBroadcastOrder,reserveBroadcast,finishBroadcast,calloutWait} from '../src/broadcast-order.ts';
test('赛果在延迟入队前占位，声音与画面都完成后等待完整15秒才允许叫号',()=>{
 let q=emptyBroadcastOrder();assert.equal(calloutWait(q,0),0);
 q=reserveBroadcast(reserveBroadcast(q,'visual:1'),'voice:1');assert.equal(calloutWait(q,2000),Infinity);
 q=finishBroadcast(q,'voice:1',30000);assert.equal(calloutWait(q,31000),Infinity);
 q=finishBroadcast(q,'visual:1',32000);assert.equal(calloutWait(q,46999),1);assert.equal(calloutWait(q,47000),0);
 assert.equal(finishBroadcast(q,'visual:1',80000).notBefore,47000,'duplicate completion must not restart delay');
});
test('多桌赛果依序播完，冷却中新赛果阻止叫号并从新结束时间重新计时',()=>{
 let q=reserveBroadcast(reserveBroadcast(emptyBroadcastOrder(),'1'),'2');q=finishBroadcast(q,'1',5000);assert.equal(calloutWait(q,60000),Infinity);q=finishBroadcast(q,'2',65000);assert.equal(calloutWait(q,70000),10000);q=reserveBroadcast(q,'3');assert.equal(calloutWait(q,80000),Infinity);q=finishBroadcast(q,'3',90000);assert.equal(calloutWait(q,104999),1);assert.equal(calloutWait(q,105000),0);
});
