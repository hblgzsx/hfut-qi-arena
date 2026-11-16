import type { Sport } from './engine';
export function Board({ sport, large = false }: { sport: Sport; large?: boolean }) {
  const stones = [[7,7,0],[8,7,1],[6,8,0],[8,8,1],[5,9,0],[8,9,1],[4,10,0],[8,6,1],[3,11,0]];
  if (sport === 'gomoku') return <svg className={`chessboard ${large ? 'large' : ''}`} viewBox="0 0 360 360" role="img" aria-label="15×15 五子棋盘，棋子依次落盘">
    <defs><linearGradient id="wood" x2="1" y2="1"><stop stopColor="#efd9b5"/><stop offset="1" stopColor="#cfaa76"/></linearGradient><radialGradient id="black"><stop stopColor="#62615b"/><stop offset=".75" stopColor="#282d2a"/><stop offset="1" stopColor="#16221e"/></radialGradient><radialGradient id="white" cx=".35" cy=".3"><stop stopColor="#fff"/><stop offset="1" stopColor="#deddd3"/></radialGradient><filter id="shadow"><feDropShadow dx="1" dy="3" stdDeviation="2" floodOpacity=".23"/></filter></defs>
    <rect x="5" y="5" width="350" height="350" rx="12" fill="url(#wood)"/>
    {Array.from({length:15},(_,i)=><g key={i} stroke="#6f674f" strokeWidth=".7" opacity=".65"><path d={`M${26+i*22} 26V334`}/><path d={`M26 ${26+i*22}H334`}/></g>)}
    {[[3,3],[3,11],[7,7],[11,3],[11,11]].map(([x,y])=><circle key={`${x}-${y}`} cx={26+x*22} cy={26+y*22} r="2.7" fill="#5c5948"/>)}
    {stones.map(([x,y,c],i)=><circle className="stone" key={i} cx={26+x*22} cy={26+y*22} r="10" fill={`url(#${c?'white':'black'})`} filter="url(#shadow)" style={{animationDelay:`${i*.35}s`}}/>)}
    <circle className="last-move" cx="92" cy="268" r="3" fill="#f27b50"/>
  </svg>;
  const camps = new Set(['1-1','3-1','2-2','1-3','3-3','1-8','3-8','2-9','1-10','3-10']);
  return <svg className={`chessboard military ${large?'large':''}`} viewBox="0 0 300 390" role="img" aria-label="军棋棋盘，5列12行，公路、铁路、行营与大本营">
    <rect x="4" y="4" width="292" height="382" rx="12" fill="#e6e1c7"/>
    {Array.from({length:12},(_,r)=>Array.from({length:5},(_,c)=><g key={`${r}-${c}`} stroke="#7b896e" strokeWidth="1"><path d={`M${38+c*56} ${30+r*30}h${c<4?56:0}m-${c<4?56:0} 0v${r<11&&!(r===5&&(c===1||c===3))?30:0}`}/></g>))}
    {[1,5,6,10].map(r=><path key={r} d={`M38 ${30+r*30}H262`} stroke="#456854" strokeWidth="4" strokeDasharray="3 2"/>)}
    {[38,262].map(x=><path key={x} d={`M${x} 60V330`} stroke="#456854" strokeWidth="4" strokeDasharray="3 2"/>)}
    {[...camps].map(cell=>{const [c,r]=cell.split('-').map(Number);return <path key={cell} d={`M${38+(c-1)*56} ${30+(r-1)*30}l112 60m-112 0l112 -60`} stroke="#7b896e" strokeWidth=".8"/>;})}
    <text x="94" y="199" textAnchor="middle" fontSize="9" fill="#738068">前</text><text x="206" y="199" textAnchor="middle" fontSize="9" fill="#738068">线</text>
    {Array.from({length:12},(_,r)=>Array.from({length:5},(_,c)=>{ const camp = camps.has(`${c}-${r}`), base = (r===0||r===11)&&(c===1||c===3); return camp ? <circle key={`${r}-${c}`} cx={38+c*56} cy={30+r*30} r="8" fill="#e6e1c7" stroke="#456854"/> : <rect key={`${r}-${c}`} x={28+c*56} y={24+r*30} width="20" height="12" rx={base?0:3} fill={base?'#62745a':'#e6e1c7'} stroke="#7b896e"/>; }))}
    {[['司令',2,2],['军长',0,3],['工兵',4,4],['军旗',1,11],['师长',2,9],['炸弹',3,10]].map(([label,c,r],i)=><g className="army-piece" key={i} style={{animationDelay:`${i*.2}s`}}><rect x={22+Number(c)*56} y={20+Number(r)*30} width="32" height="21" rx="4" fill={i<3?'#284c40':'#ab533e'} stroke="#fff" strokeWidth=".5"/><text x={38+Number(c)*56} y={34+Number(r)*30} textAnchor="middle" fill="white" fontSize="10">{label}</text></g>)}
  </svg>;
}
