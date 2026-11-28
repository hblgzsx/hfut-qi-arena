import type {EventSettings} from './event-settings.ts';
import type {Schedule} from './scheduling.ts';
import {emptySchedule,validateTableBindings} from './scheduling.ts';
import {validateRules} from './tournament-rules.ts';
import type {TournamentRules} from './tournament-rules.ts';
import type {RefereeOption} from './TableBindingFields';
export interface EventCreationDraft {draft:EventSettings;custom:string;rules:Record<'gomoku'|'junqi',TournamentRules>;schedule:Schedule;step:number;ruleSport:'gomoku'|'junqi';created:RefereeOption[];password:string;confirmation:string}
const memory=new Map<string,EventCreationDraft>();
const key=(owner:string)=>'qi-event-creation-draft-v1:'+owner;
export function saveCreationDraft(owner:string,value:EventCreationDraft,storage?:Storage){
 memory.set(owner,structuredClone(value));
 const {password:_password,confirmation:_confirmation,...publicDraft}=value;
 try{storage?.setItem(key(owner),JSON.stringify(publicDraft));return true;}catch{return false;}
}
export function loadCreationDraft(owner:string,storage?:Storage):EventCreationDraft|null{
 if(memory.has(owner))return structuredClone(memory.get(owner)!);
 try{
  const raw=storage?.getItem(key(owner));if(!raw)return null;const value=JSON.parse(raw);
  if(!value.draft||['name','venue','startsAt','endsAt'].some(k=>typeof value.draft[k]!=='string')||!Array.isArray(value.draft.colleges)||value.draft.colleges.some((c:unknown)=>typeof c!=='string')||!Number.isInteger(value.step)||value.step<0||value.step>3||!['gomoku','junqi'].includes(value.ruleSport)||typeof value.custom!=='string'||!Array.isArray(value.created))return null;
  validateRules(value.rules.gomoku);validateRules(value.rules.junqi);
  const schedule={...emptySchedule(),counts:value.schedule.counts,bindings:value.schedule.bindings};validateTableBindings(schedule,false);
  const created=value.created.filter((p:RefereeOption)=>typeof p?.id==='string'&&typeof p.display_name==='string'&&p.role==='referee').map((p:RefereeOption)=>({id:p.id,display_name:p.display_name,role:p.role,email:p.email}));
  return {...value,schedule,created,password:'',confirmation:''};
 }catch{return null;}
}
export function clearCreationDraft(owner:string,storage?:Storage){memory.delete(owner);try{storage?.removeItem(key(owner));}catch{}}
