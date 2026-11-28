export const RESULT_TO_CALL_MS=15000;
export interface BroadcastOrder {pending:string[];notBefore:number;lastFinishedAt?:number;leases?:Record<string,number>}
export const emptyBroadcastOrder=():BroadcastOrder=>({pending:[],notBefore:0});
export function reserveBroadcast(order:BroadcastOrder,key:string):BroadcastOrder{return order.pending.includes(key)?order:{...order,pending:[...order.pending,key]};}
export function finishBroadcast(order:BroadcastOrder,key:string,now:number,gap=RESULT_TO_CALL_MS):BroadcastOrder{return order.pending.includes(key)?{...order,pending:order.pending.filter(id=>id!==key),lastFinishedAt:Math.max(order.lastFinishedAt??0,now),notBefore:Math.max(order.notBefore,now+gap)}:order;}
export function calloutWait(order:BroadcastOrder,now:number){return order.pending.length?Infinity:Math.max(0,order.notBefore-now);}
const storageKey=(scope:string)=>'qi-broadcast-order-v1:'+scope;
export function validateCallGap(seconds:number){if(!Number.isInteger(seconds)||seconds<0||seconds>300)throw new Error('叫号间隔必须是 0—300 秒的整数');return seconds;}
export function callGapSeconds(scope:string){try{const saved=localStorage.getItem('qi-call-gap-v1:'+scope);return saved===null?15:validateCallGap(Number(saved));}catch{return 15;}}
function read(scope:string):BroadcastOrder{try{const d=JSON.parse(localStorage.getItem(storageKey(scope))||'null');if(d&&Array.isArray(d.pending)&&d.pending.every((k:unknown)=>typeof k==='string')&&Number.isFinite(d.notBefore))return {...d,pending:d.pending.filter((k:string)=>Number(d.leases?.[k])>Date.now())};}catch{}return emptyBroadcastOrder();}
function write(scope:string,order:BroadcastOrder){try{localStorage.setItem(storageKey(scope),JSON.stringify(order));}catch{}}
export function setCallGapSeconds(scope:string,seconds:number){validateCallGap(seconds);try{localStorage.setItem('qi-call-gap-v1:'+scope,String(seconds));const order=read(scope),last=order.lastFinishedAt??(order.notBefore?order.notBefore-RESULT_TO_CALL_MS:0);write(scope,{...order,notBefore:last?last+seconds*1000:0});window.dispatchEvent(new Event('qi-broadcast-settings'));}catch{throw new Error('无法保存叫号间隔，请允许浏览器本地存储');}}
export function reserveResult(scope:string,key:string){let order=read(scope);order=reserveBroadcast(reserveBroadcast(order,'visual:'+key),'voice:'+key);order.leases={...order.leases,['visual:'+key]:Date.now()+120000,['voice:'+key]:Date.now()+120000};write(scope,order);}
export function refreshResult(scope:string,key:string){const order=read(scope),leases={...order.leases};for(const k of order.pending)if(k==='visual:'+key||k==='voice:'+key)leases[k]=Date.now()+120000;write(scope,{...order,leases});}
export function finishResultVoice(scope:string,key:string,actuallySpoken=false){const now=Date.now(),gap=callGapSeconds(scope)*1000,order=finishBroadcast(read(scope),'voice:'+key,now,gap);write(scope,actuallySpoken?{...order,lastFinishedAt:now,notBefore:Math.max(order.notBefore,now+gap)}:order);}
export function finishResultVisual(scope:string,key:string){write(scope,finishBroadcast(read(scope),'visual:'+key,Date.now(),callGapSeconds(scope)*1000));}
export function discardResult(scope:string,key:string){finishResultVoice(scope,key);finishResultVisual(scope,key);}
export function tableCallWait(scope:string){return calloutWait(read(scope),Date.now());}
export function resultIsPending(scope:string,key:string){return read(scope).pending.some(k=>k==='visual:'+key||k==='voice:'+key);}
export function resultVoiceEnabled(){try{return JSON.parse(localStorage.getItem('qi-arena-speech-v1')||'{}').enabled===true;}catch{return false;}}
