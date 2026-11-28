import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveCreationDraft,loadCreationDraft,clearCreationDraft} from '../src/event-creation-draft.ts';
import {defaultEvent} from '../src/event-settings.ts';
import {defaultRules} from '../src/tournament-rules.ts';
import {emptySchedule} from '../src/scheduling.ts';
test('创建草稿按账号隔离，持久层不含密码，清理后不沿用已发布安排',()=>{
 const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)} as Storage;
 const draft={draft:defaultEvent(),custom:'学院草稿',rules:{gomoku:defaultRules(),junqi:defaultRules()},schedule:emptySchedule(),step:2,ruleSport:'gomoku' as const,created:[],password:'PRIVATE-PASSWORD',confirmation:'PRIVATE-PASSWORD'};
 saveCreationDraft('a',draft,storage);assert.equal([...map.values()].join('').includes('PRIVATE-PASSWORD'),false);assert.equal(loadCreationDraft('a',storage)?.password,'PRIVATE-PASSWORD');assert.equal(loadCreationDraft('b',storage),null);
 map.set('qi-event-creation-draft-v1:b',map.get('qi-event-creation-draft-v1:a')!);assert.equal(loadCreationDraft('b',storage)?.password,'');assert.equal(loadCreationDraft('b',storage)?.step,2);
 clearCreationDraft('a',storage);assert.equal(loadCreationDraft('a',storage),null);assert.equal(loadCreationDraft('b',storage)?.custom,'学院草稿');
});
