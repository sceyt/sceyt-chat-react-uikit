import { useCallback, useSyncExternalStore } from 'react'
import {
  getMediaDownloadSnapshot,
  MediaDownloadSnapshot,
  subscribeToMediaDownload
} from '../../helpers/mediaDownloadCoordinator'

const subscribeToIdle = () => () => undefined

export const useMediaDownload = (key?: string): MediaDownloadSnapshot => {
  const subscribe = useCallback(
    (listener: () => void) => (key ? subscribeToMediaDownload(key, listener) : subscribeToIdle()),
    [key]
  )
  const getSnapshot = useCallback(() => getMediaDownloadSnapshot(key), [key])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
