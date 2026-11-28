import {finishResultVoice} from './broadcast-order';
import {eventId} from './cloud';
import {useEffect,useState} from 'react';
import {Volume2,VolumeX,X} from 'lucide-react';
import {announcementText} from './announcement-text';
import type {SpokenResult} from './announcement-text';
import {chooseVoice,isNaturalVoice,voiceGender,voiceLabel} from './voice-policy';
import type {VoiceGender} from './voice-policy';
import {playSpeechChunks} from './speech-playback';
import {claimBroadcast,OtherBroadcastDevice,withBroadcastHeartbeat} from './broadcast-lease';
import {resultDeliveryId,resultWasDelivered,markResultDelivered} from './result-delivery';
type Preferences={enabled:boolean;voice:string;style:'standard'|'energetic'|'calm';duration:number;gender:VoiceGender};
const KEY='qi-arena-speech-v1';
const styles={standard:{label:'标准赛事解说',rate:1,pitch:1},energetic:{label:'热烈竞技',rate:1.04,pitch:1},calm:{label:'沉稳播音',rate:.94,pitch:1}};
function readPreferences():Preferences{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return {enabled:v.enabled===true,voice:typeof v.voice==='string'&&!/kangkang|yunxi|yunjian/i.test(v.voice)?v.voice:'',gender:'female',style:v.style in styles?v.style:'standard',duration:[8,12,16,20,30].includes(v.duration)?v.duration:12};}catch{return {enabled:false,voice:'',style:'standard',duration:12,gender:'female'};}}
export function setResultSpeechEnabled(enabled:boolean){try{localStorage.setItem(KEY,JSON.stringify({...readPreferences(),enabled}));window.dispatchEvent(new Event('qi-speech-preferences'));}catch{}}
export async function playManualSpeech(text:string,signal:AbortSignal){const p=readPreferences(),voice=chooseVoice(speechSynthesis.getVoices(),p.gender,p.voice);if(!voice)throw new Error('设备暂无可用中文女声音色，请稍后重试或选择本机中文音色');await playSpeechChunks(text,{voice,rate:styles[p.style].rate,pitch:styles[p.style].pitch},signal);}
export function broadcastSeconds(event:SpokenResult){const p=readPreferences();return p.enabled?Math.max(p.duration,Math.ceil(announcementText(event).length/(4*styles[p.style].rate))+3):p.duration;}
export function useAnnouncementSpeech(event:SpokenResult&{key:string;drawnAt?:string},enabled=true){
 const [busy,setBusy]=useState(enabled),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!enabled){setBusy(false);setError('');return;}
  const controller=new AbortController();let active=true;setBusy(true);setError('');
  const delay=()=>new Promise<void>(resolve=>{const done=()=>{clearTimeout(t);controller.signal.removeEventListener('abort',done);resolve();};const t=setTimeout(done,2000);controller.signal.addEventListener('abort',done,{once:true});});
  const id=resultDeliveryId(event);
  const finish=(spoken=false)=>{if(!active)return;finishResultVoice(eventId,event.key,spoken);setBusy(false);setError('');};
  async function run(){
   if(!navigator.locks){setError('浏览器缺少播报锁，请使用 Edge 或 Chrome');return;}
   while(active){
    try{
     let done=false;
     await navigator.locks.request('qi-arena-voice-owner',{ifAvailable:true},async lock=>{
      if(!lock||!active)return;
      if(resultWasDelivered(eventId,id)){finish();done=true;return;}
      const claim=await claimBroadcast('',false,controller.signal);if(!active)return;
      if(claim.delivered.includes(id)){markResultDelivered(eventId,id);finish();done=true;return;}
      if(!claim.owned)throw new OtherBroadcastDevice();
      setError('');
      await withBroadcastHeartbeat(controller.signal,signal=>playManualSpeech(announcementText(event),signal));
      if(!active)return;
      markResultDelivered(eventId,id);done=true;
      try{await claimBroadcast(id,false,controller.signal);}catch{/* Persisted outbox retries without replaying completed audio. */}
      finally{finish(true);}
     });
     if(done)return;
    }catch(e){if(active)setError((e as Error).message+'；待播任务已保留，将自动重试');}
    if(active)await delay();
   }
  }
  void run();
  return()=>{active=false;controller.abort();};
 },[event.key,enabled,attempt]);
 return {busy,error,retry:()=>setAttempt(n=>n+1)};
}
export function SpeechControls({queueSince=Date.now(),managed=false}:{queueSince?:number;managed?:boolean}){
  const [p,setP]=useState(readPreferences),[open,setOpen]=useState(false),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[status,setStatus]=useState('');
  const supported='speechSynthesis' in window;
  useEffect(()=>{const update=()=>setP(readPreferences());window.addEventListener('storage',update);window.addEventListener('qi-speech-preferences',update);return()=>{window.removeEventListener('storage',update);window.removeEventListener('qi-speech-preferences',update);};},[]);

  useEffect(()=>{if(!supported)return;const update=()=>setVoices(speechSynthesis.getVoices().sort((a,b)=>Number(/^zh/i.test(b.lang))-Number(/^zh/i.test(a.lang))||a.name.localeCompare(b.name)));update();speechSynthesis.addEventListener('voiceschanged',update);return()=>speechSynthesis.removeEventListener('voiceschanged',update);},[supported]);
  function save(next:Preferences){setP(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{setStatus('浏览器无法保存偏好，请允许本地存储。');}}
  async function preview(){if(!supported||status==='正在试听')return;if(!managed)save({...p,enabled:true});setStatus('正在试听');if(!navigator.locks){setStatus('请使用支持播报锁的 Edge 或 Chrome');return;}await navigator.locks.request('qi-arena-voice-owner',{ifAvailable:true},async lock=>{if(!lock){setStatus('正在播报赛事，请稍后试听');return;}try{await playManualSpeech('五子棋，四分之一决赛。张三战胜李四，局分二比一。恭喜张三晋级半决赛！',new AbortController().signal);setStatus('试听结束');}catch(e){setStatus((e as Error).message);}});}
  const selectedVoice=chooseVoice(voices,'female',p.voice),hasNatural=selectedVoice&&isNaturalVoice(selectedVoice);
  return <><button onClick={()=>setOpen(true)} title="设置完整赛程播报与设备音色">{p.enabled?<Volume2 size={15}/>:<VolumeX size={15}/>}<span>播报设置</span></button>{open&&<div className="speech-settings-backdrop" onClick={()=>setOpen(false)}><section className="speech-settings" role="dialog" aria-label="语音播报设置" onClick={e=>e.stopPropagation()}><button className="speech-close" aria-label="关闭播报设置" onClick={()=>setOpen(false)}><X size={18}/></button><h3>现场语音播报</h3><p className="queue-start">队列范围：仅本次登录后<br/>起点：{new Date(queueSince).toLocaleString('zh-CN',{hour12:false})}<br/>不回放历史完赛；正式与演示赛事均适用。</p><p>每条赛果只朗读一次，与展示秒数无关。项目、轮次、胜负和晋级去向一次播完。</p>{managed?<p>自动语音开关由控制台的“成绩播放队列”统一管理。</p>:<label><input type="checkbox" checked={p.enabled} disabled={!supported} onChange={e=>save({...p,enabled:e.target.checked})}/> 启用赛果语音</label>}<label>具体音色<select aria-label="播报音色" value={p.voice} onChange={e=>save({...p,voice:e.target.value})}><option value="">优先使用可用自然音色</option>{voices.filter(v=>/^zh/i.test(v.lang)&&voiceGender(v)!=='male').map((v,i)=><option key={v.voiceURI+i} value={v.voiceURI}>{voiceLabel(v)}{v.localService?' · 本机':' · 联网'}</option>)}</select></label><label>播报风格<select aria-label="播报风格" value={p.style} onChange={e=>save({...p,style:e.target.value as Preferences['style']})}>{Object.entries(styles).map(([key,s])=><option key={key} value={key}>{s.label}</option>)}</select></label><label>最短展示时长<select aria-label="最短展示时长" value={p.duration} onChange={e=>save({...p,duration:Number(e.target.value)})}>{[8,12,16,20,30].map(n=><option key={n} value={n}>{n} 秒</option>)}</select></label><p>展示时间只控制画面停留，不会循环语音。语音较长时在同一个画面内播完。</p><p className="voice-quality">{hasNatural?'已选自然音色，优先保持自然音调。':'当前使用设备提供的中文音色，可选择并试听。'}</p><p className="speech-help">{supported?'当前音色由设备和浏览器提供；安装中文语音包可增加选择。若列表没有自然音色，稳定接近真人的效果需要接入云端神经语音服务。':'此浏览器不支持语音，赛果动画仍正常显示。'}</p><button disabled={!supported||status==='正在试听'} onClick={preview}>{managed?'试听音色':'试听并启用'}</button><small role="status">{status}</small></section></div>}</>;
}
