import { ExcelImporter } from './ExcelImporter';
import { trainingPositions } from './completed';
import { applyUpdate, checkUpdate, updateWaiting } from './updates';
import { StatisticsView } from './StatisticsView';
import { resolvedCalendar } from './statistics';
import { ArchiveView } from './HistoryArchive';
import { historicalSessions, mergeHistory, parseHistory } from './history';
import { useEffect, useRef, useState } from 'react';
import { Dumbbell, LayoutDashboard, History, Scale, Settings, ArrowUpRight, ArrowLeft, ArrowRight, Plus, Check, ChevronDown, Download, Upload, WifiOff, ShieldCheck, X, CheckCircle2, Circle } from 'lucide-react';
import { createSession, suggestedSession, days, today, completedSets, totalSets, newSet, previousExercise, validResult, parseBackup, type Data, type Day, type Exercise, type Result, type Session, type SetRecord } from './model';
import { readData, writeData } from './storage';

type Tab = 'train' | 'history' | 'stats' | 'weight' | 'settings';
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const numberLabel = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const rirOptions = ['', '0', '0–1', '1', '1–2', '2', '2–3', '3', '4', '5', '6', '7', '8', '9', '10'];
const nav = [{ id: 'train', label: 'Entrenar', icon: LayoutDashboard }, { id: 'history', label: 'Historial', icon: History }, { id: 'stats', label: 'Progreso', icon: ArrowUpRight }, { id: 'weight', label: 'Peso corporal', icon: Scale }, { id: 'settings', label: 'Mis datos', icon: Settings }] as const;
function download(data: Data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `beast-log-${today()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ResultFields({ value, onChange, side, prefix }: { value: Result; onChange: (r: Result) => void; side?: string; prefix: string }) {
  const change = (key: 'weight' | 'reps' | 'partials', text: string) => {
    const n = text === '' ? null : Number(text);
    if (n !== null && (!Number.isFinite(n) || n < 0 || (key !== 'weight' && !Number.isInteger(n)))) return;
    onChange({ ...value, [key]: n });
  };
  return <div className="result-fields">
    {side && <span className="side-label">{side}</span>}
    <div className="field-row">
      <label>Carga <input aria-label={`${prefix} ${side ?? ''} carga`.trim()} type="number" min="0" step="any" inputMode="decimal" placeholder="—" value={value.weight ?? ''} onChange={e => change('weight', e.target.value)} /></label>
      <label>Reps <input aria-label={`${prefix} ${side ?? ''} repeticiones`.trim()} type="number" min="0" step="1" inputMode="numeric" placeholder="—" value={value.reps ?? ''} onChange={e => change('reps', e.target.value)} /></label>
      <label>RIR <select aria-label={`${prefix} ${side ?? ''} RIR`.trim()} value={value.rir} onChange={e => onChange({ ...value, rir: e.target.value })}>{rirOptions.map(r => <option key={r} value={r}>{r || '—'}</option>)}</select></label>
    </div>
    <div className="result-extra"><label className="checkbox"><input type="checkbox" checked={value.failure} onChange={e => onChange({ ...value, failure: e.target.checked })} /> Intento fallido</label><label className="partials">Parciales <input aria-label={`${prefix} ${side ?? ''} parciales`.trim()} type="number" min="0" step="1" inputMode="numeric" placeholder="—" value={value.partials ?? ''} onChange={e => change('partials', e.target.value)} /></label></div>
  </div>;
}
function ExerciseCard({ exercise, index, session, data, update }: { exercise: Exercise; index: number; session: Session; data: Data; update: (e: Exercise) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const prev = previousExercise(data, session, exercise);
  const first = prev?.sets.find(s => s.done);
  const setUpdate = (set: SetRecord) => update({ ...exercise, sets: exercise.sets.map(s => s.id === set.id ? set : s) });
  const setResult = (set: SetRecord, side: 'left' | 'right', r: Result) => setUpdate({ ...set, done: false, [side]: r });
  const complete = (set: SetRecord) => {
    if (!set.done && (!validResult(set.left) || (set.split && !validResult(set.right)))) { setError('Anota las repeticiones de esta serie antes de marcarla.'); return; }
    setError(''); setUpdate({ ...set, done: !set.done });
  };
  return <article className="exercise-card">
    <div className="exercise-heading"><span className="exercise-number">{String(index + 1).padStart(2, '0')}</span><div className="exercise-title"><h3>{exercise.name}</h3><p>{exercise.loadLabel}{exercise.unilateral && ' · por lado'}</p></div><button className={`icon-button ${open ? 'active' : ''}`} aria-label={`Notas y equipo de ${exercise.name}`} aria-expanded={open} onClick={() => setOpen(!open)}><ChevronDown size={18} /></button></div>
    {first && <div className="previous">Anterior · {first.left.weight === null ? 'carga no anotada' : `${numberLabel(first.left.weight)} kg`} × {first.left.reps} · RIR {first.left.rir || 'sin anotar'}{first.split && ' · izquierda'}</div>}
    {open && <div className="exercise-details"><label>Máquina / equipo<input placeholder="Identifica la máquina para comparar sesiones" value={exercise.equipment} onChange={e => update({ ...exercise, equipment: e.target.value })} /></label><label>Notas y ajustes<textarea placeholder="Técnica, posición del banco, recordatorios…" value={exercise.notes} onChange={e => update({ ...exercise, notes: e.target.value })} /></label><label>Cómo anotas la carga<select value={exercise.loadLabel} onChange={e => update({ ...exercise, loadLabel: e.target.value })}>{[...new Set([exercise.loadLabel, 'kg por mancuerna', 'kg totales, incluida la barra', 'kg añadidos', 'kg indicados en la máquina', 'kg de lastre (opcional)'])].map(v => <option key={v}>{v}</option>)}</select></label></div>}
    {exercise.sets.map((set, i) => <div key={set.id} className={`set-row ${set.done ? 'done' : ''}`}>
      <div className="set-meta"><span>Serie {i + 1}</span><span className="goal">Objetivo <strong>{set.goal}</strong> · RIR {set.targetRir}</span>{exercise.unilateral && <label className="checkbox split"><input type="checkbox" checked={set.split} onChange={e => setUpdate({ ...set, split: e.target.checked, done: false, right: e.target.checked ? { ...set.left } : set.right })} /> Diferenciar lados</label>}</div>
      <div className="set-entry"><div className="results"><ResultFields prefix={`${exercise.name} serie ${i + 1}`} side={exercise.unilateral ? (set.split ? 'Izquierda' : 'Ambos lados') : undefined} value={set.left} onChange={r => setResult(set, 'left', r)} />{set.split && <ResultFields prefix={`${exercise.name} serie ${i + 1}`} side="Derecha" value={set.right} onChange={r => setResult(set, 'right', r)} />}</div><button className={`set-check ${set.done ? 'checked' : ''}`} aria-label={`${set.done ? 'Desmarcar' : 'Completar'} ${exercise.name} serie ${i + 1}`} aria-pressed={set.done} onClick={() => complete(set)}><Check size={20} /></button></div>
    </div>)}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <button className="add-set" onClick={() => update({ ...exercise, sets: [...exercise.sets, newSet(exercise.sets.at(-1)?.goal ?? 'Libre', exercise.sets.at(-1)?.left.weight ?? null, exercise.sets.at(-1)?.targetRir ?? 0)] })}><Plus size={15} /> Añadir serie</button>
  </article>;
}
export default function App() {
  const [needsUpdate,setNeedsUpdate]=useState(updateWaiting);
  const [updating,setUpdating]=useState(false);
  useEffect(()=>{const change=()=>setNeedsUpdate(updateWaiting());window.addEventListener('beast-update',change);return()=>window.removeEventListener('beast-update',change);},[]);
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('train');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [day, setDay] = useState<Day>('A');
  const [block, setBlock] = useState(7);
  const [week, setWeek] = useState(6);
  const [date, setDate] = useState(today());
  const [saveStatus, setSaveStatus] = useState('Guardado en este dispositivo');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [toast, setToast] = useState('');
  const [weightDate, setWeightDate] = useState(today());
  const [weight, setWeight] = useState('');
  const [weightNote, setWeightNote] = useState('');
  const [backup, setBackup] = useState<Data | null>(null);
  const [finishDialog, setFinishDialog] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLInputElement>(null);
  const savedRevision = useRef(0);
  const prepareNext = (d: Data) => { const next = suggestedSession(d); setBlock(next.block); setWeek(next.week); setDay(next.day); setDate(today()); };
  useEffect(() => { let cancelled = false; readData().then(d => { if (!cancelled) { setData(d); prepareNext(d); } }).catch(() => { if (!cancelled) setLoadError('No se pueden abrir los datos del navegador. Comprueba que el almacenamiento esté permitido y recarga.'); }); return () => { cancelled = true; }; }, []);
  useEffect(() => {
    const change = () => setOffline(!navigator.onLine);
    window.addEventListener('online', change); window.addEventListener('offline', change);
    return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); };
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 5000); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    if (!backup && !finishDialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => [...(dialog?.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]') ?? [])];
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setBackup(null); setFinishDialog(false); }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previousFocus?.focus(); };
  }, [backup, finishDialog]);
  // Changes save immediately in a serial IndexedDB transaction queue.
  const commit = (next: Data) => {
    setData(next); setSaveStatus('Guardando…');
    const revision = ++savedRevision.current;
    writeData(next).then(() => { if (revision === savedRevision.current) setSaveStatus('Guardado en este dispositivo'); }).catch(() => {
      if (revision === savedRevision.current) setSaveStatus('Error al guardar · exporta una copia');
    });
  };
  if (loadError) return <main className="loading"><Dumbbell size={40} /><h1>No hemos podido abrir tu diario</h1><p role="alert">{loadError}</p><button onClick={() => location.reload()}>Reintentar</button></main>;
  if (!data) return <main className="loading"><Dumbbell size={40} /><p>Abriendo tu diario…</p></main>;
  const active = data.sessions.find(s => s.id === activeId);
  const positions=trainingPositions(data);
  const finishedPositions=positions.filter(s=>s.finished);
  const hasHistory=positions.length>0;
  const sessions = [...data.sessions].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const weights = [...data.weights].sort((a,b) => b.date.localeCompare(a.date));
  const lastWeight = weights[0];
  const updateSession = (s: Session) => commit({ ...data, sessions: data.sessions.map(old => old.id === s.id ? s : old) });
  const startSession = () => {
    if (!Number.isInteger(block) || block < 1 || !Number.isInteger(week) || week < 1 || !date) { setToast('Indica un bloque, una semana y una fecha válidos.'); return; }
    const existing = data.sessions.find(s => s.block === block && s.week === week && s.day === day);
    if (existing) { setActiveId(existing.id); setToast('Abierta la sesión que ya tenías en esta semana.'); return; }
    const s = createSession(block, week, day, date);
    // Preload only loads, never repetitions or completed states.
    s.exercises.forEach(e => {
      const prev = previousExercise(data, s, e);
      if (prev) { e.notes = prev.notes; e.sets.forEach((set,i) => { const old = prev.sets[i]; if (old?.done) { set.left.weight = old.left.weight; set.right.weight = old.right.weight; } }); }
    });
    commit({ ...data, sessions: [...data.sessions, s] }); setActiveId(s.id);
  };
  const saveWeight = (event: React.FormEvent) => {
    event.preventDefault(); const kg = Number(weight.replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0 || !weightDate) { setToast('Introduce un peso mayor que cero y una fecha.'); return; }
    const old = data.weights.find(w => w.date === weightDate);
    const record = { id: old?.id ?? crypto.randomUUID(), date: weightDate, kg, note: weightNote };
    commit({ ...data, weights: [...data.weights.filter(w => w.date !== weightDate), record] });
    setWeight(''); setWeightNote(''); setToast(old ? 'Peso de ese día actualizado.' : 'Peso corporal guardado.');
  };
  const loadBackup = async (file?: File) => {
    if (!file) return;
    try { if (file.size > 20_000_000) throw new Error('La copia supera el límite de 20 MB.'); setBackup(parseBackup(await file.text())); }
    catch (e) { setToast(e instanceof Error ? e.message : 'No se pudo leer la copia.'); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const loadHistory = async (selection: FileList | null) => {
    if (!selection?.length) return;
    const files = Array.from(selection);
    try {
      if (files.reduce((sum, file) => sum + file.size, 0) > 20_000_000) throw new Error('El histórico supera el límite de 20 MB.');
      const texts = await Promise.all(files.map(async file => ({ name: file.name, text: await file.text() })));
      const isJson = files.length === 1 && files[0].name.toLowerCase().endsWith('.json');
      const incoming = parseHistory(isJson ? JSON.parse(texts[0].text) : { format: 'beast-log-history', version: 1, files: texts });
      const history = mergeHistory(data.history, incoming);
      const next = { ...data, history };
      await writeData(next); setData(next); prepareNext(next);
      setSaveStatus('Guardado en este dispositivo'); setTab('history');
      setToast(`Histórico guardado: ${historicalSessions(history).length} sesiones. Tus sesiones actuales se han conservado.`);
    } catch (e) { setToast(e instanceof Error ? e.message : 'No se pudo importar el histórico.'); }
    if (historyRef.current) historyRef.current.value = '';
  };
  const updateApp = async () => {
    setUpdating(true);
    try { await applyUpdate(true); }
    catch { setToast('No se pudo actualizar. Comprueba la conexión e inténtalo otra vez.'); setUpdating(false); }
  };
  const searchUpdate = async () => {
    try { await checkUpdate(); setToast('Comprobación solicitada. Si hay una versión nueva, aparecerá el aviso de actualización.'); }
    catch(e) { setToast(e instanceof Error ? e.message : 'No se pudo comprobar la actualización.'); }
  };
  const count = active ? completedSets(active) : 0;
  const total = active ? totalSets(active) : 0;
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#" onClick={e => { e.preventDefault(); setTab('train'); }}><span className="brand-icon"><Dumbbell size={24} /></span><span>BEAST<span className="brand-log">LOG</span><small>DIARIO DE ENTRENAMIENTO</small></span></a><div className="sidebar-label">TU ESPACIO</div><nav>{nav.map(item => <button key={item.id} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}><item.icon size={20} /><span>{item.label}</span>{tab === item.id && <span className="nav-dot" />}</button>)}</nav><div className="sidebar-bottom"><div className="local-badge"><ShieldCheck size={21} /><div><strong>Tu progreso es tuyo</strong><p>Guardado en este dispositivo</p></div></div><div className="profile"><span>RV</span><div><strong>Mi diario</strong><small>Una serie a la vez.</small></div></div></div></aside>
    <div className="main-shell"><header className="topbar"><span className="breadcrumb">Mi diario <span>/</span> {nav.find(n => n.id === tab)?.label}</span><span className={`save-state ${saveStatus.startsWith('Error') ? 'error' : ''}`} role="status">{offline ? <WifiOff size={14} /> : <span className="status-dot" />}{offline ? 'Sin conexión · ' : ''}{saveStatus}</span></header>
    <main className="main-content">
      {needsUpdate && <section className="update-notice" aria-live="polite"><div><strong>Hay una nueva versión disponible</strong><p>Actualiza para ver las novedades. Tus entrenamientos se conservan.</p></div><button className="primary" disabled={updating || saveStatus !== 'Guardado en este dispositivo'} onClick={()=>void updateApp()}>{updating?'Actualizando…':'Actualizar app'}</button></section>}
      <div className="page-heading"><div><p className="eyebrow">{tab === 'train' ? 'EL PROGRESO SE CONSTRUYE' : 'CADA REGISTRO CUENTA'}</p><h1>{tab === 'train' ? (active ? 'Vamos con esa sesión.' : 'Hoy toca superar ayer.') : tab === 'history' ? 'Tu camino, serie a serie.' : tab === 'stats' ? 'Tus marcas. Tu evolución.' : tab === 'weight' ? 'Más allá de un número.' : 'Tus datos. Tu control.'}</h1><p className="subtitle">{tab === 'train' ? 'Sin prisas. Con intención. Registra lo que haces y sigue avanzando.' : tab === 'history' ? 'Vuelve a tus sesiones y encuentra tu siguiente punto de partida.' : tab === 'stats' ? 'Descubre tus récords, sigue tus cargas y cuenta tus entrenamientos.' : tab === 'weight' ? 'Registra tu peso y observa la tendencia, no solo el día.' : 'Conserva una copia de tu progreso y llévala contigo.'}</p></div><span className="today"><span>HOY</span>{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</span></div>
      {tab === 'train' && !active && <>
        <section className="summary-grid"><div className="summary-card"><span className="summary-icon"><Dumbbell size={19} /></span><p>Sesiones terminadas</p><strong>{finishedPositions.length}<small>sesiones</small></strong><span>Total de tu historial</span></div><div className="summary-card"><span className="summary-icon"><CheckCircle2 size={19} /></span><p>Sesiones terminadas este bloque</p><strong>{finishedPositions.filter(s=>s.block===block).length}<small>sesiones</small></strong><span>Bloque {block}</span></div><div className="summary-card"><span className="summary-icon"><Scale size={19} /></span><p>Último peso corporal</p><strong>{lastWeight ? numberLabel(lastWeight.kg) : '—'}<small>kg</small></strong><span>{lastWeight ? dateLabel(lastWeight.date) : 'Añade tu primer registro'}</span></div></section>
        <div className="dashboard-grid dashboard-main"><section className="session-builder panel"><div className="section-heading"><div><p className="eyebrow">TU RUTINA</p><h2>Prepara tu sesión</h2></div><span className="pill">Bloque {block || '—'}</span></div><p className="muted">Tu próxima sesión ya está preparada. Puedes cambiarla si lo necesitas.</p><div className="day-grid">{days.map((d,i) => <button key={d} className={`day-card ${day === d ? 'chosen' : ''}`} onClick={() => setDay(d)} aria-pressed={day === d}><span>{d === 'Brazos' ? 'DÍA 4' : `DÍA ${d}`} </span><strong>{d === 'Brazos' ? 'Brazos' : ['A','B','C'][i]}</strong><small>{d === 'Brazos' ? '6 ejercicios' : '7 ejercicios'}</small>{day === d && <Check size={16} />}</button>)}</div><div className="session-fields"><label>Bloque<input aria-label="Bloque" type="number" min="1" step="1" value={block || ''} onChange={e => setBlock(Number(e.target.value))} /></label><label>Semana<input aria-label="Semana" type="number" min="1" step="1" value={week || ''} onChange={e => setWeek(Number(e.target.value))} /></label><label className="date-field">Fecha<input aria-label="Fecha de sesión" type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div><button className="primary start-button" onClick={startSession}>Empezar entrenamiento <ArrowRight size={19} /></button><p className="small-note">Ciclo: A → B → C → Brazos → siguiente semana. El bloque cambia cuando tú lo decidas.</p></section>
        </div>
      </>}
      {tab === 'train' && active && <><button className="back-button" onClick={() => setActiveId(null)}><ArrowLeft size={16} /> Volver a mi diario</button><section className="session-banner"><div><span className="pill">Día {active.day}</span><h2>Bloque {active.block} <span>/</span> Semana {active.week}</h2><p>{dateLabel(active.date)} · {active.exercises.length} ejercicios{active.finished && ' · sesión terminada'}</p></div><div className="session-progress"><strong>{count}<span> / {total}</span></strong><p>series registradas</p><div className="progress-track"><div style={{ width: `${total ? count / total * 100 : 0}%` }} /></div></div></section><div className="training-layout"><section className="exercise-list">{active.exercises.map((exercise,i) => <ExerciseCard key={exercise.id} exercise={exercise} index={i} session={active} data={data} update={e => updateSession({ ...active, finished: false, exercises: active.exercises.map(old => old.id === e.id ? e : old) })} />)}<button className="primary finish-button" onClick={() => setFinishDialog(true)}>Terminar sesión <Check size={19} /></button></section><aside className="training-aside panel"><p className="eyebrow">EN ESTA SESIÓN</p><h3>Una serie a la vez</h3>{active.exercises.map((e,i) => <div className="exercise-index" key={e.id}><span>{String(i+1).padStart(2,'0')}</span><p>{e.name}</p>{e.sets.every(s => s.done) ? <CheckCircle2 size={16} /> : <Circle size={16} />}</div>)}<p className="small-note">Marca cada serie al terminar. Las series sin marcar no cuentan como resultados registrados.</p></aside></div></>}
      {tab === 'history' && (sessions.length > 0 || !hasHistory) && <section className="panel history-panel"><div className="section-heading"><h2>Entrenamientos</h2><span className="pill">{positions.length} sesiones</span></div>{!hasHistory ? <div className="empty-state"><History size={36} /><h3>Tu historia empieza con la primera sesión</h3><p>Aquí aparecerán los entrenamientos que registres. Importa tus bloques desde Mis datos para consultarlos aquí.</p><button className="primary" onClick={() => { setTab('train'); setActiveId(null); }}>Registrar entrenamiento <ArrowRight size={17} /></button></div> : sessions.map(s => <button className="history-row" key={s.id} onClick={() => { setActiveId(s.id); setTab('train'); }}><span className="history-day">{s.day === 'Brazos' ? 'Br' : s.day}</span><div><h3>{s.day === 'Brazos' ? 'Brazos' : `Día ${s.day}`} <span>· Bloque {s.block}, semana {s.week}</span></h3><p>{dateLabel(s.date)} · {completedSets(s)} de {totalSets(s)} series registradas</p></div><span className={`pill ${s.finished ? 'success' : ''}`}>{s.finished ? 'Terminada' : 'En curso'}</span><ArrowUpRight size={18} /></button>)}</section>}
      {tab === 'history' && (data.history || data.excel) && <ArchiveView data={data} calendar={resolvedCalendar(data)} />}
      {tab === 'stats' && <StatisticsView data={data} save={commit} />}
      {tab === 'weight' && <div className="weight-layout"><section className="panel"><div className="section-heading"><h2>Registrar peso</h2><Scale size={21} /></div><p className="muted">Una referencia más para entender tu progreso.</p><form className="weight-form" onSubmit={saveWeight}><label>Fecha<input aria-label="Fecha del peso" type="date" required value={weightDate} onChange={e => { setWeightDate(e.target.value); const old = data.weights.find(w => w.date === e.target.value); setWeight(old ? String(old.kg) : ''); setWeightNote(old?.note ?? ''); }} /></label><label>Peso corporal (kg)<input aria-label="Peso corporal (kg)" type="number" step="any" min="0.1" required placeholder="Ej. 78,5" value={weight} onChange={e => setWeight(e.target.value)} /></label><label>Nota opcional<textarea placeholder="En ayunas, después de entrenar…" value={weightNote} onChange={e => setWeightNote(e.target.value)} /></label><button className="primary" type="submit">{data.weights.some(w => w.date === weightDate) ? 'Actualizar peso' : 'Guardar peso'} <Check size={18} /></button><p className="small-note">Un registro por fecha. Si ya existe, se actualizará.</p></form></section><section className="panel weight-records"><div className="section-heading"><h2>Evolución</h2><span className="pill">{weights.length} registros</span></div>{weights.length ? <><WeightTrend weights={weights} /><div className="weight-table">{weights.map(w => <button key={w.id} className="weight-row" onClick={() => { setWeightDate(w.date); setWeight(String(w.kg)); setWeightNote(w.note); }}><div><strong>{dateLabel(w.date)}</strong><p>{w.note || 'Sin nota'}</p></div><strong>{numberLabel(w.kg)} <small>kg</small></strong></button>)}</div></> : <div className="empty-state"><Scale size={36} /><h3>Tu primer punto de referencia</h3><p>Añade tu peso para empezar a ver su evolución.</p></div>}</section></div>}
      {tab === 'settings' && <div className="settings-layout"><ExcelImporter data={data} save={async next=>{await writeData(next);setData(next);prepareNext(next);setSaveStatus('Guardado en este dispositivo');setToast('Excel importado. Pesos, historial y fechas guardados.');}}/><section className="panel"><div className="section-heading"><h2>Copia de seguridad</h2><ShieldCheck size={22} /></div><p className="muted">Tus sesiones y tu peso corporal se guardan en este navegador. Exporta una copia para conservarlos o llevarlos a otro dispositivo.</p><div className="backup-actions"><button className="primary" onClick={() => download(data)}><Download size={18} /> Exportar mis datos</button><button className="secondary" onClick={() => fileRef.current?.click()}><Upload size={18} /> Restaurar una copia</button><input data-testid="backup-file" ref={fileRef} hidden type="file" accept=".json,application/json" onChange={e => void loadBackup(e.target.files?.[0])} /></div><div className="info-box"><strong>{positions.length} sesiones · {data.weights.length} registros de peso</strong><p>La copia incluye objetivos, series, notas y resultados por lado.</p></div></section><section className="panel"><p className="eyebrow">VERSIÓN · PROGRESO Y MARCAS</p><h2>Siempre a mano</h2><button className="secondary" onClick={()=>void searchUpdate()}>Buscar actualización</button><ul className="feature-list"><li><CheckCircle2 size={18} /> Guardado automático en este dispositivo</li><li><CheckCircle2 size={18} /> Disponible sin conexión tras la primera carga</li><li><CheckCircle2 size={18} /> Copias completas en formato JSON</li></ul><p className="muted">Selecciona juntos Gym 1.txt hasta Gym 7.txt, o importa el JSON privado, para consultar todos los bloques. Se añade a tus datos actuales sin sustituir sesiones ni duplicar bloques. Tus datos no se suben a GitHub. La sincronización entre dispositivos aún no está disponible.</p><div className="backup-actions"><button className="primary" onClick={() => historyRef.current?.click()}><Upload size={18} /> Importar histórico</button><input data-testid="history-file" ref={historyRef} hidden type="file" multiple accept=".txt,.json,text/plain,application/json" onChange={e => void loadHistory(e.target.files)} /></div><p className="small-note">Histórico: {historicalSessions(data.history).length} sesiones. También se incluye en Exportar mis datos.</p><p className="small-note">Para instalar: usa «Instalar aplicación» en un navegador compatible, o «Añadir a pantalla de inicio» en Safari. La versión publicada necesita HTTPS.</p></section></div>}
      <footer className="footer"><span>BEAST LOG <span>·</span> Hecho para seguir avanzando.</span><span>Tu diario personal de entrenamiento</span></footer>
    </main></div>
    <nav className="mobile-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}><item.icon size={21} /><span>{item.id === 'weight' ? 'Peso' : item.label}</span></button>)}</nav>
    {toast && <div className="toast" role="alert">{toast}<button aria-label="Cerrar aviso" onClick={() => setToast('')}><X size={16} /></button></div>}
    {finishDialog && active && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="finish-title" className="modal"><span className="modal-icon"><Check size={24} /></span><h2 id="finish-title">Buen trabajo. ¿Terminamos?</h2><p>Has registrado {count} de {total} series. Las {total - count} restantes quedarán sin resultado; no contarán como cero.</p><div className="modal-actions"><button className="secondary" autoFocus onClick={() => setFinishDialog(false)}>Seguir entrenando</button><button className="primary" onClick={() => { const finished = { ...active, finished: true }; const nextData = { ...data, sessions: data.sessions.map(s => s.id === finished.id ? finished : s) }; commit(nextData); prepareNext(nextData); setFinishDialog(false); setActiveId(null); setTab('train'); setToast('Sesión terminada. Tu siguiente entrenamiento está preparado.'); }}>Terminar sesión</button></div></section></div>}
    {backup && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="restore-title" className="modal"><h2 id="restore-title">Restaurar esta copia</h2><p>Contiene {backup.sessions.length} sesiones, {historicalSessions(backup.history).length} sesiones históricas y {backup.weights.length} registros de peso. Sustituirá los datos de este navegador. Antes descargaremos una copia de tus datos actuales.</p><div className="modal-actions"><button className="secondary" autoFocus onClick={() => setBackup(null)}>Cancelar</button><button className="primary" onClick={async () => { try { download(data); await writeData(backup); setData(backup); prepareNext(backup); setActiveId(null); setBackup(null); setSaveStatus('Guardado en este dispositivo'); setToast('Copia restaurada.'); } catch { setToast('No se pudo restaurar. Tus datos actuales siguen disponibles.'); } }}>Guardar copia y restaurar</button></div></section></div>}
  </div>;
}
function WeightTrend({ weights }: { weights: Data['weights'] }) {
  const sorted = [...weights].sort((a,b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1)!;
  const end = Date.parse(latest.date);
  const recent = sorted.filter(w => end - Date.parse(w.date) < 7 * 86400000);
  const mean = recent.reduce((n,w) => n + w.kg, 0) / recent.length;
  const min = Math.min(...sorted.map(w => w.kg)) - 0.5;
  const max = Math.max(...sorted.map(w => w.kg)) + 0.5;
  const first = Date.parse(sorted[0].date);
  const points = sorted.map(w => `${sorted.length === 1 ? 150 : 12 + (Date.parse(w.date)-first) / (end-first) * 276},${100 - (w.kg-min)/(max-min)*80}`).join(' ');
  return <div className="weight-trend"><div><span>Media de 7 días · hasta {dateLabel(latest.date)}</span><strong>{numberLabel(mean)} <small>kg</small></strong><small>{recent.length} {recent.length === 1 ? 'registro' : 'registros'} en esa ventana de 7 días</small></div><svg viewBox="0 0 300 120" role="img" aria-label="Evolución del peso corporal por fecha"><line x1="0" y1="100" x2="300" y2="100" stroke="#3b4334" strokeDasharray="4 4" /><polyline points={points} fill="none" stroke="#c8f36b" strokeWidth="2.5" />{points.split(' ').map((p,i) => { const [x,y] = p.split(','); return <circle key={i} cx={x} cy={y} r="3.5" fill="#c8f36b"><title>{sorted[i].date}: {sorted[i].kg} kg</title></circle>; })}</svg><div className="chart-labels"><span>{dateLabel(sorted[0].date)}</span><span>{dateLabel(latest.date)}</span></div></div>;
}
