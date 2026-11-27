import { useEffect, useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { cloudEnabled, supabase } from './cloud';
import type { Profile } from './cloud';
import { canGrantRole, isAdministrator } from './access-policy';
import {BulkReferees} from './BulkReferees';
import {RefereeExport} from './RefereeExport';

const labels:Record<Profile['role'],string>={superadmin:'超级管理员',admin:'赛事管理员',referee:'裁判',pending:'账号待授权',blocked:'账号已停用'};
type Credential={email:string;password:string;displayName:string};
export function AccountPanel({profile,call,onChanged,onWorkState}:{profile:Profile|null;call:(a:string,p?:Record<string,unknown>)=>Promise<any>;onChanged:()=>void;onWorkState?:(busy:boolean,unsaved:boolean)=>void}) {
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[people,setPeople]=useState<Profile[]>([]);
  const [refEmail,setRefEmail]=useState(''),[refName,setRefName]=useState(''),[credential,setCredential]=useState<Credential|null>(null);
  const [memberSearch,setMemberSearch]=useState(''),[memberPage,setMemberPage]=useState(0);
  const [credentialSaved,setCredentialSaved]=useState(false);
  useEffect(()=>setCredentialSaved(false),[credential]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(credential&&!credentialSaved){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[credential,credentialSaved]);
  const filteredPeople=people.filter(p=>p.id!==profile?.id&&(p.display_name+' '+p.email).toLowerCase().includes(memberSearch.toLowerCase()));
  useEffect(()=>setMemberPage(0),[memberSearch]);
  const [unsavedBatch,setUnsavedBatch]=useState(false);useEffect(()=>{onWorkState?.(busy,unsavedBatch||!!credential&&!credentialSaved);},[busy,unsavedBatch,credential,credentialSaved]);
  async function list(){try{const d=await call('members');setPeople(d.profiles);}catch(e){setMessage((e as Error).message);}}
  useEffect(()=>{if(isAdministrator(profile?.role))void list();else setPeople([]);setCredential(null);},[profile?.id,profile?.role]);
  if(!cloudEnabled)return <div className="account-offline"><ShieldCheck size={38}/><h3>云端尚未配置</h3><p>本地演示可以体验展示与录分。跨设备同步与裁判账号管理需要连接 Supabase 后端。</p></div>;
  async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  async function auth(e:React.FormEvent){e.preventDefault();await run(async()=>{
    const {error}=await supabase!.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('');onChanged();
  });}
  async function changeRole(p:Profile,role:Profile['role']){if(!confirm(`将 ${p.display_name}（${p.email}）的权限改为「${labels[role]}」？${role==='superadmin'?'该账号将可以管理全部赛事及其他管理员权限。':''}`))return;await run(async()=>{await call('approve',{userId:p.id,role});await list();setMessage('权限已更新。');});}
  return <div className="account-panel">{profile?<>
    <div className="account-status"><ShieldCheck size={30}/><h3>{profile.display_name}</h3><p>{profile.email}</p><span className="status-pill green">{labels[profile.role]}</span></div>
    {profile.role==='pending'&&<div className="info-note">账号尚未授权，请联系已有管理员。</div>}
    {isAdministrator(profile.role)&&<>
      <BulkReferees call={call} onChanged={()=>void list()} onBusyChange={setBusy} onCredentialsChange={setUnsavedBatch}/>
      <RefereeExport title="管理员导出裁判信息" disabled={busy} rows={people.filter(p=>p.role==='referee').map(p=>({name:p.display_name,email:p.email,password:credential?.email===p.email?credential.password:undefined,status:'裁判'}))} onExport={emails=>{if(credential&&emails.includes(credential.email))setCredentialSaved(true);}}/>
      <form onSubmit={e=>{e.preventDefault();void run(async()=>{setCredential(null);const data=await call('create-referee',{email:refEmail,displayName:refName});setCredential(data.credential);setRefEmail('');setRefName('');await list();});}}>
        <h3>创建裁判账号</h3><p>系统生成随机密码，裁判使用邮箱和该密码登录。不会发送邀请邮件。</p>
        <label className="form-label">裁判姓名<input required maxLength={40} value={refName} onChange={e=>setRefName(e.target.value)}/></label>
        <label className="form-label">裁判邮箱<input required type="email" value={refEmail} onChange={e=>setRefEmail(e.target.value)}/></label>
        <button className="button primary full" disabled={busy}>生成裁判账号与随机密码</button>
      </form>
      {credential&&<div className="credential-card" role="status"><h3>请将登录信息交给对应裁判</h3><p>{credential.displayName} · {credential.email}</p><label className="form-label">随机密码（关闭后不再显示）<input readOnly value={credential.password} autoComplete="off" onFocus={e=>e.target.select()}/></label><RefereeExport title="导出当前裁判登录信息" format="txt" rows={[{name:credential.displayName,email:credential.email,password:credential.password}]} onExport={emails=>{if(emails.includes(credential.email))setCredentialSaved(true);}}/><div className="modal-actions"><button className="button secondary" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(`邮箱：${credential.email}\n密码：${credential.password}`);setCredentialSaved(true);setMessage('登录信息已复制，请安全交给对应裁判。');})}>复制登录信息</button><button className="button secondary" onClick={()=>{if(!credentialSaved&&!confirm('该裁判密码尚未保存，关闭后无法再次读取。确认已另行记录？'))return;setCredential(null);}}>已保存，关闭密码</button></div></div>}
      <div className="member-list"><h3>账号与权限</h3><p>{profile.role==='superadmin'?'可授权管理员、超级管理员或裁判。不能修改自己的权限。':'可管理裁判。高级权限由超级管理员处理。'}</p>
        <label className="form-label">查找账号<input aria-label="查找管理账号" placeholder="姓名或邮箱" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)}/></label>
        {filteredPeople.slice(memberPage*10,memberPage*10+10).map(p=><div className="member-row" key={p.id}><div><b>{p.display_name}</b><small>{p.email} · {labels[p.role]}</small></div><div className="member-controls">
          <select aria-label={`${p.display_name}的权限`} value={p.role} disabled={busy} onChange={e=>void changeRole(p,e.target.value as Profile['role'])}><option value={p.role}>{labels[p.role]}</option>{(['referee','admin','superadmin','blocked'] as const).filter(role=>role!==p.role&&canGrantRole(profile,p,role)).map(role=><option key={role} value={role}>{labels[role]}</option>)}</select>
          {['referee','blocked'].includes(p.role)&&<button className="button secondary small" disabled={busy} onClick={()=>{if(confirm(`重置 ${p.display_name}（${p.email}）的密码？旧密码立即失效。`))void run(async()=>{setCredential(null);const data=await call('reset-referee',{userId:p.id});setCredential(data.credential);});}}>重置随机密码</button>}
        </div></div>)}{!filteredPeople.length&&<p>没有匹配的账号。</p>}
        {filteredPeople.length>10&&<div className="roll-pagination"><button type="button" className="button secondary small" disabled={!memberPage} onClick={()=>setMemberPage(n=>n-1)}>上一页</button><span>{memberPage+1} / {Math.ceil(filteredPeople.length/10)} 页 · {filteredPeople.length} 人</span><button type="button" className="button secondary small" disabled={(memberPage+1)*10>=filteredPeople.length} onClick={()=>setMemberPage(n=>n+1)}>下一页</button></div>}
      </div>
    </>}
    <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>{onChanged();if(isAdministrator(profile.role))void list();}}>刷新权限状态</button><button className="button secondary" disabled={busy} onClick={()=>void run(async()=>{await supabase!.auth.signOut();setCredential(null);onChanged();})}>退出登录</button></div>
  </>:<><h3><LogIn size={16}/> 邮箱登录</h3><form onSubmit={auth}><label className="form-label">邮箱<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="form-label">密码<input type="password" required minLength={8} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary full" disabled={busy}>{busy?'正在处理…':'登录赛事工作台'}</button></form><p className="account-help">账号由管理员统一创建，请向组委会领取登录信息。</p></>}{message&&<p className="validation-warning" role="status">{message}</p>}</div>;
}
