import { useEffect,useRef,useState } from 'react';
import type { Data } from './model';
import { mergeExcel,readExcelFiles,reviewWeights,type ExcelImport } from './excel';
import { trainingPositions } from './completed';
export function ExcelImporter({data,save}:{data:Data;save:(next:Data)=>Promise<void>}){
  const input=useRef<HTMLInputElement>(null);
  const [incoming,setIncoming]=useState<ExcelImport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [choices,setChoices]=useState<Record<string,string>>({}),[useCalendar,setUseCalendar]=useState(true);
  const dialog=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!incoming)return;
    const previous=document.activeElement as HTMLElement|null;
    const controls=()=>[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')??[])];controls()[0]?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&!busy)setIncoming(null);
      if(e.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    };document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};
  },[incoming,busy]);
  const load=async(files:FileList|null)=>{
    if(!files?.length)return;setBusy(true);setError('');
    try{const parsed=await readExcelFiles(Array.from(files));mergeExcel(data,parsed,{},true);setIncoming(parsed);setChoices({});setUseCalendar(true);}
    catch(e){setError(e instanceof Error?e.message:'No se pudo leer el Excel.');}
    finally{setBusy(false);if(input.current)input.current.value='';}
  };
  const rows=incoming?reviewWeights(data,incoming):[],conflicts=rows.filter(r=>r.conflict);
  const newCount=rows.filter(r=>!r.existing).length,duplicates=rows.filter(r=>r.existing&&!r.conflict).length;
  const importData=async()=>{
    if(!incoming)return;setBusy(true);setError('');
    try{await save(mergeExcel(data,incoming,choices,useCalendar));setIncoming(null);}
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar. Tus datos anteriores se conservan.');}
    finally{setBusy(false);}
  };
  return <section className="panel excel-importer"><div className="section-heading"><h2>Importar tus Excel</h2><span className="pill">Pesos y calendario</span></div><p className="muted">Selecciona juntos los archivos «Bloque 1…xlsx» hasta «Bloque 7…xlsx». Revisarás los pesos repetidos antes de guardar. Tus sesiones actuales se conservan.</p><div className="backup-actions"><button className="primary" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Leyendo Excel…':'Importar Excel'}</button><input data-testid="excel-file" ref={input} hidden type="file" multiple accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>void load(e.target.files)}/></div><p className="small-note">Los originales, incluidas rutinas y dieta, quedan en este navegador y en Exportar mis datos. No se suben a internet.</p><p className="small-note">{data.excel?.sources.length??0} archivos Excel guardados.</p>{error&&!incoming&&<p role="alert" className="inline-error">{error}</p>}
    {incoming&&<div className="modal-backdrop"><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="excel-title" className="modal excel-modal"><h2 id="excel-title">Revisar importación de Excel</h2><p>{incoming.archive.sources.length} archivos · {incoming.weights.length} pesajes encontrados.</p><div className="info-box"><p>{newCount} fechas nuevas · {duplicates} pesajes ya existentes · {conflicts.length} fechas con pesos distintos.</p><p>El historial reunirá {trainingPositions(mergeExcel(data,incoming,choices,useCalendar)).filter(s=>s.finished).length} sesiones, sin contar dos veces el mismo día de rutina dentro de una semana.</p></div><label className="checkbox"><input type="checkbox" checked={useCalendar} disabled={busy} onChange={e=>setUseCalendar(e.target.checked)}/> Usar las fechas semanales reales del Excel</label><p className="small-note">Las sesiones con una única coincidencia en Excel mostrarán su fecha exacta. Las coincidencias ambiguas conservarán el rango semanal y el aviso de revisión. Los objetivos de las rutinas no cuentan como resultados.</p>{conflicts.length>0&&<div className="weight-conflicts">{conflicts.map(r=><label key={r.date}>Peso del {r.date}<select aria-label={`Resolver peso ${r.date}`} disabled={busy} value={choices[r.date]??(r.existing?'existing':'0')} onChange={e=>setChoices({...choices,[r.date]:e.target.value})}>{r.existing&&<option value="existing">Conservar actual: {r.existing.kg} kg</option>}{r.candidates.map((w,i)=><option key={i} value={i}>Usar Excel: {w.kg} kg · {w.source}</option>)}</select></label>)}</div>}{incoming.archive.issues.length>0&&<details><summary>Observaciones de los archivos · {incoming.archive.issues.length}</summary>{incoming.archive.issues.map((issue,i)=><p key={i}>{issue}</p>)}</details>}{error&&<p role="alert" className="inline-error">{error}</p>}<div className="modal-actions"><button className="secondary" disabled={busy} onClick={()=>setIncoming(null)}>Cancelar</button><button className="primary" disabled={busy} onClick={()=>void importData()}>{busy?'Guardando…':'Añadir datos del Excel'}</button></div></section></div>}
  </section>;
}
