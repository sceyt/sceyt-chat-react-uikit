/**
 * The Media tab must not reload when an attachment is sent in the open chat.
 *
 * The Media tab with the real store and sagas (only the chat client is fake):
 * it loads its first page on mount and the next page when ChannelDetails
 * dispatches loadMoreAttachmentsAC (list scrolled to its end). A confirmed
 * send hands the message's attachments to updateTabAttachmentCache, as
 * sendMessage / sendTextMessage do with the server's reply.
 */
import React from 'react'
import log from 'loglevel'
import { act, screen } from '@testing-library/react'
import store from '../../../../store'
import Media from './index'
import { renderWithSceytProvider } from '../../../../testUtils/messageListHarness'
import { makeChannel, makeUser } from '../../../../testUtils/messageFixtures'
import { setClient } from '../../../../common/client'
import { attachmentTypes, DETAILS_TAB_ATTACHMENTS_PAGE_SIZE, LOADING_STATE } from '../../../../helpers/constants'
import {
  clearTabAttachmentsCacheAC,
  loadMoreAttachmentsAC,
  setAttachmentsAC,
  setAttachmentsLoadingStateAC
} from '../../../../store/message/actions'
import { __resetMessageSagaTestState, updateTabAttachmentCache } from '../../../../store/message/saga'
import { IAttachment } from '../../../../types'

jest.unmock('store')

jest.mock('../../../Attachment', () => ({
  __esModule: true,
  default: ({ attachment }: any) => <button type='button'>{attachment.name}</button>
}))

jest.mock('../../../../common/popups/sliderPopup', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('../../../../hooks', () => ({
  useColor: () => ({ background: '#fff', textSecondary: '#666', surface1: '#eee' }),
  useDidUpdate: jest.requireActual('../../../../hooks/basic/useDidUpdate').default
}))

const sender = makeUser({ id: 'current-user' })
const channel = makeChannel({ id: 'media-tab-channel' })

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

const tiles = () => screen.queryAllByRole('button')
const tileNames = () => tiles().map((tile) => tile.textContent)

// Lets the sagas' promises settle until `count` tiles show.
const waitForTiles = (count: number) =>
  act(async () => {
    const until = Date.now() + 3000
    while (tiles().length !== count) {
      if (Date.now() > until) throw new Error(`Expected ${count} media tiles, got ${tiles().length}`)
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
  })

const installAttachmentServer = (pages: { attachments: IAttachment[]; hasNext: boolean }[]) => {
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
          }
        })
      }
    }
  } as any)
  return served
}

const renderMedia = () => renderWithSceytProvider(<Media channel={channel} />, { store: store as any })

// What the confirmed send of image-41 does to the tab.
const sendImage41 = () =>
  act(() => {
    updateTabAttachmentCache(channel.id, [image(41)], sender)
  })

describe('Media tab while an attachment is sent in the chat', () => {
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

  it('sending an attachment after scrolling to older media keeps every loaded tile mounted', async () => {
    const served = installAttachmentServer([
      { attachments: range(40, 6), hasNext: true },
      { attachments: range(5, 1), hasNext: false }
    ])
    renderMedia()
    await waitForTiles(35)
    act(() => {
      store.dispatch(loadMoreAttachmentsAC(20))
    })
    await waitForTiles(40)
    const tilesBeforeSend = tiles()
    const namesBeforeSend = tileNames()

    sendImage41()

    // The new image is added on top; the 40 shown before are the same elements, none unmounted.
    expect(tileNames()).toEqual(['image-41.png', ...namesBeforeSend])
    expect(tilesBeforeSend.filter((tile) => !tile.isConnected).map((tile) => tile.textContent)).toEqual([])
    expect(served.pages).toBe(2)
  })

  it('sending an attachment keeps the shown tiles without a reload when all media fit one page', async () => {
    const served = installAttachmentServer([{ attachments: range(2, 1), hasNext: false }])
    renderMedia()
    await waitForTiles(2)
    const tilesBeforeSend = tiles()

    sendImage41()

    expect(tileNames()).toEqual(['image-41.png', 'image-2.png', 'image-1.png'])
    expect(tilesBeforeSend.every((tile) => tile.isConnected)).toBe(true)
    expect(served).toEqual({ queries: 1, pages: 1 })
  })
})
