import {test,expect} from '@playwright/test';
import {trainingStreaks} from '../src/streaks';
import {emptyData,createSession,days} from '../src/model';
test('rachas siguen la rutina y permiten descansos y una sesión pendiente',()=>{
 const data=emptyData();
 for(const [week,start] of [[6,12],[7,19]])days.forEach((day,i)=>{data.sessions.push({...createSession(7,week,day,`2026-10-${start+i}`),finished:true});});
 expect(trainingStreaks(data,'2026-10-23')).toEqual({days:8,weeks:2});
 expect(trainingStreaks(data,'2026-10-24')).toEqual({days:8,weeks:2});
 data.sessions.push({...data.sessions.at(-1)!,id:'duplicate'});expect(trainingStreaks(data,'2026-10-23').days).toBe(8);
 expect(trainingStreaks(data,'2026-10-26').weeks).toBe(2);
 // A later incomplete training week breaks the streak; merely reopening the app does not rewrite history.
 data.sessions.push(createSession(7,9,'A','2026-11-02'));expect(trainingStreaks(data,'2026-11-02')).toEqual({days:0,weeks:0});
 data.sessions.push(createSession(7,8,'A','2026-10-23'));expect(trainingStreaks(data,'2026-10-23').days).toBe(8);
 expect(trainingStreaks(data,'2026-10-11')).toEqual({days:0,weeks:0});
});
test('histórico cuenta días de entrenamiento sin inventar fechas',()=>{
 const data=emptyData();data.history={format:'beast-log-history',version:1,files:[{name:'gym.txt',text:'Bloque 7\nSemana 7\n'+days.map(day=>`${day==='Brazos'?'Brazos':`Dia ${day}`}\n1. Remo -> 20kg 8(+0)`).join('\n')}]};
 expect(trainingStreaks(data,'2026-10-26')).toEqual({days:4,weeks:1});
});
test('inicio muestra las dos rachas dentro de sus paneles en móvil',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');
 await expect(page.getByRole('region',{name:'Rachas de entrenamiento'})).toBeVisible();await expect(page.getByTestId('day-streak')).toHaveText('0');await expect(page.getByTestId('week-streak')).toHaveText('0');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});expect(await page.locator('.streak-card').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);}
});

test('semanas de rutina no se fragmentan por fechas mixtas y atraviesan bloques',()=>{
 const data=emptyData();
 const file=(block:number,weeks:number[])=>({name:`b${block}.txt`,text:`Bloque ${block}\n`+weeks.map(week=>`Semana ${week}\n`+days.map(day=>`${day==='Brazos'?'Brazos':`Dia ${day}`}\n1. Remo -> 20kg 8(+0)`).join('\n')).join('\n')});
 data.history={format:'beast-log-history',version:1,files:[file(6,[11,12]),file(7,[1,2,3,4,5,6,7])]};
 data.sessions.push({...createSession(7,7,'A','2026-10-20'),finished:true},{...createSession(7,7,'B','2026-10-26'),finished:true},createSession(7,8,'A','2026-10-26'));
 expect(trainingStreaks(data,'2026-10-26')).toEqual({days:36,weeks:9});
 data.history.files[1]=file(7,[1,2,3,5,6,7]);expect(trainingStreaks(data,'2026-10-26')).toEqual({days:12,weeks:3});
});
