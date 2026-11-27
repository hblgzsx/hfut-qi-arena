import { buildBracket, draw, seededRandom, SPORT_NAMES } from './engine.ts';
import type { Sport, State } from './engine.ts';

export const SPORTS: Sport[] = ['gomoku', 'junqi'];
export interface TableAssignment {
  id: string;
  sport: Sport;
  table: number;
  match: string;
  players: [string, string];
  status: 'called' | 'playing' | 'finished' | 'cancelled';
  calledAt: number;
  finishedAt?: number;
}
export interface TableCall {
  id: string;
  assignment: string;
  text: string;
  createdAt: number;
}
export interface Schedule {
  counts: Record<Sport, number>;
  queues: Record<Sport, string[]>;
  draws: Record<Sport, string>;
  bindings: Record<string, string[]>;
  assignments: TableAssignment[];
  calls: TableCall[];
  running: boolean;
}
export const tableKey = (sport: Sport, table: number) => sport + ':' + table;
export const tableName = (sport: Sport, table: number) => SPORT_NAMES[sport] + ' ' + table + ' 号桌';
export const occupied = (a: TableAssignment) => a.status === 'called' || a.status === 'playing';
export function emptySchedule(): Schedule {
  return { counts: { gomoku: 10, junqi: 5 }, queues: { gomoku: [], junqi: [] },
    draws: { gomoku: '', junqi: '' }, bindings: {}, assignments: [], calls: [], running: false };
}
function randomized(ids: string[], seed: string) {
  const random = seededRandom(seed);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
export function prepareDraw(state: State, sport: Sport, absent: string[], priority: string[], seed = crypto.randomUUID()): State {
  if (state.schedule?.assignments.some(a => occupied(a))) throw new Error('已有叫号或进行中对局，请先结束现场比赛再重新抽签。');
  const next = structuredClone(state);
  const t = next.tournaments[sport];
  if (absent.some(id => !t.players.some(p => p.id === id))) throw new Error('未到场名单已变化，请重新核对。');
  t.players = t.players.filter(p => !absent.includes(p.id));
  if (priority.some(id => !t.players.some(p => p.id === id))) throw new Error('优先选手必须已到场。');
  next.tournaments[sport] = draw(t, seed);
  const schedule = next.schedule ??= emptySchedule();
  const rounds = buildBracket(next.tournaments[sport]);
  schedule.queues[sport] = rounds.flatMap((round, index) => {
    const ids = randomized(round.map(m => m.id), seed + ':queue:' + index);
    if (index !== 0) return ids;
    const ranks = new Map(priority.map((id, i) => [id, i]));
    const rank = (id: string) => {
      const m = round.find(m => m.id === id)!;
      return Math.min(ranks.get(m.a.id!) ?? Infinity, ranks.get(m.b.id!) ?? Infinity);
    };
    return ids.sort((a, b) => rank(a) - rank(b));
  });
  schedule.draws[sport] = next.tournaments[sport].drawnAt;
  schedule.assignments = schedule.assignments.filter(a => a.sport !== sport);
  schedule.calls = schedule.calls.filter(c => schedule.assignments.some(a => a.id === c.assignment));
  schedule.running = false;
  return next;
}
function identity(state: State, sport: Sport, id: string) {
  return state.tournaments[sport].players.find(p => p.id === id)?.studentId || sport + ':' + id;
}
export function dispatchTables(input: State, now = Date.now()): State {
  if (!input.schedule) return input;
  const state = structuredClone(input);
  const s = state.schedule!;
  const busy = new Set<string>();
  const rested = new Map<string, number>();
  for (const a of s.assignments) {
    const m = buildBracket(state.tournaments[a.sport]).flat().find(m => m.id === a.match);
    if (occupied(a) && (!m || a.players[0] !== m.a.id || a.players[1] !== m.b.id)) throw new Error('现场对局与晋级图不一致，请管理员核查。');
    if (occupied(a) && m?.resolved) {
      a.status = 'finished';
      a.finishedAt = now;
    }
    for (const id of a.players) {
      const key = identity(state, a.sport, id);
      if (occupied(a)) busy.add(key);
      if (a.status === 'finished') rested.set(key, Math.max(rested.get(key) ?? 0, (a.finishedAt ?? now) + 180000));
    }
  }
  // Project order breaks simultaneous cross-project conflicts deterministically.
  for (const sport of s.running ? SPORTS : []) {
    const t = state.tournaments[sport];
    if (s.draws[sport] !== t.drawnAt) continue;
    const matches = buildBracket(t).flat();
    for (let table = 1; table <= s.counts[sport]; table++) {
      if (s.assignments.some(a => a.sport === sport && a.table === table && occupied(a))) continue;
      const match = s.queues[sport].map(id => matches.find(m => m.id === id)).find(m =>
        m?.ready && !m.resolved &&
        !s.assignments.some(a => a.sport === sport && a.match === m.id && occupied(a)) &&
        [m.a.id!, m.b.id!].every(id => !busy.has(identity(state, sport, id)) && (rested.get(identity(state, sport, id)) ?? 0) <= now));
      if (!match) continue;
      const a: TableAssignment = { id: crypto.randomUUID(), sport, table, match: match.id,
        players: [match.a.id!, match.b.id!], status: 'called', calledAt: now };
      s.assignments.push(a);
      a.players.forEach(id => busy.add(identity(state, sport, id)));
      const names = a.players.map(id => t.players.find(p => p.id === id)!.name);
      const text = tableName(sport, table) + '，下一场，' + match.label.replace('1/4 决赛', '四分之一决赛') +
        '，' + names[0] + '对' + names[1] + '。请两位选手前往' + tableName(sport, table) + '准备比赛。';
      s.calls.push({ id: crypto.randomUUID(), assignment: a.id, text, createdAt: now });
    }
  }
  s.calls = s.calls.slice(-1024);
  return JSON.stringify(s) === JSON.stringify(input.schedule) ? input : state;
}
export function assertSafeCorrection(state: State, sport: Sport, id: string) {
  if (!state.schedule) return;
  const affected = new Set([id]);
  for (const m of buildBracket(state.tournaments[sport]).flat()) {
    if (affected.has(m.a.source) || affected.has(m.b.source)) affected.add(m.id);
  }
  if (state.schedule.assignments.some(a => a.sport === sport && a.match !== id && affected.has(a.match) && occupied(a))) {
    throw new Error('下游比赛已叫号或开赛。请先核实并取消未开赛叫号；进行中的对局须处理完后再更正。');
  }
}
export function validateSchedule(state: State) {
  const s = state.schedule;
  if (!s) return;
  if (!s.counts || !s.queues || !s.draws || !s.bindings || Array.isArray(s.bindings) ||
      !Array.isArray(s.assignments) || !Array.isArray(s.calls) || typeof s.running !== 'boolean') throw new Error('棋盘调度结构无效。');
  for (const sport of SPORTS) {
    if (!Number.isInteger(s.counts[sport]) || s.counts[sport] < 1 || s.counts[sport] > 30) throw new Error('每项目棋盘数须为 1 至 30。');
    if (!Array.isArray(s.queues[sport]) || s.queues[sport].length > 256 || new Set(s.queues[sport]).size !== s.queues[sport].length) throw new Error('候场顺序无效。');
    const ids = buildBracket(state.tournaments[sport]).flat().map(m => m.id);
    if (s.queues[sport].some(id => !ids.includes(id)) || typeof s.draws[sport] !== 'string') throw new Error('候场顺序与签位不匹配。');
    if (s.running && state.tournaments[sport].seeds.length && s.draws[sport] !== state.tournaments[sport].drawnAt) throw new Error('抽签批次发生变化，请重新配置调度。');
  }
  const tables = new Set<string>(), players = new Set<string>();
  for (const a of s.assignments) {
    if (!SPORTS.includes(a.sport) || !Number.isInteger(a.table) || a.table < 1 || a.table > s.counts[a.sport] ||
        !Array.isArray(a.players) || a.players.length !== 2 || !Number.isFinite(a.calledAt) ||
        !['called','playing','finished','cancelled'].includes(a.status)) throw new Error('棋盘占用记录无效。');
    if (!occupied(a)) continue;
    const key = tableKey(a.sport,a.table);
    if (tables.has(key)) throw new Error('同一棋盘重复占用。');
    tables.add(key);
    for (const id of a.players) {
      const player = identity(state,a.sport,id);
      if (players.has(player)) throw new Error('选手同时占用多个棋盘。');
      players.add(player);
    }
  }
  for (const keys of Object.values(s.bindings)) {
    if (!Array.isArray(keys) || keys.some(k => !SPORTS.some(sport => Array.from({length:s.counts[sport]},(_,i)=>tableKey(sport,i+1)).includes(k)))) throw new Error('裁判绑定桌号无效。');
  }
  if (s.calls.length > 1024 || s.calls.some(c => typeof c.id !== 'string' || typeof c.text !== 'string' || c.text.length > 500 || !Number.isFinite(c.createdAt))) throw new Error('叫号记录无效。');
}
