// Minimal IndexedDB key-value store.
// Used to persist FileSystemFileHandle across page loads (localStorage can't hold it).

const DB_NAME = 'burndown_db'
const STORE   = 'keyval'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

let dbPromise = null
function getDB() {
  if (!dbPromise) dbPromise = openDB()
  return dbPromise
}

export async function idbGet(key) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = e => resolve(e.target.result ?? null)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function idbSet(key, value) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
}

export async function idbDel(key) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
}
