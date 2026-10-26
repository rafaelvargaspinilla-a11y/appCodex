import {test,expect} from '@playwright/test';
import {trainingStreaks} from '../src/streaks';
import {emptyData,createSession,days} from '../src/model';
test('rachas cuentan días distintos, semanas completas y permiten hoy sin terminar',()=>{
 const data=emptyData();
 for(const [week,start] of [[6,12],[7,19]])days.forEach((day,i)=>{data.sessions.push({...createSession(7,week,day,`2026-10-${start+i}`),finished:true});});
 expect(trainingStreaks(data,'2026-10-23')).toEqual({days:4,weeks:2});
 expect(trainingStreaks(data,'2026-10-24')).toEqual({days:0,weeks:2});
 data.sessions.push({...data.sessions.at(-1)!,id:'duplicate'});expect(trainingStreaks(data,'2026-10-23').days).toBe(4);
 expect(trainingStreaks(data,'2026-10-26').weeks).toBe(2);
 expect(trainingStreaks(data,'2026-11-02')).toEqual({days:0,weeks:0});
 data.sessions.push(createSession(7,8,'A','2026-10-23'));expect(trainingStreaks(data,'2026-10-23').days).toBe(4);
 expect(trainingStreaks(data,'2026-10-11')).toEqual({days:0,weeks:0});
});
test('histórico sin fechas no inventa rachas diarias pero conserva semanas completas',()=>{
 const data=emptyData();data.history={format:'beast-log-history',version:1,files:[{name:'gym.txt',text:'Bloque 7\nSemana 7\n'+days.map(day=>`${day==='Brazos'?'Brazos':`Dia ${day}`}\n1. Remo -> 20kg 8(+0)`).join('\n')}]};
 expect(trainingStreaks(data,'2026-10-26')).toEqual({days:0,weeks:1});
});
test('inicio muestra las dos rachas dentro de sus paneles en móvil',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');
 await expect(page.getByRole('region',{name:'Rachas de entrenamiento'})).toBeVisible();await expect(page.getByTestId('day-streak')).toHaveText('0');await expect(page.getByTestId('week-streak')).toHaveText('0');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});expect(await page.locator('.streak-card').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);}
});
