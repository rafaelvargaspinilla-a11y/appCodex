import { historicalSessions, parseHistory, type HistoryArchive } from './history';
export type Day = 'A' | 'B' | 'C' | 'Brazos';
export type Result = { weight: number | null; reps: number | null; rir: string; failure: boolean; partials: number | null };
export type SetRecord = { id: string; goal: string; targetRir: number; done: boolean; split: boolean; left: Result; right: Result };
export type Exercise = { id: string; name: string; unilateral: boolean; loadLabel: string; equipment: string; notes: string; sets: SetRecord[] };
export type Session = { id: string; block: number; week: number; day: Day; date: string; createdAt: string; finished: boolean; exercises: Exercise[] };
export type BodyWeight = { id: string; date: string; kg: number; note: string };
export type Data = { version: 1; sessions: Session[]; weights: BodyWeight[]; history?: HistoryArchive };
type Template = [string, string[], boolean?, string?];
const dumbbell = 'kg por mancuerna';
const machine = 'kg indicados en la máquina';
const added = 'kg añadidos';
export const days: Day[] = ['A', 'B', 'C', 'Brazos'];
export type SessionPosition = { block: number; week: number; day: Day };
// Resume an unfinished session; advance only when it is explicitly finished.
// Logical routine order keeps edits to older sessions from rewinding progress.
export function suggestedSession(data: Data): SessionPosition {
  const latest = [...data.sessions, ...historicalSessions(data.history).map(s => ({ ...s, finished: true }))].sort((a, b) =>
    b.block - a.block || b.week - a.week || days.indexOf(b.day) - days.indexOf(a.day))[0];
  if (!latest) return { block: 7, week: 6, day: 'A' };
  if (!latest.finished) return { block: latest.block, week: latest.week, day: latest.day };
  const index = days.indexOf(latest.day);
  return { block: latest.block, week: latest.week + (index === days.length - 1 ? 1 : 0), day: days[(index + 1) % days.length] };
}
export const routines: Record<Day, Template[]> = {
  A: [
    ['Elevaciones laterales', ['8–10', '8–10'], false, dumbbell],
    ['Press inclinado con mancuernas', ['4–6', '8–10'], false, dumbbell],
    ['Remo con mancuerna', ['6–8', '6–8'], true, dumbbell],
    ['Curl predicador con mancuerna', ['10–12', '10–12'], true, dumbbell],
    ['Curl femoral sentado', ['6–8', '10–12'], false, machine],
    ['Prensa unilateral', ['10–12', '10–12'], true, added],
    ['Gemelo en máquina', ['12–15', '15–20'], false, machine]
  ],
  B: [
    ['Elevaciones de piernas colgado', ['AMRAP'], false, 'kg de lastre (opcional)'],
    ['Remo con barra', ['6–8', '10–12'], false, 'kg totales, incluida la barra'],
    ['Sentadilla hack', ['4–6', '8–10'], false, added],
    ['Curl femoral tumbado', ['6–8', '6–8'], false, machine],
    ['Press estrecho en multipower', ['6–8', '10–12'], false, added],
    ['Curl martillo', ['8–10', '8–10'], true, dumbbell],
    ['Elevaciones laterales', ['10–12', '10–12'], false, dumbbell]
  ],
  C: [
    ['Curl femoral tumbado', ['6–8', '6–8'], false, machine],
    ['Peso muerto', ['4–6', '8–10'], false, 'kg totales, incluida la barra'],
    ['Prensa', ['10–12', '10–12'], false, added],
    ['Press muy inclinado con mancuernas', ['8–10', '8–10'], false, dumbbell],
    ['Jalón unilateral', ['8–10', '8–10'], true, machine],
    ['Elevaciones laterales', ['10–12', '10–12'], false, dumbbell],
    ['Bíceps en polea trasera', ['10–12', '10–12'], true, machine]
  ],
  Brazos: [
    ['Elevaciones laterales', ['8–10', '10–12'], false, dumbbell],
    ['Curl de bíceps con barra', ['8–10', '10–12'], false, 'kg totales, incluida la barra'],
    ['JM press en multipower', ['8–12', '8–12'], false, added],
    ['Curl con mancuernas sentado', ['10–15', '10–15'], false, dumbbell],
    ['Extensión de codo overhead', ['10–15', '10–15'], true, dumbbell],
    ['Elevaciones laterales en polea Y', ['12–15', '12–15'], true, machine]
  ]
};
export const emptyData = (): Data => ({ version: 1, sessions: [], weights: [] });
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export const result = (weight: number | null = null): Result => ({ weight, reps: null, rir: '', failure: false, partials: null });
export function newSet(goal: string, weight: number | null = null, targetRir = 0): SetRecord {
  return { id: crypto.randomUUID(), goal, targetRir, done: false, split: false, left: result(weight), right: result(weight) };
}
export function createSession(block: number, week: number, day: Day, date: string): Session {
  return {
    id: crypto.randomUUID(), block, week, day, date, createdAt: new Date().toISOString(), finished: false,
    exercises: routines[day].map(([name, goals, unilateral = false, loadLabel = dumbbell], i) => ({
      id: `${day}-${i}`, name, unilateral, loadLabel, equipment: '', notes: '',
      sets: goals.map(goal => newSet(goal, null, name === 'Gemelo en máquina' ? 2 : 0))
    }))
  };
}
export function previousExercise(data: Data, session: Session, exercise: Exercise): Exercise | undefined {
  return data.sessions.filter(s => s.id !== session.id &&
    (s.date < session.date || (s.date === session.date && s.createdAt < session.createdAt)))
    .sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .flatMap(s => s.exercises).find(e => e.name === exercise.name && e.loadLabel === exercise.loadLabel &&
      e.equipment === exercise.equipment && e.sets.some(set => set.done));
}
export function validResult(r: Result): boolean {
  return r.reps !== null && Number.isInteger(r.reps) && r.reps >= 0;
}
export const completedSets = (s: Session) => s.exercises.reduce((n,e) => n + e.sets.filter(set => set.done).length, 0);
export const totalSets = (s: Session) => s.exercises.reduce((n,e) => n + e.sets.length, 0);

// Backups are untrusted input: validate before changing local records.
export function parseBackup(text: string): Data {
  const d = JSON.parse(text);
  const fail = (): never => { throw new Error('La copia no tiene un formato válido de Beast Log.'); };
  const str = (v: unknown) => typeof v === 'string' && v.length < 100_000;
  const num = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
  const int = (v: unknown) => num(v) && (v === null || Number.isInteger(v));
  const date = (v: unknown) => str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string) &&
    !Number.isNaN(Date.parse(v as string)) && new Date(v as string).toISOString().slice(0,10) === v;
  const res = (r: Result) => r && num(r.weight) && int(r.reps) && str(r.rir) &&
    /^(|[0-9]|10|0–1|1–2|2–3)$/.test(r.rir) && typeof r.failure === 'boolean' && int(r.partials);
  if (!d || d.version !== 1 || !Array.isArray(d.sessions) || !Array.isArray(d.weights) ||
    d.sessions.length > 10000 || d.weights.length > 100000) fail();
  const ids = new Set();
  for (const s of d.sessions) {
    if (!s || !str(s.id) || ids.has(s.id) || !Number.isInteger(s.block) || s.block < 1 ||
      !Number.isInteger(s.week) || s.week < 1 || !days.includes(s.day) || !date(s.date) ||
      !str(s.createdAt) || Number.isNaN(Date.parse(s.createdAt)) || typeof s.finished !== 'boolean' ||
      !Array.isArray(s.exercises) || s.exercises.length > 100) fail();
    ids.add(s.id);
    const exerciseIds = new Set();
    for (const e of s.exercises) {
      if (!e || !str(e.id) || exerciseIds.has(e.id) || !str(e.name) || !str(e.loadLabel) || !str(e.equipment) || !str(e.notes) ||
        typeof e.unilateral !== 'boolean' || !Array.isArray(e.sets) || e.sets.length > 100) fail();
      exerciseIds.add(e.id);
      const setIds = new Set();
      for (const set of e.sets) {
        if (!set || !str(set.id) || setIds.has(set.id) || !str(set.goal) || typeof set.done !== 'boolean' ||
          typeof set.split !== 'boolean' || !Number.isInteger(set.targetRir) || set.targetRir < 0 ||
          !res(set.left) || !res(set.right) || (set.done && (!validResult(set.left) || (set.split && !validResult(set.right))))) fail();
        setIds.add(set.id);
      }
    }
  }
  ids.clear();
  for (const w of d.weights) {
    if (!w || !str(w.id) || ids.has(w.id) || !date(w.date) || typeof w.kg !== 'number' || !Number.isFinite(w.kg) ||
      w.kg <= 0 || !str(w.note)) fail();
    ids.add(w.id);
  }
  if (d.history !== undefined) d.history = parseHistory(d.history);
  return d as Data;
}
