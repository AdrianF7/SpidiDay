(function () {
  'use strict';
  const DB_NAME = 'AdriDayDB';
  const DB_VERSION = 3;
  const STORES = ['routines', 'completions', 'expenses', 'categories', 'settings', 'compassInsights', 'compassFeedback', 'dailyVerses', 'favoriteVerses', 'verseReflections', 'shortHabitCompletions', 'verseJournalEntries'];
  let connection;

  function open() {
    if (connection) return Promise.resolve(connection);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña.'));
      request.onupgradeneeded = () => {
        const db = request.result;
        STORES.forEach(store => { if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' }); });
        const journal = request.transaction.objectStore('verseJournalEntries');
        ['verseId', 'verseDate', 'createdAt', 'updatedAt', 'isFavorite'].forEach(index => {
          if (!journal.indexNames.contains(index)) journal.createIndex(index, index, { unique: false });
        });
      };
      request.onsuccess = () => { connection = request.result; connection.onversionchange = () => connection.close(); resolve(connection); };
    });
  }

  async function store(name, mode = 'readonly') { return (await open()).transaction(name, mode).objectStore(name); }
  async function all(name) { const s = await store(name); return new Promise((res, rej) => { const r=s.getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
  async function get(name, id) { const s = await store(name); return new Promise((res, rej) => { const r=s.get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
  async function put(name, value) { const s = await store(name,'readwrite'); return new Promise((res, rej) => { const r=s.put(value); r.onsuccess=()=>res(value); r.onerror=()=>rej(r.error); }); }
  async function remove(name, id) { const s = await store(name,'readwrite'); return new Promise((res, rej) => { const r=s.delete(id); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }
  async function clear(name) { const s = await store(name,'readwrite'); return new Promise((res, rej) => { const r=s.clear(); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }
  async function exportAll() { const data={}; for (const name of STORES) data[name]=await all(name); return data; }
  async function replaceAll(data) {
    const db=await open();
    return new Promise((resolve,reject)=>{ const tx=db.transaction(STORES,'readwrite'); STORES.forEach(name=>{ const s=tx.objectStore(name); s.clear(); const items=Array.isArray(data[name])?data[name]:[]; items.forEach(item=>s.put(item)); }); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error); });
  }
  window.AdriDB = { STORES, open, all, get, put, remove, clear, exportAll, replaceAll };
})();
