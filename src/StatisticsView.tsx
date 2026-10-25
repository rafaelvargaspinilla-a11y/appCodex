import {useMemo,useState} from 'react';
import {type Data} from './model';
import {resolvedCalendar,extractStatistics,performanceDate,record,weeklyImprovements,weekRange,monday,type Performance} from './statistics';
import {today} from './model';
const n=(v:number)=>v.toLocaleString('es-ES',{maximumFractionDigits:2});
const result=(r:Performance)=>`${r.weight===null?'—':n(r.weight)} ${r.unit} × ${r.reps}`;
const position=(r:Performance)=>`B${r.block} · S${r.week} · ${r.day}`;
export function StatisticsView({data}:{data:Data}){
 const calendar=resolvedCalendar(data);
 const {performances}=useMemo(()=>extractStatistics(data),[data]);
 const gains=weeklyImprovements(performances,calendar);
 const names=[...new Set(performances.map(r=>r.exercise))].sort((a,b)=>a.localeCompare(b,'es'));
 const [choice,setChoice]=useState(''),[block,setBlock]=useState(''),[variant,setVariant]=useState('');
 const name=names.includes(choice)?choice:names[0]??'';
 const exercise=performances.filter(r=>r.exercise===name);
 const variants=[...new Map(exercise.map(r=>[r.group,r])).values()];
 const rows=exercise.filter(r=>(!block||r.block===Number(block))&&(!variant||r.group===variant)&&r.reps>0).sort((a,b)=>performanceDate(b,calendar).localeCompare(performanceDate(a,calendar))||b.reps-a.reps);
 const blocks=[...new Set(exercise.map(r=>r.block))].sort((a,b)=>a-b);
 const history=[...new Map(rows.map(r=>[`${r.block}:${r.week}:${r.day}:${r.group}:${r.weight}`,r])).keys()].map(key=>record(rows.filter(r=>`${r.block}:${r.week}:${r.day}:${r.group}:${r.weight}`===key))!);
 return <div className="statistics-view simple-progress">
  <section className="panel weekly-gains"><p className="eyebrow">ESTA SEMANA</p><h2>Te has superado</h2><p className="small-note">{weekRange(monday(today()))} · frente a la semana anterior</p>
   {gains.length?<ul className="gains-list">{gains.map(g=><li key={g.exercise}><div><strong>{g.exercise}</strong><small>{result(g.before)} → {result(g.after)} · día {g.after.day}</small></div><div className="gain-badges">{g.weightGain>0&&<span>+{n(g.weightGain)} {g.after.unit}</span>}{g.repsGain>0&&<span>+{g.repsGain} reps</span>}</div></li>)}</ul>:<p className="muted gains-empty">Todavía no hay mejoras comparables esta semana.</p>}
  </section>
  <section className="panel exercise-history"><h2>Consulta por ejercicio</h2>
   {!names.length?<p className="muted">Completa series o importa tu histórico para consultar tu evolución.</p>:<>
    <label className="exercise-picker">Ejercicio<select aria-label="Ejercicio" value={name} onChange={e=>{setChoice(e.target.value);setVariant('');setBlock('');}}>{names.map(v=><option key={v}>{v}</option>)}</select></label>
    <details className="history-filters"><summary>Filtrar consulta</summary><div className="stats-filters"><label>Periodo<select aria-label="Periodo" value={block} onChange={e=>setBlock(e.target.value)}><option value="">Todo mi historial</option>{blocks.map(b=><option key={b} value={b}>Bloque {b}</option>)}</select></label><label>Variante, equipo y unidad<select aria-label="Variante, equipo y unidad" value={variant} onChange={e=>setVariant(e.target.value)}><option value="">Todas las variantes</option>{variants.map(r=><option key={r.group} value={r.group}>{r.scope} · {r.convention} · {r.unit}</option>)}</select></label></div></details>
    <div className="stats-table exercise-timeline">{history.map(r=><details key={r.id} className="history-performance"><summary><span>{position(r)}<small>{r.date??weekRange(performanceDate(r,calendar))}</small></span><strong>{result(r)}</strong></summary><p className="small-note">{r.scope} · {r.convention} · RIR {r.rir||'sin anotar'}</p><div className="original-stat">{rows.filter(s=>s.block===r.block&&s.week===r.week&&s.day===r.day&&s.group===r.group&&s.weight===r.weight).map(s=><p key={s.id}>{s.raw}</p>)}</div><p className="small-note">{r.source}</p></details>)}</div>
    {!rows.length&&<p className="muted">No hay registros para este filtro.</p>}
   </>}
  </section>
 </div>;
}
