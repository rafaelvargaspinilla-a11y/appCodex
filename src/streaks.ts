import {days,today,type Data} from './model';
import {trainingPositions,historyDate,positionKey} from './completed';
import {monday,resolvedCalendar,weekDate} from './statistics';
const shift=(date:string,offset:number)=>new Date(Date.parse(`${date}T12:00:00Z`)+offset*86400000).toISOString().slice(0,10);
export function trainingStreaks(data:Data,date=today()):{days:number;weeks:number}{
 const dates=new Set<string>(),weeks=new Map<string,Set<string>>(),calendar=resolvedCalendar(data);
 for(const p of trainingPositions(data).filter(p=>p.finished)){
  const session=data.sessions.filter(s=>s.finished&&positionKey(s)===positionKey(p)).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const exact=session?.date??historyDate(data,p);
  if(exact&&exact>date)continue;
  if(exact)dates.add(exact);
  const week=exact?monday(exact):weekDate(p.block,p.week,calendar);
  if(week>monday(date))continue;
  const completed=weeks.get(week)??new Set<string>();completed.add(p.day);weeks.set(week,completed);
 }
 let dayCursor=dates.has(date)?date:shift(date,-1),dayStreak=0;
 while(dates.has(dayCursor)){dayStreak++;dayCursor=shift(dayCursor,-1);}
 const complete=(week:string)=>days.every(day=>weeks.get(week)?.has(day));
 let weekCursor=monday(date),weekStreak=0;
 if(!complete(weekCursor))weekCursor=shift(weekCursor,-7);
 while(complete(weekCursor)){weekStreak++;weekCursor=shift(weekCursor,-7);}
 return {days:dayStreak,weeks:weekStreak};
}
