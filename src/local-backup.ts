import {validateState} from './engine';
import type {State} from './engine';
export interface LocalBackup { id:string; eventId:string; createdAt:string; revision:string; state:State; source:'cloud'|'local' }
function database():Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('qi-arena-auto-backups',1);
  req.onupgradeneeded=()=>{const store=req.result.createObjectStore('snapshots',{keyPath:'id'});store.createIndex('eventId','eventId');};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
export async function localBackups(eventId:string):Promise<LocalBackup[]> {
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const req=db.transaction('snapshots','readonly').objectStore('snapshots').index('eventId').getAll(eventId);
  req.onsuccess=()=>resolve((req.result as LocalBackup[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
  req.onerror=()=>reject(req.error);
 });}finally{db.close();}
}
export async function saveLocalBackup(eventId:string,state:State,source:'cloud'|'local',intervalMs=0):Promise<LocalBackup> {
 const safe=validateState(structuredClone(state));
 const record:LocalBackup={id:crypto.randomUUID(),eventId,createdAt:new Date().toISOString(),revision:safe.revision,state:safe,source};
 const db=await database();
 let saved=record;
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');
  const list=store.index('eventId').getAll(eventId);
  list.onsuccess=()=>{
   const previous=(list.result as LocalBackup[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
   if(previous[0]&&Date.now()-Date.parse(previous[0].createdAt)<intervalMs){saved=previous[0];return;}
   previous.slice(23).forEach(item=>store.delete(item.id));
   store.put(record);
  };
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
 return saved;
}
