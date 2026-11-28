import {tableCallWait,resultVoiceEnabled} from './broadcast-order';
import { useEffect, useRef, useState } from 'react';
import type { State } from './engine';
import { occupied } from './scheduling';
import {supabase,eventId} from './cloud';
import {voiceOwner} from './voice-owner';

export function TableAnnouncer({state,resultsEnabled,enabled,onConsole}:{state:State;resultsEnabled:boolean;enabled:boolean;onConsole?:()=>void}) {
  const [status,setStatus]=useState('叫号语音未启用');
  const speaking=useRef(false),ownSpeech=useRef<SpeechSynthesisUtterance|null>(null),resultQueue=useRef(resultsEnabled);resultQueue.current=resultsEnabled;
  const stateRef=useRef(state);stateRef.current=state;
  const since=useRef(Date.now());
  const owner=useRef(voiceOwner);
  useEffect(()=>{
    if(!enabled){setStatus('自动叫号队列已关闭');return;}since.current=0;setStatus('自动叫号队列已开启 · 检查当前有效叫号');
    let active=true;
    function ordered(){
      if(!resultQueue.current||!resultVoiceEnabled()){setStatus('叫号等待：请先开启播报队列和赛果语音，保证先播胜利');return false;}
      const wait=tableCallWait(eventId);if(wait===Infinity){setStatus('叫号等待：先完成胜利播报');return false;}if(wait>0){setStatus('胜利播报已结束，'+Math.ceil(wait/1000)+' 秒后叫号');return false;}return true;
    }
    async function next() {
      if(speaking.current||!active)return;
      if(!ordered())return;
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
      if(!event||!active||!ordered())return;
      const callId=event.id;
      if(!navigator.locks){setStatus('浏览器缺少播报锁，请使用 Edge 或 Chrome');return;}
      speaking.current=true;
      await navigator.locks.request('qi-arena-voice-owner',{ifAvailable:true},async lock=>{
        if(!lock||!active||!ordered())return;
        // Recheck after gaining the shared voice lock.
        if(localStorage.getItem('qi-table-call:'+event.id))return;
        if(!stateRef.current.schedule?.assignments.some(a=>a.id===event.assignment&&a.status==='called'))return;
        setStatus(event.text);
        await new Promise<void>(resolve=>{
          const speech=new SpeechSynthesisUtterance(event.text);ownSpeech.current=speech;
          speech.lang='zh-CN';
          const voice=speechSynthesis.getVoices().find(v=>/^zh/.test(v.lang)&&!/kangkang|yunxi|yunjian/i.test(v.name));
          if(voice)speech.voice=voice;
          let finished=false;
          const timer=setTimeout(()=>{speechSynthesis.cancel();done(false);},90000);
          function done(ok:boolean){if(finished)return;finished=true;ownSpeech.current=null;clearTimeout(timer);if(ok)localStorage.setItem('qi-table-call:'+callId,'done');else setStatus('叫号播放失败，请核对设备后重试');resolve();}
          speech.onend=()=>done(true);speech.onerror=()=>done(false);
          speechSynthesis.speak(speech);
        });
      });
      if(localStorage.getItem('qi-table-call:'+callId)) await supabase.functions.invoke('tournament',{body:{action:'voice-claim',eventId,owner:owner.current,ack:callId}});
      speaking.current=false;
    }
    void next();
    const timer=setInterval(()=>void next(),1500);
    return()=>{active=false;clearInterval(timer);if(ownSpeech.current){speechSynthesis.cancel();ownSpeech.current=null;}speaking.current=false;};
  },[enabled]);
  return <div className="arena-call-banner"><span>{status}</span>{onConsole&&<button onClick={onConsole}>队列设置与重播</button>}</div>;
}
