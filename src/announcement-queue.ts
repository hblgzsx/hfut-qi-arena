// A result revision can arrive through save, Realtime and polling. Reserve it before delaying.
export class AnnouncementQueue<T extends {key:string}> {
  private seen=new Set<string>();
  private items:T[]=[];
  reserve(events:T[]):T[]{return events.filter(event=>{if(this.seen.has(event.key))return false;this.seen.add(event.key);return true;});}
  append(events:T[]){this.items.push(...events);}
  next(valid:(event:T)=>boolean):T|undefined{let event:T|undefined;while((event=this.items.shift()))if(valid(event))return event;}
}
