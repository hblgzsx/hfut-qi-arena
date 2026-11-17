import { buildBracket, setResult, validateState } from './engine.ts';
import type { Result, Sport, State } from './engine.ts';
export function matchSignature(s:State,sport:Sport,id:string):string {
  const t=s.tournaments[sport],m=buildBracket(t).flat().find(m=>m.id===id);
  return JSON.stringify([t.drawnAt,m?.a.id,m?.b.id,m?.bestOf,t.results[id]??null]);
}
export function redactState(s:State,role:'public'|'referee'|'admin'):State {
  if(role==='admin'){const result=structuredClone(s);for(const t of Object.values(result.tournaments))t.players=t.players.map(p=>{const {phone,qq,...safe}=p;void phone;void qq;return safe as typeof p;});return result;}
  const result=structuredClone(s);result.audit=[];
  for(const sport of ['gomoku','junqi'] as Sport[]){
    const t=result.tournaments[sport];
    t.players=t.players.map(p=>{const {phone,qq,...safe}=p;void phone;void qq;return {...safe,studentId:role==='public'?p.id:p.studentId,gender:''} as typeof p;});
    if(role==='public')for(const r of Object.values(t.results)){r.referee='赛事裁判';r.reason=r.kind==='played'?'':'裁判判定';}
  }
  return result;
}
export function applyCloudScore(state:State,input:{sport:Sport;id:string;result:Result|null;expectedSignature:string},role:'admin'|'referee',referee:string):State {
  const {sport,id}=input;if(!['gomoku','junqi'].includes(sport)||typeof id!=='string')throw new Error('无效项目或场次。');
  if(matchSignature(state,sport,id)!==input.expectedSignature)throw new Error('此场比赛已被其他裁判更新，或参赛双方已改变。请重新打开对局后录入。');
  const t=state.tournaments[sport],m=buildBracket(t).flat().find(m=>m.id===id);
  if(!m?.ready)throw new Error('本场双方尚未确定。');
  if(role==='referee'&&(m.resolved||!input.result))throw new Error('已结束比赛的更正和撤销须由管理员处理。');
  if(role==='referee'&&input.result?.kind==='adjudicated')throw new Error('直接裁定胜方仅管理员可操作。');
  const r=input.result?{...input.result,referee:referee.slice(0,40),updatedAt:new Date().toISOString()}:null;
  if(r&&(typeof r.reason!=='string'||r.reason.length>200||!Array.isArray(r.games)))throw new Error('赛果格式不正确。');
  const next={...state,revision:crypto.randomUUID(),tournaments:{...state.tournaments,[sport]:setResult(t,id,r)}};
  next.audit=[{id:crypto.randomUUID(),sport,time:new Date().toISOString(),message:resultAudit(state,sport,id,r,referee)},...next.audit].slice(0,200);
  return validateState(next);
}
export function resultAudit(state:State,sport:Sport,id:string,result:Result|null,actor:string):string {
  const t=state.tournaments[sport],m=buildBracket(t).flat().find(m=>m.id===id);
  const summary=(r:Result|undefined|null)=>!r?'未录入':r.kind==='played'?`逐局 ${r.games.join('/')} (${r.games.filter(g=>g==='A').length}:${r.games.filter(g=>g==='B').length})`:r.kind==='double'?'双方取消资格':`${r.kind==='adjudicated'?'管理员裁定':'弃权判定'} ${t.players.find(p=>p.id===(r.winner==='A'?m?.a.id:m?.b.id))?.name??r.winner}胜`;
  return `${id} · ${actor} · ${summary(t.results[id])} → ${summary(result)}${result?.reason?` · 原因：${result.reason}`:''}`;
}
