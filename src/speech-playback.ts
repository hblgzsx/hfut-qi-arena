import {splitSpeechText} from './split-speech';
let owned:SpeechSynthesisUtterance|null=null;
export async function playSpeechChunks(text:string,options:{voice:SpeechSynthesisVoice|null;rate:number;pitch:number},signal:AbortSignal){
 if(!('speechSynthesis' in window))throw new Error('设备不支持语音播报');
 for(const part of splitSpeechText(text)){
  if(signal.aborted)throw new Error('已停止本次播报');
  await new Promise<void>((resolve,reject)=>{
   const speech=new SpeechSynthesisUtterance(part);speech.voice=options.voice;speech.lang=options.voice?.lang||'zh-CN';speech.rate=options.rate;speech.pitch=options.pitch;
   let settled=false;owned=speech;
   function finish(error?:Error){if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);speech.onend=null;speech.onerror=null;if(owned===speech){owned=null;if(error)speechSynthesis.cancel();}error?reject(error):resolve();}
   const abort=()=>finish(new Error('已停止本次播报'));
   const timer=setTimeout(()=>finish(new Error('语音未正常结束，本条仍待播报，请检查音色后重试')),45000);
   speech.onend=()=>finish();speech.onerror=e=>finish(new Error(e.error==='not-allowed'?'浏览器未允许语音，请点击重试启用':'语音播放失败，本条仍待播报'));
   signal.addEventListener('abort',abort,{once:true});
   if(signal.aborted){abort();return;}
   try{if(speechSynthesis.paused)speechSynthesis.resume();speechSynthesis.speak(speech);}catch(e){finish(e as Error);}
  });
 }
}
