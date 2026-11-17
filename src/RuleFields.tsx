import type {TournamentRules} from './tournament-rules';
export function RuleFields({value,onChange,prefix=''}:{value:TournamentRules;onChange:(value:TournamentRules)=>void;prefix?:string}){
 const labels={preliminary:'其余轮次',quarterfinal:'四分之一决赛',semifinal:'半决赛',final:'决赛',bronze:'季军争夺赛'} as const;
 return <><label>季军人数<select aria-label={prefix+'季军人数'} value={value.bronzeCount} onChange={e=>onChange({...value,bronzeCount:Number(e.target.value) as 0|1|2})}><option value={0}>0 名 · 不设季军</option><option value={1}>1 名 · 增加季军争夺赛</option><option value={2}>2 名 · 半决赛负方并列（默认）</option></select></label><div className="form-grid">{Object.entries(labels).map(([key,label])=><label key={key}>{label}<select aria-label={prefix+label} value={value[key as keyof typeof labels]} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}><option value={1}>一局定胜负</option><option value={3}>三局两胜</option></select></label>)}</div></>;
}
