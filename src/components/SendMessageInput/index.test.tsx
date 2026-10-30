import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { setClient } from '../../common/client'
import { setActiveChannelAC } from '../../store/channel/actions'
import { addSelectedMessageAC, setPinnedMessagesListOpenAC } from '../../store/message/actions'
import { SEND_MESSAGE } from '../../store/message/constants'
import { attachmentTypes } from '../../helpers/constants'
import {
  createMessageListStore,
  makeChannel,
  makeMessage,
  makeUser,
  renderWithSceytProvider
} from '../../testUtils/messageListHarness'
import { documentDropCases, mediaDropCases } from '../../testUtils/fileDropFixtures'
import {
  clearAttachmentPreparation,
  waitForAttachmentPreparation,
  waitForAttachmentPreview
} from '../../helpers/attachmentPreparation'
import * as videoContainer from '../../helpers/videoContainer'
import { releaseAllBlobUrls } from '../../helpers/attachmentBlobUrls'
import * as imagePreparation from '../../helpers/resizeImage'
import { setCustomUploader } from '../../helpers/customUploader'

jest.mock('../../helpers/messagesHalper', () => {
  const drafts: Record<string, any> = {}
  return {
    ...jest.requireActual('../../helpers/messagesHalper'),
    __drafts: drafts,
    areDraftMessagesHydrated: () => true,
    checkDraftMessagesIsEmpty: () => Object.keys(drafts).length === 0,
    deleteVideoThumb: jest.fn(),
    draftMessagesMap: drafts,
    getAudioRecordingFromMap: jest.fn(),
    getDraftMessageFromMap: (channelId: string) => drafts[channelId],
    removeDraftMessageFromMap: (channelId: string) => delete drafts[channelId],
    setDraftMessageToMap: (channelId: string, draft: any) => {
      drafts[channelId] = draft
    },
    setPendingAttachment: jest.fn(),
    setSendMessageHandler: jest.fn(),
    subscribeToDraftMessages: () => () => undefined
  }
})

jest.mock('../../hooks', () => ({
  useColor: () => ({
    accent: '#00aa88',
    backgroundSections: '#ffffff',
    surface1: '#ffffff',
    surface2: '#eeeeee',
    textPrimary: '#111111',
    textSecondary: '#666666',
    iconInactive: '#999999',
    warning: '#c96f00',
    backgroundHovered: '#f4f4f4',
    background: '#ffffff',
    textFootnote: '#666666',
    highlightedBackground: '#e8f5ef',
    textOnPrimary: '#ffffff',
    tooltipBackground: '#111111',
    border: '#dddddd'
  }),
  useDidUpdate: jest.fn()
}))

jest.mock('../../hooks/usePermissions', () => ({
  __esModule: true,
  default: () => [() => true]
}))

jest.mock('./FormatMessagePlugin', () => ({
  __esModule: true,
  default: ({ setMessageText }: { setMessageText: (text: string) => void }) => (
    <button data-testid='type-user-a-draft' onClick={() => setMessageText('Draft for User A')}>
      Type draft
    </button>
  )
}))

jest.mock('./MentionsPlugin', () => ({ __esModule: true, default: () => null }))
jest.mock('./FloatingTextFormatToolbarPlugin', () => ({ __esModule: true, default: () => null }))
jest.mock('./EditMessagePlugin', () => ({ __esModule: true, default: () => null }))
jest.mock('./EmojisPlugin', () => ({ __esModule: true, default: () => null }))
jest.mock('./RecordingAnimation', () => ({ __esModule: true, default: () => null }))
jest.mock('./Poll/CreatePollPopup', () => ({ __esModule: true, default: () => null }))
jest.mock('../Attachment', () => ({
  __esModule: true,
  default: () => null,
  AttachmentFile: () => null,
  AttachmentImg: () => null
}))
jest.mock('../AudioRecord', () => ({ __esModule: true, default: () => null }))
jest.mock('../../common/dropdown', () => ({ __esModule: true, default: () => null }))
jest.mock('../../common/popups/delete', () => ({ __esModule: true, default: () => null }))
jest.mock('../../common/popups/forwardMessage', () => ({ __esModule: true, default: () => null }))

jest.mock('../../helpers/videoConversion', () => ({
  remuxVideoFileForUpload: jest.fn((file: File) => Promise.resolve(file))
}))

jest.mock('../../helpers/getVideoFrame', () => ({
  getFrame: jest.fn(() =>
    Promise.resolve({
      thumb: 'data:image/jpeg;base64,thumb',
      width: 1280,
      height: 720,
      duration: 3,
      frameBlobUrl: 'blob:video-thumb',
      blob: new Blob(['thumb'], { type: 'image/jpeg' })
    })
  )
}))

jest.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))
jest.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [
    {
      focus: jest.fn(),
      update: jest.fn(),
      dispatchCommand: jest.fn(),
      setEditorState: jest.fn()
    }
  ]
}))
jest.mock('@lexical/react/LexicalContentEditable', () => ({ ContentEditable: () => <div /> }))
jest.mock('@lexical/react/LexicalRichTextPlugin', () => ({ RichTextPlugin: () => null }))
jest.mock('@lexical/react/LexicalErrorBoundary', () => () => null)
jest.mock('@lexical/react/LexicalOnChangePlugin', () => ({ OnChangePlugin: () => null }))
jest.mock('@lexical/react/LexicalHistoryPlugin', () => ({ HistoryPlugin: () => null }))
jest.mock('lexical', () => ({
  $createParagraphNode: jest.fn(),
  $createTextNode: jest.fn(),
  $getRoot: jest.fn(),
  $getSelection: jest.fn(),
  FORMAT_TEXT_COMMAND: 'format'
}))
jest.mock('./MentionNode', () => ({ MentionNode: class MentionNode {} }))

const SendMessageInput = require('./index').default
const MessageList = require('../Messages/MessageList').default
const mockDrafts: Record<string, any> = require('../../helpers/messagesHalper').__drafts

const renderFileDropFlow = (props = {}) => {
  const channel = makeChannel({ id: 'file-drop-flow-channel' })
  const store = createMessageListStore({ ChannelReducer: { activeChannel: channel } })
  const dispatch = jest.spyOn(store, 'dispatch')
  const view = renderWithSceytProvider(
    <>
      <MessageList />
      <SendMessageInput {...props} CustomSendMessageButton={<button data-testid='send-dropped-files'>Send</button>} />
    </>,
    { store }
  )
  const drop = async (files: File[], attachmentType = 'file', exposeItems = true) => {
    const dataTransfer = {
      types: ['Files'],
      items: exposeItems ? files.map((file) => ({ kind: 'file', type: file.type })) : [],
      files,
      // As in Firefox: the dropped data is read-only during the drop event.
      clearData: () => {
        throw new DOMException('Modifications are not allowed for this document', 'NoModificationAllowedError')
      }
    }
    const event = (type: string) => {
      const result = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(result, 'dataTransfer', { value: dataTransfer })
      return result
    }
    fireEvent(view.container.querySelector('#scrollableDiv')!, event('dragenter'))
    await act(async () => {
      fireEvent(screen.getByText(`Drag & drop to send as ${attachmentType}`), event('drop'))
      jest.advanceTimersByTime(0)
      await Promise.resolve()
    })
    // Preparation is scheduled after the composer consumes the drop action.
    await act(async () => {
      jest.advanceTimersByTime(0)
      await Promise.resolve()
    })
  }
  const send = async () => {
    await act(async () => {
      const button = screen.queryByTestId('send-dropped-files')
      if (button) fireEvent.click(button)
      await Promise.resolve()
    })
  }
  const outgoing = () => dispatch.mock.calls.map(([action]) => action).filter((action) => action.type === SEND_MESSAGE)
  return { ...view, store, drop, send, outgoing }
}

describe('file-drop integration: MessageList, Redux and SendMessageInput', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })
    })
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:drop-preview') })
  })

  beforeEach(() => {
    jest.useFakeTimers()
    Object.keys(mockDrafts).forEach((channelId) => delete mockDrafts[channelId])
    require('../../helpers/messagesHalper').clearMessagesMap()
    setClient({ user: makeUser({ id: 'current-user' }) })
    require('../../hooks').useDidUpdate.mockImplementation(require('../../hooks/basic/useDidUpdate').default)
    jest.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(() => {
      throw new Error('A file drop must not read the full file into base64')
    })
    jest.spyOn(window, 'atob')
    jest.spyOn(imagePreparation, 'createImageThumbnail').mockResolvedValue({
      thumbnail: 'thumbnail',
      imageWidth: 10,
      imageHeight: 10
    })
    jest.spyOn(imagePreparation, 'resizeImage').mockImplementation(async (file: File) => ({
      file,
      blob: null,
      newWidth: 10,
      newHeight: 10
    }))
    require('../../helpers/videoConversion').remuxVideoFileForUpload.mockImplementation((file: File) =>
      Promise.resolve(file)
    )
    require('../../helpers/getVideoFrame').getFrame.mockResolvedValue({
      thumb: 'thumbnail',
      width: 10,
      height: 10,
      duration: 1,
      blob: new Blob(['thumbnail'], { type: 'image/jpeg' })
    })
  })

  afterEach(() => {
    require('../../helpers/messagesHalper').setPendingAttachment.mock.calls.forEach(([tid]: [string]) =>
      clearAttachmentPreparation(tid)
    )
    releaseAllBlobUrls()
    require('../../hooks').useDidUpdate.mockReset()
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  // WAAF-3477: the installer.dmg rows cover a large dropped DMG, with and without a MIME type.
  it.each([['installer.dmg', 'application/x-apple-diskimage'], ['installer.dmg', ''], ...documentDropCases])(
    'sends dropped %s from the real list through the real composer',
    async (name, type) => {
      const view = renderFileDropFlow()
      const file = new File(['original bytes'], name, { type, lastModified: 1234 })
      if (name === 'installer.dmg') Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 * 1024 })
      await view.drop([file])
      expect(view.store.getState().ChannelReducer.draggedAttachments).toEqual([])
      await view.send()
      expect(view.outgoing()).toHaveLength(1)
      const attachments = view.outgoing()[0].payload.message.attachments
      expect(attachments).toHaveLength(1)
      expect(attachments[0].data).toBe(file)
      expect(attachments[0].name).toBe(name)
      expect(attachments[0].size).toBe(file.size)
      expect(attachments[0].type).toBe(attachmentTypes.file)
      expect(FileReader.prototype.readAsDataURL).not.toHaveBeenCalled()
      expect(window.atob).not.toHaveBeenCalled()
      view.unmount()
    }
  )

  it.each(['media', 'file'])('a %s drop only reads the dropped data, which Firefox makes read-only', async (target) => {
    const errors: string[] = []
    const onError = (event: ErrorEvent) => {
      errors.push(event.message)
      event.preventDefault()
    }
    window.addEventListener('error', onError)
    try {
      const view = renderFileDropFlow()
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
      await view.drop([file], target)
      await view.send()

      expect(errors).toEqual([])
      expect(view.outgoing()).toHaveLength(1)
      expect(view.outgoing()[0].payload.message.attachments[0].data).toBe(file)
      view.unmount()
    } finally {
      window.removeEventListener('error', onError)
    }
  })

  it.each(mediaDropCases)('sends dropped %s as media with its original file', async (name, mimeType) => {
    const view = renderFileDropFlow()
    const file = new File(['original media bytes'], name, { type: mimeType })
    await view.drop([file], 'media')
    await view.send()
    expect(view.outgoing()).toHaveLength(1)
    const attachment = view.outgoing()[0].payload.message.attachments[0]
    expect(attachment.data).toBe(file)
    expect(attachment.type).toBe(mimeType.startsWith('image/') ? attachmentTypes.image : attachmentTypes.video)
    expect(attachment.name).toBe(name)
    expect(attachment.size).toBe(file.size)
    expect(FileReader.prototype.readAsDataURL).not.toHaveBeenCalled()
    expect(window.atob).not.toHaveBeenCalled()
    view.unmount()
  })

  it.each(mediaDropCases)('keeps dropped %s as a file card when the file target is chosen', async (name, mimeType) => {
    const view = renderFileDropFlow()
    const file = new File(['media bytes'], name, { type: mimeType })
    await view.drop([file], 'file')
    await view.send()
    expect(view.outgoing()).toHaveLength(1)
    const attachment = view.outgoing()[0].payload.message.attachments[0]
    expect(attachment.data).toBe(file)
    expect(attachment.type).toBe(attachmentTypes.file)
    view.unmount()
  })

  it.each([
    ['the SDK upload', undefined],
    ['a custom uploader', { upload: jest.fn(), download: jest.fn(), cancelRequest: jest.fn() }]
  ])('a media image sent through %s is encoded once, as JPEG of quality 0.8', async (_name, uploader) => {
    setCustomUploader(uploader)
    try {
      const view = renderFileDropFlow()
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
      await view.drop([file], 'media')
      await view.send()

      expect(imagePreparation.resizeImage).toHaveBeenCalledTimes(1)
      expect(imagePreparation.resizeImage).toHaveBeenCalledWith(file, undefined, undefined, 0.8)
      view.unmount()
    } finally {
      setCustomUploader(undefined)
    }
  })

  it.each([19, 20, 21, 40])('enforces the 20-file limit for a batch of %s dropped files', async (count) => {
    const view = renderFileDropFlow()
    const files = Array.from({ length: count }, (_, index) => new File(['file'], `document-${index}.pdf`))
    await view.drop(files)
    if (count > 20) {
      const skipped = count - 20
      expect(
        screen.getByText(`Only 20 files can be added. ${skipped} file${skipped === 1 ? '' : 's'} will be skipped.`)
      ).toBeVisible()
    }
    await view.send()
    expect(view.outgoing()).toHaveLength(1)
    const attachments = view.outgoing()[0].payload.message.attachments
    expect(attachments).toHaveLength(Math.min(count, 20))
    attachments.forEach((attachment: { data: File; name: string }, index: number) => {
      expect(attachment.data).toBe(files[index])
      expect(attachment.name).toBe(files[index].name)
    })
    expect(view.store.getState().ChannelReducer.draggedAttachments).toEqual([])
    view.unmount()
  })

  it('uses only remaining slots on a later drop and rejects another drop at the limit', async () => {
    const view = renderFileDropFlow()
    const first = Array.from({ length: 19 }, (_, index) => new File(['file'], `first-${index}.txt`))
    const second = [new File(['one'], 'accepted.pdf'), new File(['two'], 'skipped.pdf')]
    await view.drop(first)
    await view.drop(second)
    expect(screen.getByText('Only 1 file can be added. 1 file will be skipped.')).toBeVisible()
    await view.drop([new File(['extra'], 'extra.zip')])
    expect(screen.getByText('You have reached the maximum limit of 20 files')).toBeVisible()
    await view.send()
    const attachments = view.outgoing()[0].payload.message.attachments
    expect(attachments).toHaveLength(20)
    expect(attachments[19].data).toBe(second[0])
    expect(view.store.getState().ChannelReducer.draggedAttachments).toEqual([])
    view.unmount()
  })

  it('keeps distinct files with identical names and appends separate drops once', async () => {
    const view = renderFileDropFlow()
    const files = [new File(['first'], 'report.pdf'), new File(['second'], 'report.pdf')]
    await view.drop([files[0]])
    await view.drop([files[1]])
    await view.send()
    expect(view.outgoing()).toHaveLength(1)
    const attachments = view.outgoing()[0].payload.message.attachments
    expect(attachments).toHaveLength(2)
    expect(attachments[0].data).toBe(files[0])
    expect(attachments[1].data).toBe(files[1])
    expect(new Set(attachments.map((attachment: { tid: string }) => attachment.tid)).size).toBe(2)
    view.unmount()
  })

  it('clears sent files so the next drop sends only the next file', async () => {
    const view = renderFileDropFlow()
    const first = new File(['first'], 'first.pdf')
    const second = new File(['second'], 'second.zip')
    await view.drop([first])
    await view.send()
    await view.drop([second])
    await view.send()
    expect(view.outgoing()).toHaveLength(2)
    expect(view.outgoing()[0].payload.message.attachments).toHaveLength(1)
    expect(view.outgoing()[1].payload.message.attachments).toHaveLength(1)
    expect(view.outgoing()[1].payload.message.attachments[0].data).toBe(second)
    view.unmount()
  })

  it('does not carry dropped files into another chat', async () => {
    const view = renderFileDropFlow()
    await view.drop([new File(['private'], 'old-chat.pdf')])
    act(() => view.store.dispatch(setActiveChannelAC(makeChannel({ id: 'new-drop-chat' }))))
    const next = new File(['new'], 'new-chat.zip')
    await view.drop([next])
    await view.send()
    expect(view.outgoing()).toHaveLength(1)
    expect(view.outgoing()[0].payload.channelId).toBe('new-drop-chat')
    expect(view.outgoing()[0].payload.message.attachments).toHaveLength(1)
    expect(view.outgoing()[0].payload.message.attachments[0].data).toBe(next)
    view.unmount()
  })

  it('sends a zero-byte file and ignores an empty drop', async () => {
    const view = renderFileDropFlow()
    await view.drop([])
    await view.send()
    expect(view.outgoing()).toHaveLength(0)
    const file = new File([], 'empty.txt')
    await view.drop([file])
    await view.send()
    expect(view.outgoing()).toHaveLength(1)
    expect(view.outgoing()[0].payload.message.attachments[0].data).toBe(file)
    expect(view.outgoing()[0].payload.message.attachments[0].size).toBe(0)
    view.unmount()
  })

  it.each([
    ['installer.dmg', 'application/x-apple-diskimage'],
    ['report.pdf', 'application/pdf'],
    ['drawing.svg', 'image/svg+xml']
  ])('rejects unsupported %s in the media target without losing the next valid drop', async (name, type) => {
    const view = renderFileDropFlow({ allowedMediaExtensionsErrorMessage: 'Unsupported media format' })
    await view.drop([new File(['file'], name, { type })], 'media', false)
    expect(screen.getByText('Unsupported media format')).toBeVisible()
    await view.send()
    expect(view.outgoing()).toHaveLength(0)
    expect(view.store.getState().ChannelReducer.draggedAttachments).toEqual([])
    const valid = new File(['video'], 'next.mp4', { type: 'video/mp4' })
    await view.drop([valid], 'media')
    await view.send()
    expect(view.outgoing()).toHaveLength(1)
    expect(view.outgoing()[0].payload.message.attachments[0].data).toBe(valid)
    view.unmount()
  })

  it('validates each file in a mixed media drop and sends only supported files', async () => {
    const view = renderFileDropFlow()
    const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    await view.drop([new File(['pdf'], 'report.pdf'), video], 'media')
    expect(screen.getByText('Invalid file type.')).toBeVisible()
    await view.send()
    const attachments = view.outgoing()[0].payload.message.attachments
    expect(attachments).toHaveLength(1)
    expect(attachments[0].data).toBe(video)
    view.unmount()
  })

  it.each([1024, 1025])('validates original media size at %s bytes against a 1 KB limit', async (size) => {
    const view = renderFileDropFlow({ mediaAttachmentSizeLimit: 1, attachmentSizeLimitErrorMessage: 'Media too large' })
    const file = new File(['x'.repeat(size)], 'clip.mp4', { type: 'video/mp4' })
    await view.drop([file], 'media')
    if (size > 1024) expect(screen.getByText('Media too large')).toBeVisible()
    await view.send()
    expect(view.outgoing()).toHaveLength(size > 1024 ? 0 : 1)
    if (size === 1024) expect(view.outgoing()[0].payload.message.attachments[0].data).toBe(file)
    expect(view.store.getState().ChannelReducer.draggedAttachments).toEqual([])
    view.unmount()
  })

  it('applies the media allowlist without blocking the same file in the file target', async () => {
    const view = renderFileDropFlow({ allowedMediaExtensions: ['png'], allowedMediaExtensionsErrorMessage: 'PNG only' })
    const file = new File(['gif'], 'animation.gif', { type: 'image/gif' })
    await view.drop([file], 'media')
    expect(screen.getByText('PNG only')).toBeVisible()
    await view.send()
    expect(view.outgoing()).toHaveLength(0)
    await view.drop([file], 'file')
    await view.send()
    expect(view.outgoing()).toHaveLength(1)
    expect(view.outgoing()[0].payload.message.attachments[0].data).toBe(file)
    expect(view.outgoing()[0].payload.message.attachments[0].type).toBe(attachmentTypes.file)
    view.unmount()
  })
})

describe('SendMessageInput draft ownership', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })
    })
  })

  beforeEach(() => {
    Object.keys(mockDrafts).forEach((channelId) => delete mockDrafts[channelId])
    setClient({ user: makeUser({ id: 'current-user' }) })
  })

  it('does not show or save User A draft in User B after a tab-focus rerender', async () => {
    const userA = makeChannel({ id: 'user-a' })
    const userB = makeChannel({ id: 'user-b' })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: userA } })
    const view = renderWithSceytProvider(<SendMessageInput />, { store })

    fireEvent.click(screen.getByTestId('type-user-a-draft'))
    await act(async () => undefined)
    expect(mockDrafts['user-a']?.text).toBe('Draft for User A')

    act(() => {
      store.dispatch(setActiveChannelAC(userB))
    })

    // Match the app update caused when the browser tab becomes active again.
    view.rerender(<SendMessageInput />)

    expect(mockDrafts['user-a']?.text).toBe('Draft for User A')
    expect(mockDrafts['user-b']).toBeUndefined()
  })

  it('keeps Forward and Delete visible when a pinned-list message is selected', () => {
    const channel = makeChannel({ id: 'pinned-selection-channel' })
    const message = makeMessage({ id: 'pinned-selection-message', channelId: channel.id, body: 'Selected pin' })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: channel } })

    renderWithSceytProvider(<SendMessageInput />, { store })

    act(() => {
      store.dispatch(setPinnedMessagesListOpenAC(true))
      store.dispatch(addSelectedMessageAC(message))
    })

    expect(screen.getByText('Forward')).toBeVisible()
    expect(screen.getByText('Delete')).toBeVisible()
  })
})

describe('SendMessageInput attachment sending', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:compose-video')
    })
  })

  beforeEach(() => {
    setClient({ user: makeUser({ id: 'current-user' }) })
    require('../../helpers/videoConversion').remuxVideoFileForUpload.mockImplementation((file: File) =>
      Promise.resolve(file)
    )
    require('../../helpers/getVideoFrame').getFrame.mockResolvedValue({
      thumb: 'data:image/jpeg;base64,thumb',
      width: 1280,
      height: 720,
      duration: 3,
      frameBlobUrl: 'blob:video-thumb',
      blob: new Blob(['thumb'], { type: 'image/jpeg' })
    })
  })

  it('keeps a video selected through the File picker as a file attachment', async () => {
    const channel = makeChannel({ id: 'video-file-channel' })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: channel } })
    const dispatchedActions: any[] = []
    const dispatch = store.dispatch.bind(store)
    jest.spyOn(store, 'dispatch').mockImplementation((action: any) => {
      dispatchedActions.push(action)
      return dispatch(action)
    })
    const { container } = renderWithSceytProvider(
      <SendMessageInput CustomSendMessageButton={<button data-testid='send-message'>Send</button>} />,
      { store }
    )
    const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(fileInput, { target: { files: [video], accept: '' } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('send-message'))
      await Promise.resolve()
    })

    const sendAction = dispatchedActions.find((action) => action.type === SEND_MESSAGE)
    expect(sendAction).toBeDefined()
    expect(sendAction.payload.channelId).toBe(channel.id)
    expect(sendAction.payload.message.attachments).toHaveLength(1)
    expect(sendAction.payload.message.attachments[0].name).toBe('clip.mp4')
    expect(sendAction.payload.message.attachments[0].type).toBe(attachmentTypes.file)
    expect(sendAction.payload.message.attachments[0].data).toBe(video)
  })

  describe('a QuickTime video being converted to MP4', () => {
    const MEDIA_ACCEPT = '.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.wmv,.flv,.webm,.jfif'
    const original = () => new File(['quicktime'], 'clip.mov', { type: 'video/quicktime' })
    const converted = new File(['mp4'], 'clip.mp4', { type: 'video/mp4' })

    const addVideo = async (video: File) => {
      const { container } = renderWithSceytProvider(
        <SendMessageInput CustomSendMessageButton={<button data-testid='send-message'>Send</button>} />,
        {
          store: createMessageListStore({ ChannelReducer: { activeChannel: makeChannel({ id: 'quicktime-channel' }) } })
        }
      )
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [video], accept: MEDIA_ACCEPT } })
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      return require('../../helpers/messagesHalper').setPendingAttachment.mock.calls[0][0] as string
    }

    afterEach(() => {
      require('../../helpers/messagesHalper').setPendingAttachment.mock.calls.forEach(([tid]: [string]) =>
        clearAttachmentPreparation(tid)
      )
      inspectVideo?.mockRestore()
      canPlayQuickTime?.mockRestore()
    })

    let inspectVideo: jest.SpyInstance | undefined
    let canPlayQuickTime: jest.SpyInstance | undefined
    const asQuickTime = (plays: boolean) => {
      inspectVideo = jest
        .spyOn(videoContainer, 'inspectVideoBlob')
        .mockResolvedValue({ mimeType: 'video/mp4', isoBrand: 'qt  ', codecs: [] })
      canPlayQuickTime = jest.spyOn(videoContainer, 'canPlayQuickTime').mockResolvedValue(plays)
    }

    it('reports the preview as soon as the frame is ready, without waiting for the conversion', async () => {
      let finishConversion!: (file: File) => void
      require('../../helpers/videoConversion').remuxVideoFileForUpload.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishConversion = resolve
          })
      )
      const tid = await addVideo(original())

      let preview: any
      await act(async () => {
        preview = await waitForAttachmentPreview(tid, 1000)
      })
      expect(JSON.parse(preview.metadata)).toEqual({ tmb: 'data:image/jpeg;base64,thumb', szw: 1280, szh: 720, dur: 3 })
      // The file to upload is not ready yet.
      expect((await waitForAttachmentPreparation(tid, 1))?.status).toBe('failed')

      let prepared: any
      await act(async () => {
        finishConversion(converted)
        prepared = await waitForAttachmentPreparation(tid, 1000)
      })
      expect(prepared.status).toBe('ready')
      expect(prepared.file === converted).toBe(true)
    })

    it('in a Firefox that does not play QuickTime, takes the frame from the converted MP4, not converting it twice', async () => {
      const remux = require('../../helpers/videoConversion').remuxVideoFileForUpload
      remux.mockImplementation(() => Promise.resolve(converted))
      const userAgent = jest
        .spyOn(window.navigator, 'userAgent', 'get')
        .mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0')
      asQuickTime(false)
      try {
        const tid = await addVideo(original())
        await act(async () => {
          await waitForAttachmentPreparation(tid, 1000)
        })

        const getFrame = require('../../helpers/getVideoFrame').getFrame
        expect(getFrame).toHaveBeenCalledTimes(1)
        expect(getFrame.mock.calls[0][0] === converted).toBe(true)
        expect(remux).toHaveBeenCalledTimes(1)
      } finally {
        userAgent.mockRestore()
      }
    })

    it('in a Firefox that plays QuickTime, takes the frame from the original without waiting for the conversion', async () => {
      require('../../helpers/videoConversion').remuxVideoFileForUpload.mockImplementation(
        () => new Promise(() => undefined)
      )
      asQuickTime(true)
      const video = original()
      const tid = await addVideo(video)
      await act(async () => {
        await waitForAttachmentPreview(tid, 1000)
      })

      const getFrame = require('../../helpers/getVideoFrame').getFrame
      expect(getFrame.mock.calls[0][0] === video).toBe(true)
      expect(canPlayQuickTime!.mock.calls[0][0] === video).toBe(true)
    })

    it('a frame that cannot be taken is not tried again from the same file', async () => {
      const getFrame = require('../../helpers/getVideoFrame').getFrame
      getFrame.mockRejectedValue(new Error('Failed to extract video frame'))
      // Not QuickTime: the upload file is the original, so a retry would decode the same bytes again.
      const video = new File(['mp4'], 'clip.mp4', { type: 'video/mp4' })
      const tid = await addVideo(video)
      let prepared: any
      await act(async () => {
        prepared = await waitForAttachmentPreparation(tid, 1000)
      })

      expect(getFrame).toHaveBeenCalledTimes(1)
      expect(prepared.status).toBe('failed')
    })

    it('in other browsers, takes the frame from the original file', async () => {
      require('../../helpers/videoConversion').remuxVideoFileForUpload.mockImplementation(() =>
        Promise.resolve(converted)
      )
      inspectVideo = jest
        .spyOn(videoContainer, 'inspectVideoBlob')
        .mockResolvedValue({ mimeType: 'video/mp4', isoBrand: 'qt  ', codecs: [] })
      const video = original()
      const tid = await addVideo(video)
      await act(async () => {
        await waitForAttachmentPreparation(tid, 1000)
      })

      const getFrame = require('../../helpers/getVideoFrame').getFrame
      expect(getFrame.mock.calls[0][0] === video).toBe(true)
    })
  })

  it('creates only one send action when Send is tapped repeatedly while a video is preparing', async () => {
    let resolveFrame: ((frame: any) => void) | undefined
    require('../../helpers/getVideoFrame').getFrame.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFrame = resolve
        })
    )
    const channel = makeChannel({ id: 'rapid-video-send-channel' })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: channel } })
    const dispatchedActions: any[] = []
    const dispatch = store.dispatch.bind(store)
    jest.spyOn(store, 'dispatch').mockImplementation((action: any) => {
      dispatchedActions.push(action)
      return dispatch(action)
    })
    const { container } = renderWithSceytProvider(
      <SendMessageInput CustomSendMessageButton={<button data-testid='send-message'>Send</button>} />,
      { store }
    )
    const video = new File(['video'], 'rapid-send.mp4', { type: 'video/mp4' })
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    // Selecting via the media picker makes the attachment wait for its video
    // metadata before the optimistic message is created.
    fireEvent.change(fileInput, {
      target: { files: [video], accept: '.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.wmv,.flv,.webm,.jfif' }
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const sendButton = screen.getByTestId('send-message')
    act(() => {
      sendButton.click()
      sendButton.click()
      sendButton.click()
    })

    // The optimistic message is dispatched immediately; it does not wait for
    // frame extraction or upload/network completion.
    expect(dispatchedActions.filter((action) => action.type === SEND_MESSAGE)).toHaveLength(1)

    await act(async () => {
      resolveFrame!({
        thumb: 'data:image/jpeg;base64,thumb',
        width: 1280,
        height: 720,
        duration: 3,
        frameBlobUrl: 'blob:video-thumb',
        blob: new Blob(['thumb'], { type: 'image/jpeg' })
      })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(dispatchedActions.filter((action) => action.type === SEND_MESSAGE)).toHaveLength(1)
  })

  it.each([
    ['image', 'pasted-image.png', 'image/png', attachmentTypes.image],
    ['video', 'pasted-video.mp4', 'video/mp4', attachmentTypes.video]
  ])('includes a %s pasted immediately before Send in the outgoing message', async (_kind, name, mimeType, type) => {
    const channel = makeChannel({ id: 'paste-image-send-channel' })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: channel } })
    const dispatchedActions: any[] = []
    const dispatch = store.dispatch.bind(store)
    jest.spyOn(store, 'dispatch').mockImplementation((action: any) => {
      dispatchedActions.push(action)
      return dispatch(action)
    })
    const { container } = renderWithSceytProvider(
      <SendMessageInput CustomSendMessageButton={<button data-testid='send-message'>Send</button>} />,
      { store }
    )

    // Keep Send active before the native paste listener queues the attachment
    // state update, matching a user pasting an image and immediately tapping Send.
    fireEvent.click(screen.getByTestId('type-user-a-draft'))
    await act(async () => {
      await Promise.resolve()
    })

    const file = new File(['media'], name, { type: mimeType })
    const pasteTarget = container.firstElementChild?.firstElementChild as HTMLElement
    await act(async () => {
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { files: [file], items: [] }
      })
      pasteTarget.dispatchEvent(pasteEvent)
      fireEvent.click(screen.getByTestId('send-message'))
    })

    const sendAction = dispatchedActions.find((action) => action.type === SEND_MESSAGE)
    expect(sendAction).toBeDefined()
    expect(sendAction.payload.message.attachments).toEqual([expect.objectContaining({ data: file, name, type })])
  })
})
