/**
 * Vanalok Offline Store
 * Uses IndexedDB via the idb-keyval pattern (manual implementation)
 * to cache museum, gallery, and object data for fully offline use.
 */

const DB_NAME = 'vanalok-offline';
const DB_VERSION = 1;

const STORES = {
  MUSEUMS: 'museums',
  GALLERIES: 'galleries',
  OBJECTS: 'objects',
  META: 'meta',
};

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      Object.values(STORES).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
    request.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(storeName, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach((item) => store.put(item));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbSetMeta(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.META, 'readwrite');
    const store = tx.objectStore(STORES.META);
    store.put({ id: key, value });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetMeta(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.META, 'readonly');
    const store = tx.objectStore(STORES.META);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────

export const offlineStore = {
  /**
   * Syncs all museum content to IndexedDB from the live API.
   * Call this once when the visitor enters the museum (online).
   */
  async syncAll(apiBaseUrl, onProgress) {
    const progress = (pct, msg) => onProgress?.(pct, msg);

    try {
      progress(5, 'Fetching museums...');
      const musRes = await fetch(`${apiBaseUrl}/museums?per_page=50`);
      const musData = await musRes.json();
      const museums = musData.data || [];
      await dbPut(STORES.MUSEUMS, museums.map(m => ({ ...m, id: m.id })));
      progress(30, `Cached ${museums.length} museums`);

      progress(35, 'Fetching galleries...');
      const galRes = await fetch(`${apiBaseUrl}/galleries?per_page=200`);
      const galData = await galRes.json();
      const galleries = galData.data || [];
      await dbPut(STORES.GALLERIES, galleries.map(g => ({ ...g, id: g.id })));
      progress(55, `Cached ${galleries.length} galleries`);

      progress(60, 'Fetching objects...');
      const objRes = await fetch(`${apiBaseUrl}/objects?per_page=200`);
      const objData = await objRes.json();
      const objects = objData.data || [];
      await dbPut(STORES.OBJECTS, objects.map(o => ({ ...o, id: o.id })));
      progress(85, `Cached ${objects.length} objects`);

      // Cache object images via SW
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const imgUrls = objects
          .filter(o => o.image)
          .map(o => o.image)
          .filter(u => u.startsWith('http') || u.startsWith('/'));
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_MUSEUM_DATA',
          urls: imgUrls.slice(0, 50), // Limit to first 50 images
        });
      }

      progress(95, 'Finalizing...');
      await dbSetMeta('lastSync', Date.now());
      await dbSetMeta('syncedMuseumCount', museums.length);
      progress(100, 'Offline sync complete!');

      return { museums, galleries, objects };
    } catch (err) {
      console.error('[OfflineStore] Sync failed:', err);
      throw err;
    }
  },

  async getLastSync() {
    return dbGetMeta('lastSync');
  },

  async getMuseums() {
    return dbGetAll(STORES.MUSEUMS);
  },

  async getMuseum(id) {
    return dbGet(STORES.MUSEUMS, id);
  },

  async getGalleries(museumId) {
    const all = await dbGetAll(STORES.GALLERIES);
    return museumId ? all.filter(g => g.museum_id === museumId) : all;
  },

  async getGallery(id) {
    return dbGet(STORES.GALLERIES, id);
  },

  async getObjects(params = {}) {
    const all = await dbGetAll(STORES.OBJECTS);
    let filtered = all;
    if (params.museum_id) filtered = filtered.filter(o => o.museum_id === params.museum_id);
    if (params.gallery_id) filtered = filtered.filter(o => o.gallery_id === params.gallery_id);
    if (params.category) filtered = filtered.filter(o => o.category === params.category);
    return filtered;
  },

  async getObject(id) {
    return dbGet(STORES.OBJECTS, id);
  },

  async findObjectByCode(code) {
    const all = await dbGetAll(STORES.OBJECTS);
    return all.find(o => o.object_code === code || String(o.id) === String(code));
  },

  async isReady() {
    const lastSync = await dbGetMeta('lastSync');
    return !!lastSync;
  },
};

export default offlineStore;
