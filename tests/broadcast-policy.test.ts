import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultQueueEnabled,resultAfterLogin} from '../src/broadcast-policy.ts';
test('超管默认播放，裁判默认关闭，其他账号不能默认弹出队列',()=>{
 assert.equal(defaultQueueEnabled('superadmin',true,false),true);assert.equal(defaultQueueEnabled('referee',true,true),false);
 assert.equal(defaultQueueEnabled('admin',true,true),false);assert.equal(defaultQueueEnabled('pending',true,true),false);
});
test('正式与演示队列只允许登录起点后的新赛果与更正，拒绝历史和无效时间',()=>{
 const start=Date.parse('2026-11-16T15:00:00Z');
 assert.equal(resultAfterLogin('2026-11-16T14:59:59Z',start),false);
 assert.equal(resultAfterLogin('2026-11-16T15:00:01Z',start),true);
 assert.equal(resultAfterLogin(undefined,start),false);assert.equal(resultAfterLogin('bad',start),false);
});
