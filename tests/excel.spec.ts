import { test,expect } from '@playwright/test';
import { existsSync,readdirSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
const menu=(page:import('@playwright/test').Page,label:string)=>page.locator('.sidebar:visible nav, .mobile-nav:visible').getByRole('button',{name:label,exact:true});
const fixture='tests/fixtures/Bloque 7 - Prueba.xlsx';

test('inicio conserva total y contador de bloque; historial muestra importados sin mensaje vacío',async({page})=>{
 await page.goto('./');await menu(page,'Mis datos').click();
 const archive={format:'beast-log-history',version:1,files:[{name:'one.txt',text:'Bloque 1\nSemana 1\nDia A\n1. Remo -> 20kg 8(+0)'},{name:'seven.txt',text:'Bloque 7\nSemana 5\nDia A\n1. Remo -> 30kg 8(+0)\nDia B\n1. Remo -> 30kg 7(+0)'}]};
 await page.getByTestId('history-file').setInputFiles({name:'h.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
 await expect(page.getByText('Tu historia empieza con la primera sesión')).toHaveCount(0);
 await expect(page.locator('.archive-panel .pill')).toHaveText('3 sesiones');
 await menu(page,'Entrenar').click();
 await expect(page.locator('.summary-card').nth(0)).toContainText('3');await expect(page.locator('.summary-card').nth(1)).toContainText('Sesiones terminadas este bloque');await expect(page.locator('.summary-card').nth(1)).toContainText('2');
 await expect(page.locator('.dashboard-aside')).toHaveCount(0);await expect(page.getByText('En tu diario',{exact:true})).toHaveCount(0);await expect(page.getByText('Series registradas',{exact:true})).toHaveCount(0);
});

test('Excel importa pesos, excluye medias y revisa conflictos; recarga y copia conservan originales',async({page})=>{
 await page.goto('./');await menu(page,'Peso corporal').or(menu(page,'Peso')).click();
 await page.getByLabel('Fecha del peso',{exact:true}).fill('2026-10-05');await page.getByRole('spinbutton',{name:'Peso corporal (kg)',exact:true}).fill('65');await page.getByRole('button',{name:'Guardar peso',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Guardado en este dispositivo');
 await page.getByTestId('excel-file').setInputFiles(fixture);
 await expect(page.getByRole('dialog')).toContainText('2 pesajes encontrados');await expect(page.getByRole('dialog')).toContainText('1 fechas con pesos distintos');
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('.weight-row')).toHaveCount(1);
 await page.getByTestId('excel-file').setInputFiles(fixture);await page.getByRole('button',{name:'Añadir datos del Excel',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Excel importado');await expect(page.locator('.weight-row')).toHaveCount(2);await expect(page.locator('.weight-row').last()).toContainText('65');
 await page.getByTestId('excel-file').setInputFiles(fixture);await page.getByLabel('Resolver peso 2026-10-05',{exact:true}).selectOption('0');await page.getByRole('button',{name:'Añadir datos del Excel',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Excel importado');await expect(page.locator('.weight-row')).toHaveCount(2);await expect(page.locator('.weight-row').last()).toContainText('70');
 await page.reload();await menu(page,'Mis datos').click();await expect(page.locator('.excel-importer')).toContainText('1 archivos Excel guardados');
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar mis datos',exact:true}).click();const path=await(await waiting).path();
 const backup=JSON.parse(readFileSync(path!,'utf8'));expect(backup.weights).toHaveLength(2);expect(backup.excel.sources).toHaveLength(1);expect(Buffer.from(backup.excel.sources[0].content,'base64')).toEqual(readFileSync(fixture));
 await page.getByTestId('backup-file').setInputFiles(path!);await page.getByRole('button',{name:'Guardar copia y restaurar',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Copia restaurada');
 await menu(page,'Historial').click();await expect(page.locator('.archive-panel')).toContainText('1 sesiones');await page.locator('.archive-session summary').click();await expect(page.locator('.archive-session')).toContainText('2026-10-06');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('los siete Excel privados aportan 339 pesos y fechas reales sin duplicar el TXT',async({page})=>{
 const root='/workspace/attachments';const files=existsSync(root)?readdirSync(root).flatMap(d=>{const dir=join(root,d);try{return readdirSync(dir).filter(f=>/^Bloque [1-7] .*\.xlsx$/.test(f)).map(f=>join(dir,f));}catch{return [];}}):[];
 test.skip(files.length!==7||!existsSync('/workspace/scratch/gym-historico.json'),'Originales personales solo disponibles en este entorno');
 await page.goto('./');await menu(page,'Mis datos').click();await page.getByTestId('history-file').setInputFiles('/workspace/scratch/gym-historico.json');await menu(page,'Mis datos').click();
 await page.getByTestId('excel-file').setInputFiles(files);await expect(page.getByRole('dialog')).toContainText('339 pesajes encontrados',{timeout:20000});await expect(page.getByRole('dialog')).toContainText('222 sesiones');
 await page.getByRole('button',{name:'Añadir datos del Excel',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Excel importado');
 await menu(page,'Historial').click();await expect(page.locator('.archive-panel .pill')).toHaveText('222 sesiones');await expect(page.getByText('Tu historia empieza con la primera sesión')).toHaveCount(0);
 await page.getByLabel('Filtrar bloque',{exact:true}).selectOption('1');await page.getByLabel('Filtrar semana',{exact:true}).selectOption('1');await page.getByLabel('Filtrar día',{exact:true}).selectOption('A');await page.locator('.archive-session summary').click();await expect(page.locator('.archive-session')).toContainText('2025-04-22');
 await menu(page,'Entrenar').click();await expect(page.locator('.summary-card').first()).toContainText('222');await expect(page.locator('.summary-card').nth(1)).toContainText('18');
 await menu(page,'Peso corporal').or(menu(page,'Peso')).click();await expect(page.locator('.weight-row')).toHaveCount(339);
 await page.getByTestId('excel-file').setInputFiles(files);await expect(page.getByRole('dialog')).toContainText('339 pesajes ya existentes');await page.getByRole('button',{name:'Añadir datos del Excel',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Excel importado');await expect(page.locator('.weight-row')).toHaveCount(339);
 await page.reload();await menu(page,'Mis datos').click();await expect(page.locator('.excel-importer')).toContainText('7 archivos Excel guardados');
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar mis datos',exact:true}).click();const backup=JSON.parse(readFileSync((await(await waiting).path())!,'utf8'));
 expect(backup.weights).toHaveLength(339);expect(backup.excel.sources).toHaveLength(7);expect(backup.excel.weeks).toHaveLength(84);expect(backup.history.files).toHaveLength(7);
});

test('importación Excel funciona sin conexión incluso antes de abrir el lector',async({page,context})=>{
 await page.goto('./');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await context.setOffline(true);await page.reload();
 await menu(page,'Mis datos').click();await page.getByTestId('excel-file').setInputFiles(fixture);await expect(page.getByRole('dialog')).toContainText('2 pesajes encontrados');
 await page.getByRole('button',{name:'Añadir datos del Excel',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Excel importado');
 await page.reload();await menu(page,'Peso corporal').or(menu(page,'Peso')).click();await expect(page.locator('.weight-row')).toHaveCount(2);
});
