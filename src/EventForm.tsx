import {useState} from 'react';
import {COLLEGES,validateEvent,backupSettings} from './event-settings';
import {BackupFields} from './AutoBackup';
import type {EventSettings} from './event-settings';
import {RuleFields} from './RuleFields';
import {defaultRules,validateRules} from './tournament-rules';
import type {TournamentRules} from './tournament-rules';
import {emptySchedule,validateTableBindings} from './scheduling';
import type {Schedule} from './scheduling';
import {TableBindingFields} from './TableBindingFields';
import type {RefereeOption} from './TableBindingFields';
export type NewEventRules=Record<'gomoku'|'junqi',TournamentRules>;
export function EventForm({initial,creating,saving,onSave,members=[]}:{initial:EventSettings;creating:boolean;saving:boolean;members?:RefereeOption[];onSave:(value:EventSettings,rules:NewEventRules,schedule:Schedule)=>Promise<void>}){
 const [draft,setDraft]=useState(()=>({...structuredClone(initial),autoBackup:creating?{enabled:false,intervalMinutes:10}:backupSettings(initial)})),[custom,setCustom]=useState(''),[error,setError]=useState('');
 const [rules,setRules]=useState<NewEventRules>(()=>({gomoku:defaultRules(),junqi:defaultRules()}));
 const [schedule,setSchedule]=useState(emptySchedule);
 const colleges=[...new Set([...COLLEGES,...draft.colleges])];
 return <form className="event-form" onSubmit={async e=>{e.preventDefault();setError('');try{if(creating)validateTableBindings(schedule);await onSave(validateEvent(draft),{gomoku:validateRules(rules.gomoku),junqi:validateRules(rules.junqi)},schedule);}catch(err){setError((err as Error).message);}}}>
 <label>比赛名称<input required maxLength={60} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <fieldset><legend>举办学院（可多选）</legend><div className="event-colleges">{colleges.map(c=><label key={c}><input type="checkbox" checked={draft.colleges.includes(c)} onChange={e=>setDraft({...draft,colleges:e.target.checked?[...draft.colleges,c]:draft.colleges.filter(v=>v!==c)})}/>{c}</label>)}</div><div className="event-custom"><input aria-label="其他举办学院" placeholder="添加其他学院" maxLength={60} value={custom} onChange={e=>setCustom(e.target.value)}/><button type="button" className="button secondary small" onClick={()=>{const c=custom.trim();if(c&&!draft.colleges.includes(c)){setDraft({...draft,colleges:[...draft.colleges,c]});setCustom('');}}}>添加学院</button></div></fieldset>
 <div className="form-grid"><label>开始时间（北京时间）<input type="datetime-local" required value={draft.startsAt} onChange={e=>setDraft({...draft,startsAt:e.target.value})}/></label><label>结束时间（北京时间）<input type="datetime-local" required min={draft.startsAt} value={draft.endsAt} onChange={e=>setDraft({...draft,endsAt:e.target.value})}/></label></div>
 <label>比赛地点<input required maxLength={120} value={draft.venue} onChange={e=>setDraft({...draft,venue:e.target.value})}/></label>
 <BackupFields value={draft.autoBackup} onChange={autoBackup=>setDraft({...draft,autoBackup})}/>
 {creating&&<TableBindingFields value={schedule} onChange={setSchedule} members={members}/>}
 {creating&&<><p className="info-note">创建时配置两个项目的赛制。默认两名季军；四分之一决赛、半决赛、决赛三局两胜，其余一局定胜负。抽签后还可设置具体场次。</p>{(['gomoku','junqi'] as const).map(sport=><fieldset key={sport}><legend>{sport==='gomoku'?'五子棋':'军棋'} · 赛制与奖项</legend><RuleFields value={rules[sport]} prefix={sport==='gomoku'?'五子棋':'军棋'} onChange={value=>setRules({...rules,[sport]:value})}/></fieldset>)}</>}
 <p className="info-note">{creating?'云端将创建独立竞赛，保留以往竞赛，可在侧栏切换。新竞赛初始名单、赛程和成绩为空。':'保存基本信息后，首页、导航和大屏同步更新，保留当前赛程与成绩。'}</p>
 {error&&<p role="alert">{error}</p>}<div className="modal-actions"><button className="button primary" disabled={saving} type="submit">{saving?'正在保存…':creating?'下一步：确认创建':'保存竞赛信息'}</button></div>
 </form>;
}
