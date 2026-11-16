import {useEffect,useRef,useState} from 'react';
import {buildBracket,SPORT_NAMES} from './engine';
import type {Sport,Tournament} from './engine';
export function ContestBoard({t,onRecord}:{t:Tournament;onRecord:(s:Sport,id:string)=>void}){
 const matches=buildBracket(t).flat(),columns=t.players.length>128?16:t.players.length>64?12:8;
 const ref=useRef<HTMLDivElement>(null),[cell,setCell]=useState({width:110,height:25});
 useEffect(()=>{const obs=new ResizeObserver(entries=>{const box=entries[0].contentRect;setCell({width:box.width/columns,height:box.height/rows});});if(ref.current)obs.observe(ref.current);return()=>obs.disconnect();},[columns,t.players.length]);
 const rows=Math.max(1,Math.ceil(t.players.length/columns));
 return <div className="contest-board" style={{'--roster-cols':columns,'--roster-rows':rows} as React.CSSProperties} role="region" aria-label={SPORT_NAMES[t.sport]+'全员竞赛总榜'}>
 <div className="contest-board-legend"><span>SEED / COMPETITOR</span><span><i className="status-alive"/>晋级 / 待赛</span><span><i className="status-out"/>已止步</span><span>W · 胜场</span></div>
 <div className="contest-roster" ref={ref} style={{'--cell-name-size':Math.max(3,Math.min(13,(cell.width-32)/4,cell.height*.63))+'px'} as React.CSSProperties}>{t.players.map((p,i)=>{
 const played=matches.filter(m=>m.a.id===p.id||m.b.id===p.id),wins=played.filter(m=>m.resolved&&m.winner===p.id&&!m.bye).length,loss=played.find(m=>m.resolved&&!m.bye&&m.winner!==p.id),current=played.find(m=>m.ready&&!m.resolved),latest=played.filter(m=>m.winner===p.id).at(-1),champion=matches.at(-1)?.winner===p.id;
 return <button key={p.id} className={'contest-player '+(champion?'champion':loss?'out':current?'active':'advanced')} title={p.name+' · '+p.college+' · '+(loss?'止步'+loss.label:current?current.label+'待赛':latest?'已晋级':'待赛')} onClick={()=>{const m=current||loss||latest;if(m)onRecord(t.sport,m.id);}}><span className="contest-seed">{String(i+1).padStart(3,'0')}</span><b>{p.name}</b><span className="contest-wins">{champion?'♛':loss?'—':wins+'W'}</span><i style={{width:(wins/Math.max(1,Math.log2(t.seeds.length)))*100+'%'}}/></button>;
 })}</div></div>;
}
