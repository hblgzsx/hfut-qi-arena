import { useEffect, useRef, useState } from 'react';
import type { State } from './engine';
import { occupied } from './scheduling';
import {supabase,eventId} from './cloud';

export function TableAnnouncer({state}:{state:State}) {
  const [enabled,setEnabled]=useState(false),[status,setStatus]=useState('叫号语音未启用');
  const speaking=useRef(false);
  const stateRef=useRef(state);stateRef.current=state;
  const since=useRef(Date.now());
  const owner=useRef(crypto.randomUUID());
  useEffect(()=>{
    if(!enabled)return;
    let active=true;
    async function next() {
      if(speaking.current||!active)return;
      if(!supabase){setStatus('叫号语音需要云端赛事');return;}
      if(!('speechSynthesis' in window)){setStatus('设备不支持语音，请按棋盘总览人工叫号');return;}
      if(!stateRef.current.schedule?.calls.some(c=>!localStorage.getItem('qi-table-call:'+c.id)&&stateRef.current.schedule?.assignments.some(a=>a.id===c.assignment&&a.status==='called')))return;
      speaking.current=true;
      const {data:claim,error}=await supabase.functions.invoke('tournament',{body:{action:'voice-claim',eventId,owner:owner.current}});
      if(error||claim?.error){setStatus(claim?.error||'请在主屏登录管理员后启用叫号');speaking.current=false;return;}
      if(!claim?.owned){setStatus('其他设备正在负责叫号，本屏仅展示');speaking.current=false;return;}
      for(const id of claim.delivered)localStorage.setItem('qi-table-call:'+id,'done');
      const s=stateRef.current.schedule;
      const event=s?.calls.find(c=>c.createdAt>=since.current&&!claim.delivered.includes(c.id)&&!localStorage.getItem('qi-table-call:'+c.id)&&s.assignments.some(a=>a.id===c.assignment&&a.status==='called'));
      speaking.current=false;
      if(!event)return;
      const callId=event.id;
      if(!navigator.locks){setStatus('浏览器缺少播报锁，请使用 Edge 或 Chrome');return;}
      speaking.current=true;
      await navigator.locks.request('qi-arena-voice-owner',{ifAvailable:true},async lock=>{
        if(!lock||!active)return;
        // Recheck after gaining the shared voice lock.
        if(localStorage.getItem('qi-table-call:'+event.id))return;
        if(!stateRef.current.schedule?.assignments.some(a=>a.id===event.assignment&&a.status==='called'))return;
        setStatus(event.text);
        await new Promise<void>(resolve=>{
          const speech=new SpeechSynthesisUtterance(event.text);
          speech.lang='zh-CN';
          const voice=speechSynthesis.getVoices().find(v=>/^zh/.test(v.lang)&&!/kangkang|yunxi|yunjian/i.test(v.name));
          if(voice)speech.voice=voice;
          let finished=false;
          const timer=setTimeout(()=>{speechSynthesis.cancel();done(false);},90000);
          function done(ok:boolean){if(finished)return;finished=true;clearTimeout(timer);if(ok)localStorage.setItem('qi-table-call:'+callId,'done');else setStatus('叫号播放失败，请核对设备后重试');resolve();}
          speech.onend=()=>done(true);speech.onerror=()=>done(false);
          speechSynthesis.speak(speech);
        });
      });
      if(localStorage.getItem('qi-table-call:'+callId)) await supabase.functions.invoke('tournament',{body:{action:'voice-claim',eventId,owner:owner.current,ack:callId}});
      speaking.current=false;
    }
    void next();
    const timer=setInterval(()=>void next(),1500);
    return()=>{active=false;clearInterval(timer);speechSynthesis.cancel();speaking.current=false;};
  },[enabled]);
  return <div className="arena-call-banner"><span>{status}</span><button onClick={()=>{
    if(!enabled){since.current=0;setStatus('叫号语音已启用 · 将播报当前有效叫号');}
    setEnabled(!enabled);
  }}>{enabled?'关闭叫号语音':'启用叫号语音（主屏）'}</button></div>;
}
