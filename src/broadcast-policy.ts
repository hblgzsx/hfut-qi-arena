export function defaultQueueEnabled(role:string|undefined,cloud:boolean,projection:boolean){
 return !cloud||role==='superadmin'||(!role&&projection);
}
export function resultAfterLogin(updatedAt:string|undefined,loginTime:number){
 const time=Date.parse(updatedAt||'');return Number.isFinite(time)&&time>=loginTime;
}
