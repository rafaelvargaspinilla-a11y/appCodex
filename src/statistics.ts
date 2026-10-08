import { historicalSessions } from './history';
import type { Data, Day } from './model';
export type CalendarConfig = { anchorDate: string; block: number; week: number; lengths: Record<string, number> };
export type Performance = { id: string; exercise: string; group: string; scope: string; unit: string; convention: string; block: number; week: number; day: Day; date: string | null; weight: number | null; reps: number; rir: string; partials: number | null; failure: boolean; raw: string; source: string };
export type Review = { id: string; block: number; week: number; day: Day; raw: string; reason: string };
const DAY_MS = 86400000;
export function monday(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0,10);
}
export function defaultCalendar(data: Data): CalendarConfig {
  const lengths: Record<string, number> = {};
  for (const file of data.history?.files ?? []) {
    const block = Number(file.text.match(/^\s*Bloque\s+(\d+)\s*$/mi)?.[1]);
    const weeks = [...file.text.matchAll(/^\s*Semana\s+(\d+)\s*$/gmi)].map(m=>Number(m[1]));
    if (block) lengths[block] = Math.max(1,...weeks);
  }
  for(const session of data.sessions) lengths[session.block]=Math.max(lengths[session.block]??0,session.week);
  lengths[7]=Math.max(5,lengths[7]??5);
  // Fixed reference supplied in this conversation. Never shift old records on a later visit.
  return { anchorDate: '2026-10-05', block: 7, week: 5, lengths: { 1:12,2:12,3:11,4:10,5:12,6:12,7:5,...lengths } };
}
export function ordinal(block: number, week: number, calendar: CalendarConfig): number {
  let n = week - 1;
  n += Math.max(0,block-1)*12;
  for(const [key,length] of Object.entries(calendar.lengths)) if(Number(key)<block) n += length-12;
  return n;
}
export function weekDate(block: number, week: number, calendar: CalendarConfig): string {
  const offset = ordinal(block,week,calendar)-ordinal(calendar.block,calendar.week,calendar);
  return new Date(Date.parse(`${monday(calendar.anchorDate)}T12:00:00Z`)+offset*7*DAY_MS).toISOString().slice(0,10);
}
export function weekRange(date: string): string {
  const end = new Date(Date.parse(`${date}T12:00:00Z`)+6*DAY_MS).toISOString().slice(0,10);
  const label = (d:string)=>new Date(`${d}T12:00:00Z`).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  return `${label(date)} — ${label(end)}`;
}
export function canonical(name: string, day: Day): string {
  const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  if (/elevaciones.*piernas|elevaciones piernas/.test(n)) return 'Elevaciones de piernas colgado';
  if (/laterales/.test(n)) {
    if (/polea|en [iy]\b/.test(n)) return /\by\b/.test(n) ? 'Elevaciones laterales en polea Y' : /\bi\b/.test(n) ? 'Elevaciones laterales en polea I' : 'Elevaciones laterales en polea';
    return 'Elevaciones laterales';
  }
  if (/press.*muy inclinado/.test(n)) return 'Press muy inclinado con mancuernas';
  if (/press inclinado.*mancuerna/.test(n)) return 'Press inclinado con mancuernas';
  if (/remo.*mancuerna/.test(n)) return 'Remo con mancuerna';
  if (/predicador/.test(n)) return 'Curl predicador con mancuerna';
  if (/femoral/.test(n)) {
    if (/pie|unilateral/.test(n)) return 'Curl femoral de pie unilateral';
    if (/sentado/.test(n)) return 'Curl femoral sentado';
    if (/tumbado/.test(n)) return 'Curl femoral tumbado';
    return 'Curl femoral (variante sin confirmar)';
  }
  if (/sentadilla frontal/.test(n)) return 'Sentadilla frontal';
  if (/hack/.test(n)) return 'Sentadilla hack';
  if (/press estrecho.*multipower/.test(n)) return 'Press estrecho en multipower';
  if (/press estrecho.*mancuerna/.test(n)) return 'Press estrecho con mancuernas';
  if (/biceps.*barra|curl.*barra/.test(n)) return 'Curl de bíceps con barra';
  if (/curl.*mancuerna.*sentado/.test(n)) return 'Curl con mancuernas sentado';
  if (/overhead/.test(n)) return 'Extensión de codo overhead';
  if (/biceps.*polea trasera/.test(n)) return 'Bíceps en polea trasera';
  if (/jalon unil(?:ateral|ayeral)/.test(n)) return 'Jalón unilateral';
  if (/jm press/.test(n)) return 'JM press en multipower';
  if (/bulgara/.test(n)) return 'Sentadilla búlgara';
  if (/gemelo/.test(n)) return 'Gemelo en máquina';
  if (/prensa/.test(n)) return /unilateral/.test(n) ? 'Prensa unilateral' : /de pie/.test(n) ? 'Prensa de pie' : 'Prensa';
  if (/remo.*barra/.test(n)) return 'Remo con barra';
  if (/peso muerto/.test(n)) return 'Peso muerto';
  if (/martillo/.test(n)) return 'Curl martillo';
  void day;
  return name.trim();
}
function convention(name:string):string {
  if (/búlgara/.test(name)) return 'kg totales de las dos mancuernas';
  if (/mancuerna|martillo|laterales$/.test(name)) return 'por mancuerna';
  if (/multipower|Prensa|hack/.test(name)) return 'carga añadida';
  if (/barra|Peso muerto|Sentadilla frontal/.test(name)) return 'total incluida la barra';
  return 'carga indicada';
}
function freeLoad(name:string):boolean { return /mancuerna|martillo|laterales$|búlgara|barra|Peso muerto|Sentadilla frontal/.test(name); }
export function extractStatistics(data: Data): { performances: Performance[]; review: Review[] } {
  const performances: Performance[] = [], review: Review[] = [];
  const addReview = (s:{block:number;week:number;day:Day}, id:string,raw:string,reason:string) => review.push({id,...s,raw,reason});
  for (const s of historicalSessions(data.history)) for (const line of s.lines) {
    const arrow = line.text.indexOf('->');
    if (arrow<0) continue;
    const name = canonical(line.text.slice(0,arrow).replace(/^\s*\d+\.\s*/,''),s.day);
    const raw = line.text;
    const id = `${s.id}-${line.number}`;
    if (/barra rara/i.test(raw) || (s.block===7 && [3,4].includes(s.week) && name==='Prensa unilateral')) { addReview(s,id,raw,'Excluida por la corrección confirmada del histórico.'); continue; }
    if (/overhead/.test(name) || /variante sin confirmar/.test(name) || (s.block===2 && /Press muy inclinado/.test(name) && /primera serie/i.test(raw))) { addReview(s,id,raw,'Variante o carga contradictoria pendiente de confirmar.'); continue; }
    let weight: number|null = null, unit = 'kg', count = 0, uncertain = false;
    const body = raw.slice(arrow+2);
    for (let segment of body.split('//')) {
      segment = segment.trim().replace(/^(?:\d+\s*[-–]\s*\d+\s*\(\s*\+[^)]*\)|AMRAP)\s*/i,'');
      if (/cluster/i.test(segment)) { uncertain=true; weight=null; continue; }
      // Only the ordinary series preceding a dropset contribute to ordinary-series records.
      const ds = segment.search(/\+\s*DS\b|dropset/i);
      if (ds>=0) { segment=segment.slice(0,ds); uncertain=true; }
      const token = /\s*(?:(\d+(?:[.,'’]\d+)?)\s*(kg|lbs)\b|(\d+)\s*\(([^)]*)\)|(\d+)\s*(repes|reps|izq|dch|ambas)\b)/iy;
      let cursor = 0;
      while (cursor<segment.length) {
        // Strip only separators and side labels, never narrative notes or unidentified numbers.
        const gap=segment.slice(cursor).match(/^[\s,]*(?:(?:izq|dch|derecha|izquierda|ambas)\b[\s,]*)*/i)?.[0] ?? '';
        cursor+=gap.length;
        if (cursor>=segment.length) break;
        token.lastIndex=cursor;
        const m=token.exec(segment);
        if (!m) { if (segment.slice(cursor).trim()) uncertain=true; break; }
        cursor=token.lastIndex;
        if (m[1]) { weight=Number(m[1].replace(/[,'’]/,'.'));unit=m[2].toLowerCase();continue; }
        let reps=Number(m[3]??m[5]);
        const annotation=(m[4]??'').trim();
        if (/creo|por ah[ií]/i.test(annotation)) { uncertain=true;continue; }
        const unknownRir=/^\+?x$|^sobrao$|^subir$/i.test(annotation);
        if(unknownRir) uncertain=true;
        const rirMatch=annotation.match(/^\+(\d+)(?:\+(\d+))?$/);
        const partialMatch=annotation.match(/^(?:\+)?(?:(\d+)\s*)?parcial(es)?$/i);
        let partials:number|null=null;
        if (partialMatch) partials=partialMatch[1] ? Number(partialMatch[1]) : partialMatch[2] ? null : 1;
        else if (/la\s+\d+.*75%/i.test(annotation)) { reps--;partials=1; }
        else if (annotation && !rirMatch && !unknownRir && !/^\+?fallo$/i.test(annotation)) { uncertain=true;continue; }
        if (name==='Sentadilla búlgara' && weight!==null && ![40,50].includes(weight)) { uncertain=true;continue; }
        if (weight===null) uncertain=true;
        const scope=freeLoad(name) ? 'Misma variante y convención' : `Histórico · bloque ${s.block} · máquina sin identificar`;
        const load=convention(name);
        performances.push({id:`${id}-${count++}`,exercise:name,group:`${name}|${unit}|${load}|${scope}`,scope,unit,convention:load,block:s.block,week:s.week,day:s.day,date:null,weight,reps,rir:rirMatch ? `${rirMatch[1]}${rirMatch[2] ? '–'+rirMatch[2] : ''}` : '',partials,failure:/fallo/i.test(annotation),raw,source:`${s.source}:${line.number}`});
      }
      if (ds>=0) weight=null; // A later ordinary set cannot inherit the load of an unparsed dropset.
    }
    if (uncertain || !count) addReview(s,id,raw,count ? 'Solo se usan las series inequívocas anteriores a las notas o técnicas especiales.' : 'Sin resultado y carga inequívocos para calcular marcas.');
  }
  for (const s of data.sessions) for (const e of s.exercises) for (const set of e.sets) {
    if (!set.done) continue;
    const name=canonical(e.name,s.day),load=e.loadLabel;
    const scope=e.equipment.trim() || (freeLoad(name) ? 'Misma variante y convención' : 'Registro nuevo · equipo sin identificar');
    for (const [side,r] of (set.split ? [['izquierda',set.left],['derecha',set.right]] : [['ambos',set.left]]) as [string,typeof set.left][]) {
      if (r.reps===null) continue;
      // Use the same convention for the standard app labels, but retain customized labels.
      const labels:Record<string,string>={'kg por mancuerna':'por mancuerna','kg totales, incluida la barra':'total incluida la barra','kg añadidos':'carga añadida','kg indicados en la máquina':'carga indicada'};
      const normalized = labels[load] ?? load;
      performances.push({id:`${s.id}-${set.id}-${side}`,exercise:name,group:`${name}|kg|${normalized}|${scope}`,scope,unit:'kg',convention:normalized,block:s.block,week:s.week,day:s.day,date:s.date,weight:r.weight,reps:r.reps,rir:r.rir,partials:r.partials,failure:r.failure,raw:`${r.weight===null?'Carga sin anotar':r.weight+' kg'} × ${r.reps} · RIR ${r.rir||'sin anotar'}${set.split ? ' · '+side : ''}`,source:'Registro en la app'});
    }
  }
  return {performances,review};
}
export function performanceDate(r:Performance,calendar:CalendarConfig):string { return r.date ? monday(r.date) : weekDate(r.block,r.week,calendar); }
export function record(rows: Performance[]): Performance | undefined {
  return [...rows].filter(r=>r.reps>0).sort((a,b)=>(b.weight??-1)-(a.weight??-1)||b.reps-a.reps)[0];
}
export type Attendance = { block:number;week:number;date:string;days:Day[];count:number;estimated:boolean };
export function attendance(data: Data, calendar:CalendarConfig): Attendance[] {
  const positions=new Map<string, {block:number;week:number;days:Set<Day>;estimated:boolean}>();
  for (const s of [...historicalSessions(data.history).map(s=>({...s,finished:true,estimated:true})),...data.sessions.map(s=>({...s,estimated:false}))]) {
    if (!s.finished) continue;
    const key=`${s.block}-${s.week}`;
    const row=positions.get(key)??{block:s.block,week:s.week,days:new Set<Day>(),estimated:s.estimated};
    row.days.add(s.day);row.estimated ||= s.estimated;positions.set(key,row);
  }
  const trained=[...positions.values()];
  if (!trained.length) return [];
  const first=Math.min(...trained.map(r=>r.block)),last=Math.max(calendar.block,...trained.map(r=>r.block));
  const rows:Attendance[]=[];
  for(let b=first;b<=Math.min(last,first+200);b++) {
    const elapsed=Math.max(0,Math.floor((Date.parse(monday(new Date().toISOString().slice(0,10)))-Date.parse(monday(calendar.anchorDate)))/(7*DAY_MS)));
    const max=Math.max(calendar.lengths[b]??12,...trained.filter(r=>r.block===b).map(r=>r.week),b===calendar.block ? calendar.week+(b===last?elapsed:0) : 0);
    for(let w=1;w<=Math.min(max,104);w++) {
      const date=weekDate(b,w,calendar);
      if(date>monday(new Date().toISOString().slice(0,10)) && !positions.has(`${b}-${w}`)) continue;
      const r=positions.get(`${b}-${w}`);
      rows.push({block:b,week:w,date,days:[...(r?.days??[])],count:r?.days.size??0,estimated:r?.estimated??true});
    }
  }
  return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
