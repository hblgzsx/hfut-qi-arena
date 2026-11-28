import {supabase,eventId} from './cloud';
import {voiceOwner} from './voice-owner';
export interface BroadcastLease {owned:boolean;delivered:string[];leaseUntil?:string}
export class OtherBroadcastDevice extends Error{constructor(){super('其他设备正在负责播报，可在播报控制台选择“使用本机播报”');}}
function receipts():string[]{try{return JSON.parse(localStorage.getItem('qi-broadcast-receipts:'+eventId)||'[]');}catch{return [];}}
function saveReceipts(ids:string[]){try{localStorage.setItem('qi-broadcast-receipts:'+eventId,JSON.stringify([...new Set(ids)]));}catch{}}
export async function flushBroadcastReceipts(signal:AbortSignal){if(receipts().length)await claimBroadcast('',false,signal);}
export async function claimBroadcast(ack='',takeover=false,signal?:AbortSignal,statusOnly=false):Promise<BroadcastLease>{
 if(!supabase)return {owned:true,delivered:[]};
 if(ack)saveReceipts([...receipts(),ack]);const receipt=statusOnly?'':ack||receipts()[0]||'';
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const timer=setTimeout(abort,10000);
 try{const {data,error}=await supabase.functions.invoke('tournament',{body:{action:'voice-claim',eventId,owner:voiceOwner,...(receipt?{ack:receipt}:{}),...(takeover?{takeover:true}:{}),...(statusOnly?{statusOnly:true}:{})},signal:controller.signal});if(error||data?.error)throw new Error(data?.error||'播报设备连接失败，本条保留待播，稍后重试');if(data?.owned&&receipt)saveReceipts(receipts().filter(id=>id!==receipt));return {owned:data?.owned===true,delivered:Array.isArray(data?.delivered)?data.delivered:[],leaseUntil:data?.leaseUntil};}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function withBroadcastHeartbeat<T>(signal:AbortSignal,play:(signal:AbortSignal)=>Promise<T>):Promise<T>{
 const child=new AbortController(),abort=()=>child.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();let renewing=false;
 const timer=setInterval(()=>{if(renewing||child.signal.aborted)return;renewing=true;void claimBroadcast('',false,child.signal).then(c=>{if(!c.owned)child.abort();}).catch(()=>child.abort()).finally(()=>{renewing=false;});},2000);
 try{return await play(child.signal);}finally{clearInterval(timer);signal.removeEventListener('abort',abort);child.abort();}
}
