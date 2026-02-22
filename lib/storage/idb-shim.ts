/**
 * Minimal promise-based IndexedDB wrapper (replaces "idb" package for build).
 */

export interface IDBPDatabase<DBTypes = unknown> {
  get<K extends keyof DBTypes>(
    name: K,
    key: string
  ): Promise<DBTypes[K] extends { value: infer V } ? V | undefined : never>
  put<K extends keyof DBTypes>(
    name: K,
    value: DBTypes[K] extends { value: infer V } ? V : never
  ): Promise<void>
  delete(name: keyof DBTypes, key: string): Promise<void>
  getAll(name: keyof DBTypes): Promise<DBTypes[keyof DBTypes] extends { value: infer V } ? V[] : never[]>
  getAllFromIndex<K extends keyof DBTypes>(
    name: K,
    indexName: string,
    key: string
  ): Promise<DBTypes[K] extends { value: infer V } ? V[] : never[]>
  transaction<K extends keyof DBTypes>(
    storeNames: K[],
    mode?: IDBTransactionMode
  ): {
    objectStore(name: K): {
      get(key: string): IDBRequest
      put(value: unknown): IDBRequest
      delete(key: string): IDBRequest
      index(name: string): { getAll(key: string): Promise<unknown[]> }
    }
    done: Promise<void>
  }
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function openDB<DBTypes>(
  name: string,
  version: number,
  opts: { upgrade: (db: IDBDatabase) => void }
): Promise<IDBPDatabase<DBTypes>> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => {
      opts.upgrade(req.result)
    }
    req.onsuccess = () => {
      const raw = req.result
      const db: IDBPDatabase<DBTypes> = {
        get(storeName, key) {
          return promisify(raw.transaction(storeName as string, "readonly").objectStore(storeName as string).get(key))
        },
        put(storeName, value) {
          return promisify(raw.transaction(storeName as string, "readwrite").objectStore(storeName as string).put(value))
        },
        delete(storeName, key) {
          return promisify(raw.transaction(storeName as string, "readwrite").objectStore(storeName as string).delete(key))
        },
        getAll(storeName) {
          return promisify(raw.transaction(storeName as string, "readonly").objectStore(storeName as string).getAll())
        },
        getAllFromIndex(storeName, indexName, key) {
          const store = raw.transaction(storeName as string, "readonly").objectStore(storeName as string)
          return promisify(store.index(indexName).getAll(key))
        },
        transaction(storeNames, mode = "readwrite") {
          const tx = raw.transaction(storeNames as string[], mode)
          const done = new Promise<void>((res, rej) => {
            tx.oncomplete = () => res()
            tx.onerror = () => rej(tx.error)
          })
          return {
            objectStore(name) {
              const s = tx.objectStore(name as string)
              return {
                get(key: string) {
                  return s.get(key)
                },
                put(value: unknown) {
                  return s.put(value)
                },
                delete(key: string) {
                  return s.delete(key)
                },
                index(name: string) {
                  return {
                    getAll(key: string) {
                      return promisify(s.index(name).getAll(key))
                    },
                  }
                },
              }
            },
            get done() {
              return done
            },
          }
        },
      }
      resolve(db)
    }
  })
}
