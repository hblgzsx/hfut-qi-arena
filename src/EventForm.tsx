import {useEffect,useState} from 'react';
import {COLLEGES,validateEvent,backupSettings,restMinutes} from './event-settings';
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
import {validateNewEventPassword} from './event-password';
import {loadCreationDraft,saveCreationDraft} from './event-creation-draft';
export type NewEventRules=Record<'gomoku'|'junqi',TournamentRules>;
export function EventForm({initial,creating,saving,onSave,members=[],call,draftOwner='local'}:{initial:EventSettings;creating:boolean;saving:boolean;members?:RefereeOption[];call?:ArenaCall;draftOwner?:string;onSave:(value:EventSettings,rules:NewEventRules,schedule:Schedule,password:string)=>Promise<void>}){
 const [restored]=useState(()=>creating?loadCreationDraft(draftOwner,localStorage):null);
 const [draft,setDraft]=useState(()=>restored?.draft??({...structuredClone(initial),autoBackup:creating?{enabled:false,intervalMinutes:10}:backupSettings(initial)})),[custom,setCustom]=useState(restored?.custom??''),[error,setError]=useState('');
 const [rules,setRules]=useState<NewEventRules>(()=>restored?.rules??({gomoku:defaultRules(),junqi:defaultRules()}));
 const [schedule,setSchedule]=useState(()=>restored?.schedule??emptySchedule());
 const [password,setPassword]=useState(restored?.password??''),[confirmation,setConfirmation]=useState(restored?.confirmation??'');
 const [step,setStep]=useState(restored?.step??0),[ruleSport,setRuleSport]=useState<'gomoku'|'junqi'>(restored?.ruleSport??'gomoku'),[created,setCreated]=useState<RefereeOption[]>(restored?.created??[]),[draftSaved,setDraftSaved]=useState(true);
 useEffect(()=>{if(creating)setDraftSaved(saveCreationDraft(draftOwner,{draft,custom,rules,schedule,password,confirmation,step,ruleSport,created},localStorage));},[creating,draftOwner,draft,custom,rules,schedule,password,confirmation,step,ruleSport,created]);
 const people=[...new Map([...members,...created].map(p=>[p.id,p])).values()];
 const steps=['赛事信息','赛制与奖项','棋盘与裁判','核对与创建'];
 useEffect(()=>{setError('');},[schedule,draft,rules,password,confirmation]);
 function advance(){setError('');try{if(step===0){validateEvent(draft);validateNewEventPassword(password,confirmation);}if(step===1){validateRules(rules.gomoku);validateRules(rules.junqi);}if(step===2)validateTableBindings(schedule);setStep(step+1);}catch(e){setError((e as Error).message);}}
 const colleges=[...new Set([...COLLEGES,...draft.colleges])];
 return <form className={'event-form '+(creating?'event-wizard':'')} onSubmit={async e=>{e.preventDefault();if(creating&&step<3){advance();return;}setError('');try{if(creating){validateTableBindings(schedule);validateNewEventPassword(password,confirmation);}await onSave(validateEvent(draft),{gomoku:validateRules(rules.gomoku),junqi:validateRules(rules.junqi)},schedule,creating?password:'');}catch(err){setError((err as Error).message);}}}>
 {creating&&<nav className="wizard-steps" aria-label="创建竞赛步骤">{steps.map((label,i)=><button type="button" key={label} disabled={i>step} aria-current={step===i?'step':undefined} onClick={()=>{setStep(i);setError('');}}><span>{i<step?<Check size={15}/>:i+1}</span><b>{label}</b></button>)}</nav>}
 {creating&&<p className="composer-hint" role="status">{draftSaved?(restored?'已恢复上次创建草稿。':'创建信息自动保存为本机草稿。')+' 暂时关闭或刷新后可继续；刷新后需重新填写赛事密码。':'浏览器未能保存草稿，暂时关闭可继续，请勿刷新页面。'}</p>}
 <div className="wizard-stage">
 {(!creating||step===0)&&<>
 {creating&&<div className="wizard-stage-title"><span className="eyebrow">01 / EVENT DETAILS</span><h3>先为这场比赛，定好时间与地点。</h3><p>名单在创建后导入，所有赛程与裁判安排独立保存。</p></div>}
 <label>比赛名称<input required maxLength={60} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <fieldset><legend>举办学院（可多选）</legend><div className="event-colleges">{colleges.map(c=><label key={c}><input type="checkbox" checked={draft.colleges.includes(c)} onChange={e=>setDraft({...draft,colleges:e.target.checked?[...draft.colleges,c]:draft.colleges.filter(v=>v!==c)})}/>{c}</label>)}</div><div className="event-custom"><input aria-label="其他举办学院" placeholder="添加其他学院" maxLength={60} value={custom} onChange={e=>setCustom(e.target.value)}/><button type="button" className="button secondary small" onClick={()=>{const c=custom.trim();if(c&&!draft.colleges.includes(c)){setDraft({...draft,colleges:[...draft.colleges,c]});setCustom('');}}}>添加学院</button></div></fieldset>
 <div className="form-grid"><label>开始时间（北京时间）<input type="datetime-local" required value={draft.startsAt} onChange={e=>setDraft({...draft,startsAt:e.target.value})}/></label><label>结束时间（北京时间）<input type="datetime-local" required min={draft.startsAt} value={draft.endsAt} onChange={e=>setDraft({...draft,endsAt:e.target.value})}/></label></div>
 <label>比赛地点<input required maxLength={120} value={draft.venue} onChange={e=>setDraft({...draft,venue:e.target.value})}/></label>
 {creating&&<fieldset className="creation-password"><legend>当前赛事密码（必填）</legend><p>裁判进入本场比赛，以及修改抽签和调度安排时使用。与裁判账号登录密码不同。</p><div className="form-grid"><label>设置赛事密码<input aria-label="创建赛事密码" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>确认赛事密码<input aria-label="确认创建赛事密码" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></div><small>至少 8 个字符，最多 72 字节。密码不会写入导出的 PDF 或 JSON 备份。</small></fieldset>}
 </>}
 {creating&&step===1&&<><div className="wizard-stage-title"><span className="eyebrow">02 / COMPETITION RULES</span><h3>两个项目，各有清晰规则。</h3><p>默认并列两名季军，末三轮三局两胜。抽签后可按具体场次调整。</p></div><div className="sport-tabs">{(['gomoku','junqi'] as const).map(sp=><button type="button" key={sp} aria-pressed={ruleSport===sp} className={ruleSport===sp?'selected':''} onClick={()=>setRuleSport(sp)}>{sp==='gomoku'?'五子棋':'军棋'}</button>)}</div><fieldset><legend>{ruleSport==='gomoku'?'五子棋':'军棋'} · 赛制与奖项</legend><RuleFields value={rules[ruleSport]} prefix={ruleSport==='gomoku'?'五子棋':'军棋'} onChange={value=>setRules({...rules,[ruleSport]:value})}/></fieldset></>}
 {creating&&step===2&&<TableBindingFields value={schedule} onChange={setSchedule} members={people} call={call} onMemberCreated={p=>setCreated(old=>[...old,p])}/>}
 {(!creating||step===3)&&<>
 {creating&&<><div className="wizard-stage-title"><span className="eyebrow">04 / READY TO LAUNCH</span><h3>核对安排，准备开启比赛。</h3><p>以下 PDF 为未发布草稿。创建成功后，可在该赛事的资料打印中心导出正式版本。</p></div><div className="creation-review"><div><small>赛事</small><b>{draft.name}</b><span>{draft.startsAt.replace('T',' ')} 至 {draft.endsAt.replace('T',' ')}</span><span>{draft.venue}</span></div><div><small>棋盘与裁判</small><b>{schedule.counts.gomoku+schedule.counts.junqi} 桌 / {Object.values(schedule.bindings).filter(keys=>keys.length).length} 名裁判</b><span>五子棋 {schedule.counts.gomoku} 桌 · 军棋 {schedule.counts.junqi} 桌</span><span>每桌均已安排负责裁判</span></div></div><ReportActions build={()=>refereeReport(validateEvent(draft),schedule,people,'创建草稿',true)}/></>}
 <BackupFields value={backupSettings(draft)} onChange={autoBackup=>setDraft({...draft,autoBackup})}/>
 <fieldset className="backup-fields"><legend>场间休息</legend><label>选手休息时间（分钟）<input aria-label="创建选手休息分钟" type="number" min={0} max={120} step={1} value={restMinutes(draft)} onChange={e=>setDraft({...draft,restMinutes:e.target.value===''?NaN:Number(e.target.value)})}/></label><small>默认 3 分钟，0 表示不设间隔。兼项共用同一休息限制；赛中可在“现场运行”修改。</small></fieldset>
 {!creating&&<p className="info-note">更新基本信息后，各设备同步展示，保留当前赛程与成绩。</p>}
 </>}
 </div>
 {error&&<p className="wizard-error" role="alert">{error}</p>}<div className="wizard-footer"><span>{creating?'步骤 '+(step+1)+' / 4 · '+steps[step]:'竞赛信息编辑'}</span><div>{creating&&step>0&&<button type="button" className="button secondary" onClick={()=>{setStep(step-1);setError('');}}><ArrowLeft size={16}/>上一步</button>}<button className="button primary" disabled={saving} type="submit">{saving?'正在保存…':creating?(step===3?'核对完成，创建竞赛':'下一步'):'保存竞赛信息'}<ArrowRight size={16}/></button></div></div>
 </form>;
}
