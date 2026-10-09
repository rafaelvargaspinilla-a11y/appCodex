import type { BodyWeight, Data, Day } from './model';
export type ExcelSource = { id:string; name:string; block:number; content:string };
export type ExcelDay = { id:string; sourceId:string; sheet:string; row:number; block:number; week:number; date:string; kg:number|null; day:Day|null; training:string; performance:string; steps:number|null };
export type ExcelWeek = { sourceId:string; sheet:string; block:number; week:number; start:string; end:string };
export type ExcelNote = { sourceId:string; sheet:string; block:number; week:number; category:string; text:string };
export type ExcelArchive = { version:1; sources:ExcelSource[]; days:ExcelDay[]; weeks:ExcelWeek[]; notes:ExcelNote[]; issues:string[] };
export type WeightCandidate = BodyWeight & { source:string };
export type ExcelImport = { archive:ExcelArchive; weights:WeightCandidate[] };
export type WeightReview = { date:string; existing?:BodyWeight; candidates:WeightCandidate[]; conflict:boolean };
const validDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function excelDate(value:unknown):string|null {
  if(value instanceof Date) return !Number.isNaN(value.getTime())?value.toISOString().slice(0,10):null;
  if(typeof value!=='string')return null;
  const match=value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  const date=match?`${match[3].length===2?'20':''}${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`:value.trim();
  return validDate(date)?date:null;
}
const text=(v:unknown)=>v===null||v===undefined?'':String(v).trim();
const num=(v:unknown):number|null=>{if(typeof v==='number')return Number.isFinite(v)&&v>=0?v:null;if(typeof v==='string'&&/^\d+(?:[.,]\d+)?$/.test(v.trim()))return Number(v.trim().replace(',','.'));return null;};
const day=(v:unknown):Day|null=>{const label=text(v).toLowerCase().replace(/\s/g,'');if(/^fullbody[abc]$/.test(label))return label.at(-1)!.toUpperCase() as Day;if(['brazo','brazos'].includes(label))return 'Brazos';return null;};
export function emptyExcel():ExcelArchive{return {version:1,sources:[],days:[],weeks:[],notes:[],issues:[]};}
export async function readExcelFiles(files:File[]):Promise<ExcelImport> {
  if(!files.length||files.length>30||files.some(f=>!f.name.toLowerCase().endsWith('.xlsx'))||files.reduce((sum,f)=>sum+f.size,0)>10_000_000)throw new Error('Selecciona hasta 30 archivos Excel .xlsx (máximo 10 MB en total).');
  const {default:readXlsx}=await import('read-excel-file/browser');
  const archive=emptyExcel(),weights:WeightCandidate[]=[];
  for(const file of files){
    const block=Number(file.name.match(/bloque\s*(\d+)/i)?.[1]);
    if(!block||block>99)throw new Error(`No se reconoce el bloque de ${file.name}. Usa el nombre «Bloque N…xlsx».`);
    const bytes=new Uint8Array(await file.arrayBuffer());
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(archive.sources.some(s=>s.id===hash))continue;
    let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    archive.sources.push({id:hash,name:file.name,block,content:btoa(binary)});
    const sheets=await readXlsx(file,{trim:false});
    let recognized=0;
    for(const sheet of sheets){
      const match=sheet.sheet.match(/^Datos S(\d+)\s*-\s*S(\d+)$/i);if(!match)continue;
      recognized++;
      const rows=sheet.data as unknown[][];
      const cell=(r:number,c:number)=>rows[r-1]?.[c-1];
      const first=Number(match[1]);
      if(first<1||first>100||Number(match[2])!==first+3)throw new Error(`Semanas no reconocidas en ${file.name}, ${sheet.sheet}.`);
      const declared=excelDate(cell(9,5));
      for(const [offset,start] of [23,39,55,71].entries()){
        const week=first+offset;
        if(Number(cell(start,2))!==week)throw new Error(`La estructura de semanas no coincide en ${file.name}, ${sheet.sheet}.`);
        const dates=Array.from({length:7},(_,i)=>excelDate(cell(start+i,3)));
        if(dates.some(d=>!d))throw new Error(`Faltan fechas legibles en ${file.name}, ${sheet.sheet}, semana ${week}.`);
        if(dates.some((d,i)=>Date.parse(d!)!==Date.parse(dates[0]!)+i*86400000)||new Date(dates[0]!).getUTCDay()!==1)throw new Error(`Fechas semanales incoherentes en ${file.name}, ${sheet.sheet}, semana ${week}.`);
        archive.weeks.push({sourceId:hash,sheet:sheet.sheet,block,week,start:dates[0]!,end:dates[6]!});
        if(first===1&&offset===0&&declared&&declared!==dates[0])archive.issues.push(`${file.name}, ${sheet.sheet}: la cabecera de inicio difiere de las fechas diarias; se conservan las fechas diarias.`);
        for(let r=start;r<start+7;r++){
          const date=dates[r-start]!,rawWeight=cell(r,4),kg=num(rawWeight),training=text(cell(r,5)),performance=text(cell(r,6)),steps=num(cell(r,7));
          if(text(rawWeight)&&(!kg||date>localToday()))archive.issues.push(`${file.name}, ${sheet.sheet}, D${r}: peso inválido o fecha futura; no se importará como pesaje.`);
          const validKg=kg!==null&&kg>0&&date<=localToday()?kg:null;
          if(text(rawWeight)||training||performance||steps!==null){
            archive.days.push({id:`${hash}:${sheet.sheet}:${r}`,sourceId:hash,sheet:sheet.sheet,row:r,block,week,date,kg:validKg,day:day(training),training,performance,steps});
          }
          if(validKg!==null)weights.push({id:`excel-${date}`,date,kg:validKg,note:'',source:`${file.name} · ${sheet.sheet} · D${r}`});
          if(training&&!day(training)&&training.toUpperCase()!=='DESCANSO')archive.issues.push(`${file.name}, ${sheet.sheet}, E${r}: entrenamiento sin día reconocido (${training}).`);
        }
        // Row start+7 is a computed weekly average, never a daily measurement.
        for(let r=start+8;r<=start+10;r++){const value=text(cell(r,7));if(value)archive.notes.push({sourceId:hash,sheet:sheet.sheet,block,week,category:text(cell(r,5)),text:value});}
      }
    }
    if(!recognized)throw new Error(`No se encontraron hojas «Datos S1 - S4» en ${file.name}.`);
  }
  validateExcel(archive);
  return {archive,weights};
}
function localToday():string{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function reviewWeights(data:Data,incoming:ExcelImport):WeightReview[]{
  const groups=new Map<string,WeightCandidate[]>();
  for(const w of incoming.weights){const group=groups.get(w.date)??[];if(!group.some(x=>x.kg===w.kg))group.push(w);groups.set(w.date,group);}
  return [...groups].map(([date,candidates])=>{const existing=data.weights.find(w=>w.date===date);return {date,existing,candidates,conflict:new Set([...(existing?[existing.kg]:[]),...candidates.map(c=>c.kg)]).size>1};}).sort((a,b)=>a.date.localeCompare(b.date));
}
export function mergeExcel(data:Data,incoming:ExcelImport,choices:Record<string,string>,useCalendar:boolean):Data{
  const weights=[...data.weights];
  for(const row of reviewWeights(data,incoming)){
    const choice=choices[row.date]??(row.existing?'existing':'0');
    if(choice==='existing')continue;
    const w=row.candidates[Number(choice)];if(!w)throw new Error('Selecciona un peso válido para cada fecha en conflicto.');
    const value={id:row.existing?.id??w.id,date:w.date,kg:w.kg,note:w.note||row.existing?.note||''};
    const index=weights.findIndex(old=>old.date===w.date);if(index>=0)weights[index]=value;else weights.push(value);
  }
  const existing=data.excel??emptyExcel();
  const unique=<T,>(values:T[],key:(v:T)=>string)=>[...new Map(values.map(v=>[key(v),v])).values()];
  const excel:ExcelArchive={version:1,sources:unique([...existing.sources,...incoming.archive.sources],s=>s.id),days:unique([...existing.days,...incoming.archive.days],d=>d.id),weeks:unique([...existing.weeks,...incoming.archive.weeks],w=>`${w.sourceId}:${w.block}:${w.week}`),notes:unique([...existing.notes,...incoming.archive.notes],n=>`${n.sourceId}:${n.sheet}:${n.week}:${n.category}`),issues:[...new Set([...existing.issues,...incoming.archive.issues])]};
  validateExcel(excel);
  let calendar=data.calendar;
  if(useCalendar){
    const lengths={...calendar?.lengths};for(const w of excel.weeks)lengths[w.block]=Math.max(lengths[w.block]??0,w.week);
    // The source-specific dates below remain authoritative, even across gaps between blocks.
    calendar={anchorDate:calendar?.anchorDate??'2026-10-05',block:calendar?.block??7,week:calendar?.week??5,lengths};
  }
  return {...data,weights,excel,calendar,excelCalendar:useCalendar||data.excelCalendar===true};
}
export function validateExcel(value:unknown):ExcelArchive{
  const d=value as ExcelArchive;
  const fail=():never=>{throw new Error('El archivo contiene datos Excel no válidos.');};
  const str=(v:unknown,max=100_000)=>typeof v==='string'&&v.length<max;
  const integer=(v:unknown,min=1,max=104)=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
  const numeric=(v:unknown)=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0);
  if(!d||d.version!==1||!Array.isArray(d.sources)||d.sources.length>100||!Array.isArray(d.days)||d.days.length>100000||!Array.isArray(d.weeks)||d.weeks.length>10000||!Array.isArray(d.notes)||d.notes.length>10000||!Array.isArray(d.issues)||d.issues.length>10000)fail();
  const ids=new Set<string>();
  for(const s of d.sources){if(!s||!str(s.id)||!/^[a-f0-9]{64}$/.test(s.id)||ids.has(s.id)||!str(s.name,1000)||!integer(s.block,1,99)||!str(s.content,15_000_000)||!s.content||!/^[A-Za-z0-9+/]*={0,2}$/.test(s.content)||s.content.length%4!==0)fail();ids.add(s.id);}
  const rowIds=new Set<string>();
  for(const r of d.days){if(!r||!str(r.id)||rowIds.has(r.id)||!ids.has(r.sourceId)||!str(r.sheet)||!integer(r.row,1,100000)||!integer(r.block,1,99)||!integer(r.week)||!validDate(r.date)||!numeric(r.kg)||(r.kg!==null&&r.kg<=0)||!numeric(r.steps)||!(r.day===null||['A','B','C','Brazos'].includes(r.day))||!str(r.training)||!str(r.performance))fail();rowIds.add(r.id);}
  const dates=new Map<string,string>();
  for(const w of d.weeks){if(!w||!ids.has(w.sourceId)||!str(w.sheet)||!integer(w.block,1,99)||!integer(w.week)||!validDate(w.start)||!validDate(w.end)||Date.parse(w.end)-Date.parse(w.start)!==6*86400000)fail();const key=`${w.block}:${w.week}`;if(dates.has(key)&&dates.get(key)!==w.start)throw new Error(`Dos Excel indican fechas distintas para el bloque ${w.block}, semana ${w.week}. Revisa los archivos antes de importar.`);dates.set(key,w.start);}
  for(const n of d.notes)if(!n||!ids.has(n.sourceId)||!str(n.sheet)||!integer(n.block,1,99)||!integer(n.week)||!str(n.category)||!str(n.text))fail();
  if(d.issues.some(i=>!str(i)))fail();
  return d;
}
