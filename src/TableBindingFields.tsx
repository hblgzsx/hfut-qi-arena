import {SPORTS,tableKey,tableName} from './scheduling';
import type {Schedule} from './scheduling';
export interface RefereeOption {id:string;display_name:string;role:string}
export function TableBindingFields({value,onChange,members}:{value:Schedule;onChange:(s:Schedule)=>void;members:RefereeOption[]}) {
 return <fieldset className="backup-fields"><legend>启用棋盘与负责裁判</legend>
  <p>每张启用棋盘至少一名裁判，一名裁判在本场赛事只能负责一桌。一桌可安排多名裁判。</p>
  {SPORTS.map(sport=><label key={sport}>{sport==='gomoku'?'五子棋':'军棋'}棋盘数<input type="number" min={1} max={30} value={value.counts[sport]} onChange={e=>onChange({...value,counts:{...value.counts,[sport]:Number(e.target.value)},bindings:{}})}/></label>)}
  {members.length===0&&<p>请先在账号与权限中心创建裁判账号，再创建竞赛。</p>}
  {members.map(p=><label key={p.id}>{p.display_name}<select aria-label={p.display_name+'负责棋盘'} value={value.bindings[p.id]?.[0]??''} onChange={e=>onChange({...value,bindings:{...value.bindings,[p.id]:e.target.value?[e.target.value]:[]}})}>
   <option value="">不参与本场执裁</option>
   {SPORTS.flatMap(sport=>Array.from({length:Math.max(0,Math.min(30,value.counts[sport]))},(_,i)=><option key={tableKey(sport,i+1)} value={tableKey(sport,i+1)}>{tableName(sport,i+1)}</option>))}
  </select></label>)}
 </fieldset>;
}
