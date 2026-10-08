import { registerSW } from 'virtual:pwa-register';
let waiting = false;
let check: (() => Promise<void>) | undefined;
function announce() { window.dispatchEvent(new CustomEvent('beast-update', {detail:waiting})); }
export const applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() { waiting=true;announce(); },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    check = async () => { await registration.update(); };
    void check().catch(()=>{});
    window.setInterval(()=>{ if(navigator.onLine) void check?.().catch(()=>{}); },60*60*1000);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && navigator.onLine) void check?.().catch(()=>{}); });
  },
});
export function updateWaiting() { return waiting; }
export async function checkUpdate() {
  if (!navigator.onLine) throw new Error('Necesitas conexión para buscar actualizaciones.');
  if (!check) throw new Error('La actualización aún se está preparando. Vuelve a intentarlo en unos segundos.');
  await check();
}
