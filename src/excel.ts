import { emptyTournament, validatePlayers } from './engine';
import type { Player, Sport } from './engine';
export interface ImportPreview { players: Record<Sport, Player[]>; issues: string[]; warnings: string[]; fileName: string }
const normalize = (s: unknown) => String(s ?? '').replace(/[\s（()）_：:]/g, '').toLowerCase();
const aliases: Record<keyof Omit<Player, 'id'>, string[]> = {
  name: ['姓名', '名字', '参赛姓名'], studentId: ['学号', '学生学号'], college: ['学院', '所在学院'],
  phone: ['联系方式', '联系电话', '手机号', '手机号码', '电话'], qq: ['QQ', 'QQ号', 'QQ号码', '联系方式QQ'], gender: ['性别'],
};
export async function readRegistration(file: File): Promise<ImportPreview> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('请选择 .xlsx 格式报名表。');
  if (file.size > 10 * 1024 * 1024) throw new Error('报名表不能超过 10 MB。');
  const XLSX = await import('xlsx');
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellText: true });
  const preview: ImportPreview = { players: { gomoku: [], junqi: [] }, issues: [], warnings: [], fileName: file.name };
  for (const sport of ['gomoku', 'junqi'] as Sport[]) {
    const label = sport === 'gomoku' ? '五子棋' : '军棋';
    const sheets = book.SheetNames.filter(n => sport === 'gomoku' ? n.includes('五子棋') : /军棋|军旗/.test(n));
    if (sheets.length !== 1) { preview.issues.push(`${label}：需要且只能有一个名称含“${label}”的工作表（军旗也可识别）。`); continue; }
    const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[sheets[0]], { header: 1, defval: '', raw: false, blankrows: true });
    const headerIndex = rows.findIndex(row => row.some(c => normalize(c) === '姓名') && row.some(c => normalize(c) === '学号'));
    if (headerIndex < 0) { preview.issues.push(`${label}：找不到同时含“姓名”“学号”的表头。`); continue; }
    const header = rows[headerIndex].map(normalize);
    const columns = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, header.findIndex(h => names.map(normalize).includes(h))])) as Record<keyof Omit<Player, 'id'>, number>;
    if (columns.college < 0) preview.warnings.push(`${label}：缺少学院列，导入后显示“未填写”。`);
    for (let r = headerIndex + 1; r < rows.length; r++) {
      const row = rows[r]; if (row.every(c => !String(c).trim())) continue;
      const get = (key: keyof typeof columns) => String(row[columns[key]] ?? '').trim();
      const name = get('name'), studentId = get('studentId');
      if (!name || !studentId) { preview.issues.push(`${label}第 ${r + 1} 行：姓名或学号为空。`); continue; }
      if (/e\+|\d\.\d/i.test(studentId)) { preview.issues.push(`${label}第 ${r + 1} 行：学号显示为科学计数法或小数，请在 Excel 中改为完整文本。`); continue; }
      preview.players[sport].push({ id: crypto.randomUUID(), name, studentId, college: get('college') || '未填写', phone: get('phone'), qq: get('qq'), gender: get('gender') });
    }
    try { validatePlayers(preview.players[sport]); } catch (error) { preview.issues.push(`${label}：${(error as Error).message}`); }
    if (preview.players[sport].length < 2) preview.warnings.push(`${label}不足 2 人，可以保存名单，但不能抽签开赛。`);
  }
  const both = preview.players.gomoku.filter(p => preview.players.junqi.some(q => q.studentId === p.studentId));
  if (both.length) preview.warnings.push(`${both.length} 人同时报名两项目；两场同时举行，请主办方协调场次：${both.map(p => p.name).join('、')}。`);
  return preview;
}
export function importedTournament(sport: Sport, players: Player[]) { return { ...emptyTournament(sport), players }; }
export function download(name: string, content: Blob) {
  const url = URL.createObjectURL(content), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportResults(t: ReturnType<typeof emptyTournament>, rows: Record<string, string | number>[]) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  // Cell values are written as strings, never interpreted as formula expressions.
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '比赛记录');
  XLSX.writeFile(workbook, `${t.sport === 'gomoku' ? '五子棋' : '军棋'}-比赛记录.xlsx`);
}
