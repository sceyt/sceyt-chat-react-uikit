import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import MessageList from './index'
import { CONNECTION_STATUS } from '../../../store/user/constants'
import {
  createMessageListStore,
  makeChannel,
  renderWithSceytProvider,
  resetMessageListFixtureIds
} from '../../../testUtils/messageListHarness'
import { documentDropCases, mediaDropCases } from '../../../testUtils/fileDropFixtures'

// In Safari a dragged document must offer only "Send as file", not "Send as media".
//
// While a drag is over the page (dragenter/dragover) WebKit keeps the DataTransfer in
// protected mode: `files` is empty, and `items` lists only the promised file types that
// are image or media types (WebCore DataTransferItemList::ensureItems, canReadTypes
// branch). A document's type is filtered out, so a PDF drag has no items at all. Only
// the drop event gets the real Files.

jest.mock('../../../common/popups/sliderPopup', () => () => null)

const buildStore = () =>
  createMessageListStore({
    ChannelReducer: { activeChannel: makeChannel() },
    UserReducer: { connectionStatus: CONNECTION_STATUS.DISCONNECTED }
  })

const renderMessageList = (store: ReturnType<typeof buildStore>) =>
  renderWithSceytProvider(React.createElement(MessageList), { store })

const fireDragEvent = (target: HTMLElement, type: 'dragenter' | 'drop', dataTransfer: object) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  fireEvent(target, event)
  return event
}

// Approximates WebKit's MIMETypeRegistry::isSupportedImageMIMEType / isSupportedMediaMIMEType.
const safariExposesTypeDuringDrag = (type: string) => /^(image|video|audio)\//.test(type)

// What Safari hands to dragenter for files dragged in from Finder.
const safariDragEnterData = (files: File[]) => ({
  types: ['Files'],
  items: files
    .filter((file) => safariExposesTypeDuringDrag(file.type))
    .map((file) => ({ kind: 'file', type: file.type })),
  files: []
})

// What Safari hands to drop: the real Files.
const safariDropData = (files: File[]) => ({
  types: ['Files'],
  items: files.map((file) => ({ kind: 'file', type: file.type, webkitGetAsEntry: () => ({ isDirectory: false }) })),
  files,
  clearData: jest.fn()
})

// The drop areas the list offers, in the order shown.
const dropOptions = () =>
  screen
    .queryAllByText(/Drag & drop to send as (file|media)/)
    .map((area) => /send as (file|media)/.exec(area.textContent || '')![0])

describe('MessageList drag and drop in Safari', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
  })

  it.each(documentDropCases)(
    'Safari drag of document %s (MIME %p) offers only "send as file", not "send as media"',
    async (name, type) => {
      const store = buildStore()
      const view = renderMessageList(store)
      const file = new File(['document bytes'], name, { type })

      fireDragEvent(view.container.querySelector('#scrollableDiv')!, 'dragenter', safariDragEnterData([file]))

      expect(dropOptions()).toEqual(['send as file'])
      await act(async () => view.unmount())
    }
  )

  it('Safari drop of a PDF is queued as a file, after only "send as file" was offered', async () => {
    const store = buildStore()
    const view = renderMessageList(store)
    const file = new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' })

    fireDragEvent(view.container.querySelector('#scrollableDiv')!, 'dragenter', safariDragEnterData([file]))
    expect(screen.queryByText('Drag & drop to send as media')).toBeNull()
    fireDragEvent(screen.getByText('Drag & drop to send as file'), 'drop', safariDropData([file]))

    const queued = store.getState().ChannelReducer.draggedAttachments
    expect(queued.map((attachment) => [attachment.name, attachment.attachmentType])).toEqual([['report.pdf', 'file']])
    await act(async () => view.unmount())
  })

  // Guards the other side of a fix: Safari does expose image and video types, so media keeps both options.
  it.each(mediaDropCases)('Safari drag of media %s still offers "send as media"', async (name, type) => {
    const store = buildStore()
    const view = renderMessageList(store)
    const file = new File(['media bytes'], name, { type })

    fireDragEvent(view.container.querySelector('#scrollableDiv')!, 'dragenter', safariDragEnterData([file]))

    expect(dropOptions()).toEqual(['send as file', 'send as media'])
    await act(async () => view.unmount())
  })
})
