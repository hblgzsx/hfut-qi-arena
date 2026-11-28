import {DataTable} from './DataTable';
import {useState} from 'react';
import {Download,Search,SlidersHorizontal} from 'lucide-react';
import {download} from './excel';
import {CREDENTIAL_FIELDS,refereeExportData} from './referee-export-data';
import type {CredentialField,RefereeExportRow} from './referee-export-data';
export function RefereeExport({rows,title='导出裁判账号信息',disabled=false,format='xlsx',onExport}:{rows:RefereeExportRow[];title?:string;disabled?:boolean;format?:'xlsx'|'txt';onExport?:(savedPasswordEmails:string[])=>void}){
 const [excluded,setExcluded]=useState<string[]>([]),[fields,setFields]=useState<CredentialField[]>(['name','email']),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const selected=rows.filter(r=>!excluded.includes(r.email)),visible=rows.filter(r=>(r.name+' '+r.email).toLowerCase().includes(query.toLowerCase()));
 const available:CredentialField[]=['name','email','password',...(rows.some(r=>r.status!==undefined)?['status' as const]:[]),...(rows.some(r=>r.note!==undefined)?['note' as const]:[])];
 async function save(){
  setMessage('');setBusy(true);
  try{const data=refereeExportData(rows,selected.map(r=>r.email),fields),stamp=new Date().toISOString().slice(0,10),sensitive=fields.includes('password');
   if(format==='txt'){const content=data.map(record=>Object.entries(record).map(([key,value])=>key+'：'+value).join('\n')).join('\n\n');download('裁判'+(sensitive?'登录信息':'基本信息')+'-'+stamp+'.txt',new Blob([content],{type:'text/plain;charset=utf-8'}));}
   else{const XLSX=await import('xlsx'),book=XLSX.utils.book_new(),sheet=XLSX.utils.json_to_sheet(data);sheet['!cols']=fields.map(f=>({wch:f==='password'||f==='note'?48:f==='email'?34:18}));XLSX.utils.book_append_sheet(book,sheet,'裁判信息');XLSX.writeFile(book,'裁判'+(sensitive?'登录信息':'基本信息')+'-'+stamp+'.xlsx');}
   onExport?.(sensitive?selected.filter(r=>r.password).map(r=>r.email):[]);setMessage('已导出 '+selected.length+' 名裁判，'+(sensitive?'包含本次可用密码。请仅交给对应裁判。':'文件不包含密码。'));
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="credential-export" aria-label={title}><details open={rows.length===1}><summary><SlidersHorizontal size={16}/>{title}<small>已选 {selected.length} / {rows.length} 人</small></summary><div className="credential-export-body">
 {rows.length>1&&<><div className="credential-export-tools"><label><Search size={15}/><input aria-label="搜索导出裁判" placeholder="搜索姓名或邮箱" value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" className="text-button" onClick={()=>setExcluded(excluded.filter(email=>!visible.some(r=>r.email===email)))}>全选搜索结果</button><button type="button" className="text-button" onClick={()=>setExcluded([...new Set([...excluded,...visible.map(r=>r.email)])])}>清空搜索结果</button></div><DataTable label="裁判导出选择" rows={visible} rowKey={r=>r.email} emptyText="没有匹配的裁判。" columns={[{title:'选择',cell:r=><input type="checkbox" aria-label={'导出 '+r.name+' '+r.email} checked={!excluded.includes(r.email)} onChange={()=>setExcluded(excluded.includes(r.email)?excluded.filter(e=>e!==r.email):[...excluded,r.email])}/>},{title:'裁判姓名',cell:r=>r.name},{title:'邮箱',cell:r=>r.email}]}/></>}
 <fieldset><legend>选择导出字段</legend><div className="credential-export-fields">{available.map(f=><label key={f}><input type="checkbox" aria-label={'导出字段 '+CREDENTIAL_FIELDS[f]} checked={fields.includes(f)} onChange={()=>setFields(fields.includes(f)?fields.filter(v=>v!==f):[...fields,f])}/>{CREDENTIAL_FIELDS[f]}</label>)}</div></fieldset>
 <p className="composer-hint">{fields.includes('password')?'已选择密码：仅本次创建或重置后返回的密码可以导出，已有密码无法读取。含密码的文件请勿发到公开群。':'密码默认不导出。姓名、邮箱等字段可独立勾选。'}{rows.some(r=>r.password)&&' 关闭前请另行保存新密码，导出不含密码的文件不会标记为已保存密码。'}</p>
 <button type="button" className="button secondary small" disabled={disabled||busy||!selected.length||!fields.length} onClick={()=>void save()}><Download size={15}/>{busy?'正在导出…':'导出所选裁判 '+format.toUpperCase()}</button>
 {message&&<p role="status">{message}</p>}</div></details></section>;
}
