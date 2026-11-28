import {bracketSize,draw} from './engine.ts';
import type {Tournament} from './engine.ts';
export interface DrawReveal {index:number;playerId:string;slot:number;match:string;side:'A'|'B';opponentId:string|null;bye:boolean}
// A presentation always reads committed seats. Pausing or recording never draws again.
export function drawPresentation(t:Tournament){
 if(t.players.length<2||t.seeds.length!==bracketSize(t.players.length))throw new Error('请先完成本项目抽签并锁定签位。');
 const people=new Map(t.players.map(p=>[p.id,p]));const picked=t.seeds.filter((id):id is string=>!!id);
 if(people.size!==t.players.length||picked.length!==people.size||new Set(picked).size!==picked.length||picked.some(id=>!people.has(id)))throw new Error('签位与报名名单不一致，不能生成抽签展示。');
 const verified=!!t.drawSeed&&JSON.stringify(draw(t,t.drawSeed).seeds)===JSON.stringify(t.seeds);
 const reveals:DrawReveal[]=[];
 t.seeds.forEach((id,slot)=>{if(!id)return;const other=t.seeds[slot%2?slot-1:slot+1];reveals.push({index:reveals.length+1,playerId:id,slot,match:'R1-M'+(Math.floor(slot/2)+1),side:slot%2?'B':'A',opponentId:other,bye:!other});});
 return {reveals,verified,players:t.players.map(p=>({id:p.id,name:p.name})),seed:t.drawSeed,drawnAt:t.drawnAt};
}
