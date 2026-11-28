export interface BackupSettings { enabled:boolean; intervalMinutes:number }
export interface EventSettings { name:string; colleges:string[]; startsAt:string; endsAt:string; venue:string; autoBackup?:BackupSettings;restMinutes?:number }
export function restMinutes(event?:EventSettings){return event?.restMinutes??3;}
export function validateRestMinutes(value:unknown):number{if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>120)throw new Error('选手休息时间须为 0 至 120 分钟的整数。');return value;}
export function backupSettings(event?:EventSettings):BackupSettings {
 return event?.autoBackup??{enabled:false,intervalMinutes:10};
}
export const COLLEGES=['经济学院','计算机与信息学院','建筑与艺术学院','外国语学院','微电子学院'];
export const eventNameKey=(name:string)=>name.replace(/[\s\u3000]+/g,'').toLowerCase();
export function assertUniqueEventName(name:string,events:{id:string;name:string}[],exceptId?:string){if(events.some(e=>e.id!==exceptId&&eventNameKey(e.name)===eventNameKey(name)))throw new Error('已存在同名竞赛，请使用其他比赛名称。');}
export function defaultEvent():EventSettings{return {name:'五院研究生棋类友谊赛',colleges:[...COLLEGES],startsAt:'2026-11-29T14:00',endsAt:'2026-11-29T18:00',venue:'科教楼 B 座 501 报告厅'};}
export function eventIsActive(event:Pick<EventSettings,'startsAt'|'endsAt'>=defaultEvent(),now=Date.now()){return now>=Date.parse(event.startsAt+'+08:00')&&now<Date.parse(event.endsAt+'+08:00');}
export function validateEvent(value:unknown):EventSettings{
 const v=value as EventSettings;
 if(!v||typeof v.name!=='string'||!v.name.trim()||v.name.length>60||typeof v.venue!=='string'||!v.venue.trim()||v.venue.length>120)throw new Error('比赛名称需为 1—60 字，地点需为 1—120 字。');
 if(!Array.isArray(v.colleges)||!v.colleges.length||v.colleges.length>30||v.colleges.some(c=>typeof c!=='string'||!c.trim()||c.length>60)||new Set(v.colleges.map(c=>c.trim())).size!==v.colleges.length)throw new Error('请选择至少一个举办学院，学院名称不可重复。');
 const valid=(s:unknown)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'+08:00'));
 if(!valid(v.startsAt)||!valid(v.endsAt)||v.endsAt<=v.startsAt)throw new Error('请填写有效的比赛时间，结束时间须晚于开始时间。');
 if(v.autoBackup!==undefined&&(!v.autoBackup||typeof v.autoBackup.enabled!=='boolean'||!Number.isInteger(v.autoBackup.intervalMinutes)||v.autoBackup.intervalMinutes<1||v.autoBackup.intervalMinutes>120))throw new Error('自动备份间隔须为 1 至 120 分钟。');
 if(v.restMinutes!==undefined)validateRestMinutes(v.restMinutes);
 return {...v,name:v.name.trim(),venue:v.venue.trim(),colleges:v.colleges.map(c=>c.trim())};
}
export function eventDate(e:EventSettings){return new Date(e.startsAt+'+08:00').toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'long'});}
export function eventTime(e:EventSettings){const end=e.endsAt.slice(0,10)===e.startsAt.slice(0,10)?e.endsAt.slice(11):e.endsAt.replace('T',' ');return e.startsAt.replace('T',' ')+' — '+end;}
