import { estimatedWeek,weekDate,weekRange,type CalendarConfig } from './statistics';
import { useMemo,useState } from 'react';
import { historicalSessions,type HistoricalSession } from './history';
import { historyDate,positionKey } from './completed';
import type { Data } from './model';
export function ArchiveView({data,calendar}:{data:Data;calendar:CalendarConfig}){
  const [block,setBlock]=useState(''),[week,setWeek]=useState(''),[day,setDay]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(20);
  const all=useMemo(()=>{
    const records=historicalSessions(data.history),known=new Set([...records,...data.sessions].map(positionKey));
    const extras=new Map<string,HistoricalSession>();
    for(const r of data.excel?.days??[]){
      if(!r.day||known.has(positionKey({...r,day:r.day})))continue;
      const key=positionKey({...r,day:r.day});
      const source=data.excel?.sources.find(s=>s.id===r.sourceId)?.name??'Excel';
      const entry=extras.get(key)??{id:`excel-session-${key}`,block:r.block,week:r.week,day:r.day,source,lines:[]};
      entry.lines.push({number:r.row,text:`${r.date} · ${r.training}${r.performance?' · rendimiento: '+r.performance:''}`,warning:'Entrenamiento anotado en Excel. No hay resultados de series en el TXT.'});extras.set(key,entry);
    }
    return [...records,...extras.values()].sort((a,b)=>weekDate(b.block,b.week,calendar).localeCompare(weekDate(a.block,a.week,calendar))||['A','B','C','Brazos'].indexOf(b.day)-['A','B','C','Brazos'].indexOf(a.day));
  },[data.history,data.excel,data.sessions,calendar]);
  const filtered=all.filter(s=>(!block||s.block===Number(block))&&(!week||s.week===Number(week))&&(!day||s.day===day)&&(!query||s.lines.some(l=>l.text.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')))));
  return <section className="panel archive-panel"><div className="section-heading"><h2>Entrenamientos importados</h2><span className="pill">{all.length} sesiones</span></div><p className="muted">Todo tu historial, con filtros opcionales. Los TXT conservan sus resultados originales; los Excel añaden fechas y entrenamientos que no estaban anotados en esos archivos.</p><div className="session-fields"><label>Filtrar bloque<select aria-label="Filtrar bloque" value={block} onChange={e=>{setBlock(e.target.value);setWeek('');setLimit(20);}}><option value="">Todos</option>{[...new Set(all.map(s=>s.block))].sort((a,b)=>a-b).map(b=><option key={b}>{b}</option>)}</select></label><label>Filtrar semana<select aria-label="Filtrar semana" value={week} onChange={e=>{setWeek(e.target.value);setLimit(20);}}><option value="">Todas</option>{[...new Set(all.filter(s=>!block||s.block===Number(block)).map(s=>s.week))].sort((a,b)=>a-b).map(w=><option key={w}>{w}</option>)}</select></label><label>Filtrar día<select aria-label="Filtrar día" value={day} onChange={e=>{setDay(e.target.value);setLimit(20);}}><option value="">Todos</option>{['A','B','C','Brazos'].map(d=><option key={d}>{d}</option>)}</select></label></div><label>Buscar ejercicio o anotación<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}} placeholder="Ej. prensa, 39kg, cluster…"/></label><p className="small-note">{filtered.length} sesiones encontradas. No se inventan resultados de series.</p>{filtered.slice(0,limit).map(s=>{
    const date=historyDate(data,s),matches=(data.excel?.days??[]).filter(r=>r.day===s.day&&r.block===s.block&&r.week===s.week);
    return <details className="archive-session" key={s.id}><summary>Bloque {s.block} · Semana {s.week} · {s.day==='Brazos'?'Brazos':`Día ${s.day}`}{date&&` · ${date}`}</summary><p className="small-note">{s.source} · {date?`Fecha del Excel: ${date}`:`${estimatedWeek(s.block,s.week,calendar)?'Semana estimada':'Semana del Excel'}: ${weekRange(weekDate(s.block,s.week,calendar))}`}</p>{new Set(matches.map(r=>r.date)).size>1&&<p className="inline-error">Hay varias fechas del Excel para esta sesión. Se conserva la semana sin elegir un día: {[...new Set(matches.map(r=>r.date))].join(', ')}.</p>}{s.lines.map((l,i)=><div className="archive-line" key={`${l.number}-${i}`}>{l.warning&&<p className="inline-error">{l.warning}</p>}<p>{l.text}</p></div>)}{(data.excel?.notes??[]).filter(n=>n.block===s.block&&n.week===s.week).map((n,i)=><p className="small-note" key={i}>{n.category}: {n.text}</p>)}</details>;
  })}{filtered.length>limit&&<button className="secondary" onClick={()=>setLimit(limit+20)}>Mostrar 20 más</button>}</section>;
}
