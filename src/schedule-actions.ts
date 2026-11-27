import { buildBracket } from './engine.ts';
import type { Sport, State } from './engine.ts';
import { dispatchTables, emptySchedule, occupied, prepareDraw, SPORTS, tableKey,validateTableBindings } from './scheduling.ts';

export function scheduleAction(input: State, command: Record<string, any>, now=Date.now()): State {
  const next = structuredClone(input);
  const s = next.schedule ??= emptySchedule();
  const sport = command.sport as Sport;
  if (command.type === 'draw') {
    if (!SPORTS.includes(sport) || !Array.isArray(command.absent) || !Array.isArray(command.priority)) throw new Error('抽签参数无效。');
    return prepareDraw(next,sport,command.absent,command.priority);
  }
  if (command.type === 'configure') {
    if (s.running) throw new Error('请先暂停调度，再设置棋盘和裁判。');
    if (s.assignments.some(a=>occupied(a)&&a.table>command.counts?.[a.sport])) throw new Error('缩减数量将移除正在使用的棋盘，请先完成该桌比赛。');
    s.counts = command.counts;
    s.bindings = command.bindings;
    validateTableBindings(s);
  } else if (command.type === 'start') {
    validateTableBindings(s);
    for (const sp of SPORTS) {
      if (next.tournaments[sp].seeds.length && s.draws[sp] !== next.tournaments[sp].drawnAt) throw new Error('请先在现场调度中确认该项目抽签，旧签位不会自动接管。');
    }
    if (!SPORTS.some(sp=>s.queues[sp].length)) throw new Error('请先抽签并锁定顺序。');
    s.running=true;
  } else if (command.type === 'pause') {
    s.running=false;
  } else if (command.type === 'reorder') {
    if (!SPORTS.includes(sport) || !Array.isArray(command.queue)) throw new Error('候场队列无效。');
    const old=s.queues[sport], queue=command.queue as string[];
    if(queue.length!==old.length || new Set(queue).size!==old.length || queue.some(id=>!old.includes(id))) throw new Error('只能调整原有候场场次的顺序。');
    s.queues[sport]=queue;
  } else if (command.type === 'cancel') {
    const a=s.assignments.find(a=>a.id===command.assignment);
    if (!a || a.status!=='called' || next.tournaments[a.sport].results[a.match]) throw new Error('仅能取消尚未开赛且没有比分的叫号。');
    a.status='cancelled';
    // Pause dispatch so the cancelled match is not immediately called again.
    s.running=false;
  } else if (command.type === 'begin') {
    const a=s.assignments.find(a=>a.id===command.assignment);
    if (!a || a.status!=='called') throw new Error('叫号已变化，请刷新。');
    a.status='playing';
  } else if (command.type !== 'tick') throw new Error('不支持的调度操作。');
  return dispatchTables(next,now);
}
export function mayScoreTable(state: State, user: string, sport: Sport, match: string) {
  const a=state.schedule?.assignments.find(a=>a.sport===sport && a.match===match && occupied(a));
  const keys=state.schedule?.bindings[user];
  return !!a && keys?.length===1 && keys[0]===tableKey(sport,a.table);
}
export function scheduleProtected(before:State,after:State) {
  return JSON.stringify(before.schedule)!==JSON.stringify(after.schedule) ||
    SPORTS.some(sport=>!!before.tournaments[sport].seeds.length &&
      (JSON.stringify(before.tournaments[sport].seeds)!==JSON.stringify(after.tournaments[sport].seeds) ||
       before.tournaments[sport].drawnAt!==after.tournaments[sport].drawnAt ||
       JSON.stringify(before.tournaments[sport].players)!==JSON.stringify(after.tournaments[sport].players)));
}
export function assertNoLiveReplacement(before:State,after:State) {
  if (!before.schedule?.assignments.some(occupied)) return;
  for (const sport of SPORTS) {
    const old=before.tournaments[sport], next=after.tournaments[sport];
    if (JSON.stringify([old.seeds,old.drawnAt,old.players])!==JSON.stringify([next.seeds,next.drawnAt,next.players])) throw new Error('现场已叫号，不能覆盖名单和抽签。');
    for (const a of before.schedule.assignments.filter(a=>a.sport===sport && occupied(a))) {
      const m=buildBracket(next).flat().find(m=>m.id===a.match);
      if (!m || m.a.id!==a.players[0] || m.b.id!==a.players[1]) throw new Error('更正影响已叫号或进行中比赛，请先核查现场对局。');
    }
  }
}
