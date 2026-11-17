/**
 * The Media tab must not reload when an attachment is sent in the open chat.
 *
 * Real store, real reducers and real sagas; only the chat client is fake. The
 * Media tab loads its first page with getAttachmentsAC and further pages with
 * loadMoreAttachmentsAC (ChannelDetails dispatches it when the list is scrolled
 * to its end). A confirmed send (sendMessage / sendTextMessage) and an incoming
 * message both hand the message's attachments to updateTabAttachmentCache.
 */
import log from 'loglevel'
import store from '../../store'
import { setClient } from '../../common/client'
import {
  attachmentTypes,
  channelDetailsTabs,
  DETAILS_TAB_ATTACHMENTS_PAGE_SIZE,
  LOADING_STATE
} from '../../helpers/constants'
import { makeUser } from '../../testUtils/messageFixtures'
import { setConnectionStatusAC } from '../user/actions'
import { CONNECTION_STATUS } from '../user/constants'
import { IAttachment } from '../../types'
import {
  clearTabAttachmentsCacheAC,
  getAttachmentsAC,
  loadMoreAttachmentsAC,
  setAttachmentsAC,
  setAttachmentsLoadingStateAC
} from './actions'
import { __resetMessageSagaTestState, updateTabAttachmentCache } from './saga'

jest.unmock('store')

const channelId = 'media-tab-channel'
const sender = makeUser({ id: 'current-user' })

// 64-bit attachment ids (above Number.MAX_SAFE_INTEGER), far enough apart that
// the saga's Number() sort keeps their order.
const idAt = (index: number) => (BigInt('9007199254740993') + BigInt(index) * BigInt(1000)).toString()
const image = (index: number): IAttachment =>
  ({
    id: idAt(index),
    messageId: idAt(index),
    type: attachmentTypes.image,
    name: `image-${index}.png`,
    url: `https://cdn.example/image-${index}.png`,
    size: 100,
    metadata: JSON.stringify({ szw: 96, szh: 64 }),
    createdAt: new Date(Date.UTC(2026, 10, 1, 12, 0, index)),
    user: sender
  }) as any

// Newest first, as the attachment query returns them.
const range = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => image(from - i))

const shownNames = (): string[] => store.getState().MessageReducer.activeTabAttachments.map((a: IAttachment) => a.name)

const waitUntil = async (condition: () => boolean, what: string) => {
  const until = Date.now() + 3000
  while (!condition()) {
    if (Date.now() > until) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

// An attachment query that serves the media of the chat page by page, as the SDK does.
// `newer` is what a reconnect refresh finds after the newest cached media.
const installAttachmentServer = (
  pages: { attachments: IAttachment[]; hasNext: boolean }[],
  newer: IAttachment[] = []
) => {
  const served = { queries: 0, pages: 0 }
  setClient({
    user: { id: sender.id },
    AttachmentListQueryBuilder: class {
      limit() {
        return this
      }

      build() {
        served.queries += 1
        return Promise.resolve({
          limit: DETAILS_TAB_ATTACHMENTS_PAGE_SIZE,
          loadPrevious: () => {
            const page = pages[served.pages] || { attachments: [], hasNext: false }
            served.pages += 1
            return Promise.resolve({ attachments: [...page.attachments], hasNext: page.hasNext })
          },
          loadNextAttachmentId: () => Promise.resolve({ attachments: [...newer], hasNext: false })
        })
      }
    }
  } as any)
  return served
}

describe('Media tab attachments when an attachment is sent', () => {
  beforeAll(() => {
    jest.spyOn(log, 'info').mockImplementation(() => undefined)
    jest.spyOn(log, 'error').mockImplementation(() => undefined)
  })

  beforeEach(() => {
    __resetMessageSagaTestState()
    store.dispatch(clearTabAttachmentsCacheAC())
    store.dispatch(setAttachmentsAC([]))
    store.dispatch(setAttachmentsLoadingStateAC(LOADING_STATE.LOADED))
  })

  it('a sent attachment is added to every media item already loaded, including later pages', async () => {
    // 40 media in the chat: page 1 has the newest 35, page 2 the other 5.
    installAttachmentServer([
      { attachments: range(40, 6), hasNext: true },
      { attachments: range(5, 1), hasNext: false }
    ])

    store.dispatch(getAttachmentsAC(channelId, channelDetailsTabs.media, DETAILS_TAB_ATTACHMENTS_PAGE_SIZE))
    await waitUntil(() => shownNames().length === 35, 'the first page')
    store.dispatch(loadMoreAttachmentsAC(20))
    await waitUntil(() => shownNames().length === 40, 'the second page')
    const loadedBeforeSend = shownNames()

    // The send of image-41 is confirmed (what sendMessage does with the server's reply).
    updateTabAttachmentCache(channelId, [image(41)], sender)

    expect(shownNames()).toEqual(['image-41.png', ...loadedBeforeSend])
  })

  it('media loaded from a later page stay listed after a send, without loading them again', async () => {
    const served = installAttachmentServer([
      { attachments: range(40, 6), hasNext: true },
      { attachments: range(5, 1), hasNext: false }
    ])

    store.dispatch(getAttachmentsAC(channelId, channelDetailsTabs.media, DETAILS_TAB_ATTACHMENTS_PAGE_SIZE))
    await waitUntil(() => shownNames().length === 35, 'the first page')
    store.dispatch(loadMoreAttachmentsAC(20))
    await waitUntil(() => shownNames().length === 40, 'the second page')

    updateTabAttachmentCache(channelId, [image(41)], sender)

    // The oldest media (page 2) are still shown, and no page was requested again.
    expect(shownNames().filter((name) => ['image-1.png', 'image-5.png'].includes(name))).toEqual([
      'image-5.png',
      'image-1.png'
    ])
    expect(served).toEqual({ queries: 1, pages: 2 })
  })

  it('media loaded from a later page stay listed after a reconnect refresh', async () => {
    // image-41 was sent from another device while this one was offline.
    installAttachmentServer(
      [
        { attachments: range(40, 6), hasNext: true },
        { attachments: range(5, 1), hasNext: false }
      ],
      [image(41)]
    )

    store.dispatch(getAttachmentsAC(channelId, channelDetailsTabs.media, DETAILS_TAB_ATTACHMENTS_PAGE_SIZE))
    await waitUntil(() => shownNames().length === 35, 'the first page')
    store.dispatch(loadMoreAttachmentsAC(20))
    await waitUntil(() => shownNames().length === 40, 'the second page')
    const loadedBeforeReconnect = shownNames()

    store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    await waitUntil(() => shownNames().includes('image-41.png'), 'the reconnect refresh')

    expect(shownNames()).toEqual(['image-41.png', ...loadedBeforeReconnect])
  })
})
