import test from 'node:test';
import assert from 'node:assert/strict';
import {splitSpeechText} from '../src/split-speech.ts';
test('长播报分句逐条完成，完整保留姓名、标点和晋级信息，不产生超长片段',()=>{
 for(const text of ['五子棋，四分之一决赛，第12场。欧阳明月战胜李浩然，局分二比一。晋级半决赛！','军棋 15 号桌，下一场，请周树勋与张三来到 15 号桌，裁判请准备。','甲'.repeat(200),'😀'.repeat(60),'']){const chunks=splitSpeechText(text);assert.equal(chunks.join(''),text);assert.ok(chunks.every(c=>Array.from(c).length<=32));}
});
