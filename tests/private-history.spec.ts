import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
test('verifica las 201 sesiones del archivo privado', async ({ page }) => {
  test.skip(!existsSync('/workspace/scratch/gym-historico.json'), 'Archivo personal disponible solo en este entorno');
  await page.goto('./');
  await page.locator('.sidebar:visible nav, .mobile-nav:visible').getByRole('button', { name: 'Mis datos', exact: true }).click();
  await page.getByTestId('history-file').setInputFiles('/workspace/scratch/gym-historico.json');
  await expect(page.locator('.archive-panel .pill')).toHaveText('201 sesiones');
  for (const [block, count] of [[1,31],[2,41],[3,30],[4,24],[5,36],[6,21],[7,18]]) {
    await page.getByLabel('Filtrar bloque').selectOption(String(block));
    await expect(page.locator('.archive-panel')).toContainText(`${count} sesiones encontradas`);
  }
  await page.getByLabel('Filtrar semana').selectOption('5');
  await page.getByLabel('Filtrar día').selectOption('B');
  await page.locator('.archive-session summary').click();
  await expect(page.locator('.archive-session')).toContainText('Remo con barra');
  await page.reload();
  await expect(page.locator('.day-card.chosen strong')).toHaveText('C');
  await expect(page.getByRole('spinbutton', {name:'Semana',exact:true})).toHaveValue('5');
});
