import {useEffect,useState,useRef} from 'react';
import {Plus,Search,UserPlus,X,CheckCircle2} from 'lucide-react';
import {SPORTS,tableKey,tableName} from './scheduling';
import type {Schedule} from './scheduling';
import type {Sport} from './engine';
import {RefereeExport} from './RefereeExport';
export interface RefereeOption {id:string;display_name:string;role:string;email?:string}
export type ArenaCall=(action:string,payload?:Record<string,unknown>)=>Promise<any>;
export function TableBindingFields({value,onChange,members,call,onMemberCreated}:{value:Schedule;onChange:(s:Schedule)=>void;members:RefereeOption[];call?:ArenaCall;onMemberCreated?:(person:RefereeOption)=>void}) {
 const [sport,setSport]=useState<Sport>('gomoku'),[target,setTarget]=useState<string|null>(null),[query,setQuery]=useState(''),[creating,setCreating]=useState(false);
 const [created,setCreated]=useState<RefereeOption[]>([]),[name,setName]=useState(''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [credential,setCredential]=useState<{email:string;password:string;displayName:string}|null>(null),[saved,setSaved]=useState(true);
 const current=useRef(value);current.current=value;
 const people=[...new Map([...members,...created].map(p=>[p.id,p])).values()].filter(p=>p.role==='referee');
 const allTables=SPORTS.flatMap(sp=>Array.from({length:value.counts[sp]},(_,i)=>tableKey(sp,i+1)));
 const covered=allTables.filter(key=>Object.values(value.bindings).some(keys=>keys.length===1&&keys[0]===key)).length;
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(busy||!saved){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[busy,saved]);
 function open(key:string){setTarget(key);setQuery('');setCreating(false);setError('');}
 function assign(id:string){if(!target)return;const latest=current.current,existing=latest.bindings[id]??[];if(existing.length&&existing[0]!==target)return;onChange({...latest,bindings:{...latest.bindings,[id]:[target]}});}
 function resize(sp:Sport,n:number){if(!Number.isInteger(n)||n<1||n>30)return;const removed=Object.entries(value.bindings).filter(([,keys])=>keys.some(key=>key.startsWith(sp+':')&&Number(key.split(':')[1])>n));if(removed.length&&!confirm('减少棋盘会解除被移除棋盘的裁判绑定，确认继续？'))return;onChange({...value,counts:{...value.counts,[sp]:n},bindings:Object.fromEntries(Object.entries(value.bindings).map(([id,keys])=>[id,keys.filter(key=>!key.startsWith(sp+':')||Number(key.split(':')[1])<=n)]))});}
 async function create(){if(!call||busy)return;setError('');if(!name.trim()||!/^\S+@\S+\.\S+$/.test(email.trim())){setError('请填写裁判姓名和有效邮箱。');return;}setBusy(true);try{
  const data=await call('create-referee',{displayName:name.trim(),email:email.trim()});setCredential(data.credential);setSaved(false);
  let person=data.referee as RefereeOption|undefined;
  if(!person){const list=await call('members');person=list.profiles?.find((p:RefereeOption)=>p.email?.toLowerCase()===email.trim().toLowerCase());}
  if(!person)throw new Error('账号已建立，请保存登录信息后刷新裁判列表。');
  setCreated(p=>[...p,person!]);onMemberCreated?.(person);assign(person.id);setName('');setEmail('');setCreating(false);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function close(){if(busy)return;if(!saved&&!confirm('新裁判的登录信息尚未下载，关闭后密码无法再次查看。确认已另行保存？'))return;setTarget(null);setCredential(null);setSaved(true);}
 return <section className="table-composer" aria-label="棋盘裁判编排">
  <div className="composer-heading"><div><span className="eyebrow">TABLE & REFEREE</span><h3>让每张棋盘，都有人负责。</h3><p>按桌添加裁判。同赛事一人一桌，同桌可以多人协作。</p></div><div className={'coverage '+(covered===allTables.length?'complete':'')}><b>{covered}<small> / {allTables.length}</small></b><span>棋盘已配齐裁判</span></div></div>
  <div className="composer-toolbar"><div className="sport-tabs">{SPORTS.map(sp=><button type="button" aria-pressed={sport===sp} className={sport===sp?'selected':''} key={sp} onClick={()=>setSport(sp)}>{sp==='gomoku'?'五子棋':'军棋'}<span>{value.counts[sp]} 桌</span></button>)}</div><label>{sport==='gomoku'?'五子棋':'军棋'}棋盘数<input aria-label={(sport==='gomoku'?'五子棋':'军棋')+'棋盘数'} type="number" min={1} max={30} value={value.counts[sport]} onChange={e=>resize(sport,Number(e.target.value))}/></label></div>
  <div className="composer-grid">{Array.from({length:value.counts[sport]},(_,i)=>{const key=tableKey(sport,i+1),judges=Object.entries(value.bindings).filter(([,keys])=>keys.includes(key));return <article className={'table-card '+(judges.length?'assigned':'')} key={key}>
   <div className="table-card-top"><span>{String(i+1).padStart(2,'0')}</span><b>{tableName(sport,i+1)}</b>{judges.length?<CheckCircle2 size={17}/>:<small>待安排</small>}</div>
   <div className="judge-chips">{judges.map(([id])=><span key={id}>{people.find(p=>p.id===id)?.display_name??'账号已停用'}<button type="button" aria-label={'移除'+(people.find(p=>p.id===id)?.display_name??id)} onClick={()=>onChange({...value,bindings:{...value.bindings,[id]:[]}})}><X size={13}/></button></span>)}</div>
   <button type="button" className="table-add" aria-label={tableName(sport,i+1)+'添加裁判'} onClick={()=>open(key)}><Plus size={16}/>{judges.length?'继续添加裁判':'添加负责裁判'}</button>
  </article>;})}</div>
  <p className="composer-hint">裁判不足时可直接新建账号，或减少启用桌数。已经安排到其他桌的裁判不会重复分配。</p>
  {target&&<div className="referee-picker-backdrop" onKeyDownCapture={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}><section role="region" aria-label="添加负责裁判" className="referee-picker">
   <header><div><span className="eyebrow">REFEREE DESK</span><h3>{tableName(target.split(':')[0] as Sport,Number(target.split(':')[1]))} · 添加裁判</h3></div><button type="button" className="icon-button" aria-label="关闭裁判选择" onClick={close}><X size={20}/></button></header>
   {credential&&<div className="credential-card"><b>新账号已创建，请先保存登录信息</b><p>{credential.displayName} · {credential.email}</p><label>随机密码<input readOnly value={credential.password} autoComplete="off"/></label><RefereeExport title="导出此裁判登录信息" format="txt" rows={[{name:credential.displayName,email:credential.email,password:credential.password}]} onExport={emails=>{if(emails.includes(credential.email))setSaved(true);}}/></div>}
   <div className="picker-actions"><label className="picker-search"><Search size={17}/><input aria-label="搜索可用裁判" placeholder="搜索裁判姓名或邮箱" value={query} onChange={e=>setQuery(e.target.value)}/></label>{call&&<button type="button" className="button secondary small" disabled={busy||!saved} onClick={()=>setCreating(!creating)}><UserPlus size={16}/>新建裁判</button>}</div>
   {creating?<div className="inline-judge-create"><label>裁判姓名<input aria-label="新裁判姓名" maxLength={40} value={name} onChange={e=>setName(e.target.value)}/></label><label>裁判邮箱<input aria-label="新裁判邮箱" type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label><p>生成随机密码，账号创建后自动加入当前棋盘。</p><button type="button" className="button primary" disabled={busy} onClick={()=>void create()}>{busy?'正在创建…':'创建并加入此桌'}</button></div>:<div className="picker-results">{people.filter(p=>(!value.bindings[p.id]?.length||value.bindings[p.id]?.[0]===target)&&(p.display_name+' '+(p.email??'')).toLowerCase().includes(query.toLowerCase())).map(p=>{const selected=value.bindings[p.id]?.[0]===target;return <button type="button" key={p.id} disabled={selected} onClick={()=>assign(p.id)}><span className="judge-avatar">{p.display_name.slice(0,1)}</span><span><b>{p.display_name}</b><small>{p.email||'裁判账号'}</small></span>{selected?<span>已加入</span>:<Plus size={18}/>}</button>;})}
    {!people.some(p=>!value.bindings[p.id]?.length)&&<p>暂无未分配裁判，可新建账号，或先从其他棋盘移除后再分配。</p>}</div>}
   {error&&<p role="alert">{error}</p>}<footer><span>仅显示空闲裁判与本桌已选裁判</span><button type="button" className="button primary small" disabled={busy} onClick={close}>完成添加</button></footer>
  </section></div>}
 </section>;
}
