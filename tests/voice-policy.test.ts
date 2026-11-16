import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voiceGender,chooseVoice,voiceLabel} from '../src/voice-policy.ts';
test('男女音色按已知声线匹配，优先自然音色，不把缺失男声伪装成女声',()=>{
 const v=(name:string)=>({name,voiceURI:name,lang:'zh-CN'});
 const female=v('Microsoft Huihui'),male=v('Microsoft Kangkang'),natural=v('Microsoft Xiaoxiao Online (Natural)');
 assert.equal(voiceGender(female),'female');assert.equal(voiceGender(male),'male');
 assert.equal(chooseVoice([female,male,natural],'female'),natural);assert.equal(chooseVoice([female,male],'male'),male);
 assert.equal(chooseVoice([female],'male'),undefined);assert.equal(voiceGender(v('Unknown')),'auto');
 assert.match(voiceLabel(male),/男声/);assert.match(voiceLabel(natural),/自然音色/);
});
