import {days,today,type Data} from './model';
import {trainingPositions,historyDate,positionKey} from './completed';
import {resolvedCalendar,ordinal} from './statistics';
export function trainingStreaks(data:Data,date=today()):{days:number;weeks:number}{
 const completedDays=new Set<number>(),weeks=new Map<number,Set<string>>(),calendar=resolvedCalendar(data);
 for(const p of trainingPositions(data).filter(p=>p.finished)){
  const session=data.sessions.filter(s=>s.finished&&positionKey(s)===positionKey(p)).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const exact=session?.date??historyDate(data,p);
  if(exact&&exact>date)continue;
  const week=ordinal(p.block,p.week,calendar);
  completedDays.add(week*days.length+days.indexOf(p.day));
  const completed=weeks.get(week)??new Set<string>();completed.add(p.day);weeks.set(week,completed);
 }
 const pending=data.sessions.filter(s=>!s.finished&&s.date<=date);
 let dayCursor=Math.max(-1,...completedDays,...pending.map(s=>ordinal(s.block,s.week,calendar)*days.length+days.indexOf(s.day))),dayStreak=0;
 if(!completedDays.has(dayCursor))dayCursor--;
 while(completedDays.has(dayCursor)){dayStreak++;dayCursor--;}
 const complete=(week:number)=>days.every(day=>weeks.get(week)?.has(day));
 // Training weeks stay together even if A/B/C/Brazos straddle calendar weeks.
 const open=pending.map(s=>ordinal(s.block,s.week,calendar));
 let weekCursor=Math.max(-1,...weeks.keys(),...open),weekStreak=0;
 if(!complete(weekCursor))weekCursor--;
 while(complete(weekCursor)){weekStreak++;weekCursor--; }
 return {days:dayStreak,weeks:weekStreak};
}
