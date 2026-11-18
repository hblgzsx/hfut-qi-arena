import { ArrowUpRight, Clock3, MapPin } from 'lucide-react';
import { Board } from './Board';
import { SPORT_NAMES } from './engine';
import type { Sport } from './engine';

export function OverviewHero({ sport, status, time, venue, onBracket }: {
  sport: Sport;
  status: string;
  time: string;
  venue: string;
  onBracket: () => void;
}) {
  return <section className="hero">
    <div className="hero-copy">
      <div className="hero-kicker"><i />{SPORT_NAMES[sport]}<span />{status}</div>
      <h2>落子有声，<br /><span>热爱有回响。</span></h2>
      <button className="button dark" onClick={onBracket}>查看实时对阵 <ArrowUpRight size={17} /></button>
      <div className="hero-location">
        <span><Clock3 size={15} />{time}</span>
        <span className="hero-venue"><MapPin size={15} />{venue}</span>
      </div>
    </div>
    <div className="hero-art">
      <div className="hero-board-frame">
        <div className="hero-board-label"><span>{sport === 'gomoku' ? 'GOMOKU' : 'JUNQI'}</span><span>{sport === 'gomoku' ? '15 × 15' : '5 × 12'}</span></div>
        <div className="board-perspective"><Board key={sport} sport={sport} /></div>
      </div>
    </div>
  </section>;
}
