import {test,expect} from '@playwright/test';
import {createSession,emptyData,days,routines} from '../src/model';
import {prepareExistingSession,readPrescriptions,type Prescription} from '../src/training';

test('cada semana y día aplica su plan completo en sesiones nuevas y pendientes',()=>{
 const data=emptyData();const plans:Prescription[]=[];
 for(let start=1;start<=9;start+=4){
  const rows:unknown[][]=[];
  for(const [di,day] of days.entries()){
   rows.push([null,`SESIÓN ${di+1}`,null,day==='Brazos'?'BRAZOS':`FULLBODY ${day}`]);
   rows.push([null,'ORDEN','EJERCICIO',null,null,'RANGO REPS',...Array.from({length:4},(_,w)=>[`SERIES S${start+w}`,`RIR S${start+w}`]).flat()]);
   for(const [ei,[name]] of routines[day].entries()){
    rows.push([null,String.fromCharCode(65+ei),name,null,null,'8 - 10',...Array.from({length:4},(_,w)=>[1+(start+w+di+ei)%4,String((w+di)%3)]).flat()]);
   }
  }
  plans.push(...readPrescriptions([{sheet:`ENTRENAMIENTO S${start} - S${start+3}`,data:rows}],'a'.repeat(64),7));
 }
 data.excel={version:1,sources:[],days:[],weeks:[],notes:[],issues:[],prescriptions:plans};
 for(let week=1;week<=12;week++)for(const [di,day] of days.entries()){
  const fresh=createSession(7,week,day,'2026-10-25',data);
  const stale=createSession(7,week,day,'2026-10-25');
  // Stale metadata must not suppress a recheck of goals, RIR or reduced set counts.
  stale.exercises.forEach(e=>{e.prescription='antiguo';e.sets.forEach(s=>s.goal='antiguo');});
  const resumed=prepareExistingSession(data,stale);
  for(const session of [fresh,resumed]){
   expect(session.exercises).toHaveLength(routines[day].length);
   session.exercises.forEach((e,ei)=>{
    expect(e.sets).toHaveLength(1+(week+di+ei)%4);
    expect(e.sets.every(s=>s.goal==='8–10'&&s.targetRir===((week-1)%4+di)%3)).toBe(true);
   });
   expect(session.planSource).toBe(`ENTRENAMIENTO S${Math.floor((week-1)/4)*4+1} - S${Math.floor((week-1)/4)*4+4}`);
  }
  expect(prepareExistingSession(data,resumed)).toBe(resumed);
  resumed.exercises[0].sets[0].goal='objetivo obsoleto';resumed.exercises[0].sets[0].targetRir=9;
  const refreshed=prepareExistingSession(data,resumed);expect(refreshed.exercises[0].sets[0].goal).toBe('8–10');expect(refreshed.exercises[0].sets[0].targetRir).toBe(((week-1)%4+di)%3);
  const finished={...stale,finished:true};expect(prepareExistingSession(data,finished)).toBe(finished);
 }
 expect(createSession(8,6,'C','2026-10-25',data).planSource).toBeUndefined();
});

test('añade ejercicios del plan y conserva series extra con trabajo real',()=>{
 const data=emptyData(),session=createSession(7,6,'C','2026-10-25');
 const e=session.exercises[0];e.sets[1].done=true;e.sets[1].left.reps=8;e.sets[1].left.weight=40;e.notes='Ajuste';
 data.excel={version:1,sources:[],days:[],weeks:[],notes:[],issues:[],prescriptions:[
 {sourceId:'a'.repeat(64),sheet:'ENTRENAMIENTO S5 - S8',block:7,week:6,day:'C',name:e.name,goals:['10–12'],rir:'2',series:'1',linear:true},
 {sourceId:'a'.repeat(64),sheet:'ENTRENAMIENTO S5 - S8',block:7,week:6,day:'C',name:'Ejercicio nuevo',goals:['8–10','8–10','8–10'],rir:'1',series:'3',linear:true}
 ]};
 const updated=prepareExistingSession(data,session);expect(updated.exercises).toHaveLength(2);
 expect(updated.exercises[0].sets).toHaveLength(2);expect(updated.exercises[0].sets[1]).toEqual(e.sets[1]);expect(updated.exercises[0].notes).toBe('Ajuste');expect(updated.exercises[0].prescription).toContain('adicionales conservadas');expect(updated.exercises[1].sets).toHaveLength(3);
 expect(updated.id).toBe(session.id);expect(updated.startedAt).toBe(session.startedAt);
});

test('abrir y retomar entreno desde inicio o historial lleva arriba',async({page})=>{
 await page.goto('./');
 const scroll=async()=>page.evaluate(()=>{const main=document.querySelector('.main-shell')!;main.scrollTop=main.scrollHeight;window.scrollTo(0,document.body.scrollHeight);});
 const top=async()=>expect.poll(()=>page.evaluate(()=>Math.max(window.scrollY,document.querySelector('.main-shell')!.scrollTop))).toBe(0);
 await page.getByRole('button',{name:'Empezar entrenamiento'}).scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await top();
 await scroll();await page.getByRole('button',{name:'Volver a mi diario'}).click();
 await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await top();
 await scroll();await page.locator('.sidebar:visible nav,.mobile-nav:visible').getByRole('button',{name:'Historial',exact:true}).click();
 await page.locator('.history-row').click();await top();
});

test('Excel importado corrige a tres series el predicador de A7 al abrir desde historial',async({page})=>{
 const menu=(name:string)=>page.locator('.sidebar:visible nav,.mobile-nav:visible').getByRole('button',{name,exact:true});
 await page.goto('./');await page.getByLabel('Semana',{exact:true}).fill('7');await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
 const curl=page.locator('.exercise-card').filter({has:page.getByRole('heading',{name:'Curl predicador con mancuerna',exact:true})});
 await expect(curl.locator('.set-row')).toHaveCount(2);
 await menu('Mis datos').click();await page.getByTestId('excel-file').setInputFiles('tests/fixtures/Bloque 7 - Plan sintetico.xlsx');
 await page.getByRole('button',{name:'Añadir datos del Excel',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Excel importado');
 await menu('Historial').click();await page.locator('.history-row').click();await expect(curl.locator('.set-row')).toHaveCount(3);
 await expect(curl).toContainText('Excel · 3 series');await expect(page.getByText('Rutina del Excel · ENTRENAMIENTO S5 - S8')).toBeVisible();
 await page.reload();await menu('Historial').click();await page.locator('.history-row').click();await expect(curl.locator('.set-row')).toHaveCount(3);
});
