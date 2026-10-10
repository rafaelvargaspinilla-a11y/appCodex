import {test,expect,type Page} from '@playwright/test';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const menu=(page:Page,label:string)=>page.locator('.sidebar:visible nav, .mobile-nav:visible').getByRole('button',{name:label,exact:true});
const saved=async(page:Page)=>expect(page.getByRole('status')).toContainText('Guardado en este dispositivo');
const dump=async(page:Page)=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('beast-log',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return await new Promise<any>((resolve)=>{const tx=db.transaction('app');const r=tx.objectStore('app').get('data');tx.oncomplete=()=>{db.close();resolve(r.result);};});});
const finish=async(page:Page)=>{await page.getByRole('button',{name:'Terminar sesión',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Terminar sesión',exact:true}).click();await saved(page);};

test('precarga por serie; propaga cargas lineales; comentarios, cardio y relojes sobreviven a recarga',async({page})=>{
 await page.clock.install({time:new Date('2026-10-10T10:00:00Z')});await page.clock.pauseAt('2026-10-10T10:00:01Z');await page.goto('./');await page.getByLabel('Semana',{exact:true}).fill('1');await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
 const first=page.locator('.exercise-card').first();const second=page.locator('.exercise-card').nth(1);
 const weight=(i:number)=>first.getByRole('spinbutton',{name:`Elevaciones laterales serie ${i}  carga`,exact:true});
 await weight(1).fill('16');await expect(weight(2)).toHaveValue('16');
 for(const [i,reps] of [[1,10],[2,8]]){await first.getByRole('spinbutton',{name:`Elevaciones laterales serie ${i}  repeticiones`,exact:true}).fill(String(reps));await first.getByRole('button',{name:`Completar Elevaciones laterales serie ${i}`,exact:true}).click();}
 await second.getByRole('spinbutton',{name:'Press inclinado con mancuernas serie 1  carga',exact:true}).fill('30');await expect(second.getByRole('spinbutton',{name:'Press inclinado con mancuernas serie 2  carga',exact:true})).toHaveValue('');
 await first.getByRole('button',{name:'Añadir comentario',exact:true}).click();await first.getByLabel('Notas y ajustes').fill('Banco 2');await expect(first.locator('.set-row')).toHaveCount(2);await expect(page.getByRole('button',{name:'Añadir serie',exact:true})).toHaveCount(0);
 await page.getByLabel('He hecho cardio al final del entrenamiento').check();await saved(page);
 const started=(await dump(page)).sessions[0].startedAt;
 await page.clock.fastForward(61000);await expect(page.getByTestId('rest-clock')).toHaveText('01:01');await expect(page.getByTestId('session-duration')).toHaveText('01:01');
 await page.reload();await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await expect(page.getByTestId('rest-clock')).toHaveText('01:01');expect((await dump(page)).sessions[0].startedAt).toBe(started);
 await finish(page);const completed=(await dump(page)).sessions[0];expect(completed.cardio).toBe(true);expect(Date.parse(completed.endedAt)-Date.parse(completed.startedAt)).toBeGreaterThanOrEqual(61000);
 await page.getByLabel('Semana',{exact:true}).fill('2');await page.getByRole('button',{name:'DÍA A A 7 ejercicios'}).click();await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
 await expect(weight(1)).toHaveValue('16');await expect(first.getByRole('spinbutton',{name:'Elevaciones laterales serie 1  repeticiones',exact:true})).toHaveValue('10');await expect(first.getByRole('spinbutton',{name:'Elevaciones laterales serie 2  repeticiones',exact:true})).toHaveValue('8');await expect(first.getByTestId('previous-set')).toHaveCount(2);await expect(first.getByRole('button',{name:'Completar Elevaciones laterales serie 1',exact:true})).toHaveAttribute('aria-pressed','false');
 await first.getByRole('button',{name:'Completar Elevaciones laterales serie 2',exact:true}).click();await weight(1).fill('18');await expect(weight(2)).toHaveValue('16');
 await saved(page);expect((await dump(page)).sessions[1].exercises[0].sets[0].done).toBe(false);
 await menu(page,'Historial').click();await expect(page.locator('.history-row').last()).toContainText('Cardio');await expect(page.locator('.history-row').last()).toContainText('01:01');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('el TXT precarga la última sesión del mismo día sin marcarla como realizada',async({page})=>{
 await page.goto('./');await menu(page,'Mis datos').click();await page.getByTestId('history-file').setInputFiles({name:'Gym.txt',mimeType:'text/plain',buffer:Buffer.from('Bloque 7\nSemana 1\nDia A\n1. Elevaciones laterales -> 16kg 10(+1) 8(+0)\nDia B\n1. Elevaciones laterales -> 20kg 6(+0) 5(+0)')});await menu(page,'Entrenar').click();await page.getByLabel('Semana',{exact:true}).fill('2');await page.getByRole('button',{name:'DÍA A A 7 ejercicios'}).click();await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
 await expect(page.getByRole('spinbutton',{name:'Elevaciones laterales serie 1  carga',exact:true})).toHaveValue('16');await expect(page.getByRole('spinbutton',{name:'Elevaciones laterales serie 2  repeticiones',exact:true})).toHaveValue('8');await expect(page.locator('.session-progress strong')).toHaveText('0 / 14');await saved(page);
 const data=await dump(page);expect(data.sessions[0].exercises[0].sets.every((s:any)=>!s.done)).toBe(true);
});

test('el Excel real prescribe cada semana y migra originales de copias antiguas',async({page})=>{
 const root='/workspace/attachments';const files=existsSync(root)?readdirSync(root).flatMap(d=>{try{return readdirSync(join(root,d)).filter(f=>/^Bloque 7 .*\.xlsx$/.test(f)).map(f=>join(root,d,f));}catch{return [];}}):[];
 test.skip(files.length!==1,'Original personal solo disponible en el entorno');
 await page.goto('./');await menu(page,'Mis datos').click();await page.getByTestId('excel-file').setInputFiles(files);await expect(page.getByRole('dialog')).toContainText('30 pesajes encontrados');await page.getByRole('button',{name:'Añadir datos del Excel',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Excel importado');
 let data=await dump(page);expect(data.excel.prescriptions.length).toBeGreaterThan(300);
 // Simulate the prior version's backup: originals exist, derived routine metadata does not.
 delete data.excel.prescriptions;
 await page.getByTestId('backup-file').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.getByRole('button',{name:'Guardar copia y restaurar',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Copia restaurada');
 data=await dump(page);expect(data.excel.prescriptions.length).toBeGreaterThan(300);await menu(page,'Entrenar').click();await expect(page.locator('.summary-card').nth(1)).toContainText('/ 48 sesiones');await expect(page.locator('.summary-card').nth(1)).toContainText('31 %');
 await page.getByLabel('Semana',{exact:true}).fill('7');await page.getByRole('button',{name:'DÍA A A 7 ejercicios'}).click();await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
 const curl=page.locator('.exercise-card').filter({has:page.getByRole('heading',{name:'Curl predicador con mancuerna',exact:true})});await expect(curl.locator('.set-row')).toHaveCount(3);await expect(curl).toContainText('Excel · 3 series');await expect(page.getByText('Rutina del Excel · ENTRENAMIENTO S5 - S8')).toBeVisible();
 await page.getByRole('button',{name:'Volver a mi diario'}).click();await page.getByLabel('Semana',{exact:true}).fill('1');await page.getByRole('button',{name:'DÍA C C 7 ejercicios'}).click();await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await expect(page.locator('.exercise-card').filter({has:page.getByRole('heading',{name:'Elevaciones laterales',exact:true})}).locator('.set-row')).toHaveCount(1);
 await page.getByRole('button',{name:'Volver a mi diario'}).click();await page.getByRole('button',{name:/DÍA 4 Brazos/ }).click();await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await expect(page.locator('.exercise-card')).toHaveCount(8);
 await saved(page);await page.reload();await menu(page,'Mis datos').click();const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar mis datos',exact:true}).click();const backup=JSON.parse(readFileSync((await(await waiting).path())!,'utf8'));expect(backup.sessions).toHaveLength(3);expect(Buffer.from(backup.excel.sources[0].content,'base64')).toEqual(readFileSync(files[0]));
});

test('prescripciones distinguen series añadidas, técnicas especiales y semanas vacías',async()=>{
 const {readPrescriptions,propagateWeight}=await import('../src/training');const {createSession,parseBackup}=await import('../src/model');
 const plans=readPrescriptions([{sheet:'ENTRENAMIENTO S1 - S4',data:[
 [null,'SESIÓN 1',null,'FULLBODY A'],
 [null,'ORDEN','EJERCICIO',null,null,'RANGO REPS','SERIES S1','RIR S1','SERIES S2','RIR S2'],
 [null,'p1','Preparación',null,null,'4 - 8','2','alto','2','alto'],
 [null,'A','ELEVACIONES LATERALES',null,null,'8 - 10','2 (+1)','0','3 + dropset (última serie)','0 + parciales'],
 [null,'B','PRESS INCLINADO CON MANCUERNAS',null,null,'4 - 6 / 8 - 10','3','1',null,null]
 ]}],'a'.repeat(64),7);
 expect(plans).toHaveLength(3);expect(plans[0].goals).toEqual(['8–10','8–10','8–10']);expect(plans[1].goals).toHaveLength(3);expect(plans[1].series).toContain('dropset');expect(plans[2].goals).toEqual(['4–6','8–10','8–10']);
 const session=createSession(7,1,'A','2026-10-10',{version:1,sessions:[],weights:[],excel:{version:1,sources:[],days:[],weeks:[],notes:[],issues:[],prescriptions:plans}});
 expect(session.exercises).toHaveLength(2);expect(session.exercises[0].sets).toHaveLength(3);
 const linear={...session.exercises[0],linear:true};linear.sets[0].split=true;const changed=propagateWeight(linear,linear.sets[0].id,'right',{...linear.sets[0].right,weight:18});expect(changed.sets[1].right.weight).toBe(18);expect(changed.sets[1].left.weight).toBeNull();
 const archive={format:'beast-log-history' as const,version:1 as const,files:[{name:'gym.txt',text:'Bloque 7\nSemana 1\nDia A\n1. Elevaciones laterales -> 16kg 10(+3+4) 8(+1+0)'}]};
 const historical=createSession(7,2,'A','2026-10-10',{version:1,sessions:[],weights:[],history:archive});
 expect(historical.exercises[0].sets[0].left.rir).toBe('');expect(historical.exercises[0].sets[0].previous?.label).toContain('RIR original 3–4');expect(historical.exercises[0].sets[1].left.rir).toBe('0–1');
 expect(()=>parseBackup(JSON.stringify({version:1,sessions:[historical],weights:[],history:archive}))).not.toThrow();
});
