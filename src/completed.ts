import { historicalSessions } from './history';
import type { Data,Day } from './model';
export type CompletedPosition={block:number;week:number;day:Day;finished:boolean};
export const positionKey=(s:{block:number;week:number;day:Day})=>`${s.block}:${s.week}:${s.day}`;
export function trainingPositions(data:Data):CompletedPosition[]{
  const map=new Map<string,CompletedPosition>();
  for(const s of historicalSessions(data.history))map.set(positionKey(s),{block:s.block,week:s.week,day:s.day,finished:true});
  for(const s of data.excel?.days??[])if(s.day)map.set(positionKey({...s,day:s.day}),{block:s.block,week:s.week,day:s.day,finished:true});
  for(const s of data.sessions){const key=positionKey(s);const old=map.get(key);map.set(key,{block:s.block,week:s.week,day:s.day,finished:s.finished||old?.finished===true});}
  return [...map.values()];
}
export function historyDate(data:Data,s:{block:number;week:number;day:Day}):string|null{
  const dates=[...new Set((data.excel?.days??[]).filter(r=>r.block===s.block&&r.week===s.week&&r.day===s.day).map(r=>r.date))];
  return dates.length===1?dates[0]:null;
}
