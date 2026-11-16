import { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import type { Match, Result, Tournament } from './engine';
import { descendants } from './engine';
export function QuickDecision({t,match:m,onSave,saving,actor,onNormal}:{t:Tournament;match:Match;onSave:(r:Result)=>void;saving:boolean;actor:string;onNormal:()=>void}) {
  const [side,setSide]=useState<'A'|'B'>(m.winner===m.b.id?'B':'A'),[reason,setReason]=useState('');
  const affected=descendants(t,m.id).filter(id=>t.results[id]);
  return <form onSubmit={e=>{e.preventDefault();onSave({kind:'adjudicated',games:[],winner:side,reason:reason.trim(),referee:actor,first:m.result?.first??'A',updatedAt:new Date().toISOString()});}}>
    <div className="quick-decision-heading"><ShieldCheck size={20}/><span>{m.id} · {m.label} · 管理员直接裁定</span></div><div className="decision-players">{(['A','B'] as const).map(s=>{const p=t.players.find(p=>p.id===(s==='A'?m.a.id:m.b.id));return <button type="button" key={s} className={side===s?'selected':''} onClick={()=>setSide(s)}><span>{s}</span><b>{p?.name}</b><small>{p?.college}</small><i>{side===s?<><Check size={15}/>判定获胜</>:'点击选择胜方'}</i></button>;})}</div>
    <label className="form-label">判定 / 修改原因（必填）<textarea required minLength={2} maxLength={200} value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：核对裁判纸质记录，原录入胜方有误"/></label><div className="info-note">仅记录管理员确认的获胜方，不生成虚假单局比分。记录保存操作者、时间、修改前后结果与原因；晋级图更新 2 秒后播放赛果播报。</div>{affected.length>0&&<p className="validation-warning">此更正将清除后续 {affected.join('、')} 的成绩，提交后会再次列出影响并确认。</p>}<div className="modal-actions spread"><button type="button" className="text-button" onClick={onNormal}>改用逐局录分</button><button type="submit" className="button primary" disabled={saving||reason.trim().length<2}>{saving?'正在提交…':'确认胜方并更新晋级'}</button></div>
  </form>;
}
