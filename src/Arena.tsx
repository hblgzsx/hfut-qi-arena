import {defaultEvent,eventTime} from './event-settings';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Flag, Maximize2, Minimize2, Plus, Trophy, X } from 'lucide-react';
import { buildBracket, SPORT_NAMES, standings } from './engine';
import type { Match, Sport, State, Tournament } from './engine';
import { ContestBoard } from './ContestBoard';
import { nextRoundLabel } from './announcement-text';
import { SpeechControls, useAnnouncementSpeech, broadcastSeconds } from './SpeechControls';

export interface Announcement { key: string; drawnAt:string; sport: Sport; match: Match; name: string; opponent: string; college: string; champion: boolean; nextRound:string }
export function completedChanges(before: State, after: State): Announcement[] {
  const changes: Announcement[] = [];
  for (const sport of ['gomoku','junqi'] as Sport[]) {
    const t=after.tournaments[sport], old=before.tournaments[sport];
    if(t.drawnAt!==old.drawnAt) continue;
    for(const m of buildBracket(t).flat()) {
      if(!m.result||!m.resolved||m.bye)continue;
      if(JSON.stringify(old.results[m.id])===JSON.stringify(m.result))continue;
      const winner=t.players.find(p=>p.id===m.winner), loser=t.players.find(p=>p.id===(m.winner===m.a.id?m.b.id:m.a.id));
      changes.push({key:`${sport}-${t.drawnAt}-${m.id}-${m.result.updatedAt}`,drawnAt:t.drawnAt,sport,match:m,name:winner?.name??'双方取消资格',opponent:loser?.name??'',college:winner?.college??'',champion:standings(t).champion===m.winner&&!!m.winner,nextRound:m.id==='BRONZE'?'':nextRoundLabel(m.round,buildBracket(t).length)});
    }
  }
  return changes;
}
export function ResultBroadcast({event,onClose,speakEnabled=true}:{event:Announcement;onClose:()=>void;speakEnabled?:boolean}) {
  const [duration]=useState(()=>broadcastSeconds(event));const [seconds,setSeconds]=useState(duration);const speaking=useAnnouncementSpeech(event,speakEnabled);
  useEffect(()=>{setSeconds(broadcastSeconds(event));const timer=setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);return()=>clearInterval(timer);},[event.key]);
  useEffect(()=>{if(seconds<=0&&!speaking)onClose();},[seconds,speaking,onClose]);
  return <div className={`result-broadcast ${event.champion?'champion-broadcast':''}`} role="dialog" aria-label="赛果播报"><div className="broadcast-rays"/><div className="broadcast-grid"/><button className="broadcast-close" onClick={onClose} aria-label="关闭赛果播报"><X size={22}/></button><div className="broadcast-content"><span className="broadcast-eyebrow">{SPORT_NAMES[event.sport]} / {event.match.label} / {event.match.id}</span><span className="broadcast-trophy"><Trophy size={70} strokeWidth={1}/></span><div className="broadcast-title">{event.champion?'CHAMPION':event.match.winner?'VICTORY':'MATCH CLOSED'}</div><p className="broadcast-subtitle">{event.champion?'巅峰加冕 · 冠军诞生':event.match.winner?(event.match.id==='BRONZE'?'胜负已定 · 季军诞生':'胜负已定 · 恭喜晋级'):'裁判判定 · 本场结束'}</p><h2>{event.name}</h2><p className="broadcast-college">{event.college}</p>{event.match.winner&&<div className="broadcast-score"><span>{event.opponent}</span><b>{event.match.result?.kind==='played'?(event.match.winner===event.match.a.id?[event.match.score[1],event.match.score[0]]:event.match.score).join(' : '):event.match.result?.kind==='adjudicated'?'管理员裁定':'弃权判定'}</b><span>{event.name}</span></div>}<div className="broadcast-bottom"><span>THE NEXT MOVE IS YOURS</span><button onClick={onClose}>{seconds<=0&&speaking?'语音播报中，结束后返回':seconds+'s 后返回对阵'} <ArrowLeft size={14}/></button></div></div><div className="broadcast-progress" style={{animationDuration:duration+'s'}}/>{Array.from({length:36},(_,i)=><i className="energy-spark" key={i} style={{left:`${i*47%100}%`,animationDelay:`${i%9*.13}s`,height:3+i%5*3}}/>)}</div>;
}

function FitBracket({t,onRecord}:{t:Tournament;onRecord:(sport:Sport,id:string)=>void}) {
  const ref=useRef<HTMLDivElement>(null),[box,setBox]=useState({width:1200,height:650});
  useEffect(()=>{const obs=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;setBox({width:Math.max(width,240),height:Math.max(height,120)});});if(ref.current)obs.observe(ref.current);return()=>obs.disconnect();},[]);
  const allRounds=buildBracket(t),bronze=allRounds.flat().find(m=>m.id==='BRONZE'),rounds=allRounds.map(r=>r.filter(m=>m.id!=='BRONZE')),total=rounds.length,{width:w,height:h}=box;
  if(!total)return <div ref={ref} className="fit-bracket empty-fit"><Flag size={36}/><h3>{t.players.length} 名选手等待抽签</h3><p>导入名单并完成抽签后，将在这里显示全部晋级路径。</p></div>;
  const pad=12,header=26,footer=12,bodyH=h-header-footer;
  const sides=Math.max(total-1,0),col=(w-pad*2)/(sides*2+1),cw=Math.max(20,col-12);
  const metrics=(r:number)=>{const count=r===total-1?1:Math.max(1,rounds[r].length/2),cardH=Math.min(62,bodyH/count-4);return {cardH,font:Math.min(14,Math.max(4.5,(cardH-4)*.43),cw/6.2),compact:cardH<42};};
  const {font}=metrics(0),{cardH}=metrics(total-1);
  const positions=new Map<string,{x:number;y:number}>();
  for(let r=0;r<total;r++)for(const m of rounds[r]) {
    const final=r===total-1,half=rounds[r].length/2,right=!final&&m.index>=half,local=right?m.index-half:m.index;
    positions.set(m.id,{x:final?(w-cw)/2:right?w-pad-cw-r*col:pad+r*col,y:final?header+bodyH/2:header+(local+.5)*bodyH/half});
  }
  const name=(id:string|null,settled:boolean)=>t.players.find(p=>p.id===id)?.name??(settled?'轮空':'待晋级');
  const champion=t.players.find(p=>p.id===standings(t).champion);
  return <div className="fit-bracket" ref={ref}><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${SPORT_NAMES[t.sport]}完整晋级图，${t.players.length}名选手，所有签位一屏展示`}>
    <defs><linearGradient id={`path-${t.sport}`}><stop stopColor="var(--arena-accent)" stopOpacity=".1"/><stop offset="1" stopColor="var(--arena-accent)" stopOpacity=".9"/></linearGradient></defs>
    {Array.from({length:sides*2+1},(_,c)=>{const r=c<sides?c:sides*2-c;return <text className="fit-round-title" key={c} x={pad+c*col+cw/2} y={14} textAnchor="middle" fontSize={Math.min(10,col/7)}>{rounds[r][0].label} · BO{rounds[r][0].bestOf}</text>;})}
    {rounds.slice(0,-1).flat().map(m=>{const a=positions.get(m.id)!,next=rounds[m.round+1][Math.floor(m.index/2)],b=positions.get(next.id)!,right=a.x>b.x,x1=right?a.x:a.x+cw,x2=right?b.x+cw:b.x,mid=(x1+x2)/2;return <path key={m.id} className={`fit-path ${m.winner?'advanced':''}`} d={`M${x1} ${a.y}H${mid}V${b.y}H${x2}`} fill="none" stroke={m.winner?`url(#path-${t.sport})`:'#25364d'} strokeWidth={m.winner?1.5:1}/>;})}
    {rounds.flat().map(m=>{const {cardH,font,compact}=metrics(m.round),pos=positions.get(m.id)!,top=pos.y-cardH/2;return <g key={`${m.id}-${m.result?.updatedAt??''}`} className={`fit-match ${m.ready&&!m.resolved?'ready':''} ${m.resolved?'finished':''}`} role="button" tabIndex={m.ready?0:-1} aria-label={`${m.id} ${name(m.a.id,m.a.settled)} 对 ${name(m.b.id,m.b.settled)}`} onClick={()=>m.ready&&onRecord(t.sport,m.id)} onKeyDown={e=>{if(m.ready&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onRecord(t.sport,m.id);}}}>
      <title>{m.id} · {m.label} · {m.bye?'轮空晋级':m.resolved?'已结束':'待赛'} · {name(m.a.id,m.a.settled)} / {name(m.b.id,m.b.settled)}</title>
      <rect x={pos.x} y={top} width={cw} height={cardH} rx={Math.min(5,cardH/6)} className="fit-match-bg"/>
      {(['a','b'] as const).map((side,i)=>{const slot=m[side],won=m.winner===slot.id&&!!slot.id;const text=name(slot.id,slot.settled),y=top+cardH*(i?.76:.3);return <g key={side}><rect className={won?'fit-winner-row':'fit-normal-row'} x={pos.x+1} y={top+cardH*i/2+1} width={cw-2} height={cardH/2-2} rx="2"/><circle cx={pos.x+5} cy={y-font*.28} r={Math.max(1,font/6)} fill={won?'var(--arena-accent)':i?'#b8c7dc':'#647891'}/><text className={won?'fit-name won':'fit-name'} x={pos.x+10} y={y} fontSize={font} textLength={text.length*font>cw-32?Math.max(5,cw-32):undefined} lengthAdjust="spacingAndGlyphs">{text}</text><text x={pos.x+cw-6} y={y} textAnchor="end" fontSize={font} className="fit-score">{m.result?.kind==='played'?m.score[i]:won?'✓':'·'}</text>{!compact&&<text x={pos.x+10} y={y+font*.63} fontSize={font*.4} className="fit-college">{t.players.find(p=>p.id===slot.id)?.college??m.id}</text>}</g>;})}
    </g>;})}
    {champion&&<g className="fit-champion"><text x={w/2} y={Math.min(h-10,header+bodyH/2+cardH/2+30)} textAnchor="middle" fontSize={Math.min(15,col/5)}>♛ {champion.name} · 冠军</text></g>}
  </svg>{bronze&&<button className="arena-bronze" disabled={!bronze.ready} onClick={()=>onRecord(t.sport,bronze.id)}>季军争夺赛 · BO{bronze.bestOf} · {name(bronze.a.id,bronze.a.settled)} / {name(bronze.b.id,bronze.b.settled)} · {bronze.resolved?'已结束':bronze.ready?'待录分':'等待半决赛'}</button>}<span className="fit-density">{t.players.length} 人 / {t.seeds.length} 签位 · 全图自适应{font<8?' · 建议使用高分辨率大屏':''}</span></div>;
}

export function Arena({state,onExit,onRecord,onAwards,initialSport='gomoku',canRecord=true,connection='本地同步',queueEnabled=true,onToggleQueue,onBackdrop,queueSince=Date.now()}:{state:State;onExit:()=>void;onRecord:(s:Sport,id?:string)=>void;onAwards:()=>void;initialSport?:Sport;canRecord?:boolean;connection?:string;queueEnabled?:boolean;onToggleQueue?:()=>void;onBackdrop?:()=>void;queueSince?:number}) {
  const [mode,setMode]=useState<Sport|'both'>(new URLSearchParams(location.search).get('view')==='both'?'both':initialSport),[fullscreen,setFullscreen]=useState(!!document.fullscreenElement);
  const [now,setNow]=useState(new Date());const [boardView,setBoardView]=useState<'standings'|'bracket'>('standings');
  const allMatches=(['gomoku','junqi'] as Sport[]).flatMap(s=>buildBracket(state.tournaments[s]).flat());const finished=allMatches.filter(m=>m.resolved&&!m.bye).length,totalPlayers=state.tournaments.gomoku.players.length+state.tournaments.junqi.players.length;
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);const f=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',f);return()=>{clearInterval(t);document.removeEventListener('fullscreenchange',f);};},[]);
  const toggleFull=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{/* Browser can decline fullscreen; exit display remains available. */}};
  return <div className={`arena arena-${mode}`}><div className="arena-ambient"/><img className="arena-watermark" src={`${import.meta.env.BASE_URL}brand/hfut-badge.svg`} alt=""/><div className="arena-scanlines"/><header className="arena-header"><div className="arena-brand"><img className="hfut-brand" src={`${import.meta.env.BASE_URL}brand/hfut-horizontal.svg`} alt="合肥工业大学"/><div><b>弈境 <small>QI ARENA</small></b><span>{(state.event??defaultEvent()).name}</span></div></div><div className="arena-title"><span>{eventTime(state.event??defaultEvent())} · {(state.event??defaultEvent()).venue}</span><h1>{(state.event??defaultEvent()).name}<span> / </span>赛事直播</h1></div><div className="arena-clock"><b>{now.toLocaleTimeString('zh-CN',{hour12:false})}</b><span><i/>{connection}</span></div></header>
    <div className="arena-controls"><div className="arena-mode">{(['gomoku','both','junqi'] as const).map(m=><button key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}>{m==='both'?'双赛同屏':SPORT_NAMES[m]}</button>)}</div><div className="arena-action-buttons"><button aria-pressed={queueEnabled} title={'仅播放本次登录后：'+new Date(queueSince).toLocaleString('zh-CN',{hour12:false})} onClick={onToggleQueue}>{queueEnabled?'播报队列：开':'播报队列：关'}</button><SpeechControls queueSince={queueSince}/>{onBackdrop&&<button onClick={onBackdrop}><span>颁奖背景</span></button>}<button onClick={onAwards}><Trophy size={15}/><span>荣耀奖品</span></button><button className="arena-record" onClick={()=>onRecord(mode==='both'?'gomoku':mode)}><Plus size={16}/><span>{canRecord?'录入新的对局成绩':'裁判登录 / 录分'}</span></button><button onClick={toggleFull}>{fullscreen?<Minimize2 size={15}/>:<Maximize2 size={15}/>}<span>{fullscreen?'退出全屏':'全屏'}</span></button><button onClick={onExit}><ArrowLeft size={15}/><span>退出展示</span></button></div></div>
    <div className="contest-ribbon"><div><span className="contest-live-dot"/>LIVE SCOREBOARD <small>HFUT · {(state.event??defaultEvent()).startsAt.slice(0,4)}</small></div><div><b>{totalPlayers.toString().padStart(3,'0')}</b><span>选手</span><b>{finished.toString().padStart(3,'0')}</b><span>已完赛</span><span className="contest-demo">{state.tournaments.gomoku.demo?'SIMULATION / 演示':'OFFICIAL / 正式'}</span></div><div className="contest-view"><button className={boardView==='standings'?'selected':''} onClick={()=>setBoardView('standings')}>竞赛总榜</button><button className={boardView==='bracket'?'selected':''} onClick={()=>setBoardView('bracket')}>晋级树</button></div></div><div className="arena-boards">{(mode==='both'?['gomoku','junqi'] as Sport[]:[mode]).map(s=>{const t=state.tournaments[s],matches=buildBracket(t).flat(),done=matches.filter(m=>m.ready&&m.resolved).length;return <section key={s} className={`arena-sport arena-sport-${s}`}><div className="arena-sport-heading"><h2><span className="arena-sport-mark">{s==='gomoku'?'●':'⚑'}</span>{SPORT_NAMES[s]}<small>{s==='gomoku'?'GOMOKU':'MILITARY CHESS'}</small></h2><div><span>{t.demo?'演示赛事':'正式赛事'}</span><b>{done}<small> 场已结束 / </small>{t.players.length}<small> 位选手</small></b></div></div>{boardView==='standings'?<ContestBoard t={t} onRecord={onRecord}/>:<FitBracket t={t} onRecord={onRecord}/>}</section>;})}</div>
    <footer className="arena-footer"><span><i/> LIVE TOURNAMENT</span><p>前两轮 BO1 · 半决赛 / 决赛及其余轮次 BO3 · 双季军</p><b>THINK · PLAY · CONNECT</b></footer>
  </div>;
}
