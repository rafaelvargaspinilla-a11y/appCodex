import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

test('detecta una nueva versión, permite instalarla y conserva las sesiones', async ({ page }) => {
  let changed=false;
  const root=resolve('dist');
  const base=process.env.TEST_BASE_PATH||'/';
  const server=createServer((request,response)=>{
    const path=new URL(request.url??'/', 'http://localhost').pathname;
    if(path==='/test/new-build'){changed=true;response.end('ok');return;}
    const relative=(path.startsWith(base)?path.slice(base.length):'../missing')||'index.html';
    const file=resolve(root,relative);
    if(!file.startsWith(root+'/')||!existsSync(file)){response.writeHead(404);response.end();return;}
    const types:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
    response.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');
    response.setHeader('Cache-Control','no-cache');
    const content=readFileSync(file);
    response.end(file.endsWith('/sw.js')&&changed?Buffer.concat([content,Buffer.from('\n// update-lifecycle-test-version-2\n')]):content);
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const address=server.address();
  if(!address||typeof address==='string') throw new Error('No se pudo iniciar el servidor de prueba.');
  try {
    await page.goto(`http://127.0.0.1:${address.port}${base}`);
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.reload();
    await page.getByRole('button',{name:'Empezar entrenamiento'}).click();
    await page.getByRole('spinbutton',{name:'Elevaciones laterales serie 1  repeticiones',exact:true}).fill('9');
    await page.getByRole('button',{name:'Completar Elevaciones laterales serie 1',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Guardado en este dispositivo');
    await page.evaluate(async()=>{await fetch('/test/new-build');});
    await page.locator('.sidebar:visible nav, .mobile-nav:visible').getByRole('button',{name:'Mis datos',exact:true}).click();
    await page.getByRole('button',{name:'Buscar actualización',exact:true}).click();
    await expect(page.getByRole('button',{name:'Actualizar app',exact:true})).toBeVisible({timeout:15000});
    await page.getByRole('button',{name:'Actualizar app',exact:true}).click();
    await expect(page.locator('.update-notice')).toHaveCount(0);
    await page.getByRole('button',{name:'Empezar entrenamiento',exact:true}).click();
    await expect(page.getByRole('spinbutton',{name:'Elevaciones laterales serie 1  repeticiones',exact:true})).toHaveValue('9');
  } finally { server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r())); }
});
