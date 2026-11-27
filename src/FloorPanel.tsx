import { useEffect, useState } from 'react';
import { buildBracket, SPORT_NAMES } from './engine';
import type { Sport, State } from './engine';
import { emptySchedule, occupied, SPORTS, tableKey, tableName,validateTableBindings } from './scheduling';
import {eventId} from './cloud';
import {TableBindingFields} from './TableBindingFields';
import {EventDocuments} from './ReportActions';
import {X} from 'lucide-react';
import {validateNewEventPassword} from './event-password';

export function FloorBoard({state,onRecord,userId}:{state:State;onRecord?:(sport:Sport,id:string)=>void;userId?:string}) {
  const s=state.schedule??emptySchedule();
  return <div className="floor-grid">{SPORTS.map(sport=><section key={sport}>
    <h2>{SPORT_NAMES[sport]} <small>{s.counts[sport]} 张棋盘</small></h2>
    <div className="floor-tables">{Array.from({length:s.counts[sport]},(_,i)=>{
      const table=i+1,key=tableKey(sport,table);
      if(userId&&!s.bindings[userId]?.includes(key))return null;
      const a=s.assignments.find(a=>a.sport===sport&&a.table===table&&occupied(a));
      const names=a?.players.map(id=>state.tournaments[sport].players.find(p=>p.id===id)?.name).join(' / ');
      return <button key={key} disabled={!a||!onRecord} onClick={()=>a&&onRecord?.(sport,a.match)}>
        <b>{tableName(sport,table)}</b><span>{a?(a.status==='playing'?'进行中':'已叫号 · 等待开赛'):'空闲 · 等待可上场对局'}</span>
        <strong>{names||'—'}</strong><small>{a?.match??'选手需休息满 3 分钟，兼项不冲突'}</small>
      </button>;
    })}</div>
    <p>候场 {s.queues[sport].filter(id=>buildBracket(state.tournaments[sport]).flat().some(m=>m.id===id&&m.ready&&!m.resolved)&&!s.assignments.some(a=>a.sport===sport&&a.match===id&&occupied(a))).length} 场</p>
  </section>)}</div>;
}

export function FloorPanel({state,call,onChanged}:{state:State;call:(action:string,payload?:Record<string,unknown>)=>Promise<any>;onChanged:()=>void}) {
  const s=state.schedule??emptySchedule();
  const [sport,setSport]=useState<Sport>('gomoku'),[counts,setCounts]=useState(s.counts);
  const [members,setMembers]=useState<{id:string;display_name:string;role:string}[]>([]);
  const [bindings,setBindings]=useState(s.bindings),[absent,setAbsent]=useState<string[]>([]),[priority,setPriority]=useState<string[]>([]);
  const [password,setPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[reason,setReason]=useState('');
  const [pending,setPending]=useState<{command:Record<string,unknown>;revision:string}|null>(null),[verificationError,setVerificationError]=useState('');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [tab,setTab]=useState<'live'|'tables'|'draw'|'documents'|'security'>('live'),[search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|'absent'|'priority'>('all');
  const [rollPage,setRollPage]=useState(0);
  const [dirty,setDirty]=useState(false);
  const [bindingBase,setBindingBase]=useState(()=>JSON.stringify([s.counts,s.bindings]));
  const bindingConflict=dirty&&bindingBase!==JSON.stringify([s.counts,s.bindings]);
  const [queueDrafts,setQueueDrafts]=useState({gomoku:s.queues.gomoku.join('\n'),junqi:s.queues.junqi.join('\n')}),[queueDirty,setQueueDirty]=useState({gomoku:false,junqi:false}),[queueBases,setQueueBases]=useState({gomoku:s.queues.gomoku.join('\n'),junqi:s.queues.junqi.join('\n')});
  const queue=queueDrafts[sport],queueConflict=queueDirty[sport]&&queueBases[sport]!==s.queues[sport].join('\n');
  function setQueue(value:string){setQueueDrafts(old=>({...old,[sport]:value}));setQueueDirty(old=>({...old,[sport]:true}));}
  useEffect(()=>{void call('members').then(data=>setMembers((data.profiles??[]).filter((p:any)=>p.role==='referee'))).catch(e=>setMessage(e.message));},[]);
  useEffect(()=>{setAbsent([]);setPriority([]);},[sport]);
  useEffect(()=>{for(const sp of SPORTS)if(!queueDirty[sp]){const value=s.queues[sp].join('\n');setQueueDrafts(old=>({...old,[sp]:value}));setQueueBases(old=>({...old,[sp]:value}));}},[state.revision,queueDirty]);
  useEffect(()=>{if(!dirty){setCounts(s.counts);setBindings(s.bindings);setBindingBase(JSON.stringify([s.counts,s.bindings]));}},[state.revision,dirty]);
  useEffect(()=>{setRollPage(0);},[search,filter,sport]);
  function run(command:Record<string,unknown>){
    try{if(command.type==='configure')validateTableBindings({...s,counts,bindings});if(command.type==='draw'&&state.tournaments[command.sport as Sport].players.filter(p=>!(command.absent as string[]).includes(p.id)).length<2)throw new Error('至少需要 2 名到场选手才能抽签。');}catch(e){setMessage((e as Error).message);return;}
    if(command.type==='begin'){void execute(command,state.revision);return;}
    setPending({command:structuredClone(command),revision:state.revision});setPassword('');setReason('');setVerificationError('');
  }
  async function execute(command:Record<string,unknown>,revision:string) {
    setBusy(true);setMessage('');
    try {
      await call('schedule',{command,password,reason,expectedRevision:revision});
      if(command.type==='configure')setDirty(false);
      if(command.type==='reorder'||command.type==='draw')setQueueDirty(old=>({...old,[command.sport as Sport]:false}));
      setPassword('');setReason('');setPending(null);onChanged();setMessage('现场调度已保存。');
    } catch(e) {if(pending)setVerificationError((e as Error).message);else setMessage((e as Error).message);}
    finally {setBusy(false);}
  }
  const t=state.tournaments[sport];
  const roll=t.players.filter(p=>(p.name+' '+p.studentId).includes(search)&&(filter==='all'||(filter==='absent'?absent:priority).includes(p.id)));
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
    {tab==='draw'&&<section className="operations-section">
    <h3>抽签前确认到场与优先开赛</h3>
    <p>勾选未到场者后将从本项目名单剔除，晋级树不会包含其姓名。优先顺序按勾选先后，仅调整首轮实赛叫号顺序。</p>
    <div className="roll-toolbar"><label>搜索检录选手<input placeholder="姓名或学号" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="document-tabs">{([['all','全部 '+t.players.length],['absent','未到场 '+absent.length],['priority','优先 '+priority.length]] as const).map(([key,label])=><button type="button" key={key} className={filter===key?'selected':''} onClick={()=>setFilter(key)}>{label}</button>)}</div></div>
    <div className="floor-roll">{roll.slice(rollPage*12,rollPage*12+12).map(p=><div key={p.id}><b>{p.name}</b><small>{p.studentId}</small>
      <label><input type="checkbox" checked={absent.includes(p.id)} onChange={e=>{setAbsent(e.target.checked?[...absent,p.id]:absent.filter(id=>id!==p.id));setPriority(priority.filter(id=>id!==p.id));}}/>未到场 · 剔除</label>
      <label><input type="checkbox" disabled={absent.includes(p.id)} checked={priority.includes(p.id)} onChange={e=>setPriority(e.target.checked?[...priority,p.id]:priority.filter(id=>id!==p.id))}/>优先 {priority.includes(p.id)?priority.indexOf(p.id)+1:''}</label>
    </div>)}</div>
    <div className="roll-pagination"><button className="button secondary small" disabled={!rollPage} onClick={()=>setRollPage(n=>n-1)}>上一页</button><span>共 {roll.length} 人 · {rollPage+1} / {Math.max(1,Math.ceil(roll.length/12))} 页</span><button className="button secondary small" disabled={(rollPage+1)*12>=roll.length} onClick={()=>setRollPage(n=>n+1)}>下一页</button></div>
    <button className="button primary" disabled={busy} onClick={()=>run({type:'draw',sport,absent,priority})}>确认到场名单并抽签锁定</button>
    </section>}
    {tab==='live'&&<section className="operations-section"><p>一桌完赛即补台，允许已确定双方的后续轮次提前开赛，选手休息 3 分钟；兼项不重复占桌。</p>
    <h3>已锁定候场顺序</h3><p>修改顺序需要重新输入赛事密码和原因。已叫号对局保持原桌。</p>
    <details><summary>调整候场顺序（需赛事密码）</summary><textarea aria-label="候场场次顺序" value={queue} onChange={e=>setQueue(e.target.value)} rows={5}/>
    {queueConflict&&<p role="alert" className="wizard-error">候场顺序已被其他管理员修改，请重新加载后编辑。<button className="text-button" onClick={()=>setQueueDirty(old=>({...old,[sport]:false}))}>重新载入顺序</button></p>}
    <button className="button secondary" disabled={busy||queueConflict} onClick={()=>void run({type:'reorder',sport,queue:queue.split(/\s+/).filter(Boolean)})}>保存候场顺序</button>
    </details>
    <button className="button primary" disabled={busy} onClick={()=>void run({type:'start'})}>开始 / 恢复自动叫号</button>
    <button className="button secondary" disabled={busy||!s.running} onClick={()=>void run({type:'pause'})}>暂停补台，保留现场对局</button>
    <FloorBoard state={state}/>
    {s.assignments.filter(a=>a.status==='called').map(a=><div key={a.id}>{tableName(a.sport,a.table)} · {a.match} <button disabled={busy} onClick={()=>void run({type:'begin',assignment:a.id})}>双方到齐 · 开赛</button><button disabled={busy} onClick={()=>void run({type:'cancel',assignment:a.id})}>取消叫号并暂停调度</button></div>)}
    </section>}
    {tab==='documents'&&<>{dirty&&<p className="wizard-error">有未保存的裁判编排，此处导出上一次已保存的正式安排。请先回到“棋盘与裁判”保存。</p>}<EventDocuments state={state} members={members}/></>}
    <p role="status">{message}</p>
    {pending&&<div className="verification-overlay"><form className="verification-dialog" role="dialog" aria-modal="true" aria-label="确认现场修改" onSubmit={e=>{e.preventDefault();if(!password){setVerificationError('请输入当前赛事密码。');return;}if(reason.trim().length<2){setVerificationError('请填写至少 2 字的操作原因。');return;}void execute(pending.command,pending.revision);}} onKeyDown={e=>{if(e.key==='Escape'&&!busy){setPending(null);setPassword('');}}}>
      <header><div><span className="eyebrow">CONFIRM CHANGE</span><h3>确认现场修改</h3></div><button type="button" className="icon-button" aria-label="取消现场修改" disabled={busy} onClick={()=>{setPending(null);setPassword('');}}><X size={20}/></button></header><p>{state.event?.name}</p><strong>{({configure:'保存棋盘与裁判绑定',draw:'按到场名单抽签并锁定',reorder:'修改候场顺序',start:'启动自动叫号',pause:'暂停自动补台',cancel:'取消叫号并暂停调度'} as Record<string,string>)[String(pending.command.type)]??'修改现场调度'}</strong>
      {pending.command.type==='draw'&&<p className="wizard-error">本次将剔除未到场选手，并重新生成该项目抽签；已有成绩会清空。</p>}
      <label>当前赛事密码<input autoFocus type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>本次修改原因<input maxLength={200} value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明为什么需要这次修改"/></label>
      {pending.revision!==state.revision&&<p className="wizard-error">赛事数据已更新，请取消并核对最新赛况后重新提交。</p>}{verificationError&&<p role="alert" className="wizard-error">{verificationError}</p>}<footer><button type="button" className="button secondary" disabled={busy} onClick={()=>{setPending(null);setPassword('');}}>取消</button><button className="button primary" disabled={busy||pending.revision!==state.revision} type="submit">{busy?'正在验证保存…':'验证并保存修改'}</button></footer>
    </form></div>}
  </div>;
}

export function EventGate({call,onChanged,onAccount}:{call:(a:string,p?:Record<string,unknown>)=>Promise<any>;onChanged:()=>void;onAccount:()=>void}) {
  const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <main className="event-gate"><form onSubmit={async e=>{
    e.preventDefault();setBusy(true);
    try{const data=await call('unlock-event',{password});sessionStorage.setItem('qi-event-grant:'+eventId,data.secret);setPassword('');onChanged();}catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }}><h1>进入当前赛事</h1><p>使用组委会提供的赛事密码进入裁判录分台。</p><label>赛事密码<input type="password" autoComplete="off" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary" disabled={busy}>验证并进入</button><button type="button" className="button secondary" onClick={onAccount}>账号 / 退出登录</button><p role="alert">{error}</p></form></main>;
}
