import { emptyData, type Data } from './model';
const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open('beast-log', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('app');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
export async function readData(): Promise<Data> {
  const db = await open();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('app','readonly');
    const req = tx.objectStore('app').get('data');
    tx.oncomplete = () => { db.close(); resolve(req.result ?? emptyData()); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
let queue = Promise.resolve();
export function writeData(data: Data): Promise<void> {
  const save = async () => {
    const db = await open();
    return new Promise<void>((resolve,reject) => {
      const tx = db.transaction('app','readwrite');
      tx.objectStore('app').put(data,'data');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('No se pudo guardar.')); };
    });
  };
  queue = queue.catch(() => {}).then(save);
  return queue;
}
