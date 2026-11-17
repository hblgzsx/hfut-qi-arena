export interface TournamentRules { bronzeCount:0|1|2; preliminary:1|3; quarterfinal:1|3; semifinal:1|3; final:1|3; bronze:1|3; overrides:Record<string,1|3> }
export function defaultRules():TournamentRules{return {bronzeCount:2,preliminary:1,quarterfinal:3,semifinal:3,final:3,bronze:3,overrides:{}};}
export function validateRules(value:unknown):TournamentRules{
 const r=value as TournamentRules;
 if(!r||![0,1,2].includes(r.bronzeCount)||['preliminary','quarterfinal','semifinal','final','bronze'].some(k=>![1,3].includes(r[k as keyof TournamentRules] as number))||!r.overrides||typeof r.overrides!=='object'||Array.isArray(r.overrides)||Object.entries(r.overrides).some(([id,bo])=>! /^(R[1-8]-M([1-9]|[1-9]\d|1[01]\d|12[0-8])|BRONZE)$/.test(id)||![1,3].includes(bo)))throw new Error('竞赛规则无效：季军为 0、1 或 2 名，赛制仅支持一局制或三局两胜。');
 return r;
}
