import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNewEventPassword} from '../src/event-password.ts';
test('创建时赛事密码必填、确认一致，校验字符数及 bcrypt 字节上限',()=>{for(const value of [undefined,null,'','       ','1234567','中'.repeat(25)])assert.throws(()=>validateNewEventPassword(value),/赛事密码/);assert.throws(()=>validateNewEventPassword('TEST-EVENT','OTHER-EVENT'),/不一致/);assert.equal(validateNewEventPassword('TEST-EVENT','TEST-EVENT'),'TEST-EVENT');assert.equal(validateNewEventPassword('中'.repeat(24)),'中'.repeat(24));});
