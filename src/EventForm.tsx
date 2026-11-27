import {useEffect,useState} from 'react';
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
import type {ArenaCall} from './TableBindingFields';
import {ReportActions} from './ReportActions';
import {refereeReport} from './event-reports';
import {Check,ArrowLeft,ArrowRight} from 'lucide-react';
export type NewEventRules=Record<'gomoku'|'junqi',TournamentRules>;
export function EventForm({initial,creating,saving,onSave,members=[],call}:{initial:EventSettings;creating:boolean;saving:boolean;members?:RefereeOption[];call?:ArenaCall;onSave:(value:EventSettings,rules:NewEventRules,schedule:Schedule)=>Promise<void>}){
 const [draft,setDraft]=useState(()=>({...structuredClone(initial),autoBackup:creating?{enabled:false,intervalMinutes:10}:backupSettings(initial)})),[custom,setCustom]=useState(''),[error,setError]=useState('');
 const [rules,setRules]=useState<NewEventRules>(()=>({gomoku:defaultRules(),junqi:defaultRules()}));
 const [schedule,setSchedule]=useState(emptySchedule);
 const [step,setStep]=useState(0),[ruleSport,setRuleSport]=useState<'gomoku'|'junqi'>('gomoku'),[created,setCreated]=useState<RefereeOption[]>([]);
 const people=[...new Map([...members,...created].map(p=>[p.id,p])).values()];
 const steps=['赛事信息','赛制与奖项','棋盘与裁判','核对与创建'];
 useEffect(()=>{setError('');},[schedule,draft,rules]);
 function advance(){setError('');try{if(step===0)validateEvent(draft);if(step===1){validateRules(rules.gomoku);validateRules(rules.junqi);}if(step===2)validateTableBindings(schedule);setStep(step+1);}catch(e){setError((e as Error).message);}}
 const colleges=[...new Set([...COLLEGES,...draft.colleges])];
 return <form className={'event-form '+(creating?'event-wizard':'')} onSubmit={async e=>{e.preventDefault();if(creating&&step<3){advance();return;}setError('');try{if(creating)validateTableBindings(schedule);await onSave(validateEvent(draft),{gomoku:validateRules(rules.gomoku),junqi:validateRules(rules.junqi)},schedule);}catch(err){setError((err as Error).message);}}}>
 {creating&&<nav className="wizard-steps" aria-label="创建竞赛步骤">{steps.map((label,i)=><button type="button" key={label} disabled={i>step} aria-current={step===i?'step':undefined} onClick={()=>{setStep(i);setError('');}}><span>{i<step?<Check size={15}/>:i+1}</span><b>{label}</b></button>)}</nav>}
 <div className="wizard-stage">
 {(!creating||step===0)&&<>
 {creating&&<div className="wizard-stage-title"><span className="eyebrow">01 / EVENT DETAILS</span><h3>先为这场比赛，定好时间与地点。</h3><p>名单在创建后导入，所有赛程与裁判安排独立保存。</p></div>}
 <label>比赛名称<input required maxLength={60} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <fieldset><legend>举办学院（可多选）</legend><div className="event-colleges">{colleges.map(c=><label key={c}><input type="checkbox" checked={draft.colleges.includes(c)} onChange={e=>setDraft({...draft,colleges:e.target.checked?[...draft.colleges,c]:draft.colleges.filter(v=>v!==c)})}/>{c}</label>)}</div><div className="event-custom"><input aria-label="其他举办学院" placeholder="添加其他学院" maxLength={60} value={custom} onChange={e=>setCustom(e.target.value)}/><button type="button" className="button secondary small" onClick={()=>{const c=custom.trim();if(c&&!draft.colleges.includes(c)){setDraft({...draft,colleges:[...draft.colleges,c]});setCustom('');}}}>添加学院</button></div></fieldset>
 <div className="form-grid"><label>开始时间（北京时间）<input type="datetime-local" required value={draft.startsAt} onChange={e=>setDraft({...draft,startsAt:e.target.value})}/></label><label>结束时间（北京时间）<input type="datetime-local" required min={draft.startsAt} value={draft.endsAt} onChange={e=>setDraft({...draft,endsAt:e.target.value})}/></label></div>
 <label>比赛地点<input required maxLength={120} value={draft.venue} onChange={e=>setDraft({...draft,venue:e.target.value})}/></label>
 </>}
 {creating&&step===1&&<><div className="wizard-stage-title"><span className="eyebrow">02 / COMPETITION RULES</span><h3>两个项目，各有清晰规则。</h3><p>默认并列两名季军，末三轮三局两胜。抽签后可按具体场次调整。</p></div><div className="sport-tabs">{(['gomoku','junqi'] as const).map(sp=><button type="button" key={sp} aria-pressed={ruleSport===sp} className={ruleSport===sp?'selected':''} onClick={()=>setRuleSport(sp)}>{sp==='gomoku'?'五子棋':'军棋'}</button>)}</div><fieldset><legend>{ruleSport==='gomoku'?'五子棋':'军棋'} · 赛制与奖项</legend><RuleFields value={rules[ruleSport]} prefix={ruleSport==='gomoku'?'五子棋':'军棋'} onChange={value=>setRules({...rules,[ruleSport]:value})}/></fieldset></>}
 {creating&&step===2&&<TableBindingFields value={schedule} onChange={setSchedule} members={people} call={call} onMemberCreated={p=>setCreated(old=>[...old,p])}/>}
 {(!creating||step===3)&&<>
 {creating&&<><div className="wizard-stage-title"><span className="eyebrow">04 / READY TO LAUNCH</span><h3>核对安排，准备开启比赛。</h3><p>以下 PDF 为未发布草稿。创建成功后，可在该赛事的资料打印中心导出正式版本。</p></div><div className="creation-review"><div><small>赛事</small><b>{draft.name}</b><span>{draft.startsAt.replace('T',' ')} 至 {draft.endsAt.replace('T',' ')}</span><span>{draft.venue}</span></div><div><small>棋盘与裁判</small><b>{schedule.counts.gomoku+schedule.counts.junqi} 桌 / {Object.values(schedule.bindings).filter(keys=>keys.length).length} 名裁判</b><span>五子棋 {schedule.counts.gomoku} 桌 · 军棋 {schedule.counts.junqi} 桌</span><span>每桌均已安排负责裁判</span></div></div><ReportActions build={()=>refereeReport(validateEvent(draft),schedule,people,'创建草稿',true)}/></>}
 <BackupFields value={draft.autoBackup} onChange={autoBackup=>setDraft({...draft,autoBackup})}/>
 {!creating&&<p className="info-note">更新基本信息后，各设备同步展示，保留当前赛程与成绩。</p>}
 </>}
 </div>
 {error&&<p className="wizard-error" role="alert">{error}</p>}<div className="wizard-footer"><span>{creating?'步骤 '+(step+1)+' / 4 · '+steps[step]:'竞赛信息编辑'}</span><div>{creating&&step>0&&<button type="button" className="button secondary" onClick={()=>{setStep(step-1);setError('');}}><ArrowLeft size={16}/>上一步</button>}<button className="button primary" disabled={saving} type="submit">{saving?'正在保存…':creating?(step===3?'核对完成，创建竞赛':'下一步'):'保存竞赛信息'}<ArrowRight size={16}/></button></div></div>
 </form>;
}
