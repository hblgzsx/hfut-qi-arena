import { useEffect, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { announcementText } from './announcement-text';
import type { SpokenResult } from './announcement-text';
type Preferences={enabled:boolean;voice:string;style:'standard'|'energetic'|'calm'};
const KEY='qi-arena-speech-v1';
const styles={standard:{label:'标准赛事解说',rate:1,pitch:1},energetic:{label:'热烈竞技',rate:1.08,pitch:1.08},calm:{label:'沉稳播音',rate:.9,pitch:.95}};
function readPreferences():Preferences{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return {enabled:v.enabled===true,voice:typeof v.voice==='string'?v.voice:'',style:v.style in styles?v.style:'standard'};}catch{return {enabled:false,voice:'',style:'standard'};}}
function speak(text:string,p:Preferences,onDone:()=>void){
  const u=new SpeechSynthesisUtterance(text),voices=speechSynthesis.getVoices();
  u.voice=voices.find(v=>v.voiceURI===p.voice)||voices.find(v=>/^zh/i.test(v.lang))||null;u.lang=u.voice?.lang||'zh-CN';u.rate=styles[p.style].rate;u.pitch=styles[p.style].pitch;u.onend=onDone;u.onerror=onDone;speechSynthesis.cancel();speechSynthesis.speak(u);return u;
}
export function useAnnouncementSpeech(event:SpokenResult&{key:string}){
  const [speaking,setSpeaking]=useState(false);
  useEffect(()=>{const p=readPreferences();if(!p.enabled||!('speechSynthesis' in window))return;
    setSpeaking(true);const done=()=>setSpeaking(false);let timer:ReturnType<typeof setTimeout>;
    try{speak(announcementText(event),p,done);timer=setTimeout(()=>{speechSynthesis.cancel();done();},45000);}catch{done();}
    return()=>{clearTimeout(timer);speechSynthesis.cancel();};
  },[event.key]);
  return speaking;
}
export function SpeechControls(){
  const [p,setP]=useState(readPreferences),[open,setOpen]=useState(false),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[status,setStatus]=useState('');
  const supported='speechSynthesis' in window;
  useEffect(()=>{if(!supported)return;const update=()=>setVoices(speechSynthesis.getVoices().sort((a,b)=>Number(/^zh/i.test(b.lang))-Number(/^zh/i.test(a.lang))||a.name.localeCompare(b.name)));update();speechSynthesis.addEventListener('voiceschanged',update);return()=>speechSynthesis.removeEventListener('voiceschanged',update);},[supported]);
  function save(next:Preferences){setP(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{setStatus('浏览器无法保存偏好，请允许本地存储。');}if(!next.enabled&&supported)speechSynthesis.cancel();}
  function preview(){if(!supported)return;save({...p,enabled:true});setStatus('正在试听');try{speak('五子棋，四分之一决赛。张三战胜李四，局分二比一。恭喜张三晋级半决赛！',p,()=>setStatus('试听结束'));}catch{setStatus('设备无法播放，请检查中文语音包。');}}
  return <><button onClick={()=>setOpen(true)} title="设置完整赛程播报与设备音色">{p.enabled?<Volume2 size={15}/>:<VolumeX size={15}/>}<span>播报设置</span></button>{open&&<div className="speech-settings-backdrop" onClick={()=>setOpen(false)}><section className="speech-settings" role="dialog" aria-label="语音播报设置" onClick={e=>e.stopPropagation()}><button className="speech-close" aria-label="关闭播报设置" onClick={()=>setOpen(false)}><X size={18}/></button><h3>现场语音播报</h3><p>项目、轮次、对阵、局分、晋级去向完整播报。语音结束后再切换下一条。</p><label><input type="checkbox" checked={p.enabled} disabled={!supported} onChange={e=>save({...p,enabled:e.target.checked})}/> 启用赛果语音</label><label>播报音色<select aria-label="播报音色" value={p.voice} onChange={e=>save({...p,voice:e.target.value})}><option value="">系统默认中文音色</option>{voices.map((v,i)=><option key={v.voiceURI+i} value={v.voiceURI}>{v.name} · {v.lang}{v.localService?' · 本机':' · 联网'}</option>)}</select></label><label>播报风格<select aria-label="播报风格" value={p.style} onChange={e=>save({...p,style:e.target.value as Preferences['style']})}>{Object.entries(styles).map(([key,s])=><option key={key} value={key}>{s.label}</option>)}</select></label><p className="speech-help">{supported?'音色由当前设备和浏览器提供；可安装系统中文语音包增加选择。联网音色需要网络。':'此浏览器不支持语音，赛果动画仍正常显示。'}</p><button disabled={!supported} onClick={preview}>试听并启用</button><small role="status">{status}</small></section></div>}</>;
}
