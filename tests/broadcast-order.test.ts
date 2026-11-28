import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBroadcastOrder,reserveBroadcast,finishBroadcast,calloutWait,validateCallGap,callGapSeconds,setCallGapSeconds,reserveResult,refreshResult,finishResultVoice,finishResultVisual,tableCallWait} from '../src/broadcast-order.ts';
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
test('可设置零至300秒叫号间隔，结束时采用配置，拒绝小数、负数和无效值',()=>{for(const seconds of [0,5,15,60,300]){assert.equal(validateCallGap(seconds),seconds);const q=finishBroadcast(reserveBroadcast(emptyBroadcastOrder(),'voice'), 'voice',1000,seconds*1000);assert.equal(calloutWait(q,1000),seconds*1000);}for(const n of [-1,301,NaN,Infinity,2.5])assert.throws(()=>validateCallGap(n));});
test('中途修改间隔从真实结束时刻重算，挂起任务续期，崩溃遗留占位到期不永久阻塞',()=>{
 const data=new Map<string,string>(),original=Date.now,storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),win=Object.getOwnPropertyDescriptor(globalThis,'window');let now=1000;Date.now=()=>now;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent(){}}});
 try{assert.equal(callGapSeconds('a'),15);reserveResult('a','one');assert.equal(tableCallWait('a'),Infinity);finishResultVoice('a','one',true);finishResultVisual('a','one');assert.equal(tableCallWait('a'),15000);now=2000;setCallGapSeconds('a',5);assert.equal(tableCallWait('a'),4000);setCallGapSeconds('a',60);assert.equal(tableCallWait('a'),59000);assert.throws(()=>setCallGapSeconds('a',301));assert.equal(callGapSeconds('a'),60);assert.equal(callGapSeconds('other'),15);reserveResult('a','crash');now=61000;refreshResult('a','crash');now=122000;assert.equal(tableCallWait('a'),Infinity);now=182000;assert.equal(tableCallWait('a'),0);data.set('qi-broadcast-order-v1:old',JSON.stringify({pending:['voice:orphan'],notBefore:0}));assert.equal(tableCallWait('old'),0);}
 finally{Date.now=original;if(storage)Object.defineProperty(globalThis,'localStorage',storage);else Reflect.deleteProperty(globalThis,'localStorage');if(win)Object.defineProperty(globalThis,'window',win);else Reflect.deleteProperty(globalThis,'window');}
});
