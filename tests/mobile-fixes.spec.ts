import {test,expect,type Page} from '@playwright/test';
import {createSession} from '../src/model';
import {historicalResults} from '../src/previousResults';
const menu=(page:Page,label:string)=>page.locator('.sidebar:visible nav, .mobile-nav:visible').getByRole('button',{name:label,exact:true});
async function restore(page:Page,data:unknown){await menu(page,'Mis datos').click();await page.getByTestId('backup-file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.getByRole('button',{name:'Guardar copia y restaurar',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Copia restaurada');await menu(page,'Entrenar').click();}

test('retomar una sesión antigua rellena los campos sin cambiar lo escrito o completado',async({page})=>{
 const old=createSession(7,5,'C','2026-10-11');delete old.prefillVersion;old.exercises[0].sets[0].left.weight=80;
 old.exercises[2].sets[0].left={weight:99,reps:12,rir:'2',failure:false,partials:null};old.exercises[2].sets[0].done=true;
 const history={format:'beast-log-history',version:1,files:[{name:'gym.txt',text:'Bloque 7\nSemana 5\nDia B\n1. Femoral tumbado -> 6-8(+0) 77kg 8(+0), 5(+0) Boquete 0 y 6\n2. Elevaciones laterales con mancuernas -> 10-12(+0) 16kg 11(+0) CONTROLAR EXCENTRICA, 8(+0) NO LEVANTAR PIES\n'}]};
 await page.goto('./');await restore(page,{version:1,sessions:[old],weights:[],history});await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
 await expect(page.getByRole('spinbutton',{name:'Curl femoral tumbado serie 1  carga',exact:true})).toHaveValue('80');await expect(page.getByRole('spinbutton',{name:'Curl femoral tumbado serie 1  repeticiones',exact:true})).toHaveValue('8');await expect(page.getByRole('spinbutton',{name:'Curl femoral tumbado serie 2  carga',exact:true})).toHaveValue('77');await expect(page.getByRole('spinbutton',{name:'Curl femoral tumbado serie 2  repeticiones',exact:true})).toHaveValue('5');
 await expect(page.getByRole('spinbutton',{name:'Elevaciones laterales serie 1  repeticiones',exact:true})).toHaveValue('11');await expect(page.getByRole('spinbutton',{name:'Elevaciones laterales serie 2  repeticiones',exact:true})).toHaveValue('8');await expect(page.getByRole('spinbutton',{name:'Prensa serie 1  carga',exact:true})).toHaveValue('99');await expect(page.getByRole('button',{name:'Desmarcar Prensa serie 1',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText(/Series lineales:/)).toHaveCount(0);
 await page.getByRole('spinbutton',{name:'Curl femoral tumbado serie 2  repeticiones',exact:true}).fill('');await expect(page.getByRole('status')).toContainText('Guardado');await page.reload();await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await expect(page.getByRole('spinbutton',{name:'Curl femoral tumbado serie 2  repeticiones',exact:true})).toHaveValue('');
});

test('overhead usa una sola mancuerna en sesiones nuevas y al retomar una pendiente',async({page})=>{
 const old=createSession(7,5,'Brazos','2026-10-11');delete old.prefillVersion;
 const overhead=old.exercises.find(e=>/overhead/.test(e.name))!;overhead.unilateral=true;overhead.loadLabel='kg por mancuerna';overhead.sets.forEach(s=>s.split=true);
 const history={format:'beast-log-history',version:1,files:[{name:'gym.txt',text:'Bloque 7\nSemana 4\nBrazos\n1. Extensión de codo overhead -> 10-15(+0) 18kg 12(+0), 10(+0) TÉCNICA\n'}]};
 await page.goto('./');await restore(page,{version:1,sessions:[old],weights:[],history});await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
 const card=page.locator('.exercise-card').filter({has:page.getByRole('heading',{name:'Extensión de codo overhead',exact:true})});await expect(card).toContainText('kg de la mancuerna');await expect(card.getByLabel('Diferenciar lados')).toHaveCount(0);await expect(card.getByText('Derecha',{exact:true})).toHaveCount(0);await expect(card.getByRole('spinbutton',{name:'Extensión de codo overhead serie 1  carga',exact:true})).toHaveValue('18');await expect(card.getByRole('spinbutton',{name:'Extensión de codo overhead serie 2  repeticiones',exact:true})).toHaveValue('10');
 await page.getByRole('button',{name:'Volver a mi diario'}).click();await page.getByLabel('Semana',{exact:true}).fill('6');await page.getByRole('button',{name:'Empezar entrenamiento'}).click();await expect(card.getByLabel('Diferenciar lados')).toHaveCount(0);await expect(card.getByRole('spinbutton',{name:'Extensión de codo overhead serie 1  carga',exact:true})).toHaveValue('18');
});

test('navegación y relojes respetan la zona segura y permanecen visibles al deslizar',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');await page.addStyleTag({content:':root{--safe-top:59px;--safe-bottom:34px;}'});await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
 const nav=page.locator('.mobile-nav'),header=page.locator('.topbar'),clock=page.locator('.session-clocks');
 const baseline=(await nav.boundingBox())!;
 for(const offset of [900,1600,500,1100]){
  await page.locator('.main-shell').evaluate((e,y)=>e.scrollTop=y,offset);
  const current=(await nav.boundingBox())!,safeHeader=(await header.boundingBox())!,timer=(await clock.boundingBox())!;
  expect(current.y).toBeCloseTo(baseline.y,0);expect(current.y+current.height).toBeLessThanOrEqual(845);expect(timer.y).toBeGreaterThanOrEqual(safeHeader.y+safeHeader.height);expect(safeHeader.height).toBeGreaterThanOrEqual(120);await expect(nav.getByRole('button',{name:'Entrenar',exact:true})).toBeInViewport();
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:`/tmp/beast-mobile-${test.info().project.name}.png`});
});

test('histórico conserva series con comentarios, lados y parciales sin contar instrucciones como repeticiones',()=>{
 const sets=historicalResults('10-12(+0) -> 10-12(+0) 14kg 10(+0) dch 10(+1) izq, 9(+0) dch 9(+0) izq BOQUETE 3',true);
 expect(sets).toHaveLength(2);expect(sets[0].split).toBe(true);expect(sets[0].left.rir).toBe('1');expect(sets[0].right.rir).toBe('0');expect(sets[1].left.reps).toBe(9);
 const partial=historicalResults('Femoral -> 6-8(+0) 77kg 8(+0), 5(+1 parcial) CONTROL',false);expect(partial).toHaveLength(2);expect(partial[1].left.partials).toBe(1);
 const unknown=historicalResults('Remo -> 20kg 8(creo) 6(+0)',false);expect(unknown[0].left.reps).toBeNull();expect(unknown[1].left.reps).toBe(6);
 const ds=historicalResults('Prensa -> 20kg 10(+0) + DS 10kg 8(+0)',false);expect(ds).toHaveLength(1);
});
