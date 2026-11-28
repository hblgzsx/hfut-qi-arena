export const RESULT_TO_CALL_MS=15000;
export interface BroadcastOrder {pending:string[];notBefore:number}
export const emptyBroadcastOrder=():BroadcastOrder=>({pending:[],notBefore:0});
export function reserveBroadcast(order:BroadcastOrder,key:string):BroadcastOrder{return order.pending.includes(key)?order:{...order,pending:[...order.pending,key]};}
export function finishBroadcast(order:BroadcastOrder,key:string,now:number):BroadcastOrder{return order.pending.includes(key)?{pending:order.pending.filter(id=>id!==key),notBefore:Math.max(order.notBefore,now+RESULT_TO_CALL_MS)}:order;}
export function calloutWait(order:BroadcastOrder,now:number){return order.pending.length?Infinity:Math.max(0,order.notBefore-now);}
const storageKey=(scope:string)=>'qi-broadcast-order-v1:'+scope;
function read(scope:string):BroadcastOrder{try{const d=JSON.parse(localStorage.getItem(storageKey(scope))||'null');if(d&&Array.isArray(d.pending)&&d.pending.every((k:unknown)=>typeof k==='string')&&Number.isFinite(d.notBefore))return d;}catch{}return emptyBroadcastOrder();}
function write(scope:string,order:BroadcastOrder){try{localStorage.setItem(storageKey(scope),JSON.stringify(order));}catch{} }
export function reserveResult(scope:string,key:string){let order=read(scope);order=reserveBroadcast(order,'visual:'+key);order=reserveBroadcast(order,'voice:'+key);write(scope,order);}
export function finishResultVoice(scope:string,key:string,actuallySpoken=false){const order=finishBroadcast(read(scope),'voice:'+key,Date.now());write(scope,actuallySpoken?{...order,notBefore:Math.max(order.notBefore,Date.now()+RESULT_TO_CALL_MS)}:order);}
export function finishResultVisual(scope:string,key:string){write(scope,finishBroadcast(read(scope),'visual:'+key,Date.now()));}
export function discardResult(scope:string,key:string){finishResultVoice(scope,key);finishResultVisual(scope,key);}
export function tableCallWait(scope:string){return calloutWait(read(scope),Date.now());}
export function resultIsPending(scope:string,key:string){return read(scope).pending.some(k=>k==='visual:'+key||k==='voice:'+key);}
export function resultVoiceEnabled(){try{return JSON.parse(localStorage.getItem('qi-arena-speech-v1')||'{}').enabled===true;}catch{return false;}}
