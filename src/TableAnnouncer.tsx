import {tableCallWait} from './broadcast-order';
import {useEffect,useRef,useState} from 'react';
import type {State} from './engine';
import {eventId} from './cloud';
import {claimBroadcast,OtherBroadcastDevice,withBroadcastHeartbeat} from './broadcast-lease';
import {playManualSpeech} from './SpeechControls';
import {broadcastRows} from './broadcast-data';
export function TableAnnouncer({state,resultsEnabled,enabled}:{state:State;resultsEnabled:boolean;enabled:boolean}){
 const [status,setStatus]=useState('自动叫号队列已关闭'),stateRef=useRef(state),resultQueue=useRef(resultsEnabled);stateRef.current=state;resultQueue.current=resultsEnabled;
 useEffect(()=>{
  if(!enabled){setStatus('自动叫号队列已关闭');return;}
  const controller=new AbortController();let busy=false,active=true;
  const ordered=()=>{if(!resultQueue.current){setStatus('叫号暂停：等待成绩播放队列开启');return false;}const wait=tableCallWait(eventId);if(wait===Infinity){setStatus('叫号等待：先完成成绩播报');return false;}if(wait>0){setStatus('成绩播报结束，'+Math.ceil(wait/1000)+' 秒后叫号');return false;}return true;};
  const calls=()=>broadcastRows(stateRef.current).filter(r=>r.kind==='call'&&r.valid).sort((a,b)=>a.time-b.time);
  const delivered=(id:string)=>{try{return !!localStorage.getItem('qi-table-call:'+id);}catch{return false;}};
  async function next(){
   if(busy||!active||!ordered())return;busy=true;
   try{
    if(!navigator.locks)throw new Error('浏览器缺少播报锁，请使用 Edge 或 Chrome');
    await navigator.locks.request('qi-arena-voice-owner',{ifAvailable:true},async lock=>{
     if(!lock||!active||!ordered())return;
     const claim=await claimBroadcast('',false,controller.signal);if(!active)return;
     for(const row of calls())if(claim.delivered.includes(row.callId!))try{localStorage.setItem('qi-table-call:'+row.callId,'done');}catch{}
     const row=calls().find(r=>!delivered(r.callId!));if(!row){setStatus('当前有效叫号均已播完，等待下一场');return;}
     if(!claim.owned)throw new OtherBroadcastDevice();if(!ordered())return;
     if(!calls().some(r=>r.id===row.id))return;
     setStatus(row.text);
     await withBroadcastHeartbeat(controller.signal,signal=>playManualSpeech(row.text,signal));
     if(!active)return;
     try{localStorage.setItem('qi-table-call:'+row.callId,'done');}catch{}
     try{await claimBroadcast(row.callId!,false,controller.signal);}catch{setStatus('叫号已播完，云端回执待网络恢复后补交');}
    });
   }catch(e){if(active)setStatus((e as Error).message+'；未完成叫号仍保留，将自动重试');}
   finally{busy=false;}
  }
  void next();const timer=setInterval(()=>void next(),1500);
  return()=>{active=false;clearInterval(timer);controller.abort();};
 },[enabled]);
 return <div className="arena-call-banner"><span role="status">{status}</span></div>;
}
