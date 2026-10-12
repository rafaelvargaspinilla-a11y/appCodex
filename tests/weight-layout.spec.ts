import {test,expect} from '@playwright/test';

test('peso en móvil mantiene campos y registros dentro de sus paneles',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');
 await page.locator('.mobile-nav').getByRole('button',{name:'Peso',exact:true}).click();
 await page.getByLabel('Fecha del peso').fill('2026-10-12');
 await page.getByLabel('Peso corporal (kg)',{exact:true}).fill('78.5');
 await page.getByLabel('Nota opcional').fill('Una nota larga '+ 'entrenamiento'.repeat(35));
 await page.getByRole('button',{name:'Guardar peso',exact:true}).click();
 await expect(page.locator('.weight-row')).toContainText('78,5');
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  const outside=await page.locator('.weight-layout').evaluate(layout=>[...layout.querySelectorAll('.panel')].flatMap(panel=>{
   const box=panel.getBoundingClientRect(),style=getComputedStyle(panel);
   const left=box.left+parseFloat(style.paddingLeft),right=box.right-parseFloat(style.paddingRight);
   return [...panel.querySelectorAll('input,textarea,button,.weight-trend,.weight-row strong,.weight-row p')].filter(e=>{const b=e.getBoundingClientRect();return b.left<left-1||b.right>right+1;}).map(e=>e.tagName);
  }));
  expect(outside).toEqual([]);
  expect(await page.locator('.weight-layout').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBeTruthy();
 }
 await page.reload();await page.locator('.mobile-nav').getByRole('button',{name:'Peso',exact:true}).click();
 await page.locator('.weight-row').click();
 await expect(page.getByLabel('Fecha del peso')).toHaveValue('2026-10-12');
 await expect(page.getByLabel('Peso corporal (kg)',{exact:true})).toHaveValue('78.5');
});
