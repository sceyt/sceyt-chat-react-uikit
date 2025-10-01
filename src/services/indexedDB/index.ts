import log from 'loglevel'

// ------------------------------
// Internal helpers
// ------------------------------

const openDatabase = (dbName: string): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const runUpgrade = async (dbName: string, onUpgrade: (db: IDBDatabase) => void): Promise<IDBDatabase> => {
  const db = await openDatabase(dbName)
  const nextVersion = db.version + 1
  db.close()
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, nextVersion)
    request.onupgradeneeded = () => {
      const upgradeDb = request.result
      onUpgrade(upgradeDb)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      log.warn('IndexedDB upgrade blocked; close other tabs to proceed')
    }
  })
}

const ensureStore = async (dbName: string, storeName: string, keyPath: string): Promise<IDBDatabase> => {
  const db = await openDatabase(dbName)
  if (db.objectStoreNames.contains(storeName)) {
    return db
  }
  db.close()
  const upgraded = await runUpgrade(dbName, (upgradeDb) => {
    if (!upgradeDb.objectStoreNames.contains(storeName)) {
      upgradeDb.createObjectStore(storeName, { keyPath })
    }
  })
  return upgraded
}

const awaitTransaction = (tx: IDBTransaction): Promise<void> => {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

const putWithPossibleOutOfLineKey = (store: IDBObjectStore, value: any, keyField: string) => {
  try {
    // If store has inline keyPath, we can put the value directly
    if (store.keyPath !== null) {
      store.put(value)
      return
    }
  } catch (e) {
    // Some browsers may throw on accessing keyPath; fall back to out-of-line
  }
  // Out-of-line keys (no keyPath and no key generator) require explicit key parameter
  const explicitKey = value?.[keyField]
  if (explicitKey === undefined || explicitKey === null) {
    throw new Error(`IndexedDB put requires explicit key but value has no '${keyField}' field`)
  }
  store.put(value, explicitKey)
}

// ------------------------------
// Public API
// ------------------------------

export const setDataToDB = async (dbName: string, storeName: string, data: any[], keyPath: string): Promise<void> => {
  if (!('indexedDB' in window)) {
    log.info("This browser doesn't support IndexedDB")
    return
  }

  const db = await ensureStore(dbName, storeName, keyPath)
  try {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    data.forEach((value) => {
      putWithPossibleOutOfLineKey(store, value, keyPath)
    })
    await awaitTransaction(tx)
  } finally {
    db.close()
  }
}

export const getDataFromDB = async (
  dbName: string,
  storeName: string,
  keyPathValue: string,
  keyPathName?: string
): Promise<any> => {
  try {
    const db = await openDatabase(dbName)
    if (!db.objectStoreNames.contains(storeName)) {
      db.close()
      if (keyPathName) {
        const upgraded = await ensureStore(dbName, storeName, keyPathName)
        upgraded.close()
      }
      return ''
    }
    const tx = db.transaction(storeName, 'readonly')
    const objectStore = tx.objectStore(storeName)
    const result = await new Promise<any>((resolve, reject) => {
      const request = objectStore.get(keyPathValue)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return result || ''
  } catch (error) {
    log.error('Error retrieving data: ', error)
    return ''
  }
}

// (removed legacy addData helper)

export const getAllDataFromDB = async (dbName: string, storeName: string): Promise<any[]> => {
  const db = await openDatabase(dbName)
  try {
    if (!db.objectStoreNames.contains(storeName)) {
      return []
    }
    const tx = db.transaction(storeName, 'readonly')
    const objectStore = tx.objectStore(storeName)
    const results = await new Promise<any[]>((resolve, reject) => {
      const request = objectStore.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
    return results
  } finally {
    db.close()
  }
}

export const deleteDataFromDB = async (dbName: string, storeName: string, keyPathValue: string): Promise<void> => {
  const db = await openDatabase(dbName)
  try {
    if (!db.objectStoreNames.contains(storeName)) return
    const tx = db.transaction(storeName, 'readwrite')
    const objectStore = tx.objectStore(storeName)
    await new Promise<void>((resolve, reject) => {
      const request = objectStore.delete(keyPathValue)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export const getAllStoreNames = async (dbName: string): Promise<string[]> => {
  const db = await openDatabase(dbName)
  try {
    return Array.from(db.objectStoreNames) as string[]
  } finally {
    db.close()
  }
}

export const deleteStore = async (dbName: string, storeName: string): Promise<void> => {
  const db = await openDatabase(dbName)
  const shouldDelete = db.objectStoreNames.contains(storeName)
  db.close()
  if (!shouldDelete) return
  const upgraded = await runUpgrade(dbName, (upgradeDb) => {
    if (upgradeDb.objectStoreNames.contains(storeName)) {
      upgradeDb.deleteObjectStore(storeName)
    }
  })
  upgraded.close()
}
