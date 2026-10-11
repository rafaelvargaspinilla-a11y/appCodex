import {test,expect} from '@playwright/test';
test('preparación móvil contiene días y fecha; contador del bloque muestra solo ratio y porcentaje',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');
 await page.getByRole('button',{name:'DÍA 4 Brazos 6 ejercicios'}).click();await page.getByLabel('Fecha de sesión',{exact:true}).fill('2026-10-11');
 const counter=page.locator('.block-summary');await expect(counter.locator('strong')).toHaveText('0 / 48');await expect(counter.locator('.block-percentage')).toHaveText('0 %');await expect(counter).not.toContainText('Bloque 7');await expect(counter).not.toContainText('12 semanas');
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  const bounds=await page.evaluate(()=>{const panel=document.querySelector<HTMLElement>('.session-builder')!,box=panel.getBoundingClientRect(),style=getComputedStyle(panel);const left=box.left+parseFloat(style.paddingLeft),right=box.right-parseFloat(style.paddingRight);return {outside:[...panel.querySelectorAll('.day-card, .session-fields input')].map(e=>e.getBoundingClientRect()).filter(b=>b.left<left-1||b.right>right+1).length,scroll:document.querySelector('.main-shell')!.scrollWidth,client:document.querySelector('.main-shell')!.clientWidth,ratio:document.querySelector('.block-summary strong')!.getBoundingClientRect().right,card:document.querySelector('.block-summary')!.getBoundingClientRect().right};});
  expect(bounds.outside).toBe(0);expect(bounds.scroll).toBeLessThanOrEqual(bounds.client+1);expect(bounds.ratio).toBeLessThanOrEqual(bounds.card);
  await expect(counter.locator('.block-percentage')).toBeVisible();await expect(page.getByLabel('Fecha de sesión',{exact:true})).toHaveValue('2026-10-11');
 }
});
