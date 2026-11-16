import {test} from 'node:test';
import assert from 'node:assert/strict';
import {announcementText,nextRoundLabel,speechIdentity} from '../src/announcement-text.ts';
import {buildBracket,demoState} from '../src/engine.ts';
test('播报包含项目、完整轮次、胜者、局分与晋级去向；决赛和双弃权不误报下一轮',()=>{
  const match=buildBracket(demoState().tournaments.gomoku)[0][0];
  const e={sport:'gomoku' as const,name:'张三',opponent:'李四',champion:false,nextRound:'半决赛',match:{...match,label:'1/4 决赛',winner:match.a.id,score:[2,1] as [number,number],result:{kind:'played' as const,games:[] as [],reason:'',referee:'',first:'A' as const,updatedAt:''}}};
  const text=announcementText(e);assert.match(text,/五子棋，四分之一决赛/);assert.match(text,/张三战胜李四，局分2比1/);assert.match(text,/晋级半决赛/);assert.equal(text.split('张三').length-1,1);assert.equal(speechIdentity(e),speechIdentity({...e,match:{...e.match,result:{...e.match.result,updatedAt:'new-server-timestamp'}}}));
  assert.match(announcementText({...e,champion:true,match:{...e.match,label:'决赛'}}),/获得本项目冠军/);
  const double=announcementText({...e,match:{...e.match,winner:null}});assert.match(double,/无选手晋级/);assert.doesNotMatch(double,/恭喜/);
  assert.equal(nextRoundLabel(0,3),'半决赛');assert.equal(nextRoundLabel(1,3),'决赛');assert.equal(nextRoundLabel(2,3),'');
});
