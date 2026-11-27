import { useEffect, useState } from 'react';
import { buildBracket, SPORT_NAMES } from './engine';
import type { Sport, State } from './engine';
import { emptySchedule, occupied, SPORTS, tableKey, tableName } from './scheduling';
import {eventId} from './cloud';

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
  const [password,setPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[reason,setReason]=useState('现场配置');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [queue,setQueue]=useState(s.queues[sport].join('\n'));
  useEffect(()=>{void call('members').then(data=>setMembers((data.profiles??[]).filter((p:any)=>p.role==='referee'))).catch(e=>setMessage(e.message));},[]);
  useEffect(()=>{setAbsent([]);setPriority([]);},[sport]);
  useEffect(()=>{setQueue(s.queues[sport].join('\n'));},[sport,state.revision]);
  async function run(command:Record<string,unknown>) {
    setBusy(true);setMessage('');
    try {
      await call('schedule',{command,password,reason,expectedRevision:state.revision});
      setPassword('');onChanged();setMessage('现场调度已保存。');
    } catch(e) {setMessage((e as Error).message);}
    finally {setBusy(false);}
  }
  const t=state.tournaments[sport];
  return <div className="floor-panel">
    <p>默认 10 张五子棋、5 张军棋。一桌完赛即补台，允许跨轮开赛，选手休息 3 分钟；双项冲突时五子棋先分配。</p>
    <label>当前赛事密码<input type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>新密码（首次设置 / 修改，至少 8 字符）<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
    <button className="button secondary" disabled={busy||newPassword.length<8} onClick={async()=>{
      setBusy(true);
      try{await call('event-password',{password,newPassword});setNewPassword('');setPassword('');setMessage('赛事密码已更新，裁判需重新验证。');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
    }}>设置 / 修改赛事密码</button>
    <label>操作原因<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={200}/></label>
    <fieldset><legend>棋盘数量与裁判负责桌号</legend>
      {SPORTS.map(sp=><label key={sp}>{SPORT_NAMES[sp]}棋盘数<input type="number" min={1} max={30} value={counts[sp]} onChange={e=>setCounts({...counts,[sp]:Number(e.target.value)})}/></label>)}
      {members.map(p=><fieldset key={p.id}><legend>{p.display_name}</legend><div className="table-bindings">
        {SPORTS.flatMap(sp=>Array.from({length:Math.max(0,Math.min(30,counts[sp]))},(_,i)=>{
          const key=tableKey(sp,i+1);
          return <label key={key}><input type="checkbox" checked={bindings[p.id]?.includes(key)??false} onChange={e=>setBindings({...bindings,[p.id]:e.target.checked?[...(bindings[p.id]??[]),key]:(bindings[p.id]??[]).filter(k=>k!==key)})}/>{tableName(sp,i+1)}</label>;
        }))}
      </div></fieldset>)}
      <button className="button secondary" disabled={busy||s.running} onClick={()=>void run({type:'configure',counts,bindings})}>保存棋盘与裁判绑定</button>
    </fieldset>
    <div className="sport-tabs">{SPORTS.map(sp=><button key={sp} onClick={()=>setSport(sp)} className={sport===sp?'selected':''}>{SPORT_NAMES[sp]}</button>)}</div>
    <h3>抽签前确认到场与优先开赛</h3>
    <p>勾选未到场者后将从本项目名单剔除，晋级树不会包含其姓名。优先顺序按勾选先后，仅调整首轮实赛叫号顺序。</p>
    <div className="floor-roll">{t.players.map(p=><div key={p.id}><b>{p.name}</b><small>{p.studentId}</small>
      <label><input type="checkbox" checked={absent.includes(p.id)} onChange={e=>{setAbsent(e.target.checked?[...absent,p.id]:absent.filter(id=>id!==p.id));setPriority(priority.filter(id=>id!==p.id));}}/>未到场 · 剔除</label>
      <label><input type="checkbox" disabled={absent.includes(p.id)} checked={priority.includes(p.id)} onChange={e=>setPriority(e.target.checked?[...priority,p.id]:priority.filter(id=>id!==p.id))}/>优先 {priority.includes(p.id)?priority.indexOf(p.id)+1:''}</label>
    </div>)}</div>
    <button className="button primary" disabled={busy} onClick={()=>{if(confirm('确认按已到场名单抽签并锁定顺序？重新抽签会清空本项目成绩。'))void run({type:'draw',sport,absent,priority});}}>确认到场名单并抽签锁定</button>
    <h3>已锁定候场顺序</h3><p>修改顺序需要重新输入赛事密码和原因。已叫号对局保持原桌。</p>
    <textarea aria-label="候场场次顺序" value={queue} onChange={e=>setQueue(e.target.value)} rows={5}/>
    <button className="button secondary" disabled={busy} onClick={()=>void run({type:'reorder',sport,queue:queue.split(/\s+/).filter(Boolean)})}>保存候场顺序</button>
    <button className="button primary" disabled={busy} onClick={()=>void run({type:'start'})}>开始 / 恢复自动叫号</button>
    <button className="button secondary" disabled={busy||!s.running} onClick={()=>void run({type:'pause'})}>暂停补台，保留现场对局</button>
    <FloorBoard state={state}/>
    {s.assignments.filter(a=>a.status==='called').map(a=><div key={a.id}>{tableName(a.sport,a.table)} · {a.match} <button disabled={busy} onClick={()=>void run({type:'begin',assignment:a.id})}>双方到齐 · 开赛</button><button disabled={busy} onClick={()=>void run({type:'cancel',assignment:a.id})}>取消叫号并暂停调度</button></div>)}
    <p role="status">{message}</p>
  </div>;
}

export function EventGate({call,onChanged,onAccount}:{call:(a:string,p?:Record<string,unknown>)=>Promise<any>;onChanged:()=>void;onAccount:()=>void}) {
  const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <main className="event-gate"><form onSubmit={async e=>{
    e.preventDefault();setBusy(true);
    try{const data=await call('unlock-event',{password});sessionStorage.setItem('qi-event-grant:'+eventId,data.secret);setPassword('');onChanged();}catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }}><h1>进入当前赛事</h1><p>使用组委会提供的赛事密码进入裁判录分台。</p><label>赛事密码<input type="password" autoComplete="off" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary" disabled={busy}>验证并进入</button><button type="button" className="button secondary" onClick={onAccount}>账号 / 退出登录</button><p role="alert">{error}</p></form></main>;
}
