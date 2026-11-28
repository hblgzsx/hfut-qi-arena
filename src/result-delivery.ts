import {speechIdentity} from './announcement-text.ts';
import type {SpokenResult} from './announcement-text.ts';
type Event=SpokenResult&{drawnAt?:string};
export const resultDeliveryId=(event:Event)=>'result:'+speechIdentity(event);
export const resultDoneKey=(scope:string,id:string)=>'qi-result-done-v5:'+scope+':'+id;
export function resultWasDelivered(scope:string,id:string){try{return !!localStorage.getItem(resultDoneKey(scope,id));}catch{return false;}}
export function markResultDelivered(scope:string,id:string){try{localStorage.setItem(resultDoneKey(scope,id),String(Date.now()));}catch{}}
const jobsKey=(scope:string)=>'qi-result-jobs-v1:'+scope;
export function pendingResultJobs(scope:string):string[]{try{const keys=JSON.parse(localStorage.getItem(jobsKey(scope))||'[]');return Array.isArray(keys)?keys.filter(k=>typeof k==='string'):[];}catch{return [];}}
export function rememberResultJob(scope:string,key:string){try{localStorage.setItem(jobsKey(scope),JSON.stringify([...new Set([...pendingResultJobs(scope),key])]));}catch{}}
export function forgetResultJob(scope:string,key:string){try{localStorage.setItem(jobsKey(scope),JSON.stringify(pendingResultJobs(scope).filter(k=>k!==key)));}catch{}}
