import {PDFDocument} from 'pdf-lib';
import {defaultEvent} from './event-settings';
import {SPORT_NAMES} from './engine';
import type {State,Sport} from './engine';
import {recordHonors,recordReady,recordRows} from './record-data';
import type {RecordRow} from './record-data';
// The source PDF remains vector. Dynamic Chinese text is rendered at 4x into a
// transparent overlay without redistributing system fonts.
export async function createRecordPdf(state:State,sport:Sport){
 const t=state.tournaments[sport];if(!recordReady(t))throw new Error('请等待本项目全部可进行的对局结束后导出 PDF。');
 const response=await fetch(`${import.meta.env.BASE_URL}backgrounds/match-record.pdf`);if(!response.ok)throw new Error('记录表模板加载失败，请刷新后重试。');
 const source=await PDFDocument.load(await response.arrayBuffer()),pdf=await PDFDocument.create(),event=state.event??defaultEvent(),rows=recordRows(t);
 const groups=new Map<string,RecordRow[]>();for(const r of rows)groups.set(r.referee,[...(groups.get(r.referee)??[]),r]);if(!groups.size)groups.set('超级管理员',[]);
 const batches=[...groups].flatMap(([referee,group])=>Array.from({length:Math.max(1,Math.ceil(group.length/14))},(_,i)=>({referee,rows:group.slice(i*14,i*14+14)})));
 const notes=rows.filter(r=>r.note).filter((r,i,a)=>a.findIndex(x=>x.detail.split(' / ')[0]===r.detail.split(' / ')[0])===i),totalPages=batches.length+Math.ceil(notes.length/8);
 for(let pageIndex=0;pageIndex<batches.length;pageIndex++){
  const [page]=await pdf.copyPages(source,[0]);pdf.addPage(page);const {width,height}=page.getSize(),canvas=document.createElement('canvas');canvas.width=Math.ceil(width*4);canvas.height=Math.ceil(height*4);const context=canvas.getContext('2d');if(!context)throw new Error('浏览器无法生成记录表。');const ctx:CanvasRenderingContext2D=context;ctx.scale(4,4);ctx.fillStyle='#111';ctx.textBaseline='middle';
  function text(value:string,x:number,y:number,size:number,maxWidth:number,align:CanvasTextAlign='left'){ctx.font=`${size}px "Noto Sans SC","Microsoft YaHei",sans-serif`;while(ctx.measureText(value).width>maxWidth&&size>6){size-=.25;ctx.font=`${size}px "Noto Sans SC","Microsoft YaHei",sans-serif`;}ctx.textAlign=align;ctx.fillText(value,x,y,maxWidth);}
  function wrap(value:string,x:number,y:number,size:number,maxWidth:number){ctx.font=`${size}px "Noto Sans SC","Microsoft YaHei",sans-serif`;const lines:string[]=[];let line='';for(const c of value){if(line&&ctx.measureText(line+c).width>maxWidth){lines.push(line);line=c;}else line+=c;}if(line)lines.push(line);lines.forEach((v,i)=>text(v,x,y+i*(size+2),size,maxWidth));return lines.length*(size+2);}
  function centeredPlayer(value:string,studentId:string,x:number,top:number){const size=value.length>24?6:value.length>12?8:10;ctx.font=`${size}px "Noto Sans SC","Microsoft YaHei",sans-serif`;const lines:string[]=[];let line='';for(const c of value){if(line&&ctx.measureText(line+c).width>137){lines.push(line);line=c;}else line+=c;}if(line)lines.push(line);const gap=size+2,total=(lines.length-1)*gap+size+10,start=top+18.9-total/2+size/2;lines.forEach((v,i)=>text(v,x,start+i*gap,size,137,'center'));text(studentId,x,start+(lines.length-1)*gap+size/2+7,7.5,137,'center');}
  const batch=batches[pageIndex];text(event.name,53,72,12,488);text(event.startsAt.replace('T',' ')+' / '+event.venue,53,87,8,488);
  ctx.fillStyle='#fff';ctx.fillRect(54,101,486,34);ctx.fillStyle='#111';text(SPORT_NAMES[sport]+'友谊赛 - 比赛记录表',297,118,17,460,'center');
  // Replace only the original referee underline, retaining the original table.
  ctx.fillStyle='#fff';ctx.fillRect(445,144,84,24);ctx.fillStyle='#111';text(batch.referee,487,155,10,88,'center');
  batch.rows.forEach((r,i)=>{const top=213.2+i*37.8;text(r.round,93,top+12,10,73,'center');text(r.detail,93,top+26,7,73,'center');for(const [p,center] of [[r.a,206],[r.b,353]] as const){if(p)centeredPlayer(p.name,p.studentId,center,top);else text('空位',center,top+18.9,10,137,'center');}text(r.winner,484,top+18.9,11,103,'center');});
  let y=752;y+=wrap(recordHonors(state,sport),53,y,8,488);text('逐局记录；A 为本行先手、B 为后手。非实赛行仅代表对阵位置，不认定先后手。',53,y+8,7,488);text('轮空不计入实赛记录。和棋、弃权及管理员裁定按实际记录列示。',53,y+20,7,488);text('第 '+(pageIndex+1)+' / '+totalPages+' 页 / 裁判分组归档',541,832,8,488,'right');
  const image=await pdf.embedPng(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer());page.drawImage(image,{x:0,y:0,width,height});
 }
 // Reasons and administrative corrections remain legible even when the source
 // table has no notes column; append pages only when such records exist.
 for(let offset=0;offset<notes.length;offset+=8){const page=pdf.addPage([595.32,841.92]),canvas=document.createElement('canvas');canvas.width=2382;canvas.height=3368;const ctx=canvas.getContext('2d')!;ctx.scale(4,4);ctx.fillStyle='#fff';ctx.fillRect(0,0,596,842);ctx.fillStyle='#111';ctx.font='16px "Microsoft YaHei",sans-serif';ctx.fillText(SPORT_NAMES[sport]+' - 裁判说明附页',50,55);let y=90;for(const r of notes.slice(offset,offset+8)){ctx.font='10px "Microsoft YaHei",sans-serif';ctx.fillText(r.detail.split(' / ')[0]+' / '+r.round+' / '+r.referee,50,y);y+=17;ctx.font='9px "Microsoft YaHei",sans-serif';let line='';for(const c of r.note){if(ctx.measureText(line+c).width>490){ctx.fillText(line,50,y);y+=13;line=c;}else line+=c;}ctx.fillText(line,50,y);y+=32;}ctx.font='8px \"Microsoft YaHei\",sans-serif';ctx.fillText('第 '+(batches.length+Math.floor(offset/8)+1)+' / '+totalPages+' 页 / 裁判说明',390,832);const image=await pdf.embedPng(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer());page.drawImage(image,{x:0,y:0,width:595.32,height:841.92});}
 pdf.setTitle(event.name+' - '+SPORT_NAMES[sport]+'比赛记录');pdf.setSubject('按原始记录表归档的比赛成绩');return pdf.save();
}
