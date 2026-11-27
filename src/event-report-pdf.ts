import {PDFDocument} from 'pdf-lib';
import type {EventReport,ReportSection} from './event-reports';
import {eventTime} from './event-settings';
export async function createEventReportPdf(report:EventReport){
 await document.fonts.ready;
 const W=595.28,H=841.89,M=38,CW=W-M*2,BOTTOM=770;
 const pages:{canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D}[]=[];
 let ctx:CanvasRenderingContext2D,y=0;
 function font(size:number,bold=false){ctx.font=`${bold?'600':'400'} ${size}px "Microsoft YaHei","Noto Sans SC",sans-serif`;}
 function lines(value:string,width:number,size=9){font(size);const out:string[]=[];for(const paragraph of String(value).split('\n')){let line='';for(const char of paragraph){if(line&&ctx.measureText(line+char).width>width){out.push(line);line=char;}else line+=char;}out.push(line);}return out;}
 function text(value:string,x:number,top:number,width:number,size=9,color='#233c42',bold=false){ctx.fillStyle=color;font(size,bold);const rows=lines(value,width,size);font(size,bold);rows.forEach((line,i)=>ctx.fillText(line,x,top+i*(size+4)));return rows.length*(size+4);}
 function newPage(){const canvas=document.createElement('canvas');canvas.width=Math.ceil(W*3);canvas.height=Math.ceil(H*3);ctx=canvas.getContext('2d')!;if(!ctx)throw new Error('当前浏览器不支持 PDF 生成。');ctx.scale(3,3);ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);pages.push({canvas,ctx});ctx.fillStyle='#236658';ctx.fillRect(M,27,32,3);text('QI ARENA / 现场赛事资料',M+42,23,CW-42,8,'#61736d');y=49;y+=text(report.title+(report.draft?' · 草稿':''),M,y,CW,22,'#173e39',true)+10;y+=text(report.event.name,M,y,CW,12,'#263c40',true)+5;y+=text(eventTime(report.event)+' / '+report.event.venue,M,y,CW,9)+4;y+=text('导出：'+new Date(report.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' / '+(report.draft?'未发布安排草稿':'赛事数据快照'),M,y,CW,8,'#64736c')+10;}
 function heading(section:ReportSection,continuation=false){if(y>715)newPage();y+=12;y+=text(section.title+(continuation?'（续）':''),M,y,CW,12,'#236658',true)+8;tableRow(section,section.columns,true);}
 function tableRow(section:ReportSection,row:string[],header=false){const widths=section.widths.map(w=>w*CW),wrapped=row.map((v,i)=>lines(v,widths[i]-16,9));const h=Math.max(1,...wrapped.map(l=>l.length))*13+12;
  if(!header&&y+h>BOTTOM){newPage();heading(section,true);}
  if(!header&&y+h>BOTTOM){
   let offset=0;const total=Math.max(...wrapped.map(r=>r.length));
   while(offset<total){const count=Math.max(1,Math.floor((BOTTOM-y-12)/13)),chunk=wrapped.map(r=>r.slice(offset,offset+count)),height=Math.max(...chunk.map(r=>r.length))*13+12;ctx.fillStyle='#fff';ctx.fillRect(M,y,CW,height);ctx.strokeStyle='#cbd8d3';ctx.lineWidth=.5;let left=M;chunk.forEach((cell,i)=>{ctx.strokeRect(left,y,widths[i],height);ctx.fillStyle='#233c42';font(9);cell.forEach((line,j)=>ctx.fillText(line,left+8,y+6+j*13));left+=widths[i];});y+=height;offset+=count;if(offset<total){newPage();heading(section,true);}}
   return;
  }
  ctx.fillStyle=header?'#e8f0ed':'#ffffff';ctx.fillRect(M,y,CW,h);let x=M;ctx.strokeStyle='#cbd8d3';ctx.lineWidth=.5;
  row.forEach((_,i)=>{ctx.strokeRect(x,y,widths[i],h);ctx.fillStyle=header?'#225b50':'#233c42';font(9,header);wrapped[i].forEach((line,j)=>ctx.fillText(line,x+8,y+6+j*13));x+=widths[i];});y+=h;
 }
 newPage();y+=text(report.summary,M,y,CW,10,'#8b6538')+2;
 for(const section of report.sections){heading(section);for(const row of section.rows.length?section.rows:[section.columns.map((_,i)=>i?'—':'暂无记录')])tableRow(section,row);}
 y+=18;for(const note of report.notes){const h=lines(note,CW,8).length*12;if(y+h>BOTTOM)newPage();y+=text('• '+note,M,y,CW,8,'#5b6e65')+5;}
 const pdf=await PDFDocument.create();
 for(let i=0;i<pages.length;i++){const item=pages[i];ctx=item.ctx;ctx.strokeStyle='#cbd8d3';ctx.beginPath();ctx.moveTo(M,794);ctx.lineTo(W-M,794);ctx.stroke();text('版本 '+report.revision,M,803,CW-80,7,'#7b8680');text(`${i+1} / ${pages.length}`,W-M-45,803,45,8,'#62796d');const image=await pdf.embedPng(item.canvas.toDataURL('image/png'));const page=pdf.addPage([W,H]);page.drawImage(image,{x:0,y:0,width:W,height:H});}
 pdf.setTitle(report.event.name+' - '+report.title);pdf.setSubject(report.draft?'安排草稿，尚未创建赛事':'导出时已确认的赛事快照');pdf.setCreationDate(new Date(report.generatedAt));return pdf.save();
}
