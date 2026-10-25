import {test,expect} from '@playwright/test';
import {weeklyImprovements,defaultCalendar,type Performance} from '../src/statistics';
import {emptyData} from '../src/model';
const row=(exercise:string,date:string,weight:number|null,reps:number,extra:Partial<Performance>={}):Performance=>({id:crypto.randomUUID(),exercise,group:exercise,scope:'Mancuernas',unit:'kg',convention:'por mancuerna',block:7,week:7,day:'A',date,weight,reps,rir:'0',partials:null,failure:false,raw:'',source:'test',...extra});
test('mejoras requieren semana anterior y series comparables; no confunde bajadas ni variantes',()=>{
 const rows=[row('Peso','2026-10-13',20,8),row('Peso','2026-10-20',22,8),row('Reps','2026-10-13',10,8),row('Reps','2026-10-20',10,10),row('Igual','2026-10-13',10,8),row('Igual','2026-10-20',10,8),row('Carga nueva','2026-10-13',20,10),row('Carga nueva','2026-10-20',22,6),row('Primero','2026-10-20',30,10),row('Hueco','2026-10-06',10,8),row('Hueco','2026-10-20',20,8),row('Equipo','2026-10-13',20,8),row('Equipo','2026-10-20',30,8,{group:'otra máquina'}),row('Día','2026-10-13',20,8),row('Día','2026-10-20',30,8,{day:'B'}),row('Nulo','2026-10-13',null,8),row('Nulo','2026-10-20',30,8),row('Peso','2026-10-27',50,20)];
 const gains=weeklyImprovements(rows,defaultCalendar(emptyData()),'2026-10-25');expect(gains.map(g=>g.exercise)).toEqual(['Peso','Reps','Carga nueva']);expect(gains[0].weightGain).toBe(2);expect(gains[1].repsGain).toBe(2);expect(gains[2].weightGain).toBe(2);expect(gains[2].repsGain).toBe(0);
});
test('Progreso muestra solo mejoras semanales y consulta por ejercicio',async({page})=>{
 await page.clock.install({time:new Date('2026-10-25T12:00:00Z')});await page.goto('./');
 const menu=(name:string)=>page.locator('.sidebar:visible nav,.mobile-nav:visible').getByRole('button',{name,exact:true});
 await menu('Mis datos').click();
 const text=[6,7].map(week=>`Semana ${week}\n`+['Dia A','Dia B','Dia C','Brazos'].map(day=>`${day}\n1. Elevaciones laterales -> 16kg ${week===6?8:10}(+0)\n2. Remo con mancuerna -> ${week===6?30:32}kg ${week===6?8:6}(+0)`).join('\n')).join('\n');
 const history={format:'beast-log-history',version:1,files:[{name:'gym.txt',text:`Bloque 7\n${text}`} ]};
 await page.getByTestId('history-file').setInputFiles({name:'gym.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(history))});await menu('Progreso').click();
 await expect(page.locator('.gains-list li')).toHaveCount(8);await expect(page.locator('.weekly-gains')).toContainText('Elevaciones laterales');await expect(page.locator('.weekly-gains')).toContainText('+2 reps');await expect(page.locator('.weekly-gains')).toContainText('Remo');await expect(page.locator('.weekly-gains')).toContainText('+2 kg');await expect(page.locator('.weekly-gains')).toContainText('30 kg × 8 → 32 kg × 6');
 await expect(page.locator('.gains-day > h3')).toHaveText(['Día A','Día B','Día C','Brazos']);
 await expect(page.locator('.statistics-view > section')).toHaveCount(2);
 await page.getByLabel('Ejercicio',{exact:true}).selectOption('Remo con mancuerna');await expect(page.locator('.history-performance')).toHaveCount(8);
});
