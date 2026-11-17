import {buildBracket,SPORT_NAMES,standings} from './engine.ts';
import type {Player,State,Sport,Tournament} from './engine';
export interface RecordRow {round:string;detail:string;a?:Player;b?:Player;winner:string;referee:string;note:string}
export function recordReady(t:Tournament){const matches=buildBracket(t).flat();return !!t.seeds.length&&matches.every(m=>m.resolved||(!m.ready&&m.a.settled&&m.b.settled));}
export function recordRows(t:Tournament):RecordRow[]{
 const rows:RecordRow[]=[];
 for(const m of buildBracket(t).flat()){
  if(!m.result||m.bye)continue;const r=m.result,p=(id:string|null)=>t.players.find(p=>p.id===id),referee=r.referee.trim()||'超级管理员';
  if(r.kind==='played')r.games.forEach((winner,i)=>{const first=i%2===0?r.first:r.first==='A'?'B':'A';rows.push({round:m.label,detail:m.id+' / 第'+(i+1)+'局',a:p(first==='A'?m.a.id:m.b.id),b:p(first==='A'?m.b.id:m.a.id),winner:winner==='D'?'和棋':winner===first?'A':'B',referee,note:r.reason});});
  else rows.push({round:m.label,detail:m.id+' / 非实赛',a:p(m.a.id),b:p(m.b.id),winner:r.kind==='double'?'双弃权':(r.winner??'')+(r.kind==='adjudicated'?'（裁定）':'（弃权）'),referee,note:r.reason});
 }
 return rows;
}
export function recordHonors(state:State,sport:Sport){const t=state.tournaments[sport],s=standings(t),name=(id:string|null)=>t.players.find(p=>p.id===id)?.name??'空缺';return SPORT_NAMES[sport]+' / 冠军：'+name(s.champion)+' / 亚军：'+name(s.runnerUp)+' / 季军：'+(s.bronze.length?s.bronze.map(name).join('、'):'无');}
