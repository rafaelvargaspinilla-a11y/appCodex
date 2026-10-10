import type { Data, Day, Exercise, Result, Session } from './model';
import { canonical, extractStatistics } from './statistics';
export type Prescription = { sourceId:string; sheet:string; block:number; week:number; day:Day; name:string; goals:string[]; rir:string; series:string; linear:boolean };
const text=(v:unknown)=>v===null||v===undefined?'':String(v).trim();
export function readPrescriptions(sheets:{sheet:string;data:unknown[][]}[],sourceId:string,block:number):Prescription[]{
  const plans:Prescription[]=[];
  for(const sheet of sheets){
    if(!/^ENTRENAMIENTO S\d+\s*-\s*S\d+$/i.test(sheet.sheet))continue;
    let day:Day|null=null,columns:{index:number;week:number}[]=[];
    for(const row of sheet.data){
      if(/^SESI[ÓO]N\s*\d+/i.test(text(row[1]))){const label=text(row[3]).toUpperCase();day=/FULLBODY\s*([ABC])/.test(label)?label.match(/FULLBODY\s*([ABC])/)![1] as Day:/BRAZO/.test(label)?'Brazos':null;columns=[];continue;}
      if(text(row[1]).toUpperCase()==='ORDEN'){columns=row.flatMap((v,index)=>{const m=text(v).match(/^SERIES\s*S(\d+)$/i);return m?[{index,week:Number(m[1])}]:[];});continue;}
      // Preparation rows p1… are not working series.
      if(!day||! /^[A-Z]$/.test(text(row[1]))||!text(row[2]))continue;
      for(const column of columns){
        const series=text(row[column.index]);if(!series)continue;
        const match=series.match(/^(\d+)(?:\s*\(\+(\d+)\))?/);if(!match)throw new Error(`Series no reconocidas: ${sheet.sheet}, ${text(row[2])}, S${column.week}.`);
        const count=Number(match[1])+Number(match[2]??0);if(count<1||count>20)throw new Error('Número de series fuera del rango admitido.');
        const ranges=text(row[5]).split('/').map(s=>s.trim().replace(/\s*[-–]\s*/g,'–'));
        const goals=Array.from({length:count},(_,i)=>ranges[Math.min(i,ranges.length-1)]||'Libre');
        const rir=text(row[column.index+1]);
        plans.push({sourceId,sheet:sheet.sheet,block,week:column.week,day,name:text(row[2]),goals,rir,series,linear:ranges.length===1&&/^\d+(?:\s*\(\+\d+\))?$/.test(series)});
      }
    }
  }
  return plans;
}
export function trainingName(name:string,day:Day):string{
  if(/PRNSA/i.test(name))name=name.replace(/PRNSA/i,'PRENSA');
  // Keep a prescribed alternative explicit instead of silently choosing a machine.
  if(/TUMBADO\s*\/\s*DE PIE|MUY INCLINADO.*MULTIPOWER/i.test(name))return name.trim();
  return canonical(name,day);
}
export function plannedBlock(data:Data,block:number):{weeks:number;total:number}{
  const plans=data.excel?.prescriptions?.filter(p=>p.block===block)??[];
  const weeks=plans.length?Math.max(...plans.map(p=>p.week)):data.calendar?.lengths[block]??12;
  return {weeks,total:weeks*4};
}
export function prefillSession(data:Data,session:Session):void{
  const stats=extractStatistics(data);
  for(const e of session.exercises){
    const before=(s:{block:number;week:number;day:Day})=>s.day===session.day&&(s.block<session.block||(s.block===session.block&&s.week<session.week));
    const previous=data.sessions.filter(s=>s.id!==session.id&&before(s)).sort((a,b)=>b.block-a.block||b.week-a.week).flatMap(s=>s.exercises.map(exercise=>({s,exercise}))).find(({exercise})=>trainingName(exercise.name,session.day)===trainingName(e.name,session.day)&&exercise.loadLabel===e.loadLabel&&exercise.sets.some(set=>set.done));
    const historic=stats.performances.filter(p=>before(p)&&p.exercise===trainingName(e.name,session.day)&&p.unit==='kg'&&!stats.review.some(r=>p.id.startsWith(r.id+'-'))&&!/\bizq\b|\bdch\b|izquierda|derecha/i.test(p.raw));
    const latest=[...historic].sort((a,b)=>b.block-a.block||b.week-a.week)[0];
    if(previous&&(!latest||previous.s.block>latest.block||(previous.s.block===latest.block&&previous.s.week>=latest.week))){
      e.equipment=previous.exercise.equipment;e.notes=previous.exercise.notes;
      e.sets.forEach((set,i)=>{const old=previous.exercise.sets[i];if(old?.done){set.left={...old.left};set.right={...old.right};set.split=old.split;set.previous={left:{...old.left},right:{...old.right},split:old.split,label:`Bloque ${previous.s.block} · semana ${previous.s.week} · día ${previous.s.day}`};}});
    }else if(latest){
      const rows=historic.filter(p=>p.block===latest.block&&p.week===latest.week);
      e.sets.forEach((set,i)=>{const p=rows[i];if(!p||p.weight===null||p.convention!==loadConvention(e))return;const pair=p.rir.split('–').map(Number).sort((a,b)=>a-b);const normalized=pair.length===2?pair.join('–'):p.rir;const rir=/^(|[0-9]|10|0–1|1–2|2–3)$/.test(normalized)?normalized:'';const r:Result={weight:p.weight,reps:p.reps,rir,failure:p.failure,partials:p.partials};set.left={...r};set.right={...r};set.previous={left:{...r},right:{...r},split:false,label:`Bloque ${p.block} · semana ${p.week} · día ${p.day}${p.rir&&rir!==p.rir?` · RIR original ${p.rir}`:""}`};});
    }
  }
}
function loadConvention(e:Exercise):string{return ({'kg por mancuerna':'por mancuerna','kg totales, incluida la barra':'total incluida la barra','kg añadidos':'carga añadida','kg indicados en la máquina':'carga indicada'} as Record<string,string>)[e.loadLabel]??e.loadLabel;}
export function propagateWeight(exercise:Exercise,setId:string,side:'left'|'right',value:Result):Exercise{
  const first=exercise.sets[0];
  const linear=exercise.linear??exercise.sets.every(s=>s.goal===first.goal);
  const changed=exercise.sets.find(s=>s.id===setId)!;
  return {...exercise,sets:exercise.sets.map(s=>s.id===setId?{...s,done:false,[side]:value}:linear&&first.id===setId&&value.weight!==changed[side].weight&&!s.done?{...s,[side]:{...s[side],weight:value.weight}}:s)};
}
export const elapsedSeconds=(start?:string,end?:string,now=Date.now())=>start?Math.max(0,Math.floor(((end?Date.parse(end):now)-Date.parse(start))/1000)):0;
export function clockLabel(seconds:number):string{return `${Math.floor(seconds/3600)?`${Math.floor(seconds/3600)}:`:''}${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
