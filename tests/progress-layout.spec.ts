import {test,expect,type Page} from '@playwright/test';
const menu=(page:Page,label:string)=>page.locator('.mobile-nav').getByRole('button',{name:label,exact:true});
test('Progreso se ajusta en móviles estrechos incluso al abrir fuentes y anotaciones largas',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('./');await menu(page,'Mis datos').click();
 const text='Bloque 7\nSemana 5\nDia A\n1. Elevaciones laterales -> 16kg 8(+0) 5(+0)\n2. Remo con mancuerna -> 30kg 8(creo) NOTA_'+('larga'.repeat(50));
 await page.getByTestId('history-file').setInputFiles({name:'historico_'+('fuente'.repeat(23))+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await menu(page,'Progreso').click();
 await page.getByText('Ver serie original',{exact:true}).first().click();await page.getByText('Mejor serie con cada peso',{exact:true}).click();await page.locator('.review-entry').locator('..').locator('summary').first().click();await page.locator('.review-entry summary').first().click();
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:812});
  const layout=await page.evaluate(()=>{const shell=document.querySelector<HTMLElement>('.main-shell')!;return {client:shell.clientWidth,scroll:shell.scrollWidth,axis:getComputedStyle(shell).overflowX,touch:getComputedStyle(shell).touchAction,outside:[...document.querySelectorAll('.statistics-view .panel, .stat-chart svg, .stats-filters select, .stats-filters input')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).length};});
  expect(layout.scroll).toBeLessThanOrEqual(layout.client+1);expect(layout.axis).toBe('hidden');expect(layout.touch).toContain('pan-y');expect(layout.touch).toContain('pinch-zoom');expect(layout.outside).toBe(0);
  for(const top of [800,1700,500]){await page.locator('.main-shell').evaluate((e,y)=>{e.scrollTop=y;e.scrollLeft=100;},top);expect(await page.locator('.main-shell').evaluate(e=>e.scrollLeft)).toBe(0);await expect(menu(page,'Progreso')).toBeInViewport();}
 }
});
