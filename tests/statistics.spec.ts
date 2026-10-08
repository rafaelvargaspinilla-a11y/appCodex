import { test, expect } from '@playwright/test';
import { attendance, defaultCalendar, extractStatistics, record, weekDate } from '../src/statistics';
import type { Data } from '../src/model';
const dataWith=(text:string):Data=>({version:1,sessions:[],weights:[],history:{format:'beast-log-history',version:1,files:[{name:'fixture.txt',text}]}});
const menu=(page:import('@playwright/test').Page,label:string)=>page.locator('.sidebar:visible nav, .mobile-nav:visible').getByRole('button',{name:label,exact:true});

test('calendario conserva huecos y límites de bloque; constancia deduplica posiciones',()=>{
  const data=dataWith('Bloque 7\nSemana 1\nDia A\n1. Remo con barra -> 60kg 8(+0)\nSemana 3\nDia B\n1. Remo con barra -> 70kg 8(+0)');
  const c={...defaultCalendar(data),anchorDate:'2026-10-08',block:7,week:5};
  expect(weekDate(7,5,c)).toBe('2026-10-05');
  expect(weekDate(7,3,c)).toBe('2026-09-21');
  expect(weekDate(6,12,c)).toBe('2026-08-31');
  const rows=attendance(data,c);
  expect(rows.find(r=>r.block===7&&r.week===2)?.count).toBe(0);
  data.sessions.push({id:'new',block:7,week:1,day:'A',date:'2026-09-08',createdAt:'2026-09-08T12:00:00Z',finished:true,exercises:[]});
  expect(attendance(data,c).find(r=>r.week===1)?.count).toBe(1);
  data.sessions.push({...data.sessions[0],id:'open',day:'C',finished:false});
  expect(attendance(data,c).find(r=>r.week===1)?.count).toBe(1);
});

test('marcas separan objetivos, unidades, notas, parciales y técnicas especiales',()=>{
  const data=dataWith(`Bloque 7
Semana 5
Dia A
1. Remo con mancuerna -> 6-8(+0) 30kg 8(+0+1), 9(+1 parcial) SUBIR A 99kg // 8-10(+0) 25kg 12(+0)
2. Curl mancuernas sentado -> 10-15(+0) 14(+1), 11(+0)
3. Elevaciones piernas colgado -> AMRAP 15(+0)
4. Biceps en polea trasera -> 12-15(+0) 20kg 12(+0) // cluster 9-8-7 40kg 7+2+2
5. Jalón unilateral -> 8-10(+0) 40lbs 8(+0) // 10-12(+0) 30kg 12(+0)
6. Elevaciones laterales -> 10-12(+0) 10kg 14(la 14 la hago al 75%) + DS 5kg 20(+0)
7. Remo con barra -> 6-8(+0) 100kg 0(fallo)
8. Press inclinado con mancuernas -> 6-8(+0) 30kg 8(+0) + DS 15kg 10(+0) // 10-12(+0) 12(+0)
`);
  const {performances:r}=extractStatistics(data);
  const rows=r.filter(x=>x.exercise==='Remo con mancuerna');
  expect(rows.map(x=>[x.weight,x.reps])).toEqual([[30,8],[30,9],[25,12]]);
  expect(rows[0].rir).toBe('0–1');expect(rows[1].partials).toBe(1);
  expect(record(rows)?.weight).toBe(30);expect(record(rows)?.reps).toBe(9);
  expect(r.some(x=>x.weight===99)).toBeFalsy();
  expect(r.find(x=>x.exercise==='Press inclinado con mancuernas'&&x.reps===12)?.weight).toBeNull();
  expect(r.filter(x=>x.exercise==='Curl con mancuernas sentado').every(x=>x.weight===null)).toBeTruthy();
  expect(record(r.filter(x=>x.exercise==='Elevaciones de piernas colgado'))?.reps).toBe(15);
  expect(r.some(x=>x.weight===40&&x.exercise==='Bíceps en polea trasera')).toBeFalsy();
  expect(new Set(r.filter(x=>x.exercise==='Jalón unilateral').map(x=>x.group)).size).toBe(2);
  expect(r.find(x=>x.exercise==='Elevaciones laterales')?.reps).toBe(13);
  expect(r.find(x=>x.exercise==='Elevaciones laterales')?.partials).toBe(1);
  expect(record(r.filter(x=>x.exercise==='Remo con barra'))).toBeUndefined();
});

test('excluye copia de búlgara y barra rara; no infiere una carga incompleta',()=>{
  const data=dataWith('Bloque 7\nSemana 3\nDia A\n1. Prensa unilateral -> 50kg 14(+0)\nSemana 5\nDia A\n1. Prensa unilateral -> 39kg 5(+0) izq 5(+0) dch, 7(+0) izq 7(+0) dch\n2. Curl biceps con barra -> 30kg+barra rara 3(+0)\n3. Femoral sentado -> 10-12(+0) 67,5kg 12(+0)// 15-20(+0) 57, 19(+0)');
  const result=extractStatistics(data);
  expect(result.performances.filter(r=>r.exercise==='Prensa unilateral').map(r=>r.weight)).toEqual([39,39,39,39]);
  expect(result.performances.some(r=>r.exercise==='Curl de bíceps con barra')).toBeFalsy();
  expect(result.performances.filter(r=>r.exercise==='Curl femoral sentado').map(r=>r.reps)).toEqual([12]);
});

test('muestra marcas, evolución y constancia y guarda el calendario en las copias',async({page})=>{
  await page.goto('./');
  await menu(page,'Mis datos').click();
  const data=dataWith('Bloque 7\nSemana 4\nDia A\n1. Remo con mancuerna -> 30kg 8(+0)\nSemana 5\nDia B\n1. Remo con mancuerna -> 32kg 6(+1)');
  await page.getByTestId('history-file').setInputFiles({name:'history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data.history))});
  await menu(page,'Progreso').click();
  await expect(page.getByRole('heading',{name:'Tus marcas. Tu evolución.'})).toBeVisible();
  await expect(page.locator('.stats-cards').first()).toContainText('32 kg × 6');
  await expect(page.getByRole('heading',{name:'Constancia en entrenos'})).toBeVisible();
  await expect(page.locator('.attendance-week.level-0')).toHaveCount(3);
  await page.getByLabel('Fecha dentro de la semana de referencia').fill('2026-10-15');
  await page.getByRole('button',{name:'Guardar calendario'}).click();
  await expect(page.getByRole('status')).toContainText('Guardado en este dispositivo');
  await page.reload();await menu(page,'Progreso').click();
  await expect(page.getByLabel('Fecha dentro de la semana de referencia')).toHaveValue('2026-10-12');
  const select=page.getByLabel('Consultar punto').first();
  await select.selectOption({index:0});
  await expect(page.locator('.stat-chart').first()).toContainText('30 kg × 8');
  await menu(page,'Mis datos').click();
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar mis datos'}).click();
  const path=await(await waiting).path();await page.getByTestId('backup-file').setInputFiles(path!);
  await page.getByRole('button',{name:'Guardar copia y restaurar'}).click();
  await expect(page.getByRole('alert')).toContainText('Copia restaurada');
  await menu(page,'Progreso').click();await expect(page.getByLabel('Fecha dentro de la semana de referencia')).toHaveValue('2026-10-12');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('vista general combina bloques y permite filtrar sin mezclar unidades ni unir equipos',async({page})=>{
  await page.goto('./');await menu(page,'Mis datos').click();
  const archive={format:'beast-log-history',version:1,files:[
    {name:'block1.txt',text:'Bloque 1\nSemana 1\nDia A\n1. Femoral sentado -> 20kg 10(+0)\n2. Jalón unilateral -> 30lbs 8(+0)'},
    {name:'block7.txt',text:'Bloque 7\nSemana 5\nDia A\n1. Femoral sentado -> 30kg 8(+0)\n2. Jalón unilateral -> 25kg 8(+0)'}
  ]};
  await page.getByTestId('history-file').setInputFiles({name:'all.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
  await menu(page,'Progreso').click();await page.getByLabel('Ejercicio',{exact:true}).selectOption('Curl femoral sentado');
  await expect(page.getByLabel('Periodo',{exact:true})).toHaveValue('');
  await expect(page.locator('.stats-cards').first()).toContainText('30 kg × 8');
  await expect(page.locator('.stat-chart').first().locator('circle')).toHaveCount(2);
  await expect(page.locator('.stat-chart').first().locator('polyline')).toHaveCount(2);
  await expect(page.getByRole('heading',{name:'Marcas de todo tu historial'})).toBeVisible();
  await page.getByLabel('Periodo',{exact:true}).selectOption('1');
  await expect(page.locator('.stats-cards').first()).toContainText('20 kg × 10');
  await expect(page.locator('.stat-chart').first().locator('circle')).toHaveCount(1);
  await page.getByLabel('Periodo',{exact:true}).selectOption('');
  await page.getByLabel('Ejercicio',{exact:true}).selectOption('Jalón unilateral');
  const selector=page.getByLabel('Variante, equipo y unidad',{exact:true});
  const generalOptions=await selector.locator('option').allTextContents();
  expect(generalOptions.filter(t=>t.includes('General')).length).toBe(2);
  await expect(page.locator('.stat-chart').first().locator('circle')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
