import {buildBracket,SPORT_NAMES,standings} from './engine.ts';
import type {State,Sport} from './engine.ts';
import {announcementText,nextRoundLabel} from './announcement-text.ts';
import {tableName,tableCallText} from './scheduling.ts';
import {resultDeliveryId} from './result-delivery.ts';
export interface BroadcastRow {id:string;kind:'result'|'call';title:string;text:string;time:number;sport:Sport;match:string;valid:boolean;detail:string;identity?:string;callId?:string;queueKey?:string;deliveryId?:string}
export function broadcastRows(state:State):BroadcastRow[]{
 const rows:BroadcastRow[]=[];
 for(const sport of ['gomoku','junqi'] as Sport[]){const t=state.tournaments[sport],rounds=buildBracket(t);for(const match of rounds.flat()){
  if(!match.resolved||match.bye||!match.result)continue;
  const name=t.players.find(p=>p.id===match.winner)?.name??'双方取消资格',opponent=t.players.find(p=>p.id===(match.winner===match.a.id?match.b.id:match.a.id))?.name??'';
  rows.push({id:`result:${sport}:${t.drawnAt}:${match.id}:${match.result.updatedAt}`,kind:'result',deliveryId:resultDeliveryId({sport,match,name,opponent,champion:!!match.winner&&standings(t).champion===match.winner,drawnAt:t.drawnAt}),queueKey:`${sport}-${t.drawnAt}-${match.id}-${match.result.updatedAt}`,sport,match:match.id,title:`${SPORT_NAMES[sport]} · ${match.label} · ${match.id}`,time:Date.parse(match.result.updatedAt),valid:true,detail:name,identity:JSON.stringify([sport,t.drawnAt,match.id]),text:announcementText({sport,match,name,opponent,champion:!!match.winner&&standings(t).champion===match.winner,nextRound:match.id==='BRONZE'?'':nextRoundLabel(match.round,rounds.length)})});
 }}
 for(const call of state.schedule?.calls??[]){const a=state.schedule!.assignments.find(a=>a.id===call.assignment);if(!a)continue;
  const t=state.tournaments[a.sport],match=buildBracket(t).flat().find(m=>m.id===a.match);
  const valid=a.status==='called'&&state.schedule!.draws[a.sport]===t.drawnAt&&!!match?.ready&&!match.resolved&&match.a.id===a.players[0]&&match.b.id===a.players[1];
  rows.push({id:'call:'+call.id,callId:call.id,kind:'call',sport:a.sport,match:a.match,title:`${tableName(a.sport,a.table)} · ${a.match}`,text:valid&&match?tableCallText(t,a.table,match):call.text,time:call.createdAt,valid,detail:valid?'等待双方到桌 · '+(match?.bestOf===1?'一局定胜负':'三局两胜'):a.status==='playing'?'已开赛，无需叫号':a.status==='finished'?'已结束，叫号失效':'已取消或已被替换'});
 }
 return rows.sort((a,b)=>b.time-a.time||a.id.localeCompare(b.id));
}
