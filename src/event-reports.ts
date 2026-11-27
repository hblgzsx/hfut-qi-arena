import {buildBracket,SPORT_NAMES,standings} from './engine.ts';
import type {State} from './engine.ts';
import type {EventSettings} from './event-settings.ts';
import {defaultEvent,eventTime} from './event-settings.ts';
import {SPORTS,emptySchedule,occupied,tableKey,tableName,validateTableBindings} from './scheduling.ts';
import type {Schedule} from './scheduling.ts';
export type ReportKind='referees'|'schedule'|'results';
export interface ReportSection {title:string;columns:string[];rows:string[][];widths:number[];note?:string}
export interface EventReport {title:string;event:EventSettings;generatedAt:string;revision:string;draft:boolean;summary:string;sections:ReportSection[];notes:string[]}
export interface ReportMember {id:string;display_name:string}
export const REPORT_TITLES:Record<ReportKind,string>={referees:'裁判与棋盘安排',schedule:'现场对阵与候场',results:'比赛成绩归档'};
export function refereeReport(event:EventSettings,s:Schedule,members:ReportMember[],revision='创建草稿',draft=false):EventReport{
 validateTableBindings(s);
 const get=(key:string)=>Object.entries(s.bindings).filter(([,keys])=>keys.length===1&&keys[0]===key).map(([id])=>{const p=members.find(p=>p.id===id);if(!p)throw new Error('有裁判资料未加载或账号已停用，请刷新裁判列表后导出。');return p.display_name;}).join('、');
 return {title:REPORT_TITLES.referees,event,generatedAt:new Date().toISOString(),revision,draft,summary:`五子棋 ${s.counts.gomoku} 桌 / 军棋 ${s.counts.junqi} 桌 / ${Object.values(s.bindings).filter(keys=>keys.length).length} 名裁判`,sections:SPORTS.map(sp=>({title:SPORT_NAMES[sp]+'执裁安排',columns:['棋盘编号','负责裁判','现场确认'],widths:[.24,.51,.25],rows:Array.from({length:s.counts[sp]},(_,i)=>[tableName(sp,i+1),get(tableKey(sp,i+1)),'签到：____________'])})),notes:['请裁判提前到场核对桌号；一人仅负责一桌，同桌裁判协作执裁。','候场与补台以现场叫号为准，选手两场之间至少休息 3 分钟。','本资料不包含账号、邮箱、学号或密码，可用于打印及群通知。']};
}
export function eventReport(state:State,kind:ReportKind,members:ReportMember[]=[]):EventReport{
 const event=state.event??defaultEvent(),s=state.schedule??emptySchedule();
 if(kind==='referees')return refereeReport(event,s,members,state.revision);
 const report:EventReport={title:REPORT_TITLES[kind],event,generatedAt:new Date().toISOString(),revision:state.revision,draft:false,summary:kind==='schedule'?'现场快照 / 固定签位 / 动态补台':'阶段性成绩 / 以本次导出时已确认赛果为准',sections:[],notes:kind==='schedule'?['候场次序不等于固定桌号。空桌补台时才分配棋盘，实际桌号以现场叫号为准。','已确定双方的后续轮次可提前开始，但选手须休息满 3 分钟且无兼项冲突。','“轮空”与“等待晋级”按签位实际状态展示，不视为已完成实赛。']:['仅记录导出时已确认的成绩；未完成的比赛保留待定，不补造名次。','本 PDF 用于查阅、打印与归档。系统数据恢复请使用 JSON 备份。']};
 for(const sp of SPORTS){
  const t=state.tournaments[sp],matches=buildBracket(t).flat(),name=(id:string|null,fallback='待定')=>t.players.find(p=>p.id===id)?.name??fallback;
  if(kind==='schedule'){
   report.sections.push({title:SPORT_NAMES[sp]+' · 当前棋盘',columns:['棋盘','双方选手','现场状态'],widths:[.23,.52,.25],rows:Array.from({length:s.counts[sp]},(_,i)=>{const a=s.assignments.find(a=>a.sport===sp&&a.table===i+1&&occupied(a));return [tableName(sp,i+1),a?a.players.map(id=>name(id)).join(' / '):'等待可上场对局',a?(a.status==='playing'?'进行中':'已叫号'):'空闲'];})});
   const pending=s.queues[sp].map(id=>matches.find(m=>m.id===id)).filter(m=>m&&!m.resolved&&!s.assignments.some(a=>a.sport===sp&&a.match===m.id&&occupied(a)));
   report.sections.push({title:SPORT_NAMES[sp]+' · 候场顺序',columns:['顺序 / 场次','选手 A / 选手 B','条件'],widths:[.24,.53,.23],rows:pending.map((m,i)=>[`${i+1} / ${m!.id}`,name(m!.a.id,m!.a.settled?'轮空':m!.a.source+'胜者')+' / '+name(m!.b.id,m!.b.settled?'轮空':m!.b.source+'胜者'),m!.ready?'双方已确定':'等待晋级'])});
   report.sections.push({title:SPORT_NAMES[sp]+' · 完整对阵',columns:['轮次 / 场次','选手 A / 选手 B','赛制 / 状态'],widths:[.25,.5,.25],rows:matches.map(m=>[m.label+' / '+m.id,name(m.a.id,m.a.settled?'轮空':m.a.source+'胜者')+' / '+name(m.b.id,m.b.settled?'轮空':m.b.source+'胜者'),`BO${m.bestOf} / ${m.bye?'轮空':m.resolved?'已结束':m.ready?'双方已定':'待定'}`])});
  }else{
   const rank=standings(t);report.sections.push({title:SPORT_NAMES[sp]+' · 荣誉记录',columns:['名次','选手'],widths:[.25,.75],rows:[['冠军',name(rank.champion,'尚未产生')],['亚军',name(rank.runnerUp,'尚未产生')],['季军',rank.bronze.map(id=>name(id)).join('、')||'尚未产生 / 未设'] ]});
   report.sections.push({title:SPORT_NAMES[sp]+' · 已确认对局',columns:['轮次 / 场次','双方选手','结果 / 执裁'],widths:[.24,.4,.36],rows:matches.filter(m=>m.result).map(m=>{const r=m.result!;return [m.label+' / '+m.id,name(m.a.id)+' / '+name(m.b.id),(r.kind==='played'?m.score.join(':'):r.kind==='double'?'双方取消资格':r.kind==='adjudicated'?'管理员裁定':'弃权判定')+' / '+(m.winner?name(m.winner)+'胜':'未决')+' / '+r.referee];})});
   if(matches.some(m=>!m.resolved))report.sections.push({title:SPORT_NAMES[sp]+' · 归档说明',columns:['待完成对局','导出性质'],widths:[.3,.7],rows:[[String(matches.filter(m=>!m.resolved).length),'本项目尚未结束，此文件为阶段性成绩快照。']]});
  }
 }
 return report;
}
export function reportNotice(report:EventReport){return [report.event.name+'｜'+report.title,report.draft?'【安排草稿，未发布】':'【现场通知】',eventTime(report.event),report.event.venue,report.summary,...report.sections.flatMap(section=>[section.title,...section.rows.map(row=>row.slice(0,2).join('：'))]),'导出时间：'+new Date(report.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}),'请以最新通知与现场叫号为准。'].join('\n');}
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function reportHtml(report:EventReport){return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${esc(report.title)}</title><style>@page{size:A4;margin:16mm}body{font-family:"Microsoft YaHei",sans-serif;color:#172b32;font-size:11px;line-height:1.7}h1{font-size:24px;margin:0}h2{font-size:16px;margin-top:26px;color:#236458}p{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #bac8c5;padding:8px;text-align:left;overflow-wrap:anywhere}th{background:#e8f0ed}thead{display:table-header-group}tr{break-inside:avoid}h2{break-after:avoid}.meta{color:#536966}.stamp{border-left:3px solid #aa7542;padding-left:12px}.footer{font-size:9px;color:#60716c;margin-top:24px}</style><h1>${esc(report.title)}${report.draft?' · 草稿':''}</h1><h2>${esc(report.event.name)}</h2><p class="meta">${esc(eventTime(report.event))}<br>${esc(report.event.venue)}<br>举办：${esc(report.event.colleges.join(' / '))}</p><p class="stamp">${esc(report.summary)}<br>导出：${esc(new Date(report.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}))} / 版本：${esc(report.revision)}</p>${report.sections.map(s=>`<h2>${esc(s.title)}</h2><table><colgroup>${s.widths.map(w=>`<col style="width:${w*100}%">`).join('')}</colgroup><thead><tr>${s.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${(s.rows.length?s.rows:[s.columns.map((_,i)=>i?'—':'暂无记录')]).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}<p class="footer">${report.notes.map(esc).join('<br>')}</p></html>`;}
