export const setDataToDB = (dbName: string, storeName: string, data: any[], keyPath: string) => {
  if (!('indexedDB' in window)) {
    console.log("This browser doesn't support IndexedDB")
  } else {
    const openRequest = indexedDB.open(dbName, 1)
    openRequest.onupgradeneeded = function () {
      // срабатывает, если на клиенте нет базы данных
      // ...выполнить инициализацию...
      // версия существующей базы данных меньше 2 (или база данных не существует)
      const db = openRequest.result
      addData(db, storeName, keyPath, data)
    }

    openRequest.onerror = function () {
      console.error('Indexeddb Error ', openRequest.error)
    }

    openRequest.onsuccess = function () {
      const db = openRequest.result

      addData(db, storeName, keyPath, data)
      db.onversionchange = function () {
        db.close()
        alert('The database is out of date, please reload the page.')
      }
    }
    openRequest.onblocked = function () {
      // это событие не должно срабатывать, если мы правильно обрабатываем onversionchange
      // это означает, что есть ещё одно открытое соединение с той же базой данных
      // и он не был закрыт после того, как для него сработал db.onversionchange
    }
  }
}

export const getDataFromDB = (dbName: string, storeName: string, keyPath: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbName, 1)
    openRequest.onupgradeneeded = function () {
      const db = openRequest.result
      const transaction = db.transaction([storeName])
      const objectStore = transaction.objectStore(storeName)
      return objectStore.get(keyPath)
    }
    openRequest.onerror = (event) => {
      console.log('Error on get data from db', event)
      reject(event)
      // Handle errors!
    }
    openRequest.onsuccess = (event: any) => {
      const db = event.target.result

      const transaction = db.transaction(storeName, 'readonly')
      const objectStore = transaction.objectStore(storeName)

      const request = objectStore.get(keyPath)

      request.onsuccess = (event: any) => {
        const result = event.target.result
        if (result) {
          resolve(result)
        } else {
          console.log('No data found for the specified keyPathValue.')
          resolve('')
        }
      }

      request.onerror = (event: any) => {
        console.error('Error retrieving data: ', event.target.error)
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
          console.log('Error on put channel to db .. ', request.error)
        }
      })
    }
  } else {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    data.forEach((value: any) => {
      const request = store.put(value)
      request.onsuccess = function () {
        console.log('data added to db.. ', request.result)
      }

      request.onerror = function () {
        console.log('Error on put channel to db .. ', request.error)
      }
    })
  }
}
