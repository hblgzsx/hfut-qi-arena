import {useEffect,useRef,useState} from 'react';
import type {State} from './engine';
import {backupSettings} from './event-settings';
import type {BackupSettings} from './event-settings';
import {localBackups,saveLocalBackup} from './local-backup';

export function BackupFields({value,onChange}:{value:BackupSettings;onChange:(settings:BackupSettings)=>void}) {
 return <fieldset className="backup-fields"><legend>自动备份</legend>
  <label className="backup-enable"><input type="checkbox" checked={value.enabled} onChange={e=>onChange({...value,enabled:e.target.checked})}/>启用本场赛事自动备份</label>
  <label>备份间隔（分钟）<input type="number" min={1} max={120} value={value.intervalMinutes} onChange={e=>onChange({...value,intervalMinutes:Number(e.target.value)})}/></label>
  <small>默认关闭，默认间隔 10 分钟。开启后云端定时保存，管理员浏览器同时保留本机副本。</small>
 </fieldset>;
}
export function useAutoBackup(state:State,allowed:boolean,cloud:boolean,connected:boolean,eventId:string) {
 const ref=useRef({state,connected});ref.current={state,connected};
 const [status,setStatus]=useState(''),[last,setLast]=useState('');
 const settings=backupSettings(state.event);
 useEffect(()=>{
  if(!allowed||!settings.enabled){setStatus('自动备份关闭');return;}
  let active=true,busy=false;
  async function tick(){
   if(busy)return;busy=true;
   try {
    const list=await localBackups(eventId);
    if(!active)return;
    if(list[0])setLast(list[0].createdAt);
    if(cloud&&!ref.current.connected){setStatus(list.length?'离线，最近的本机备份已保留':'离线，等待首次同步后备份');return;}
    const item=await saveLocalBackup(eventId,ref.current.state,cloud?'cloud':'local',settings.intervalMinutes*60000);
    if(active){setLast(item.createdAt);setStatus('本机自动备份正常');}
   } catch(error){if(active)setStatus('本机备份失败：'+(error as Error).message);}
   finally{busy=false;}
  }
  void tick();const timer=setInterval(()=>void tick(),15000);
  const resume=()=>void tick();window.addEventListener('online',resume);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('online',resume);};
 },[allowed,settings.enabled,settings.intervalMinutes,cloud,eventId]);
 return {status,last};
}
export function AutoBackupPanel({state,cloud,call,onSave,onDownload,eventId}:{state:State;cloud:boolean;eventId:string;call:(a:string,p?:Record<string,unknown>)=>Promise<any>;onSave:(settings:BackupSettings)=>Promise<boolean>;onDownload:(state:State,time:string)=>void}) {
 const [draft,setDraft]=useState(()=>backupSettings(state.event)),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [remote,setRemote]=useState<{id:string;created_at:string;revision:string}[]>([]);
 const [local,setLocal]=useState<Awaited<ReturnType<typeof localBackups>>>([]);
 async function refresh(){
  try{setLocal(await localBackups(eventId));if(cloud){const data=await call('backups');setRemote(data.backups);}}catch(e){setMessage((e as Error).message);}
 }
 useEffect(()=>{void refresh();},[]);
 return <section className="auto-backup-panel"><h3>自动备份与历史版本</h3>
  <BackupFields value={draft} onChange={setDraft}/>
  <button className="button primary small" disabled={busy} onClick={async()=>{
   setBusy(true);try{if(await onSave(draft)){setMessage('自动备份设置已保存');await refresh();}}finally{setBusy(false);}
  }}>保存自动备份设置</button>
  <p>云端最多保留最近 72 份，本机最多保留 24 份。云端后台每分钟检查一次，页面关闭后继续备份；本机副本需要管理员保持页面打开。</p>
  <div className="bulk-actions"><button className="button secondary small" disabled={busy} onClick={async()=>{
   setBusy(true);try{if(cloud)await call('backup-now');await saveLocalBackup(eventId,state,cloud?'cloud':'local');setMessage('已完成立即备份');await refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }}>立即备份一次</button><button className="button secondary small" onClick={()=>void refresh()}>刷新备份列表</button></div>
  {cloud&&<><h4>云端备份</h4><p>{remote[0]?'最近成功 '+new Date(remote[0].created_at).toLocaleString('zh-CN',{hour12:false}):'尚无云端备份'}</p><div className="backup-list">{remote.map(row=><button className="button secondary small" key={row.id} onClick={async()=>{
   try{const data=await call('backup-download',{backupId:row.id});onDownload(data.state,row.created_at);}catch(e){setMessage((e as Error).message);}
  }}>下载 {new Date(row.created_at).toLocaleString('zh-CN',{hour12:false})}</button>)}</div></>}
  <h4>本机副本</h4><div className="backup-list">{local.map(row=><button className="button secondary small" key={row.id} onClick={()=>onDownload(row.state,row.createdAt)}>下载 {new Date(row.createdAt).toLocaleString('zh-CN',{hour12:false})}</button>)}</div>
  <p>下载需要的版本，再通过“恢复 JSON 备份”核对并恢复。恢复会替换当前赛事，先暂停调度并保存当前备份。PPTX 颁奖背景单独保存在本机。</p>
  <p role="status">{message}</p>
 </section>;
}
