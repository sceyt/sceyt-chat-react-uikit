import { getDataFromDB, setDataToDB, getAllStoreNames, deleteStore } from './index'
import { IOGMetadata } from '../../types'

const METADATA_DB_NAME = 'sceyt-metadata-db'

const getCurrentMonthKey = (): string => {
  const now = new Date()
  return `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
}

const getPreviousMonthKey = (): string => {
  const now = new Date()
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${String(previousMonth.getMonth() + 1).padStart(2, '0')}-${previousMonth.getFullYear()}`
}

export const storeMetadata = async (url: string, metadata: IOGMetadata): Promise<void> => {
  const currentMonth = getCurrentMonthKey()

  const metadataRecord: IOGMetadata & { timestamp: number } = {
    ...metadata,
    url,
    timestamp: Date.now()
  }

  try {
    // Store new metadata with current month store
    await setDataToDB(METADATA_DB_NAME, currentMonth, [metadataRecord], 'url')

    // Clean up old months metadata stores
  } catch (error) {
    console.error('Failed to store metadata in IndexedDB:', error)
  }
}

export const cleanupOldMonthsMetadata = async (): Promise<void> => {
  try {
    const currentMonth = getCurrentMonthKey()
    const previousMonth = getPreviousMonthKey()

    // Get all store names from the database
    const allStores = await getAllStoreNames(METADATA_DB_NAME)

    // Filter out current and previous month stores
    const storesToDelete = allStores.filter((storeName) => {
      // Only keep current and previous month, delete all others
      return storeName !== currentMonth && storeName !== previousMonth
    })

    // Delete all old month stores with delay between operations
    for (const storeName of storesToDelete) {
      try {
        await deleteStore(METADATA_DB_NAME, storeName)
        console.log(`Deleted old month store: ${storeName}`)
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Failed to delete store ${storeName}:`, error)
      }
    }

    if (storesToDelete.length > 0) {
      console.log(`Cleaned up ${storesToDelete.length} old month stores: ${storesToDelete.join(', ')}`)
    }
  } catch (error) {
    console.error('Failed to cleanup old months metadata:', error)
  }
}

export const getMetadata = async (url: string): Promise<IOGMetadata | null> => {
  try {
    const currentMonth = getCurrentMonthKey()
    const result = await getDataFromDB(METADATA_DB_NAME, currentMonth, url, 'url')

    if (!result || typeof result === 'string') {
      return null
    }

    const metadataRecord = result as IOGMetadata & { timestamp: number; expiresAt: number }

    // Check if metadata has expired
    if (Date.now() > metadataRecord.expiresAt) {
      return null
    }

    return metadataRecord
  } catch (error) {
    return null
  }
}
