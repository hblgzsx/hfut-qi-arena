import {useState} from 'react';
import {buildBracket,configureRules,matchBestOf} from './engine';
import type {Tournament} from './engine';
import {defaultRules} from './tournament-rules';
import type {TournamentRules} from './tournament-rules';
export function RulesEditor({t,saving,onSave}:{t:Tournament;saving:boolean;onSave:(t:Tournament)=>Promise<boolean>}){
 const [draft,setDraft]=useState<TournamentRules>(()=>t.rules?structuredClone(t.rules):{...defaultRules(),overrides:Object.fromEntries(buildBracket(t).flat().map(m=>[m.id,m.bestOf]))}),[error,setError]=useState('');
 const started=Object.keys(t.results).length>0,labels={preliminary:'其余轮次',quarterfinal:'四分之一决赛',semifinal:'半决赛',final:'决赛',bronze:'季军争夺赛'} as const;
 const options=<><option value={1}>一局定胜负</option><option value={3}>三局两胜</option></>;
 const draftMatches=buildBracket({...t,rules:draft}).flat();
 return <form className="event-form" onSubmit={async e=>{e.preventDefault();setError('');try{await onSave(configureRules(t,draft));}catch(err){setError((err as Error).message);}}}>
 <label>季军人数<select aria-label="季军人数" value={draft.bronzeCount} disabled={started} onChange={e=>setDraft({...draft,bronzeCount:Number(e.target.value) as 0|1|2})}><option value={0}>0 名 · 不设季军</option><option value={1}>1 名 · 半决赛负方参加季军争夺赛</option><option value={2}>2 名 · 半决赛负方并列季军（默认）</option></select></label>
 <p className="subtle">季军人数在第一场成绩录入后锁定。不足 4 人、弃权或双弃权时不补造名次；单季军须实际完成季军争夺赛。</p>
 <div className="form-grid">{Object.entries(labels).map(([key,label])=><label key={key}>{label}<select aria-label={label} value={draft[key as keyof typeof labels]} onChange={e=>setDraft({...draft,[key]:Number(e.target.value)})}>{options}</select></label>)}</div>
 <p className="info-note">默认：四分之一决赛、半决赛、决赛三局两胜，其余一局定胜负。和棋不计胜局。已有成绩的场次不可更改赛制；未开始的场次可以单独设置。</p>
 {draftMatches.length>0&&<details className="match-rules"><summary>具体场次设置（{draftMatches.length} 场）</summary>{draftMatches.map(m=>{const original=buildBracket(t).flat().find(x=>x.id===m.id),locked=!!t.results[m.id];return <label key={m.id}><span>{m.id} · {m.label}<small>{[m.a.id,m.b.id].map(id=>t.players.find(p=>p.id===id)?.name??'待确定').join(' / ')}{locked?' · 已录入，锁定':''}</small></span><select aria-label={m.id+'赛制'} disabled={locked} value={locked?original?.bestOf:(draft.overrides[m.id]??0)} onChange={e=>{const overrides={...draft.overrides};if(e.target.value==='0')delete overrides[m.id];else overrides[m.id]=Number(e.target.value) as 1|3;setDraft({...draft,overrides});}}>{!locked&&<option value={0}>跟随轮次（BO{matchBestOf({...t,rules:{...draft,overrides:{}}},m.round,buildBracket(t).length,m.id)}）</option>}{options}</select></label>;})}</details>}
 {error&&<p role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={()=>{setDraft(defaultRules());setError('已载入默认配置，请保存；如果影响已有成绩，系统会阻止保存。');}}>恢复默认配置</button><button className="button primary" disabled={saving} type="submit">{saving?'正在保存…':'保存赛制与奖项'}</button></div>
 </form>;
}
