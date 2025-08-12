import log from 'loglevel'
let currentVersion = 1

export const setDataToDB = (dbName: string, storeName: string, data: any[], keyPath: string) => {
  if (!('indexedDB' in window)) {
    log.info("This browser doesn't support IndexedDB")
  } else {
    const openRequest = indexedDB.open(dbName, currentVersion)
    openRequest.onupgradeneeded = function (event: any) {
      const db = openRequest.result
      const transaction = event.target.transaction
      addData(db, storeName, keyPath, data, transaction)
    }

    openRequest.onerror = function () {
      log.error('Indexeddb Error ', openRequest.error)
    }

    openRequest.onsuccess = function (event: any) {
      const db = event.target.result
      if (db.objectStoreNames.contains(storeName)) {
        addData(db, storeName, keyPath, data)
      } else {
        db.close()
        currentVersion++
        setDataToDB(dbName, storeName, data, keyPath)
      }
      db.onversionchange = function () {
        db.close()
      }
    }
    openRequest.onblocked = function () {}
  }
}

export const getDataFromDB = (
  dbName: string,
  storeName: string,
  keyPath: string,
  keyPatName?: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbName, currentVersion)

    openRequest.onupgradeneeded = function (event: any) {
      // const db = openRequest.result
      const db = event.target.result
      const transaction = event.target.transaction

      if (db.objectStoreNames.contains(storeName)) {
        const objectStore = transaction.objectStore(storeName)
        const request = objectStore.get(keyPath)
        request.onsuccess = (event: any) => {
          const result = event.target.result
          resolve(result || '')
        }
        request.onerror = (event: any) => {
          log.error('Error retrieving data during upgrade: ', event.target.error)
          resolve('')
        }
      } else {
        db.createObjectStore(storeName, { keyPath: keyPatName })
        resolve('')
      }
    }
    openRequest.onerror = (event: any) => {
      if (event.target.error.name === 'VersionError') {
        currentVersion++
        resolve(getDataFromDB(dbName, storeName, keyPath))
      } else {
        reject(event)
      }
      // Handle errors!
    }
    openRequest.onsuccess = (event: any) => {
      const db = event.target.result
      if (db.objectStoreNames.contains(storeName)) {
        const transaction = db.transaction(storeName, 'readonly')
        const objectStore = transaction.objectStore(storeName)
        const request = objectStore.get(keyPath)
        request.onsuccess = (event: any) => {
          const result = event.target.result
          if (result) {
            db.close()
            resolve(result)
          } else {
            log.info('No data found for the specified keyPathValue.')
            db.close()
            resolve('')
          }
        }

        request.onerror = (event: any) => {
          db.close()
          log.error('Error retrieving data: ', event.target.error)
        }
      } else {
        db.close()
        resolve('')
      }
    }
  })
}

const addData = (db: any, storeName: string, keyPath: string, data: any[], transaction?: IDBTransaction) => {
  if (!db.objectStoreNames.contains(storeName)) {
    const objectStore = db.createObjectStore(storeName, { keyPath })
    // Add data immediately using the current version change transaction
    data.forEach((value: any) => {
      const request = objectStore.put(value)
      request.onsuccess = function () {
        log.info('data added to db during upgrade.. ', request.result)
      }

      request.onerror = function () {
        log.info('Error on put data to db during upgrade.. ', request.error)
      }
    })
  } else {
    // If we have an existing transaction (during upgrade), use it
    if (transaction) {
      const store = transaction.objectStore(storeName)
      data.forEach((value: any) => {
        const request = store.put(value)
        request.onsuccess = function () {
          log.info('data added to db using existing transaction.. ', request.result)
        }

        request.onerror = function () {
          log.info('Error on put data to db using existing transaction.. ', request.error)
        }
      })
    } else {
      // Create new transaction only when not in upgrade mode
      const newTransaction = db.transaction(storeName, 'readwrite')
      const store = newTransaction.objectStore(storeName)
      data.forEach((value: any) => {
        const request = store.put(value)
        request.onsuccess = function () {
          log.info('data added to db.. ', request.result)
        }

        request.onerror = function () {
          log.info('Error on put channel to db .. ', request.error)
        }
      })
    }
  }
}

export const getAllDataFromDB = (dbName: string, storeName: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbName, currentVersion)

    openRequest.onupgradeneeded = function (event: any) {
      const db = event.target.result
      const transaction = event.target.transaction
      if (db.objectStoreNames.contains(storeName)) {
        const objectStore = transaction.objectStore(storeName)
        const request = objectStore.getAll()
        request.onsuccess = function () {
          resolve(request.result || [])
        }
        request.onerror = function () {
          reject(request.error)
        }
      } else {
        db.createObjectStore(storeName, { keyPath: 'url' })
        resolve([])
      }
    }

    openRequest.onerror = function () {
      log.error('Indexeddb Error ', openRequest.error)
      reject(openRequest.error)
    }

    openRequest.onsuccess = function (event: any) {
      const db = event.target.result
      if (db.objectStoreNames.contains(storeName)) {
        const transaction = db.transaction(storeName, 'readonly')
        const objectStore = transaction.objectStore(storeName)
        const request = objectStore.getAll()
        request.onsuccess = function () {
          db.close()
          resolve(request.result || [])
        }
        request.onerror = function () {
          db.close()
          reject(request.error)
        }
      } else {
        db.close()
        resolve([])
      }
    }
  })
}

export const deleteDataFromDB = (dbName: string, storeName: string, keyPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbName, currentVersion)

    openRequest.onupgradeneeded = function (event: any) {
      const db = event.target.result
      const transaction = event.target.transaction
      if (db.objectStoreNames.contains(storeName)) {
        const objectStore = transaction.objectStore(storeName)
        const request = objectStore.delete(keyPath)
        request.onsuccess = function () {
          resolve()
        }
        request.onerror = function () {
          reject(request.error)
        }
      } else {
        resolve()
      }
    }

    openRequest.onerror = function () {
      log.error('Indexeddb Error ', openRequest.error)
      reject(openRequest.error)
    }

    openRequest.onsuccess = function (event: any) {
      const db = event.target.result
      if (db.objectStoreNames.contains(storeName)) {
        const transaction = db.transaction(storeName, 'readwrite')
        const objectStore = transaction.objectStore(storeName)
        const request = objectStore.delete(keyPath)
        request.onsuccess = function () {
          db.close()
          resolve()
        }
        request.onerror = function () {
          db.close()
          reject(request.error)
        }
      } else {
        db.close()
        resolve()
      }
    }
  })
}

export const getAllStoreNames = (dbName: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbName, currentVersion)

    openRequest.onupgradeneeded = function (event: any) {
      const db = event.target.result
      // During upgrade, we can safely get store names
      resolve(Array.from(db.objectStoreNames) as string[])
    }

    openRequest.onerror = function () {
      log.error('Indexeddb Error ', openRequest.error)
      reject(openRequest.error)
    }

    openRequest.onsuccess = function (event: any) {
      const db = event.target.result
      try {
        // Get store names without starting a transaction
        const storeNames = Array.from(db.objectStoreNames) as string[]
        db.close()
        resolve(storeNames)
      } catch (error) {
        db.close()
        reject(error)
      }
    }
  })
}

export const deleteStore = (dbName: string, storeName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbName, currentVersion + 1)

    openRequest.onupgradeneeded = function (event: any) {
      const db = event.target.result
      if (db.objectStoreNames.contains(storeName)) {
        db.deleteObjectStore(storeName)
        currentVersion++
      }
      // Don't resolve here, wait for onsuccess
    }

    openRequest.onerror = function () {
      log.error('Indexeddb Error ', openRequest.error)
      reject(openRequest.error)
    }

    openRequest.onsuccess = function (event: any) {
      const db = event.target.result
      db.close()
      resolve()
    }
  })
}
