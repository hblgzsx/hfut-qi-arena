import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,Mic2,Play,Search,Square,Volume2} from 'lucide-react';
import type {State} from './engine';
import {broadcastRows} from './broadcast-data';
import type {BroadcastRow} from './broadcast-data';
import {reserveResult,refreshResult,finishResultVoice,finishResultVisual,discardResult,tableCallWait,resultIsPending,callGapSeconds,setCallGapSeconds} from './broadcast-order';
import {eventId,cloudEnabled} from './cloud';
import {claimBroadcast,OtherBroadcastDevice,withBroadcastHeartbeat} from './broadcast-lease';
import {markResultDelivered,resultWasDelivered} from './result-delivery';
import {DataTable} from './DataTable';
import {SpeechControls,playManualSpeech} from './SpeechControls';
import './broadcast-console.css';
type Call=(action:string,payload?:Record<string,unknown>)=>Promise<any>;
const manualKey=(id:string)=>'qi-manual-broadcast:'+eventId+':'+id;
function stored(key:string){try{return localStorage.getItem(key)||'';}catch{return '';}}
function localStatus(row:BroadcastRow){if(!row.valid)return '已失效';if(row.queueKey&&resultIsPending(eventId,row.queueKey))return '自动排队 / 播放中';if(stored(manualKey(row.id)))return '已手动播报';if(row.kind==='call')return stored('qi-table-call:'+row.callId)?'已叫号':'待叫号';return row.deliveryId&&resultWasDelivered(eventId,row.deliveryId)?'已完整播报':'可手动播报';}
function pause(signal:AbortSignal){return new Promise<void>(resolve=>{const done=()=>{clearTimeout(t);signal.removeEventListener('abort',done);resolve();};const t=setTimeout(done,300);signal.addEventListener('abort',done,{once:true});if(signal.aborted)done();});}
export function BroadcastConsole({state,call,onBack,queueEnabled,onToggleQueue,callQueueEnabled,onToggleCallQueue,projection,queueSince}:{state:State;call:Call;onBack:()=>void;queueEnabled:boolean;onToggleQueue:()=>void;callQueueEnabled:boolean;onToggleCallQueue:()=>void;projection:boolean;queueSince:number}){
 const [tab,setTab]=useState<'result'|'call'>('result'),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[job,setJob]=useState<BroadcastRow|null>(null),[message,setMessage]=useState('选择一条记录，即可在本机手动播报。'),[tick,setTick]=useState(0);
 const [gap,setGap]=useState(()=>callGapSeconds(eventId)),[gapDraft,setGapDraft]=useState(()=>String(callGapSeconds(eventId))),[device,setDevice]=useState('正在检查播报设备'),[takingOver,setTakingOver]=useState(false);
 const stateRef=useRef(state);stateRef.current=state;const controller=useRef<AbortController|null>(null),reservation=useRef('');
 useEffect(()=>{const overflow=document.body.style.overflow,root=document.getElementById('root'),inert=root?.inert,focus=document.activeElement as HTMLElement|null;document.body.style.overflow='hidden';if(root)root.inert=true;const release=()=>{controller.current?.abort();if(reservation.current)discardResult(eventId,reservation.current);};window.addEventListener('pagehide',release);return()=>{window.removeEventListener('pagehide',release);release();document.body.style.overflow=overflow;if(root)root.inert=!!inert;focus?.focus();};},[]);
 useEffect(()=>{const timer=setInterval(()=>{setTick(n=>n+1);if(reservation.current)refreshResult(eventId,reservation.current);},1000);return()=>{clearInterval(timer);controller.current?.abort();};},[]);
 useEffect(()=>{let active=true;const update=()=>void claimBroadcast('',false,undefined,true).then(c=>{if(active)setDevice(c.owned?'本机可负责播报':'其他设备负责播报');}).catch(()=>{if(active)setDevice('设备连接失败，待播任务保留');});update();const timer=setInterval(update,10000);return()=>{active=false;clearInterval(timer);};},[]);
 async function takeOver(){setTakingOver(true);try{const c=await claimBroadcast('',true);setDevice(c.owned?'本机负责播报':'设备切换未完成');setMessage(c.owned?'已切换为本机播报；未完成的成绩和有效叫号将继续处理。':'设备切换未完成，请重试。');}catch(e){setMessage((e as Error).message);}finally{setTakingOver(false);}}
 function saveGap(){try{if(!gapDraft.trim())throw new Error('请输入叫号间隔');const seconds=Number(gapDraft);setCallGapSeconds(eventId,seconds);setGap(seconds);setMessage('叫号间隔已设置为 '+seconds+' 秒，按最近一次成绩播报结束时刻重新计算。');}catch(e){setMessage((e as Error).message);}}
 const all=broadcastRows(state),rows=all.filter(r=>r.kind===tab&&(!query.trim()||[r.title,r.text,r.detail].join(' ').includes(query.trim()))&&(filter==='all'||(filter==='expired'?!r.valid:filter==='ready'?r.valid:r.valid&&localStatus(r).includes('已'))));
 const latest=(row:BroadcastRow)=>broadcastRows(stateRef.current).find(r=>r.id===row.id&&r.valid);
 async function replay(row:BroadcastRow){
  if(controller.current||!row.valid)return;
  if(!('speechSynthesis' in window)||!navigator.locks){setMessage('请使用支持中文语音和播报锁的 Edge 或 Chrome。');return;}
  const control=new AbortController(),signal=control.signal;controller.current=control;setJob(row);let reserved=false,started=false,completed=false;const key='manual:'+crypto.randomUUID();
  try{
   if(row.kind==='result'){reserveResult(eventId,key);reserved=true;reservation.current=key;}
   while(!signal.aborted){
    if(!latest(row))throw new Error('这条记录已被更正、取消或开赛，请核对最新状态。');
    if(row.kind==='call'){const wait=tableCallWait(eventId);if(wait>0){setMessage(wait===Infinity?'正在等待成绩播报完成，再间隔 '+callGapSeconds(eventId)+' 秒叫号。':`成绩已播完，${Math.ceil(wait/1000)} 秒后可重新叫号。`);await pause(signal);continue;}}
    setMessage('正在等待本机其他播报结束…');
    let played=false;
    await navigator.locks.request('qi-arena-voice-owner',{ifAvailable:true},async lock=>{
     if(!lock||signal.aborted)return;if(!latest(row))throw new Error('当前记录已失效，请查看最新对局。');
     if(row.kind==='call'&&tableCallWait(eventId)>0)return;
     if(cloudEnabled){const claim=await claimBroadcast();if(!claim.owned)throw new OtherBroadcastDevice();}
     if(signal.aborted)return;if(!latest(row))throw new Error('当前记录已失效，请查看最新对局。');
     if(row.kind==='call'&&tableCallWait(eventId)>0)return;
     setMessage('正在播报：'+row.title);started=true;
     // If a called match starts or its result is corrected while waiting/playing,
     // stop only this console's utterance rather than speaking obsolete information.
     const validity=setInterval(()=>{if(!latest(row))control.abort();},300);
     try{const current=latest(row);if(!current)throw new Error('当前记录已失效');await withBroadcastHeartbeat(signal,active=>playManualSpeech(current.text,active));}finally{clearInterval(validity);}
     completed=true;played=true;try{localStorage.setItem(manualKey(row.id),String(Date.now()));if(row.callId)localStorage.setItem('qi-table-call:'+row.callId,'done');}catch{}
     const receipt=row.callId||row.deliveryId;if(row.deliveryId)markResultDelivered(eventId,row.deliveryId);
     if(receipt&&cloudEnabled)try{await claimBroadcast(receipt);}catch{setMessage('本机已完整播完，云端回执待网络恢复后自动补交。');return;}
     setMessage('播报完成：'+row.title+(row.kind==='result'?'。'+callGapSeconds(eventId)+' 秒后允许叫号。':''));
    });
    if(played)break;await pause(signal);
   }
   if(signal.aborted)setMessage('已停止本次播报；可核对记录后重播。');
  }catch(e){setMessage(signal.aborted?'已停止本次播报；可核对记录后重播。':(e as Error).message);}
  finally{if(reserved){finishResultVoice(eventId,key,started);finishResultVisual(eventId,key);reservation.current='';}controller.current=null;setJob(null);setTick(n=>n+1);if(completed)onHistoryChanged();}
 }
 function onHistoryChanged(){window.dispatchEvent(new Event('qi-broadcast-history'));}
 const wait=tableCallWait(eventId);void tick;
 return createPortal(<div className="broadcast-console" role="dialog" aria-modal="true" aria-label="播报控制台"><header className="broadcast-console-header"><div><span className="eyebrow">QI ARENA · BROADCAST</span><h1><Mic2/>播报控制台</h1><p>{state.event?.name??'当前赛事'} · 管理员操作</p></div><button className="button secondary" disabled={!!job} onClick={onBack}><ArrowLeft size={16}/>返回赛事</button></header><main className="broadcast-console-main">
  <section className="broadcast-console-summary"><article><Volume2/><div><strong>{all.filter(r=>r.kind==='result').length}</strong><span>有效成绩记录</span></div></article><article><Mic2/><div><strong>{all.filter(r=>r.kind==='call'&&r.valid).length}</strong><span>当前有效叫号</span></div></article><article className="broadcast-console-rule"><b>先成绩 · 后叫号</b><span>{wait===Infinity?'成绩播报队列处理中':wait>0?`叫号间隔剩余 ${Math.ceil(wait/1000)} 秒`:'叫号间隔已满足'}</span><small>每次成绩播报结束后，间隔 {gap} 秒再叫号。</small></article></section>
  <section className="panel broadcast-console-status"><div><b aria-live="polite">{message}</b>{job&&<p>{job.text}</p>}<small>手动重播与自动播报共用语音通道；同一时刻只播放一条。切换下方标签不会停止当前播报。</small></div>{job&&<button className="button secondary" onClick={()=>controller.current?.abort()}><Square size={14}/>停止本次播报</button>}</section>
  <section className="panel broadcast-queue-settings" aria-label="自动播报设置"><div className="broadcast-console-toolbar"><div><h2>自动播报设置</h2><p>统一控制本机的两类自动队列，手动重播仍可单独操作。</p></div><SpeechControls queueSince={queueSince} managed/></div><div className="broadcast-queue-switches"><label><div><b>成绩播放队列</b><small>新赛果依次展示并朗读；关闭后停止自动播放。</small></div><input type="checkbox" role="switch" aria-label="成绩播放队列" checked={queueEnabled} disabled={!!job} onChange={onToggleQueue}/><span>{queueEnabled?'已开启':'已关闭'}</span></label><label><div><b>棋盘叫号队列</b><small>先播完成绩，再等 {gap} 秒，播报桌号及双方姓名。</small></div><input type="checkbox" role="switch" aria-label="棋盘叫号队列" checked={callQueueEnabled} disabled={!!job} onChange={onToggleCallQueue}/><span>{!callQueueEnabled?'已关闭':!queueEnabled?'等待成绩队列开启':!projection?'等待进入现场大屏':'已开启'}</span></label></div><small>自动语音由现场大屏负责。当前{projection?'位于现场大屏':'为管理页面，可先设置，再进入现场大屏'}；其他设备已占用播报时，本机不会重复接管叫号。</small><div className="broadcast-device"><div><b>播报设备 · {device}</b><small>刷新页面继续使用同一设备标识。更换主屏时，明确选择本机接管，原设备会停止播报。</small></div><button className="button secondary" disabled={takingOver||!!job||device==='本机负责播报'} onClick={()=>void takeOver()}>{takingOver?'正在切换…':'使用本机播报'}</button></div><div className="broadcast-gap"><label>成绩播报后叫号间隔（秒）<input type="number" aria-label="成绩播报后叫号间隔秒" min="0" max="300" step="1" value={gapDraft} onChange={e=>setGapDraft(e.target.value)}/></label><button className="button secondary" disabled={!!job||!gapDraft.trim()} onClick={saveGap}>保存叫号间隔</button><small>默认 15 秒，可设置 0—300 秒；按本机、当前赛事保存，可中途修改。</small></div></section>
  <section className="panel broadcast-console-list"><div className="broadcast-console-toolbar"><div role="tablist" aria-label="播报类型">{(['result','call'] as const).map(kind=><button role="tab" aria-selected={tab===kind} key={kind} onClick={()=>{setTab(kind);setFilter('all');setQuery('');}}>{kind==='result'?'成绩播报':'棋盘叫号'} <span>{all.filter(r=>r.kind===kind).length}</span></button>)}</div></div>
   <p>{tab==='result'?'展示当前有效赛果。历史成绩可按需手动重播，更正后的旧内容不会保留为可播报项。':'只有仍在等待双方到桌的对局可重新叫号。已经开赛、结束或取消的叫号保留供查询，不能再播。'}</p>
   <div className="broadcast-console-search"><label className="search-input"><Search size={16}/><input aria-label="搜索播报记录" placeholder="搜索选手、项目、场次或桌号" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>筛选<select aria-label="播报记录筛选" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部记录</option><option value="ready">可播报</option><option value="played">有本机处理记录</option>{tab==='call'&&<option value="expired">已失效</option>}</select></label></div>
   <DataTable key={tab} label={tab==='result'?'成绩播报记录':'棋盘叫号记录'} rows={rows} rowKey={r=>r.id} initialPageSize={10} emptyText="当前筛选下没有播报记录。" columns={[
    {title:'对局 / 棋盘',cell:r=><><b>{r.title}</b><small>{new Date(r.time).toLocaleString('zh-CN',{hour12:false})}</small></>},
    {title:'播报全文',className:'broadcast-transcript',cell:r=><p>{r.text}</p>},
    {title:'状态',cell:r=><><span className={'status-pill '+(r.valid?'green':'muted')}>{job?.id===r.id?'等待 / 播报中':localStatus(r)}</span><small>{r.detail}</small>{stored(manualKey(r.id))&&<small>上次重播 {new Date(Number(stored(manualKey(r.id)))).toLocaleTimeString('zh-CN',{hour12:false})}</small>}</>},
    {title:'操作',cell:r=><button className="button secondary small" disabled={!!job||!r.valid} aria-label={'重新播报 '+r.title} onClick={()=>void replay(r)}><Play size={14}/>重新播报</button>}
   ]}/><small>播放记录按本机浏览器保存。自动成绩仅播放本次登录后的新赛果；此页面允许管理员手动重播历史有效赛果。自动叫号请在现场大屏启用。</small>
  </section></main></div>,document.body);
}
