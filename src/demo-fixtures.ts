import { buildBracket, draw, emptyState, emptyTournament, setResult } from './engine.ts';
import type { Sport,State } from './engine.ts';
export const DEMO_SIZES=[32,64,128,256] as const;
export function competitionDemo(count=256):State{
 if(!DEMO_SIZES.includes(count as 32))throw new Error('演示人数请选择 32、64、128 或 256。');
 const s=emptyState(),surname='赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕施张孔曹严华金魏陶姜谢',given=['知远','思宁','亦安','予墨','星河','书瑶','景行','晚晴'],colleges=['计算机与信息学院','经济学院','建筑与艺术学院','外国语学院','微电子学院'];
 for(const sport of ['gomoku','junqi'] as Sport[]){
 const players=Array.from({length:count},(_,i)=>({id:'demo-'+sport+'-'+i,name:surname[i%32]+given[Math.floor(i/32)],studentId:'DEMO'+(sport==='gomoku'?'G':'J')+String(i+1).padStart(4,'0'),college:colleges[i%5],phone:'',qq:'',gender:''}));
 let t=draw({...emptyTournament(sport),players,demo:true},'HFUT-MAX-DEMO-'+sport+'-'+count);
 // Mixed completion creates realistic live rows while leaving semifinals and final open.
 for(let r=0;r<Math.log2(count)-2;r++){const matches=buildBracket(t)[r];for(const m of matches){if(!m.ready||m.resolved||r>0&&m.index%4===1)continue;const side=(m.index+r)%3===0?'B':'A';t=setResult(t,m.id,{kind:'played',games:m.bestOf===1?[side]:[side,side],first:'A',reason:'虚拟演示赛果',referee:'演示裁判',updatedAt:new Date(2026,10,29,14,r,m.index).toISOString()});}}
 s.tournaments[sport]=t;
 }return s;
}
