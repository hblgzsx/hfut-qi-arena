import { SPORT_NAMES, roundLabel } from './engine.ts';
import type { Match, Sport } from './engine.ts';
export interface SpokenResult { sport:Sport; match:Match; name:string; opponent:string; champion:boolean; nextRound?:string }
export function spokenRound(label:string){return label.replace('1/4 决赛','四分之一决赛');}
export function announcementText(e:SpokenResult):string {
  const stage=spokenRound(e.match.label),prefix=SPORT_NAMES[e.sport]+'，'+stage+'，'+'第'+(e.match.index+1)+'场。';
  if(!e.match.winner)return prefix+'双方取消资格，本场结束，无选手晋级。';
  const outcome=e.match.result?.kind==='forfeit'?e.opponent+'弃权，'+e.name+'获胜':e.match.result?.kind==='adjudicated'?'管理员裁定，'+e.name+'战胜'+e.opponent:e.name+'战胜'+e.opponent;
  const score=e.match.result?.kind==='played'?'，局分'+(e.match.winner===e.match.a.id?e.match.score:[e.match.score[1],e.match.score[0]]).join('比'):'';
  return prefix+outcome+score+'。'+(e.champion?'获得本项目冠军！':e.nextRound?'晋级'+spokenRound(e.nextRound)+'！':'晋级下一轮！');
}
export function nextRoundLabel(round:number,total:number){return round+1<total?roundLabel(round+1,total):'';}

export function speechIdentity(e:SpokenResult&{drawnAt?:string}):string {
  // Ignore server timestamps, referee metadata and render state: they are not a new score.
  return JSON.stringify([e.sport,e.drawnAt||'',e.match.id,e.match.a.id,e.match.b.id,e.match.winner,e.match.score,e.match.result?.kind]);
}
