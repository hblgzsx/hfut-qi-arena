import { useEffect, useState } from 'react';
import { buildBracket, SPORT_NAMES } from './engine';
import type { Sport, State } from './engine';
import { emptySchedule, occupied, SPORTS, tableKey, tableName,validateTableBindings } from './scheduling';
import {eventId} from './cloud';
import {TableBindingFields} from './TableBindingFields';
import {EventDocuments} from './ReportActions';
import {X} from 'lucide-react';
import {CheckinDesk} from './CheckinDesk';
import {DataTable} from './DataTable';
import {DrawStudio} from './DrawStudio';
import {TableMatchDialog} from './TableMatchDialog';
import {validateNewEventPassword} from './event-password';
import {restMinutes,validateRestMinutes} from './event-settings';

export function FloorBoard({state,onRecord,onBegin,onCancel,userId}:{state:State;onRecord?:(sport:Sport,id:string)=>void;onBegin?:(assignment:string)=>Promise<void>;onCancel?:(assignment:string)=>void;userId?:string}) {
  const s=state.schedule??emptySchedule();
  const [selected,setSelected]=useState<string|null>(null);
  const selectedAssignment=s.assignments.find(a=>a.id===selected),mayOperate=(key:string)=>!userId||s.bindings[userId]?.includes(key);
  return <><div className="floor-grid">{SPORTS.map(sport=><section key={sport}>
    <h2>{SPORT_NAMES[sport]} <small>{s.counts[sport]} 张棋盘</small></h2>
    <div className="floor-tables" style={{gridTemplateRows:`repeat(${Math.ceil(s.counts[sport]/(sport==='gomoku'?2:1))},minmax(0,1fr))`}}>{Array.from({length:s.counts[sport]},(_,i)=>{
      const table=i+1,key=tableKey(sport,table);
      const a=s.assignments.find(a=>a.sport===sport&&a.table===table&&occupied(a));
      const names=a?.players.map(id=>state.tournaments[sport].players.find(p=>p.id===id)?.name??'待确认选手');
      const status=a?(a.status==='playing'?'进行中':'已叫号 · 等待开赛'):'空闲 · 等待可上场对局';
      const interactive=!!a&&mayOperate(key)&&!!(onBegin||onRecord||onCancel);
      const note=a?a.match+(interactive?(a.status==='called'?' · 点击确认开赛':' · 点击录入成绩'):''):'场间休息 '+restMinutes(state.event)+' 分钟，兼项不冲突';
      return <button className={'floor-card '+(a?'occupied':'idle')} key={key} disabled={!interactive} aria-label={tableName(sport,table)+(a?' · '+a.match+' · '+status:' · 空闲')} title={[tableName(sport,table),status,names?.join(' / '),note].filter(Boolean).join(' · ')} onClick={()=>a&&setSelected(a.id)}>
        <div className="floor-card-body"><b className="floor-card-table">{tableName(sport,table)}</b><span className="floor-card-status">{status}</span>
        <strong className="floor-card-duel">{names?<><span title={names[0]}>{names[0]}</span><i>VS</i><span title={names[1]}>{names[1]}</span></>:<span>等待对局</span>}</strong><small className="floor-card-note" title={note}>{note}</small></div>
      </button>;
    })}</div>
    <p>候场 {s.queues[sport].filter(id=>buildBracket(state.tournaments[sport]).flat().some(m=>m.id===id&&m.ready&&!m.resolved)&&!s.assignments.some(a=>a.sport===sport&&a.match===id&&occupied(a))).length} 场</p>
  </section>)}</div>{selected&&selectedAssignment&&mayOperate(tableKey(selectedAssignment.sport,selectedAssignment.table))&&<TableMatchDialog key={selected} state={state} assignment={selected} onBegin={onBegin} onRecord={onRecord} onCancel={onCancel} onClose={()=>setSelected(null)}/>}</>;
}

export function FloorPanel({state,call,onChanged,owner='local'}:{state:State;call:(action:string,payload?:Record<string,unknown>)=>Promise<any>;onChanged:()=>void;owner?:string}) {
  const s=state.schedule??emptySchedule();
  const [sport,setSport]=useState<Sport>('gomoku'),[counts,setCounts]=useState(s.counts);
  const [members,setMembers]=useState<{id:string;display_name:string;role:string}[]>([]);
  const [bindings,setBindings]=useState(s.bindings);
  const [password,setPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[reason,setReason]=useState('');
  const [pending,setPending]=useState<{command:Record<string,unknown>;revision:string}|null>(null),[verificationError,setVerificationError]=useState('');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [presentation,setPresentation]=useState<{state:State;sport:Sport}|null>(null);
  const [restDraft,setRestDraft]=useState(()=>String(restMinutes(state.event))),[restDirty,setRestDirty]=useState(false),[restBase,setRestBase]=useState(()=>restMinutes(state.event));
  const restConflict=restDirty&&restBase!==restMinutes(state.event);
  useEffect(()=>{if(!restDirty){setRestDraft(String(restMinutes(state.event)));setRestBase(restMinutes(state.event));}},[state.event?.restMinutes,restDirty]);
  const [tab,setTab]=useState<'live'|'tables'|'draw'|'documents'|'security'>('live');
  const [dirty,setDirty]=useState(false);
  const [bindingBase,setBindingBase]=useState(()=>JSON.stringify([s.counts,s.bindings]));
  const bindingConflict=dirty&&bindingBase!==JSON.stringify([s.counts,s.bindings]);
  const [queueDrafts,setQueueDrafts]=useState({gomoku:s.queues.gomoku.join('\n'),junqi:s.queues.junqi.join('\n')}),[queueDirty,setQueueDirty]=useState({gomoku:false,junqi:false}),[queueBases,setQueueBases]=useState({gomoku:s.queues.gomoku.join('\n'),junqi:s.queues.junqi.join('\n')});
  const queue=queueDrafts[sport],queueConflict=queueDirty[sport]&&queueBases[sport]!==s.queues[sport].join('\n');
  function setQueue(value:string){setQueueDrafts(old=>({...old,[sport]:value}));setQueueDirty(old=>({...old,[sport]:true}));}
  useEffect(()=>{void call('members').then(data=>setMembers((data.profiles??[]).filter((p:any)=>p.role==='referee'))).catch(e=>setMessage(e.message));},[]);
  useEffect(()=>{for(const sp of SPORTS)if(!queueDirty[sp]){const value=s.queues[sp].join('\n');setQueueDrafts(old=>({...old,[sp]:value}));setQueueBases(old=>({...old,[sp]:value}));}},[state.revision,queueDirty]);
  useEffect(()=>{if(!dirty){setCounts(s.counts);setBindings(s.bindings);setBindingBase(JSON.stringify([s.counts,s.bindings]));}},[state.revision,dirty]);
  function run(command:Record<string,unknown>){
    try{if(command.type==='rest')validateRestMinutes(command.minutes);if(command.type==='configure')validateTableBindings({...s,counts,bindings});if(command.type==='draw'&&state.tournaments[command.sport as Sport].players.filter(p=>!(command.absent as string[]).includes(p.id)).length<2)throw new Error('至少需要 2 名到场选手才能抽签。');}catch(e){setMessage((e as Error).message);return;}
    if(command.type==='begin'){void execute(command,state.revision);return;}
    setPending({command:structuredClone(command),revision:state.revision});setPassword('');setReason('');setVerificationError('');
  }
  async function execute(command:Record<string,unknown>,revision:string) {
    setBusy(true);setMessage('');
    try {
      const response=await call('schedule',{command,password,reason,expectedRevision:revision});
      if(command.type==='draw'&&response?.state)setPresentation({state:response.state,sport:command.sport as Sport});
      if(command.type==='configure')setDirty(false);
      if(command.type==='rest')setRestDirty(false);
      if(command.type==='reorder'||command.type==='draw')setQueueDirty(old=>({...old,[command.sport as Sport]:false}));
      setPassword('');setReason('');setPending(null);onChanged();setMessage('现场调度已保存。');
    } catch(e) {if(pending)setVerificationError((e as Error).message);else setMessage((e as Error).message);}
    finally {setBusy(false);}
  }
  return <div className="floor-panel">
    <div className="floor-context"><span className="eyebrow">EVENT OPERATIONS</span><h2>{state.event?.name}</h2><p>正在管理本场赛事 · 桌号、裁判、候场与导出资料均独立保存</p></div>
    <nav className="operations-tabs" aria-label="现场调度分区">{([['live','现场运行'],['tables','棋盘与裁判'],['draw','检录与抽签'],['documents','资料与打印'],['security','赛事密码']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={tab===key} className={tab===key?'selected':''} onClick={()=>setTab(key)}>{label}</button>)}</nav>
    {tab==='security'&&<section className="operations-section"><h3>本场赛事的进入与修改凭证</h3><p>裁判登录账号后，还需输入本场赛事密码。修改密码后，裁判需要重新验证。</p>
    <label>原赛事密码（修改时必填，旧比赛首次补设可留空）<input type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>新密码（首次设置 / 修改，至少 8 字符）<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
    <label>确认新赛事密码<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
    <button className="button secondary" disabled={busy||newPassword.length<8} onClick={async()=>{
      setBusy(true);
      try{validateNewEventPassword(newPassword,confirmPassword);await call('event-password',{password,newPassword});setNewPassword('');setConfirmPassword('');setPassword('');setMessage('赛事密码已更新，裁判需重新验证。');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
    }}>设置 / 修改赛事密码</button>
    </section>}
    {tab==='tables'&&<section className="operations-section">
      <TableBindingFields value={{...s,counts,bindings}} members={members} call={call} onMemberCreated={p=>setMembers(old=>[...old,p])} onChange={next=>{setCounts(next.counts);setBindings(next.bindings);setDirty(true);}}/>
      <p className="composer-hint">{s.running?'请先暂停自动调度再修改。保存需要当前赛事密码。':'保存后才成为本场的正式裁判安排；打印中心使用已保存的安排。'}</p>
      {bindingConflict&&<p role="alert" className="wizard-error">另一位管理员已修改棋盘或裁判安排。请先重新载入最新安排后再编辑。<button type="button" className="text-button" onClick={()=>setDirty(false)}>载入最新安排</button></p>}
      <button className="button secondary" disabled={busy||s.running||bindingConflict} onClick={()=>void run({type:'configure',counts,bindings})}>保存棋盘与裁判绑定</button>
    </section>}
    {(tab==='draw'||tab==='live')&&<>
    <div className="sport-tabs">{SPORTS.map(sp=><button key={sp} onClick={()=>setSport(sp)} className={sport===sp?'selected':''}>{SPORT_NAMES[sp]}</button>)}</div>
    </>}
    <div hidden={tab!=='draw'}><CheckinDesk key={sport+':'+state.tournaments[sport].drawnAt+':'+state.tournaments[sport].players.map(p=>p.id).join(',')} state={state} sport={sport} owner={owner} eventKey={eventId} busy={busy} onDraw={(absent,priority)=>run({type:'draw',sport,absent,priority})} onPresent={()=>setPresentation({state,sport})}/></div>
    {tab==='live'&&<section className="operations-section"><p>一桌完赛即补台，允许已确定双方的后续轮次提前开赛，选手休息 {restMinutes(state.event)} 分钟；兼项不重复占桌。</p>
    <fieldset className="backup-fields rest-settings"><legend>选手休息时间 · 可中途修改</legend><p>当前生效：{restMinutes(state.event)} 分钟。新设置从选手上一场结束时间计算，只影响尚未叫号的对局，已叫号或开赛的对局保留。</p><label>休息时间（分钟）<input aria-label="选手休息时间分钟" type="number" min={0} max={120} step={1} value={restDraft} disabled={busy} onChange={e=>{setRestDraft(e.target.value);setRestDirty(true);}}/></label><small>0 表示不设休息间隔，最多 120 分钟。两项目按学号共同检查；语音播报结束后 15 秒的叫号间隔单独执行。</small>{restConflict&&<p className="wizard-error">另一位管理员已修改休息时间，请先载入最新设置。<button type="button" className="text-button" onClick={()=>setRestDirty(false)}>载入最新休息设置</button></p>}<button type="button" className="button secondary small" disabled={busy||!restDirty||restConflict||restDraft===''} onClick={()=>run({type:'rest',minutes:Number(restDraft)})}>保存休息时间</button></fieldset>
    <h3>已锁定候场顺序</h3><p>修改顺序需要重新输入赛事密码和原因。已叫号对局保持原桌。</p>
    <details><summary>调整候场顺序（需赛事密码）</summary><textarea aria-label="候场场次顺序" value={queue} onChange={e=>setQueue(e.target.value)} rows={5}/>
    {queueConflict&&<p role="alert" className="wizard-error">候场顺序已被其他管理员修改，请重新加载后编辑。<button className="text-button" onClick={()=>setQueueDirty(old=>({...old,[sport]:false}))}>重新载入顺序</button></p>}
    <button className="button secondary" disabled={busy||queueConflict} onClick={()=>void run({type:'reorder',sport,queue:queue.split(/\s+/).filter(Boolean)})}>保存候场顺序</button>
    </details>
    <button className="button primary" disabled={busy} onClick={()=>void run({type:'start'})}>开始 / 恢复自动叫号</button>
    <button className="button secondary" disabled={busy||!s.running} onClick={()=>void run({type:'pause'})}>暂停补台，保留现场对局</button>
    <p className="composer-hint">点击对应棋盘即可确认双方到齐并开赛，不需要输入赛事密码。取消叫号仍需验证密码和原因。</p>
    <FloorBoard state={state} onBegin={async assignment=>{await call('schedule',{command:{type:'begin',assignment},expectedRevision:state.revision});onChanged();}} onCancel={assignment=>void run({type:'cancel',assignment})}/>
    </section>}
    {tab==='documents'&&<>{dirty&&<p className="wizard-error">有未保存的裁判编排，此处导出上一次已保存的正式安排。请先回到“棋盘与裁判”保存。</p>}<EventDocuments state={state} members={members}/></>}
    <p role="status">{message}</p>
    {presentation&&<DrawStudio state={state} initialState={presentation.state} sport={presentation.sport} onClose={()=>setPresentation(null)}/>}
    {pending&&<div className="verification-overlay"><form className="verification-dialog" role="dialog" aria-modal="true" aria-label="确认现场修改" onSubmit={e=>{e.preventDefault();if(!password){setVerificationError('请输入当前赛事密码。');return;}if(reason.trim().length<2){setVerificationError('请填写至少 2 字的操作原因。');return;}void execute(pending.command,pending.revision);}} onKeyDown={e=>{if(e.key==='Escape'&&!busy){setPending(null);setPassword('');}}}>
      <header><div><span className="eyebrow">CONFIRM CHANGE</span><h3>确认现场修改</h3></div><button type="button" className="icon-button" aria-label="取消现场修改" disabled={busy} onClick={()=>{setPending(null);setPassword('');}}><X size={20}/></button></header><p>{state.event?.name}</p><strong>{({configure:'保存棋盘与裁判绑定',draw:'按到场名单抽签并锁定',reorder:'修改候场顺序',rest:'修改选手休息时间',start:'启动自动叫号',pause:'暂停自动补台',cancel:'取消叫号并暂停调度'} as Record<string,string>)[String(pending.command.type)]??'修改现场调度'}</strong>
      {pending.command.type==='rest'&&<p>从 {restMinutes(state.event)} 分钟改为 {String(pending.command.minutes)} 分钟。仅按新间隔计算尚未叫号的场次，已叫号和进行中对局不撤回。</p>}
      {pending.command.type==='draw'&&<DrawReview state={state} command={pending.command}/>}
      <label>当前赛事密码<input autoFocus type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>本次修改原因<input maxLength={200} value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明为什么需要这次修改"/></label>
      {pending.revision!==state.revision&&<p className="wizard-error">赛事数据已更新，请取消并核对最新赛况后重新提交。</p>}{verificationError&&<p role="alert" className="wizard-error">{verificationError}</p>}<footer><button type="button" className="button secondary" disabled={busy} onClick={()=>{setPending(null);setPassword('');}}>取消</button><button className="button primary" disabled={busy||pending.revision!==state.revision} type="submit">{busy?'正在验证保存…':'验证并保存修改'}</button></footer>
    </form></div>}
  </div>;
}

function DrawReview({state,command}:{state:State;command:Record<string,unknown>}){
 const sport=command.sport as Sport,t=state.tournaments[sport],absent=command.absent as string[],priority=command.priority as string[];
 const changes=[...absent,...priority].map(id=>{const p=t.players.find(p=>p.id===id);return {id,name:p?.name??'名单已变化',studentId:p?.studentId??'—',college:p?.college??'—',change:absent.includes(id)?'未到场 · 剔除':'优先 #'+(priority.indexOf(id)+1)};});
 return <div className="draw-review"><p><b>{SPORT_NAMES[sport]}</b> · 报名 {t.players.length} 人 · 参与抽签 {t.players.length-absent.length} 人 · 剔除 {absent.length} 人 · 优先 {priority.length} 人</p><DataTable label="抽签变更清单" rows={changes} rowKey={p=>p.id} initialPageSize={10} emptyText="本次全部报名选手参与随机抽签，无剔除和优先设置。" columns={[{title:'选手',cell:p=><><b>{p.name}</b><small>{p.studentId}</small></>},{title:'学院',cell:p=>p.college},{title:'本次安排',cell:p=>p.change}]}/><p className="wizard-error">{t.seeds.length?'本项目已有签位，提交将重新生成对手、轮空并清空本项目成绩。':'本次保留未报到选手的签位，现场确认后按弃权录入，不删除、不重抽。'} 优先只影响首轮实赛叫号顺序，对手与轮空仍随机产生。</p></div>;
}
export function EventGate({call,onChanged,onAccount}:{call:(a:string,p?:Record<string,unknown>)=>Promise<any>;onChanged:()=>void;onAccount:()=>void}) {
  const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <main className="event-gate"><form onSubmit={async e=>{
    e.preventDefault();setBusy(true);
    try{const data=await call('unlock-event',{password});sessionStorage.setItem('qi-event-grant:'+eventId,data.secret);setPassword('');onChanged();}catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }}><h1>进入当前赛事</h1><p>使用组委会提供的赛事密码进入裁判录分台。</p><label>赛事密码<input type="password" autoComplete="off" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary" disabled={busy}>验证并进入</button><button type="button" className="button secondary" onClick={onAccount}>账号 / 退出登录</button><p role="alert">{error}</p></form></main>;
}
