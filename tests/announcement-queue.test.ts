import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AnnouncementQueue} from '../src/announcement-queue.ts';
test('保存回包、实时回包和轮询重复送达只入队一次，等待中的重复事件也不重播',()=>{
  const q=new AnnouncementQueue<{key:string}>(),event={key:'draw1-gomoku-R1-M1-v1'};
  const pending=q.reserve([event]);assert.equal(pending.length,1);
  assert.equal(q.reserve([event]).length,0);q.append(pending);assert.equal(q.next(()=>true)?.key,event.key);
  assert.equal(q.reserve([event]).length,0);assert.equal(q.next(()=>true),undefined);
  const corrected={key:'draw1-gomoku-R1-M1-v2'};q.append(q.reserve([corrected]));assert.equal(q.next(()=>true)?.key,corrected.key);
});
test('队列跳过已经撤销的旧成绩，保留其他场次和新的更正赛果',()=>{
  const q=new AnnouncementQueue<{key:string}>();q.append(q.reserve([{key:'obsolete'},{key:'other'},{key:'correction'}]));
  assert.equal(q.next(e=>e.key!=='obsolete')?.key,'other');assert.equal(q.next(()=>true)?.key,'correction');assert.equal(q.next(()=>true),undefined);
});
