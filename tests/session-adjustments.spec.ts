import {test,expect} from '@playwright/test';
import {createSession,emptyData,parseBackup} from '../src/model';
import {prepareExistingSession,readPrescriptions} from '../src/training';

test('C semana 6 actualiza series de una sesión pendiente y conserva resultados',()=>{
 const data=emptyData(),session=createSession(7,6,'C','2026-10-24',data);
 const first=session.exercises[5];first.sets[0].done=true;first.sets[0].left.reps=8;first.sets[0].left.weight=40;
 first.sets[1].left.weight=35;first.notes='Ajuste guardado';data.sessions.push(session);
 const plans=readPrescriptions([{sheet:'ENTRENAMIENTO S5 - S8',data:[
 [null,'SESIÓN 3',null,'FULLBODY C'],
 [null,'ORDEN','EJERCICIO',null,null,'RANGO REPS','SERIES S5','RIR S5','SERIES S6','RIR S6'],
 [null,'A','ELEVACIONES LATERALES CON MANCUERNA',null,null,'6 - 8','2','1','2 (+ 1)','0'],
 [null,'B','CURL BÍCEPS POLEA TRASERA',null,null,'4 - 6 / 8 - 10','2','1','2 + 1','1']
 ]}],'a'.repeat(64),7);
 data.excel={version:1,sources:[],days:[],weeks:[],notes:[],issues:[],prescriptions:plans};
 const prepared=prepareExistingSession(data,session);
 expect(plans.find(p=>p.week===5)!.goals).toHaveLength(2);
 expect(prepared.exercises[5].sets).toHaveLength(3);expect(prepared.exercises[6].sets).toHaveLength(3);
 expect(prepared.exercises[5].sets[0]).toEqual(first.sets[0]);expect(prepared.exercises[5].sets[1].left.weight).toBe(35);
 expect(prepared.exercises[5].notes).toBe('Ajuste guardado');expect(prepared.startedAt).toBe(session.startedAt);
 expect(prepareExistingSession(data,prepared)).toBe(prepared);
 expect(prepareExistingSession(data,{...session,finished:true}).exercises[5].sets).toHaveLength(2);
});

test('notas visibles se heredan sin completar series y se pueden borrar',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');
 await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
 const note=page.locator('.exercise-card').first().getByLabel('Notas y ajustes');
 await expect(note).toBeVisible();await note.fill('Banco a 2, hombros abajo');
 await expect(page.getByRole('status')).toContainText('Guardado en este dispositivo');
 await page.reload();await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await expect(note).toHaveValue('Banco a 2, hombros abajo');
 await page.getByRole('button',{name:'Volver a mi diario'}).click();await page.getByLabel('Semana',{exact:true}).fill('7');
 await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await expect(note).toHaveValue('Banco a 2, hombros abajo');
 await note.fill('');await expect(page.getByRole('status')).toContainText('Guardado en este dispositivo');
 await page.getByRole('button',{name:'Volver a mi diario'}).click();await page.getByLabel('Semana',{exact:true}).fill('8');
 await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await expect(note).toHaveValue('');
 for(const control of await page.locator('.exercise-card input:not([type=checkbox]),.exercise-card select,.exercise-card textarea').all()){
  expect(await control.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
 }
 await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content',/maximum-scale=1.0, user-scalable=no/);
 const data=emptyData();data.exerciseNotes={'Elevaciones laterales':''};expect(parseBackup(JSON.stringify(data)).exerciseNotes).toEqual(data.exerciseNotes);
});
