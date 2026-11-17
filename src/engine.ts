import {defaultRules,validateRules} from './tournament-rules.ts';
import type {TournamentRules} from './tournament-rules.ts';
import { validateEvent } from './event-settings.ts';
import type { EventSettings } from './event-settings.ts';
export type Sport = 'gomoku' | 'junqi';
export type Outcome = 'A' | 'B' | 'D';
export interface Player { id: string; name: string; studentId: string; college: string; phone: string; qq: string; gender: string }
export interface Result { kind: 'played' | 'forfeit' | 'double' | 'adjudicated'; games: Outcome[]; winner?: 'A' | 'B'; reason: string; referee: string; first: 'A' | 'B'; updatedAt: string }
export interface Tournament { rules?:TournamentRules; sport: Sport; players: Player[]; seeds: (string | null)[]; drawSeed: string; drawnAt: string; results: Record<string, Result>; mode: 'flip' | 'layout'; demo: boolean }
export interface Prize { rank: string; name: string; description: string; image: string }
export interface Audit { id: string; time: string; sport: Sport; message: string }
export interface State { version: 1; revision: string; event?:EventSettings; tournaments: Record<Sport, Tournament>; prizes: Record<Sport, Prize[]>; audit: Audit[] }
export interface Slot { id: string | null; settled: boolean; source: string }
export interface Match { id: string; round: number; index: number; label: string; bestOf: 1 | 3; a: Slot; b: Slot; score: [number, number]; result?: Result; resolved: boolean; winner: string | null; bye: boolean; ready: boolean }

export const SPORT_NAMES: Record<Sport, string> = { gomoku: '五子棋', junqi: '军棋' };
export function emptyTournament(sport: Sport): Tournament { return { sport, rules:defaultRules(), players: [], seeds: [], drawSeed: '', drawnAt: '', results: {}, mode: 'flip', demo: false }; }
export function emptyState(): State { return { version: 1, revision: crypto.randomUUID(), tournaments: { gomoku: emptyTournament('gomoku'), junqi: emptyTournament('junqi') }, prizes: { gomoku: defaultPrizes(), junqi: defaultPrizes() }, audit: [] }; }
export function defaultPrizes(): Prize[] { return [ { rank: '冠军', name: '冠军奖品', description: '1 名 · 精美奖品与荣誉奖状', image: '' }, { rank: '亚军', name: '亚军奖品', description: '1 名 · 精美奖品与荣誉奖状', image: '' }, { rank: '季军', name: '季军奖品', description: '并列 2 名 · 精美奖品与荣誉奖状', image: '' } ]; }
export function bracketSize(n: number): number { return n < 2 ? 0 : 2 ** Math.ceil(Math.log2(n)); }
export function roundLabel(round: number, total: number): string {
  const remaining = total - round;
  if (remaining === 1) return '决赛';
  if (remaining === 2) return '半决赛';
  if (remaining === 3) return '1/4 决赛';
  return `初赛第${round + 1}轮`;
}
export function bestOf(round: number, total: number): 1 | 3 { return total - round <= 3 ? 3 : 1; }
export function tournamentRules(t:Tournament):TournamentRules{return t.rules??defaultRules();}
export function matchBestOf(t:Tournament,round:number,total:number,id:string):1|3{
 if(!t.rules)return total-round<=2||round>=2?3:1; // Preserve already drawn legacy competitions.
 const r=t.rules;return r.overrides[id]??(id==='BRONZE'?r.bronze:total-round===1?r.final:total-round===2?r.semifinal:total-round===3?r.quarterfinal:r.preliminary);
}
export function scoreGames(games: Outcome[]): [number, number] { return [games.filter(g => g === 'A').length, games.filter(g => g === 'B').length]; }

// Replayable, uniform draw: Fisher-Yates, followed by evenly dispersed byes.
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shuffle<T>(values: T[], random: () => number): T[] {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function draw(t: Tournament, seed: string = crypto.randomUUID()): Tournament {
  if (t.players.length < 2) throw new Error('至少需要 2 名选手才能抽签开赛，单人不自动授予冠军。');
  if (t.players.length > 256) throw new Error('单个项目最多支持 256 人。');
  validatePlayers(t.players);
  const random = seededRandom(seed), players = shuffle(t.players.map(p => p.id), random);
  const size = bracketSize(players.length), byes = size - players.length;
  const pairIndexes = shuffle(Array.from({ length: size / 2 }, (_, i) => i), random);
  const byePairs = new Set(pairIndexes.slice(0, byes));
  const seeds: (string | null)[] = [];
  for (let i = 0; i < size / 2; i++) {
    const a = players.pop()!;
    const b = byePairs.has(i) ? null : players.pop()!;
    seeds.push(...(random() < .5 ? [a, b] : [b, a]));
  }
  return { ...t, seeds, drawSeed: seed, drawnAt: new Date().toISOString(), results: {} };
}
export function buildBracket(t: Tournament): Match[][] {
  if (!t.seeds.length) return [];
  const total = Math.log2(t.seeds.length), rounds: Match[][] = [];
  for (let r = 0; r < total; r++) {
    const matches: Match[] = [];
    for (let i = 0; i < t.seeds.length / 2 ** (r + 1); i++) {
      const id = `R${r + 1}-M${i + 1}`;
      const from = (j: number): Slot => { const m = rounds[r - 1][j]; return { id: m.resolved ? m.winner : null, settled: m.resolved, source: m.id }; };
      const a: Slot = r === 0 ? { id: t.seeds[i * 2], settled: true, source: '抽签席位' } : from(i * 2);
      const b: Slot = r === 0 ? { id: t.seeds[i * 2 + 1], settled: true, source: '抽签席位' } : from(i * 2 + 1);
      const ready = a.settled && b.settled && !!a.id && !!b.id;
      const bye = a.settled && b.settled && (!a.id || !b.id);
      const result = ready ? t.results[id] : undefined;
      const score = scoreGames(result?.games ?? []);
      const bo = matchBestOf(t,r,total,id), target = bo === 1 ? 1 : 2;
      let resolved = bye, winner: string | null = bye ? a.id || b.id : null;
      if (result?.kind === 'double') { resolved = true; winner = null; }
      if (result?.kind === 'forfeit' || result?.kind === 'adjudicated') { resolved = true; winner = result.winner === 'A' ? a.id : b.id; }
      if (result?.kind === 'played' && Math.max(...score) >= target) { resolved = true; winner = score[0] >= target ? a.id : b.id; }
      matches.push({ id, round: r, index: i, label: roundLabel(r, total), bestOf: bo, a, b, score, result, resolved, winner, bye, ready });
    }
    rounds.push(matches);
  }
  if(t.rules?.bronzeCount===1&&total>=2){
    const semis=rounds[total-2];
    const slot=(m:Match):Slot=>({id:m.resolved&&m.winner&&['played','adjudicated'].includes(m.result?.kind??'')?([m.a.id,m.b.id].find(id=>id!==m.winner)??null):null,settled:m.resolved,source:m.id});
    const a=slot(semis[0]),b=slot(semis[1]),ready=a.settled&&b.settled&&!!a.id&&!!b.id,bye=a.settled&&b.settled&&(!a.id||!b.id),result=ready?t.results.BRONZE:undefined,score=scoreGames(result?.games??[]),bo=matchBestOf(t,total-1,total,'BRONZE');
    let resolved=bye,winner:string|null=null;
    if(result?.kind==='double')resolved=true;
    if(result?.kind==='forfeit'||result?.kind==='adjudicated'){resolved=true;winner=result.winner==='A'?a.id:b.id;}
    if(result?.kind==='played'&&Math.max(...score)>=(bo===1?1:2)){resolved=true;winner=score[0]>=(bo===1?1:2)?a.id:b.id;}
    // A single eligible semifinal loser does not receive an invented playoff win.
    rounds[total-1].push({id:'BRONZE',round:total-1,index:1,label:'季军争夺赛',bestOf:bo,a,b,ready,bye,result,score,resolved,winner});
  }
  return rounds;
}
export function descendants(t: Tournament, id: string): string[] {
  const matches=buildBracket(t).flat(),affected=new Set<string>([id]),list:string[]=[];
  for(const m of matches)if(m.id!==id&&(affected.has(m.a.source)||affected.has(m.b.source))){affected.add(m.id);list.push(m.id);}
  return list;
}
export function validateResult(m: Match, result: Result) {
  if (!m.ready) throw new Error('双方选手尚未确定，不能录入成绩。');
  if (!['played', 'forfeit', 'double', 'adjudicated'].includes(result.kind)) throw new Error('无效的判定类型。');
  if (!['A', 'B'].includes(result.first)) throw new Error('请选择首局先手方。');
  if (!result.referee.trim()) throw new Error('请填写裁判姓名。');
  if (result.kind !== 'played') {
    if (!result.reason.trim()) throw new Error('弃权或取消资格必须填写裁判说明。');
    if ((result.kind === 'forfeit' || result.kind === 'adjudicated') && !['A', 'B'].includes(result.winner ?? '')) throw new Error('请选择获胜方。');
    if (result.games.length) throw new Error('弃权判定不应伪造局分，请清空局分。');
    return;
  }
  if (!result.games.length) throw new Error('请至少录入一局结果。');
  if (result.games.length > 50) throw new Error('最多记录 50 局（含和棋），请联系裁判长。');
  const score = [0, 0], target = m.bestOf === 1 ? 1 : 2;
  for (const g of result.games) {
    if (score.some(x => x >= target)) throw new Error('胜负已定，不能再录入额外对局。');
    if (!['A', 'B', 'D'].includes(g)) throw new Error('无效的单局结果。');
    if (g !== 'D') score[g === 'A' ? 0 : 1]++;
  }
}
export function setResult(t: Tournament, id: string, result: Result | null): Tournament {
  const m = buildBracket(t).flat().find(x => x.id === id);
  if (!m) throw new Error('比赛不存在。');
  if (result) validateResult(m, result);
  const results = { ...t.results };
  for (const child of descendants(t, id)) delete results[child];
  if (result) results[id] = result; else delete results[id];
  return { ...t, results };
}
export function standings(t: Tournament): { champion: string | null; runnerUp: string | null; bronze: string[] } {
  const rounds = buildBracket(t), final = rounds.at(-1)?.[0];
  const champion = final?.resolved ? final.winner : null;
  const runnerUp = final?.resolved && champion && ['played','adjudicated'].includes(final.result?.kind??'') ? [final.a.id, final.b.id].find(id => id !== champion) ?? null : null;
  // A disqualified / absent player does not receive a podium place automatically.
  const bronze = rounds.at(-2)?.filter(m => m.resolved && m.winner && ['played','adjudicated'].includes(m.result?.kind??'')).map(m => [m.a.id, m.b.id].find(id => id !== m.winner)!).filter((id): id is string => !!id) ?? [];
  const count=t.rules?.bronzeCount??2,playoff=rounds.at(-1)?.find(m=>m.id==='BRONZE');
  return { champion, runnerUp, bronze:count===0?[]:count===1?(playoff?.resolved&&playoff.winner?[playoff.winner]:[]):bronze };
}
export function validatePlayers(players: Player[]) {
  const ids = new Set<string>(), studentIds = new Set<string>();
  if (players.length > 256) throw new Error('每个项目最多支持 256 名选手。');
  for (const p of players) {
    if (!p || ['id', 'name', 'studentId', 'college', 'gender'].some(k => typeof (p as unknown as Record<string, unknown>)[k] !== 'string')) throw new Error('选手资料格式不正确。');
    if (!p.id || !p.name.trim() || !p.studentId.trim()) throw new Error('姓名和学号不能为空。');
    if (p.name.length > 40 || p.studentId.length > 40 || p.college.length > 100 || p.gender.length > 20) throw new Error('选手资料字段过长。');
    if (ids.has(p.id) || studentIds.has(p.studentId)) throw new Error(`学号 ${p.studentId} 重复，请先核对报名表。`);
    ids.add(p.id); studentIds.add(p.studentId);
  }
}
export function validateState(input: unknown): State {
  if (!input || typeof input !== 'object') throw new Error('无效的备份文件。');
  const s = input as State;
  if(s.event!==undefined)validateEvent(s.event);
  if (s.version !== 1 || typeof s.revision !== 'string' || !s.tournaments || !s.prizes || !Array.isArray(s.audit)) throw new Error('备份版本或结构不受支持。');
  for (const sport of ['gomoku', 'junqi'] as Sport[]) {
    const t = s.tournaments[sport];
    if (!t || t.sport !== sport || !Array.isArray(t.players) || !Array.isArray(t.seeds) || !t.results || typeof t.results !== 'object' || Array.isArray(t.results) || !['flip', 'layout'].includes(t.mode) || typeof t.demo !== 'boolean' || typeof t.drawSeed !== 'string' || typeof t.drawnAt !== 'string') throw new Error('赛事资料不完整。');
    if(t.rules)validateRules(t.rules);
    t.players=t.players.map(p=>{const {phone,qq,...safe}=p;void phone;void qq;return safe as Player;});
    validatePlayers(t.players);
    if (t.seeds.length) {
      if (t.seeds.length !== bracketSize(t.players.length)) throw new Error('签位数量与选手人数不匹配。');
      const actual = t.seeds.filter(id => id !== null);
      if (actual.length !== t.players.length || new Set(actual).size !== actual.length || actual.some(id => !t.players.some(p => p.id === id))) throw new Error('签位包含重复或不存在的选手。');
      for (let i = 0; i < t.seeds.length; i += 2) if (!t.seeds[i] && !t.seeds[i + 1]) throw new Error('首轮包含空对局。');
    } else if (Object.keys(t.results).length) throw new Error('未抽签的赛事不应包含成绩。');
    const matches = buildBracket(t).flat();
    for (const [id, result] of Object.entries(t.results)) {
      const m = matches.find(m => m.id === id);
      if (!m || !result || !Array.isArray(result.games) || typeof result.reason !== 'string' || typeof result.referee !== 'string' || typeof result.updatedAt !== 'string') throw new Error('比赛成绩结构异常。');
      validateResult(m, result);
    }
    if (!Array.isArray(s.prizes[sport]) || s.prizes[sport].length !== 3 || s.prizes[sport].some(p => !p || [p.rank, p.name, p.description, p.image].some(v => typeof v !== 'string') || p.name.length > 80 || p.description.length > 200 || p.image.length > 500000 || (p.image && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.image)))) throw new Error('奖品资料不正确。');
  }
  if (s.audit.length > 200 || s.audit.some(a => !a || !['gomoku', 'junqi'].includes(a.sport) || [a.id, a.time, a.message].some(v => typeof v !== 'string'))) throw new Error('操作记录不正确。');
  return s;
}
export function demoState(): State {
  const s = emptyState();
  const names = ['林知远', '陈思宁', '许亦安', '周予墨', '沈星河', '李书瑶', '王景行', '苏晚晴', '赵一诺', '刘沐言', '张明轩', '何嘉禾', '吴清越', '郑子衿', '方以恒', '陆听澜'];
  const colleges = ['计算机与信息学院', '经济学院', '建筑与艺术学院', '外国语学院', '微电子学院'];
  for (const sport of ['gomoku', 'junqi'] as Sport[]) {
    const count = sport === 'gomoku' ? 16 : 7;
    const players = names.slice(0, count).map((name, i) => ({ id: `${sport}-${i}`, name, studentId: `2026${sport === 'gomoku' ? '01' : '02'}${String(i + 1).padStart(4, '0')}`, college: colleges[i % 5], gender: i % 2 ? '女' : '男', phone: '', qq: '' }));
    let t = draw({ ...emptyTournament(sport), players, demo: true }, `HFUT-DEMO-${sport}`);
    const matches = buildBracket(t)[0].filter(m => m.ready).slice(0, sport === 'gomoku' ? 3 : 1);
    for (const m of matches) t = setResult(t, m.id, { kind: 'played', games: m.bestOf===1?['A']:['A','A'], reason: '', referee: '演示裁判', first: 'A', updatedAt: new Date().toISOString() });
    s.tournaments[sport] = t;
  }
  return s;
}

export function configureRules(t:Tournament,rules:TournamentRules):Tournament{
 validateRules(rules);
 const next={...t,rules:structuredClone(rules)};
 // Never reinterpret a score after any game has been recorded.
 for(const [id,result] of Object.entries(t.results)){
  const before=buildBracket(t).flat().find(m=>m.id===id),after=buildBracket(next).flat().find(m=>m.id===id);
  if(!after||before?.bestOf!==after.bestOf)throw new Error('已有成绩的场次不可更改赛制；请先由管理员撤销相关成绩。');
  if(after.a.id!==before?.a.id||after.b.id!==before?.b.id)throw new Error('规则变更影响已有对局，请先撤销相关成绩。');
  validateResult(after,result);
 }
 if((t.rules?.bronzeCount??2)!==rules.bronzeCount&&Object.keys(t.results).length)throw new Error('已有比赛成绩，不能更改季军人数；请在开赛前确定奖项。');
 return next;
}
