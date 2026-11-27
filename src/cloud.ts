import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyState,validateState } from './engine';
import type { Result, Sport, State } from './engine';
const env=import.meta.env;
const url=env.VITE_SUPABASE_URL??'',key=env.VITE_SUPABASE_PUBLISHABLE_KEY??'';
const requestedEvent=new URLSearchParams(location.search).get('event');
export const eventId=requestedEvent&&/^[a-z0-9-]{1,64}$/.test(requestedEvent)?requestedEvent:env.VITE_EVENT_ID||'hfut-2026';
export function eventUrl(id:string){const url=new URL(location.href);url.searchParams.set('event',id);url.searchParams.delete('screen');url.searchParams.delete('view');return url.href;}
export const cloudEnabled=!!url&&!!key;
export const supabase=cloudEnabled?createClient(url,key):null;
export interface Profile { id:string; display_name:string; email:string; role:'pending'|'referee'|'admin'|'superadmin'|'blocked' }
export function useCloud() {
  const [remote,setRemote]=useState<State|null>(null),[profile,setProfile]=useState<Profile|null>(null),[status,setStatus]=useState(cloudEnabled?'正在连接云端':'本地离线'),[loading,setLoading]=useState(cloudEnabled);
  const generation=useRef(0);const [signedInAt,setSignedInAt]=useState<string|null>(null),[unavailable,setUnavailable]=useState(false);
  const [locked,setLocked]=useState(false);
  const [backupAt,setBackupAt]=useState('');
  const call=useCallback(async(action:string,payload:Record<string,unknown>={})=>{
    if(!supabase)throw new Error('尚未配置 Supabase。请按部署说明创建项目。');
    const eventGrant=sessionStorage.getItem('qi-event-grant:'+eventId)||'';
    const {data,error}=await supabase.functions.invoke('tournament',{body:{action,eventId,eventGrant,...payload}});
    if(error){let message=error.message;try{const body=await error.context?.json();message=body?.error??message;}catch{}throw new Error(message);}
    if(data?.error)throw new Error(data.error);
    return data;
  },[]);
  const refresh=useCallback(async()=>{
    if(!supabase)return;const n=++generation.current;
    try{
      const {data:{session}}=await supabase.auth.getSession();
      let next:State,p:Profile|null=null,missing=false;const loginTime=session?.user.last_sign_in_at||session?.user.created_at||null;
      if(session){const data=await call('read');next=validateState(data.state);p=data.profile;missing=!!data.unavailable;if(n===generation.current){setLocked(!!data.locked);setBackupAt(data.lastBackupAt??'');}}
      else {if(n===generation.current)setProfile(null);const {data,error}=await supabase.from('public_events').select('state').eq('id',eventId).maybeSingle();if(error)throw error;missing=!data;next=data?validateState(data.state):emptyState();}
      if(n===generation.current){setRemote(next);setProfile(p);setUnavailable(missing);setSignedInAt(loginTime);setStatus(missing?'此竞赛已删除或不存在，请添加、恢复或切换竞赛。':'云端已同步');setLoading(false);}
    }catch(e){if(n===generation.current){setStatus(`连接失败：${(e as Error).message}`);setLoading(false);}}
  },[call]);
  useEffect(()=>{
    if(!supabase)return;void refresh();
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void refresh(),0);});
    const channel=supabase.channel(`event-${eventId}`).on('postgres_changes',{event:'*',schema:'public',table:'public_events',filter:`id=eq.${eventId}`},()=>void refresh()).subscribe();
    const floorTimer=setInterval(()=>{void supabase!.functions.invoke('tournament',{body:{action:'floor-tick',eventId}});},10000);
    const timer=setInterval(()=>void refresh(),10000);const online=()=>void refresh();window.addEventListener('online',online);
    return()=>{generation.current++;subscription.unsubscribe();void supabase!.removeChannel(channel);clearInterval(timer);clearInterval(floorTimer);window.removeEventListener('online',online);};
  },[refresh]);
  async function replace(state:State,expectedRevision:string,message:string,sport:Sport,password='',reason=''){generation.current++;const data=await call('replace',{state,expectedRevision,message,sport,password,reason});generation.current++;const next=validateState(data.state);setRemote(next);return next;}
  async function score(sport:Sport,id:string,result:Result|null,expectedSignature:string){generation.current++;const data=await call('score',{sport,id,result,expectedSignature});generation.current++;const next=validateState(data.state);setRemote(next);return next;}
  return {enabled:cloudEnabled,remote,profile,signedInAt,status,loading,unavailable,locked,backupAt,refresh,call,replace,score};
}
