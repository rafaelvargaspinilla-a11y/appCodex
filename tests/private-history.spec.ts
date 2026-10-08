import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
test('verifica las 201 sesiones del archivo privado', async ({ page }, testInfo) => {
  test.skip(!existsSync('/workspace/scratch/gym-historico.json'), 'Archivo personal disponible solo en este entorno');
  await page.goto('./');
  await page.locator('.sidebar:visible nav, .mobile-nav:visible').getByRole('button', { name: 'Mis datos', exact: true }).click();
  await page.getByTestId('history-file').setInputFiles(Array.from({length:7}, (_,i) => `docs/sources/Gym ${i+1}.txt`));
  await expect(page.locator('.archive-panel .pill')).toHaveText('201 sesiones');
  for (const [block, count] of [[1,31],[2,41],[3,30],[4,24],[5,36],[6,21],[7,18]]) {
    await page.getByLabel('Filtrar bloque').selectOption(String(block));
    await expect(page.locator('.archive-panel')).toContainText(`${count} sesiones encontradas`);
  }
  await page.getByLabel('Filtrar semana').selectOption('5');
  await page.getByLabel('Filtrar día').selectOption('B');
  await page.locator('.archive-session summary').click();
  await expect(page.locator('.archive-session')).toContainText('Remo con barra');
  await page.locator('.sidebar:visible nav, .mobile-nav:visible').getByRole('button', { name: 'Progreso', exact: true }).click();
  await expect(page.getByRole('heading', {name:'Constancia en entrenos'})).toBeVisible();
  await expect(page.locator('.statistics-view')).toContainText('201 entrenamientos');
  await page.getByLabel('Ejercicio', {exact:true}).selectOption('Prensa unilateral');
  await expect(page.locator('.stat-chart').first().locator('circle')).toHaveCount(1);
  await page.getByLabel('Ejercicio', {exact:true}).selectOption('Peso muerto');
  await expect(page.locator('.stat-chart').first().locator('circle').first()).toBeVisible();
  await page.locator('.stats-cards').first().getByText('Ver serie original').first().click();
  await expect(page.locator('.original-stat').first()).toContainText('Peso muerto');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path:`/tmp/beast-statistics-${testInfo.project.name}.png`});
  await page.reload();
  await expect(page.locator('.day-card.chosen strong')).toHaveText('C');
  await expect(page.getByRole('spinbutton', {name:'Semana',exact:true})).toHaveValue('5');
});
