import { useEffect, useState } from 'react';
import { Check, Download, History } from 'lucide-react';
import { download } from './excel';
interface Entry{sequence:number;sport:string;message:string;happened_at:string;actor_id:string|null}
export function CloudAudit({call,revision}:{call:(a:string,p?:Record<string,unknown>)=>Promise<any>;revision:string}) {
  const [entries,setEntries]=useState<Entry[]>([]),[more,setMore]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function load(reset=false){setBusy(true);setError('');try{const d=await call('audit',!reset&&entries.length?{before:entries.at(-1)!.sequence}:{});setEntries(old=>reset?d.entries:[...old,...d.entries]);setMore(d.entries.length===50);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  useEffect(()=>{void load(true);},[revision]);
  async function exportAll(){setBusy(true);try{const all:Entry[]=[];let before:number|undefined;for(;;){const d=await call('audit',before?{before}:{});all.push(...d.entries);if(d.entries.length<50)break;before=d.entries.at(-1).sequence;}download('弈境-完整修改档案.json',new Blob([JSON.stringify(all,null,2)],{type:'application/json'}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="panel"><div className="section-title"><div><h2>完整修改档案</h2><p>云端留存全部关键操作，不受页面最近 200 条限制。含操作者、时间与修改前后结果。</p></div><button className="button secondary small" disabled={busy} onClick={exportAll}><Download size={15}/>导出完整档案</button></div>{entries.map(e=><div className="audit-row" key={e.sequence}><span className="audit-dot"/><div><b>{e.message}</b><small>{e.sport==='gomoku'?'五子棋':'军棋'} · {new Date(e.happened_at).toLocaleString('zh-CN',{hour12:false})} · #{e.sequence}</small></div><Check size={16}/></div>)}{!entries.length&&!busy&&<div className="empty"><History/><p>暂无云端操作。</p></div>}{error&&<p className="validation-error">{error}</p>}{more&&<button className="button secondary full" disabled={busy} onClick={()=>void load()}>{busy?'加载中…':'加载更早记录'}</button>}</section>;
}
