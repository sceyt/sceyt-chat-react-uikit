// A pinned image becomes blurry once the pinned banner is the
// component that downloads it.
//
// The banner draws the image in a 32px tile (imageAttachmentMaxWidth/Height=32).
// Attachment compresses a downloaded image to its own render size and stores
// that copy under the attachment URL, which is the key the message list, the
// pinned-messages list and every later session read. After "a long time" the
// pinned message is no longer in the loaded message window (or this is a new
// session with an empty attachment cache), so the banner is the first, and only,
// Attachment to download the image, and its tiny copy is what the message shows.
import React, { PropsWithChildren } from 'react'
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { act, fireEvent, render } from '@testing-library/react'
import { SceytReduxContext } from '../../store/context'
import ChannelReducer from '../../store/channel/reducers'
import MembersReducer from '../../store/member/reducers'
import MessageReducer from '../../store/message/reducers'
import ThemeReducer from '../../store/theme/reducers'
import UserReducer from '../../store/user/reducers'
import PinnedReducer from '../../store/pinned/reducers'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { attachmentTypes } from '../../helpers/constants'
import { resetMediaDownloadCoordinatorForTests } from '../../helpers/mediaDownloadCoordinator'
import { releaseAllBlobUrls } from '../../helpers/attachmentBlobUrls'
import { clearMessagesMap } from '../../helpers/messagesHalper'
import { fileTransfer } from '../../fileTransfer/sceytChatUIKitFileTransfer'
import { FileTransferResult } from '../../types/fileTransfer/types'
import { makeMessage, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'
import Attachment from '../Attachment'
import PinnedMessagesBanner from './PinnedMessagesBanner'

// Cache Storage stand-in: it outlives the Redux store, as the browser cache outlives a reload.
const mockAttachmentCache = new Map<string, string>()

jest.mock('../../helpers/attachmentsCache', () => ({
  ATTACHMENT_VERSION: '_1_0_2',
  getAttachmentURLWithVersion: (url: string) => `${url}_1_0_2`,
  getAttachmentUrlFromCache: (url: string) => Promise.resolve(mockAttachmentCache.get(url) || false),
  // What the download coordinator stores first: the downloaded original.
  setAttachmentToCache: (url: string) => {
    mockAttachmentCache.set(url, `blob:original:${url}`)
    return Promise.resolve()
  }
}))

// The compressed copy is named after the size it was made for, so a test can
// tell the 32px banner copy from a copy made for the message bubble.
type Compress = (url: string, cacheKey: string, maxWidth?: number, maxHeight?: number) => Promise<string>
const compressToSize: Compress = (_url, cacheKey, maxWidth, maxHeight) => {
  const copy = `blob:copy-${maxWidth}x${maxHeight}`
  mockAttachmentCache.set(cacheKey, copy)
  return Promise.resolve(copy)
}
let mockCompressAndCacheImage: Compress = compressToSize

jest.mock('../../helpers/getVideoFrame', () => {
  const actual = jest.requireActual('../../helpers/getVideoFrame')
  return {
    ...actual,
    compressAndCacheImage: (url: string, cacheKey: string, maxWidth?: number, maxHeight?: number) =>
      mockCompressAndCacheImage(url, cacheKey, maxWidth, maxHeight)
  }
})

const reducers = { ChannelReducer, MessageReducer, MembersReducer, ThemeReducer, PinnedReducer, UserReducer }
const rootReducer = combineReducers(reducers)

const CHANNEL_ID = 'channel-1'
const IMAGE_URL = 'https://cdn/pinned-portrait.jpg'
// A portrait photo: in a 400x400 message bubble it renders at 300x400.
const BUBBLE_MAX = 400
const BUBBLE_RENDER_WIDTH = 300

const pinnedImage = {
  id: 'pinned-image-attachment-id',
  messageId: '9007199254741001',
  name: 'portrait.jpg',
  type: attachmentTypes.image,
  url: IMAGE_URL,
  size: 2_400_000,
  createdAt: new Date(),
  upload: false,
  attachmentUrl: '',
  metadata: JSON.stringify({ szw: 1200, szh: 1600, tmb: 'a'.repeat(80) })
}

const createStore = () => {
  const message = makeMessage({ id: pinnedImage.messageId, body: '', attachments: [pinnedImage as any] })
  const initial = rootReducer(undefined, { type: '@@TEST/INIT' })
  return configureStore({
    reducer: reducers,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: false, serializableCheck: false }),
    preloadedState: {
      ...initial,
      UserReducer: { ...initial.UserReducer, connectionStatus: CONNECTION_STATUS.CONNECTED },
      PinnedReducer: {
        ...initial.PinnedReducer,
        byChannel: { [CHANNEL_ID]: [{ id: 'pin-1', pinType: 0, message }] },
        loaded: { [CHANNEL_ID]: true }
      }
    }
  })
}
type Store = ReturnType<typeof createStore>

const renderIn = (store: Store, ui: React.ReactElement) => {
  const Wrapper = ({ children }: PropsWithChildren<{}>) => (
    <Provider context={SceytReduxContext} store={store}>
      {children}
    </Provider>
  )
  return render(ui, { wrapper: Wrapper })
}

// The image of the pinned message as the message list (and the pinned-messages list) draws it.
const MessageBubbleImage = () => (
  <Attachment
    attachment={pinnedImage as any}
    backgroundColor='#ffffff'
    imageAttachmentMaxWidth={BUBBLE_MAX}
    imageAttachmentMaxHeight={BUBBLE_MAX}
    channelId={CHANNEL_ID}
  />
)

const settle = async () => {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

// The browser loads each pending (hidden) image; Attachment then swaps it in on top.
const loadPendingImages = async (container: HTMLElement) => {
  for (let i = 0; i < 5; i += 1) {
    const pending = Array.from(container.querySelectorAll('img[hidden]'))
    if (!pending.length) return
    pending.forEach((img) => fireEvent.load(img))
    await settle()
  }
}

// Width the image on screen was made for: 0 for the base64 blur preview, the full size
// for the original, and the size in its name for a compressed copy.
const shownImageWidth = async (container: HTMLElement) => {
  await loadPendingImages(container)
  const visible = Array.from(container.querySelectorAll('img:not([hidden])'))
  // During the cross-fade the newly displayed image is drawn last, on top.
  const src = visible.length ? visible[visible.length - 1].getAttribute('src') || '' : ''
  if (!src.startsWith('blob:')) return 0
  const copy = /^blob:copy-(\d+)x\d+$/.exec(src)
  return copy ? Number(copy[1]) : Number.POSITIVE_INFINITY
}

describe('a pinned image keeps its quality', () => {
  beforeEach(() => {
    mockAttachmentCache.clear()
    mockCompressAndCacheImage = compressToSize
    resetMediaDownloadCoordinatorForTests()
    releaseAllBlobUrls()
    clearMessagesMap()
    resetMessageListFixtureIds()
    fileTransfer.provider = {
      upload: () => Promise.resolve(FileTransferResult.failure(new Error('no uploads here'))),
      download: () => Promise.resolve(FileTransferResult.success(new Blob(['jpeg'], { type: 'image/jpeg' }))),
      cancel: () => undefined
    } as any
  })

  afterEach(() => {
    fileTransfer.configure()
  })

  it('the message shows its pinned image at full size after the banner was the first to download it', async () => {
    // The pinned message is outside the loaded message window and nothing is cached yet:
    // only the banner shows the image.
    const store = createStore()
    renderIn(store, <PinnedMessagesBanner channelId={CHANNEL_ID} />)
    await settle()

    // The user opens the pinned message (taps the banner / opens the pinned list).
    const bubble = renderIn(store, <MessageBubbleImage />)
    await settle()

    expect(await shownImageWidth(bubble.container)).toBeGreaterThanOrEqual(BUBBLE_RENDER_WIDTH)
  })

  it('after a reload the pinned message still shows its image at full size', async () => {
    const firstSession = createStore()
    const banner = renderIn(firstSession, <PinnedMessagesBanner channelId={CHANNEL_ID} />)
    await settle()
    banner.unmount()

    // Reload: Redux, the blob URL registry and running downloads are gone; Cache Storage stays.
    resetMediaDownloadCoordinatorForTests()
    releaseAllBlobUrls()
    const bubble = renderIn(createStore(), <MessageBubbleImage />)
    await settle()

    expect(await shownImageWidth(bubble.container)).toBeGreaterThanOrEqual(BUBBLE_RENDER_WIDTH)
  })

  it('the message keeps its full-size image when the banner finishes compressing after the message did', async () => {
    // Opening the chat with the pinned message loaded: banner and message share one download,
    // and each compresses it for its own size. The 32px tile happens to finish last.
    const pending: Array<{ maxWidth?: number; finish: () => void }> = []
    mockCompressAndCacheImage = (url, cacheKey, maxWidth, maxHeight) =>
      new Promise((resolve) => {
        pending.push({ maxWidth, finish: () => compressToSize(url, cacheKey, maxWidth, maxHeight).then(resolve) })
      })
    const store = createStore()
    renderIn(store, <PinnedMessagesBanner channelId={CHANNEL_ID} />)
    const bubble = renderIn(store, <MessageBubbleImage />)
    await settle()
    expect(pending).toHaveLength(2)

    const order = [...pending].sort((a, b) => (b.maxWidth || 0) - (a.maxWidth || 0))
    for (const job of order) {
      job.finish()
      await settle()
    }

    expect(await shownImageWidth(bubble.container)).toBeGreaterThanOrEqual(BUBBLE_RENDER_WIDTH)
  })

  it('after a reload the banner shows the pinned image again without downloading it', async () => {
    let downloads = 0
    const provider = fileTransfer.provider as any
    const download = provider.download
    provider.download = (...args: any[]) => {
      downloads += 1
      return download(...args)
    }
    const banner = renderIn(createStore(), <PinnedMessagesBanner channelId={CHANNEL_ID} />)
    await settle()
    banner.unmount()
    resetMediaDownloadCoordinatorForTests()
    releaseAllBlobUrls()

    const afterReload = renderIn(createStore(), <PinnedMessagesBanner channelId={CHANNEL_ID} />)
    await settle()

    expect(await shownImageWidth(afterReload.container)).toBeGreaterThan(0)
    expect(downloads).toBe(1)
  })
})
