(function () {
  'use strict';
  const DB_NAME = 'AdriDayDB';
  const DB_VERSION = 5;
  const STORES = ['routines', 'completions', 'expenses', 'categories', 'settings', 'compassInsights', 'compassFeedback', 'dailyVerses', 'favoriteVerses', 'verseReflections', 'shortHabitCompletions', 'verseJournalEntries', 'storyDays', 'storyLetter', 'storyPromises', 'storyMessageHistory', 'storyOrigin', 'dailyHistory', 'motivationPools', 'appSettings'];
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
        const history = request.transaction.objectStore('dailyHistory');
        ['localDate', 'status', 'finalizedAt', 'motivationMessageType'].forEach(index => {
          if (!history.indexNames.contains(index)) history.createIndex(index, index, { unique: false });
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
  async function transaction(names, callback) {
    const db=await open(), list=Array.isArray(names)?names:[names];
    return new Promise((resolve,reject)=>{const tx=db.transaction(list,'readwrite'), stores=Object.fromEntries(list.map(name=>[name,tx.objectStore(name)]));let result;
      try{result=callback(stores,tx)}catch(error){tx.abort();reject(error);return}
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('La transacción fue cancelada.'));
    });
  }
  window.AdriDB = { DB_NAME, DB_VERSION, STORES, open, all, get, put, remove, clear, exportAll, replaceAll, transaction };
})();
