/* A copy of the company's data on this device (IndexedDB), so the app opens and keeps working with no signal — in a
 * basement, a new building — and whatever was done there goes up the moment the signal is back. */
const DB = 'tileos-device'
const STORE = 'kv'
let opening: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no IndexedDB'))
  return (opening ||= new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE) }
    r.onsuccess = () => res(r.result)
    r.onerror = () => { opening = null; rej(r.error) }
    r.onblocked = () => { opening = null; rej(new Error('blocked')) }
  }))
}
export async function putLocal(key: string, value: unknown): Promise<void> {
  const db = await open()
  await new Promise<void>((res, rej) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).put(value, key)
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  })
}
export async function getLocal<T>(key: string): Promise<T | undefined> {
  const db = await open()
  return new Promise<T | undefined>((res, rej) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    r.onsuccess = () => res(r.result as T | undefined)
    r.onerror = () => rej(r.error)
  })
}
export async function delLocal(key: string): Promise<void> {
  const db = await open()
  await new Promise<void>((res, rej) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).delete(key)
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
  })
}
