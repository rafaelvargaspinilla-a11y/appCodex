import type { Data, Day, Exercise, Result, Session } from './model';
import { canonical } from './statistics';
import { historicalSessions } from './history';
import { historicalResults, type PreviousSet } from './previousResults';
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
const order=(s:{block:number;week:number;day:Day})=>s.block*100000+s.week*10+['A','B','C','Brazos'].indexOf(s.day);
function compatibleName(name:string,day:Day,exercise:Exercise):boolean{
  const previous=trainingName(name,day),current=trainingName(exercise.name,day);
  if(previous.toLowerCase()===current.toLowerCase())return true;
  if(/TUMBADO\s*\/\s*DE PIE/i.test(current))return ['Curl femoral tumbado','Curl femoral de pie unilateral'].includes(previous);
  return previous.toLowerCase()===current.toLowerCase();
}
export function prefillSession(data:Data,session:Session):void{
  for(const e of session.exercises){
    const candidates:{position:number;label:string;sets:(PreviousSet|null)[];notes?:string;equipment?:string}[]=[];
    for(const s of data.sessions.filter(s=>s.id!==session.id&&order(s)<order(session))){
      const old=s.exercises.find(x=>compatibleName(x.name,s.day,e)&&compatibleLoad(x.loadLabel,e.loadLabel)&&x.sets.some(set=>set.done));
      if(old)candidates.push({position:order(s),label:`Bloque ${s.block} · semana ${s.week} · día ${s.day}`,sets:old.sets.map(set=>set.done?{left:{...set.left},right:{...set.right},split:set.split}:null),notes:old.notes,equipment:old.equipment});
    }
    for(const s of historicalSessions(data.history).filter(s=>order(s)<order(session))){
      for(const line of s.lines){
        const arrow=line.text.indexOf('->');if(arrow<0)continue;
        const name=line.text.slice(0,arrow).replace(/^\s*\d+\.\s*/,'');
        if(!compatibleName(name,s.day,e)||/barra rara/i.test(line.text)||(s.block===7&&[3,4].includes(s.week)&&/prensa unilateral/i.test(name)))continue;
        // Retain explicit contradictory variants for review instead of importing them.
        if(s.block===2&&/Press muy inclinado/i.test(name)&&/primera serie/i.test(line.text))continue;
        const sets=historicalResults(line.text,e.unilateral);
        if(sets.some(set=>set.left.reps!==null||set.right.reps!==null))candidates.push({position:order(s),label:`Bloque ${s.block} · semana ${s.week} · día ${s.day}`,sets});
      }
    }
    const previous=candidates.sort((a,b)=>b.position-a.position)[0];if(!previous)continue;
    if(!e.notes&&previous.notes)e.notes=previous.notes;
    if(!e.equipment&&previous.equipment)e.equipment=previous.equipment;
    e.sets.forEach((set,i)=>{
      const old=previous.sets[i];if(!old||set.done||set.previous)return;
      const fill=(current:Result,prior:Result):Result=>({...current,weight:current.weight??prior.weight,reps:current.reps??prior.reps,rir:current.rir||prior.rir,partials:current.partials??prior.partials,failure:current.failure||prior.failure});
      const untouched=set.left.reps===null&&set.right.reps===null;
      set.left=fill(set.left,old.left);set.right=fill(set.right,old.right);if(untouched)set.split=e.unilateral&&old.split;
      set.previous={left:{...old.left},right:{...old.right},split:e.unilateral&&old.split,label:previous.label};
    });
  }
  session.prefillVersion=2;
}
function compatibleLoad(previous:string,current:string):boolean{return previous===current||/kg (?:por mancuerna|de la mancuerna)/.test(previous)&&/kg (?:por mancuerna|de la mancuerna)/.test(current);}
export function prepareExistingSession(data:Data,session:Session):Session{
  if(session.finished||session.prefillVersion===2)return session;
  const next=structuredClone(session);
  for(const e of next.exercises)if(/overhead/i.test(e.name)){
    e.unilateral=false;e.loadLabel='kg de la mancuerna';
    for(const set of e.sets)if(!set.done)set.split=false;
  }
  prefillSession(data,next);return next;
}
export function propagateWeight(exercise:Exercise,setId:string,side:'left'|'right',value:Result):Exercise{
  const first=exercise.sets[0];
  const linear=exercise.linear??exercise.sets.every(s=>s.goal===first.goal);
  const changed=exercise.sets.find(s=>s.id===setId)!;
  return {...exercise,sets:exercise.sets.map(s=>s.id===setId?{...s,done:false,[side]:value}:linear&&first.id===setId&&value.weight!==changed[side].weight&&!s.done?{...s,[side]:{...s[side],weight:value.weight}}:s)};
}
export const elapsedSeconds=(start?:string,end?:string,now=Date.now())=>start?Math.max(0,Math.floor(((end?Date.parse(end):now)-Date.parse(start))/1000)):0;
export function clockLabel(seconds:number):string{return `${Math.floor(seconds/3600)?`${Math.floor(seconds/3600)}:`:''}${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
