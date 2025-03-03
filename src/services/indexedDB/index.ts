import log from 'loglevel'
let currentVersion = 1

export const setDataToDB = (dbName: string, storeName: string, data: any[], keyPath: string) => {
  if (!('indexedDB' in window)) {
    log.info("This browser doesn't support IndexedDB")
  } else {
    const openRequest = indexedDB.open(dbName, currentVersion)
    openRequest.onupgradeneeded = function () {
      const db = openRequest.result
      addData(db, storeName, keyPath, data)
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
        alert('The database is out of date, please reload the page.')
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

      if (db.objectStoreNames.contains(storeName)) {
        const transaction = db.transaction([storeName])
        const objectStore = transaction.objectStore(storeName)
        resolve(objectStore.get(keyPath))
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

const addData = (db: any, storeName: string, keyPath: string, data: any[]) => {
  if (!db.objectStoreNames.contains(storeName)) {
    const objectStore = db.createObjectStore(storeName, { keyPath })
    // Create the 'channels' object store with the appropriate keyPath
    objectStore.transaction.oncomplete = () => {
      const channelObjectStore = db.transaction(storeName, 'readwrite').objectStore(storeName)
      data.forEach((value: any) => {
        const request = channelObjectStore.put(value)
        request.onsuccess = function () {}

        request.onerror = function () {
          log.info('Error on put channel to db .. ', request.error)
        }
      })
    }
  } else {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
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
