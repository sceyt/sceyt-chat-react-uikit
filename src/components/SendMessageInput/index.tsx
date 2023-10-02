import React, { FC, useEffect, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'
import styled, { keyframes } from 'styled-components'

// Rich text editor
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import MentionsPlugin from './MentionsPlugin'
import FloatingTextFormatToolbarPlugin from './FloatingTextFormatToolbarPlugin'
import { MentionNode } from './MentionNode'
import EditMessagePlugin from './EditMessagePlugin'
import FormatMessagePlugin from './FormatMessagePlugin'

import { ReactComponent as SendIcon } from '../../assets/svg/send.svg'
import { ReactComponent as EyeIcon } from '../../assets/svg/eye.svg'
import { ReactComponent as EditIcon } from '../../assets/svg/editIcon.svg'
import { ReactComponent as ReplyIcon } from '../../assets/svg/replyIcon.svg'
import { ReactComponent as AttachmentIcon } from '../../assets/svg/addAttachment.svg'
import { ReactComponent as EmojiSmileIcon } from '../../assets/svg/emojiSmileIcon.svg'
import { ReactComponent as ChoseFileIcon } from '../../assets/svg/choseFile.svg'
import { ReactComponent as BlockInfoIcon } from '../../assets/svg/error_circle.svg'
import { ReactComponent as ChoseMediaIcon } from '../../assets/svg/choseMedia.svg'
import { ReactComponent as CloseIcon } from '../../assets/svg/close.svg'
import { ReactComponent as DeleteIcon } from '../../assets/svg/deleteIcon.svg'
import { ReactComponent as ForwardIcon } from '../../assets/svg/forward.svg'
import {
  clearSelectedMessagesAC,
  deleteMessageAC,
  deleteMessageFromListAC,
  editMessageAC,
  forwardMessageAC,
  resendMessageAC,
  sendMessageAC,
  sendTextMessageAC,
  setMessageForReplyAC,
  setMessageToEditAC,
  setSendMessageInputHeightAC
} from '../../store/message/actions'
import Attachment, { AttachmentFile, AttachmentImg } from '../Attachment'
import { detectBrowser, detectOS, hashString } from '../../helpers'
import { EditorTheme, getAllowEditDeleteIncomingMessage, makeUsername, MessageTextFormat } from '../../helpers/message'
import { DropdownOptionLi, DropdownOptionsUl, TextInOneLine, UploadFile } from '../../UIHelper'
import { colors } from '../../UIHelper/constants'
import EmojisPopup from './EmojisPlugin'
import {
  messageForReplySelector,
  messageToEditSelector,
  selectedMessagesMapSelector
} from '../../store/message/selector'
import {
  activeChannelSelector,
  channelInfoIsOpenSelector,
  draggedAttachmentsSelector,
  typingIndicatorSelector
} from '../../store/channel/selector'
import { IAttachment, IMember, IMessage, IUser } from '../../types'
import {
  joinChannelAC,
  sendTypingAC,
  setChannelDraftMessageIsRemovedAC,
  setCloseSearchChannelsAC,
  setDraggedAttachments
} from '../../store/channel/actions'
import { createImageThumbnail, resizeImage } from '../../helpers/resizeImage'
import { connectionStatusSelector, contactsMapSelector } from '../../store/user/selector'
import DropDown from '../../common/dropdown'
import { cancelUpload, getCustomUploader, getSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import {
  checkDraftMessagesIsEmpty,
  deletePendingAttachment,
  deleteVideoThumb,
  draftMessagesMap,
  getDraftMessageFromMap,
  getPendingMessagesMap,
  removeDraftMessageFromMap,
  removeMessageFromAllMessages,
  removeMessageFromMap,
  setDraftMessageToMap,
  setPendingAttachment,
  setSendMessageHandler
} from '../../helpers/messagesHalper'
import {
  attachmentTypes,
  CHANNEL_TYPE,
  DB_NAMES,
  DB_STORE_NAMES,
  MESSAGE_DELIVERY_STATUS,
  USER_STATE
} from '../../helpers/constants'
import usePermissions from '../../hooks/usePermissions'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { useDidUpdate } from '../../hooks'
import { getClient } from '../../common/client'
import { CONNECTION_STATUS } from '../../store/user/constants'
import LinkifyIt from 'linkify-it'
import { themeSelector } from '../../store/theme/selector'
import { getDataFromDB } from '../../helpers/indexedDB'
import { hideUserPresence } from '../../helpers/userHelper'
import { getFrame } from '../../helpers/getVideoFrame'
import ForwardMessagePopup from '../../common/popups/forwardMessage'
import ConfirmPopup from '../../common/popups/delete'
import { getMembersAC } from '../../store/member/actions'
import { CAN_USE_DOM } from '../../helpers/canUseDOM'
import { activeChannelMembersSelector } from '../../store/member/selector'

function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    // Focus the editor when the effect fires!
    editor.focus()
  }, [editor])

  return null
}
function ClearEditorPlugin({ shouldClearEditor, setEditorCleared }: any) {
  const [editor] = useLexicalComposerContext()

  useDidUpdate(() => {
    if (shouldClearEditor.clear) {
      editor.update(() => {
        const rootNode = $getRoot()
        rootNode.clear()
        if (shouldClearEditor.draftMessage) {
          const paragraphNode = $createParagraphNode()
          paragraphNode.append($createTextNode(shouldClearEditor.draftMessage.text))
          editor.setEditorState(shouldClearEditor.draftMessage.editorState)
        }
        setEditorCleared()
      })
    }
  }, [shouldClearEditor])

  return null
}
// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
function onError(error: any) {
  console.error(error)
}

let prevActiveChannelId: any

interface SendMessageProps {
  draggedAttachments?: boolean
  // eslint-disable-next-line no-unused-vars
  handleAttachmentSelected?: (state: boolean) => void
  // eslint-disable-next-line no-unused-vars
  handleSendMessage?: (message: IMessage, channelId: string) => Promise<IMessage>
  inputCustomClassname?: string
  inputAutofocus?: boolean
  disabled?: boolean
  showAddEmojis?: boolean
  AddEmojisIcon?: JSX.Element
  emojiIcoOrder?: number
  showAddAttachments?: boolean
  AddAttachmentsIcon?: JSX.Element
  attachmentIcoOrder?: number
  sendIconOrder?: number
  inputOrder?: number
  CustomTypingIndicator?: FC<{ from: IUser; typingState: boolean }>
  backgroundColor?: string
  margin?: string
  minHeight?: string
  border?: string
  borderRadius?: string
  inputBorderRadius?: string
  inputBackgroundColor?: string
  inputPaddings?: string
  selectedFileAttachmentsBoxBackground?: string
  selectedFileAttachmentsBoxBorder?: string
  selectedFileAttachmentsTitleColor?: string
  selectedFileAttachmentsSizeColor?: string
  selectedFileAttachmentsIcon?: JSX.Element
  selectedAttachmentsBorderRadius?: string
  replyMessageIcon?: JSX.Element
  editMessageIcon?: JSX.Element
  voiceMessage?: boolean
  sendAttachmentSeparately?: boolean
  allowMentionUser?: boolean
  textSelectionBackgroundColor?: string
}

const SendMessageInput: React.FC<SendMessageProps> = ({
  handleAttachmentSelected,
  // draggedAttachments,
  handleSendMessage,
  disabled = false,
  sendIconOrder,
  inputOrder = 1,
  showAddEmojis = true,
  AddEmojisIcon,
  emojiIcoOrder = 2,
  showAddAttachments = true,
  AddAttachmentsIcon,
  attachmentIcoOrder = 0,
  CustomTypingIndicator,
  margin,
  border,
  minHeight,
  borderRadius,
  inputBorderRadius,
  backgroundColor,
  inputBackgroundColor,
  inputCustomClassname,
  inputAutofocus = true,
  inputPaddings,
  selectedAttachmentsBorderRadius,
  selectedFileAttachmentsIcon,
  selectedFileAttachmentsBoxBackground,
  selectedFileAttachmentsBoxBorder,
  selectedFileAttachmentsTitleColor,
  selectedFileAttachmentsSizeColor,
  replyMessageIcon,
  editMessageIcon,
  sendAttachmentSeparately,
  allowMentionUser = true,
  textSelectionBackgroundColor
  // voiceMessage = true
}) => {
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)
  const theme = useSelector(themeSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const activeChannel = useSelector(activeChannelSelector)
  const messageToEdit = useSelector(messageToEditSelector)
  const activeChannelMembers = useSelector(activeChannelMembersSelector, shallowEqual)
  const messageForReply = useSelector(messageForReplySelector)
  const draggedAttachments = useSelector(draggedAttachmentsSelector)
  const selectedMessagesMap = useSelector(selectedMessagesMapSelector)
  const isDirectChannel = activeChannel.type === CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && activeChannel.members.find((member: IMember) => member.id !== user.id)
  const disableInput = disabled || (directChannelUser && hideUserPresence && hideUserPresence(directChannelUser))
  const isBlockedUserChat = directChannelUser && directChannelUser.blocked
  const isDeletedUserChat = directChannelUser && directChannelUser.state === USER_STATE.DELETED

  const allowSetMention =
    allowMentionUser && (activeChannel.type === CHANNEL_TYPE.PRIVATE || activeChannel.type === CHANNEL_TYPE.GROUP)
  /* const recordingInitialState = {
    recordingSeconds: 0,
    recordingMilliseconds: 0,
    initRecording: false,
    mediaStream: null,
    mediaRecorder: null,
    audio: undefined
  } */
  const messageContRef = useRef<any>(null)
  const [checkActionPermission] = usePermissions(activeChannel.userRole)
  const [listenerIsAdded, setListenerIsAdded] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [editMessageText, setEditMessageText] = useState('')
  const [readyVideoAttachments, setReadyVideoAttachments] = useState({})
  const [showChooseAttachmentType, setShowChooseAttachmentType] = useState(false)
  const [isEmojisOpened, setIsEmojisOpened] = useState(false)
  const [emojisInRightSide, setEmojisInRightSide] = useState(false)
  const [emojisPopupLeftPosition, setEmojisPopupLeftPosition] = useState(0)
  const [emojisPopupBottomPosition, setEmojisPopupBottomPosition] = useState(0)
  const [addAttachmentsInRightSide, setAddAttachmentsInRightSide] = useState(false)

  // const [recording, setRecording] = useState<Recording>(recordingInitialState)
  // const [recordedFile, setRecordedFile] = useState<any>(null)

  const [shouldClearEditor, setShouldClearEditor] = useState<{ clear: boolean; draftMessage?: any }>({ clear: false })
  const [messageBodyAttributes, setMessageBodyAttributes] = useState<any>([])
  const [mentionedMembers, setMentionedMembers] = useState<any>([])

  const [browser, setBrowser] = useState<any>('')

  const [inputContainerHeight, setInputContainerHeight] = useState<any>()

  const selectedText = useRef<any>(null)

  const [typingTimout, setTypingTimout] = useState<any>()
  const [inTypingStateTimout, setInTypingStateTimout] = useState<any>()
  const [inTypingState, setInTypingState] = useState(false)
  const [sendMessageIsActive, setSendMessageIsActive] = useState(false)
  const [attachments, setAttachments]: any = useState([])

  const [forwardPopupOpen, setForwardPopupOpen] = useState(false)
  const [deletePopupOpen, setDeletePopupOpen] = useState(false)
  const [isIncomingMessage, setIsIncomingMessage] = useState(false)

  const typingIndicator = useSelector(typingIndicatorSelector(activeChannel.id))
  const contactsMap = useSelector(contactsMapSelector)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)
  const fileUploader = useRef<any>(null)
  const inputWrapperRef = useRef<any>(null)
  const messageInputRef = useRef<any>(null)
  const emojiBtnRef = useRef<any>(null)
  const addAttachmentsBtnRef = useRef<any>(null)

  const [realEditorState, setRealEditorState] = useState()
  const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null)
  const [isSmallWidthViewport, setIsSmallWidthViewport] = useState<boolean>(false)
  function onChange(editorState: any) {
    setRealEditorState(editorState)
    editorState.read(() => {
      const rootNode = $getRoot()
      const plainText = rootNode.getTextContent()
      if (!messageToEdit) {
        setMessageText(plainText)
      }
    })

    if (typingTimout) {
      if (!inTypingStateTimout) {
        handleSendTypingState(true)
      }
      clearTimeout(typingTimout)
    } else {
      handleSendTypingState(true)
    }
    setTypingTimout(
      setTimeout(() => {
        setTypingTimout(0)
      }, 2000)
    )
  }

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem)
    }
  }

  const initialConfig = {
    namespace: 'MyEditor',
    theme: EditorTheme,
    nodes: [MentionNode],
    onError
  }
  const mediaExtensions = '.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.wmv,.flv,.webm,.jfif'

  const handleSendTypingState = (typingState: boolean) => {
    if (typingState) {
      setInTypingStateTimout(
        setTimeout(() => {
          setInTypingStateTimout(0)
        }, 3000)
      )
    } else {
      clearTimeout(inTypingStateTimout)
    }
    setInTypingState(typingState)
    if (!activeChannel.isMockChannel) {
      dispatch(sendTypingAC(typingState))
    }
  }

  const handleCloseReply = () => {
    dispatch(setMessageForReplyAC(null))
  }
  const handleSendEditMessage = (event?: any) => {
    /* if (recordedFile) {
      /!* const file = new File([recordedFile.data], recordedFile.data.name, {
        type: 'audio/mp3'
      }) *!/
      const messageToSend = {
        metadata: '',
        body: '',
        mentionedMembers: [],
        attachments: [
          {
            name: `${uuidv4()}.mp3`,
            data: recordedFile.data,
            attachmentId: uuidv4(),
            upload: true,
            size: recordedFile.data.size,
            attachmentUrl: recordedFile.attachmentURL,
            metadata: { tmb: recordedFile.thumbs },
            type: attachmentTypes.voice
          }
        ],
        type: 'text'
      }
      dispatch(sendMessageAC(messageToSend, activeChannel.id, connectionStatus, true))
    } else { */
    const { shiftKey, type, code } = event
    const isEnter: boolean = code === 'Enter' && shiftKey === false
    const shouldSend =
      (isEnter || type === 'click') && (messageToEdit || messageText || (attachments.length && attachments.length > 0))
    if (isEnter) {
      event.preventDefault()
    }
    if (shouldSend) {
      event.preventDefault()
      event.stopPropagation()
      if (messageToEdit) {
        handleEditMessage()
      } else if (messageText || (attachments.length && attachments.length > 0)) {
        const messageTexToSend = messageText.trim()

        const messageToSend: any = {
          // metadata: mentionedMembersPositions,
          body: messageTexToSend,
          // body: 'test message',
          bodyAttributes: messageBodyAttributes,
          mentionedMembers: [],
          attachments: [],
          type: 'text'
        }
        const mentionMembersToSend: any = []
        if (messageBodyAttributes && messageBodyAttributes.length) {
          messageBodyAttributes.forEach((att: any) => {
            if (att.type === 'mention') {
              let mentionsToFind = [...mentionedMembers]
              const draftMessage = getDraftMessageFromMap(activeChannel.id)
              if (draftMessage) {
                mentionsToFind = [...draftMessage.mentionedMembers, ...mentionedMembers]
              }
              const mentionToAdd = mentionsToFind.find((mention: any) => mention.id === att.metadata)
              mentionMembersToSend.push(mentionToAdd)
            }
          })
        }
        messageToSend.mentionedMembers = mentionMembersToSend
        console.log('message to send ..........................................', messageToSend)

        if (messageForReply) {
          messageToSend.parentMessage = messageForReply
        }
        let linkAttachment: any
        if (messageTexToSend) {
          const linkify = new LinkifyIt()
          const match = linkify.match(messageTexToSend)
          // const messageTextArr = [messageTexToSend]
          if (match) {
            linkAttachment = {
              type: attachmentTypes.link,
              data: match[0].url,
              upload: false
            }
          }
        }
        if (messageTexToSend && !attachments.length) {
          if (linkAttachment) {
            messageToSend.attachments = [linkAttachment]
          }
          dispatch(sendTextMessageAC(messageToSend, activeChannel.id, connectionStatus))
        }
        if (attachments.length) {
          const sendAsSeparateMessage = getSendAttachmentsAsSeparateMessages()
          messageToSend.attachments = attachments.map((attachment: any, index: any) => {
            const attachmentToSend = {
              name: attachment.data.name,
              data: attachment.data,
              tid: attachment.tid,
              cachedUrl: attachment.cachedUrl,
              upload: attachment.upload,
              attachmentUrl: attachment.attachmentUrl,
              metadata: attachment.metadata,
              type: attachment.type,
              size: attachment.size
            }
            if (sendAsSeparateMessage) {
              if (index !== 0) {
                messageToSend.body = ''
                messageToSend.metadata = ''
                delete messageToSend.mentionedMembers
              }
              const attachmentsToSent = [attachmentToSend]
              if (linkAttachment) {
                attachmentsToSent.push(linkAttachment)
              }
              dispatch(
                sendMessageAC(
                  {
                    ...messageToSend,
                    attachments: attachmentsToSent
                  },
                  activeChannel.id,
                  connectionStatus,
                  true
                )
              )
            }
            return attachmentToSend
          })
          if (!sendAsSeparateMessage) {
            const attachmentsToSent = [...messageToSend.attachments]
            if (linkAttachment) {
              attachmentsToSent.push(linkAttachment)
            }
            dispatch(
              sendMessageAC(
                { ...messageToSend, attachments: attachmentsToSent },
                activeChannel.id,
                connectionStatus,
                false
              )
            )
          }
        }
        setMessageText('')

        fileUploader.current.value = ''
        if (inTypingState) {
          handleSendTypingState(false)
        }
        clearTimeout(typingTimout)
        setTypingTimout(undefined)
        /* else if (recordedFile) {
           /!* const file = new File([recordedFile.data], 'voice_message.webm', {
             type: 'audio/ogg',
           });
           const messageToSend = {
             metadata: '',
             body: '',
             mentionedMembers: [],
             attachments: [
               {
                 name: recordedFile.data.name,
                 data: recordedFile.data,
                 attachmentId: Date.now(),
                 upload: true,
                 attachmentUrl: recordedFile.attachmentURL,
                 metadata: 'metadata for voice message',
                 type: recordedFile.data.type.split('/')[1]
               }
             ],
             type: 'voice'
           }
           dispatch(sendMessageAC(messageToSend))
         } */
      }
      setAttachments([])
      handleCloseReply()
      setShouldClearEditor({ clear: true })
      setMentionedMembers([])
      setMessageBodyAttributes([])
      dispatch(setCloseSearchChannelsAC(true))
    }
  }
  const handleEditMessage = () => {
    const messageTexToSend = editMessageText.trim()
    if (messageTexToSend && messageTexToSend !== messageToEdit.body) {
      const mentionedMembersPositions: any = []
      const mentionMembersToSend: any = []
      if (mentionedMembers && mentionedMembers.length) {
        if (messageBodyAttributes && messageBodyAttributes.length) {
          messageBodyAttributes.forEach((att: any) => {
            if (att.type === 'mention') {
              let mentionsToFind = [...mentionedMembers]
              const draftMessage = getDraftMessageFromMap(activeChannel.id)
              if (draftMessage) {
                mentionsToFind = [...draftMessage.mentionedMembers, ...mentionedMembers]
              }
              const mentionToAdd = mentionsToFind.find((mention: any) => mention.id === att.metadata)
              mentionMembersToSend.push(mentionToAdd)
            }
          })
        }
      }
      const messageToSend = {
        ...messageToEdit,
        metadata: mentionedMembersPositions,
        bodyAttributes: messageBodyAttributes,
        mentionedUsers: mentionMembersToSend,
        body: messageTexToSend
      }
      messageToSend.type = /(https?:\/\/[^\s]+)/.test(messageToSend.body) ? 'link' : messageToSend.type
      dispatch(editMessageAC(activeChannel.id, messageToSend))
    }
    handleCloseEditMode()
  }
  const handleCloseEditMode = () => {
    setEditMessageText('')
    setMentionedMembers([])
    dispatch(setMessageToEditAC(null))
  }
  const removeUpload = (attachmentId: string) => {
    if (attachmentId) {
      deleteVideoThumb(attachmentId)
      setAttachments(attachments.filter((item: any) => item.tid !== attachmentId))
    } else {
      setAttachments([])
    }
  }

  const handleFileUpload = (e: any) => {
    const isMediaAttachment = e.target.accept === mediaExtensions
    const fileList = Object.values(e.target.files)

    fileList.forEach(async (file: any) => {
      handleAddAttachment(file, isMediaAttachment)
    })

    fileUploader.current.value = ''
  }

  const onOpenFileUploader = (attachmentType: string) => {
    setShowChooseAttachmentType(false)
    fileUploader.current.accept = attachmentType
    fileUploader.current.click()
  }

  const handlePastAttachments = (e: any) => {
    const os = detectOS()
    if (!(os === 'Windows' && browser === 'Firefox')) {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault()
        const fileList: File[] = Object.values(e.clipboardData.files)
        fileList.forEach(async (file: any) => {
          handleAddAttachment(file, true)
        })
      } else {
        e.preventDefault()
      }
    }
  }

  const handleCut = () => {
    setMessageText('')
    setMentionedMembers([])
  }

  const handleEmojiPopupToggle = (bool: boolean) => {
    setIsEmojisOpened(bool)
  }

  const setVideoIsReadyToSend = (attachmentId: string) => {
    setReadyVideoAttachments({ ...readyVideoAttachments, [attachmentId]: true })
  }

  const handleJoinToChannel = () => {
    dispatch(joinChannelAC(activeChannel.id))
  }

  const handleClick = (e: any) => {
    const emojisContainer = document.getElementById('emojisContainer')
    if (
      emojisContainer &&
      !emojisContainer.contains(e.target) &&
      emojiBtnRef.current &&
      !emojiBtnRef.current.contains(e.target)
    ) {
      setIsEmojisOpened(false)
    }
  }
  const handleToggleForwardMessagePopup = () => {
    setForwardPopupOpen(!forwardPopupOpen)
  }

  const handleForwardMessage = (channelIds: string[]) => {
    const messagesArray = Array.from(selectedMessagesMap.values())
    // @ts-ignore
    messagesArray.sort((a: any, b: any) => new Date(a.createdAt) - new Date(b.createdAt))
    if (channelIds && channelIds.length) {
      channelIds.forEach((channelId) => {
        messagesArray.forEach((message) => {
          dispatch(forwardMessageAC(message, channelId, connectionStatus))
        })
      })
    }
    dispatch(clearSelectedMessagesAC())
  }
  const handleDeletePendingMessage = (message: IMessage) => {
    if (message.attachments && message.attachments.length) {
      const customUploader = getCustomUploader()
      message.attachments.forEach((att: IAttachment) => {
        if (customUploader) {
          cancelUpload(att.tid!)
          deletePendingAttachment(att.tid!)
        }
      })
    }
    removeMessageFromMap(activeChannel.id, message.id || message.tid!)
    removeMessageFromAllMessages(message.id || message.tid!)
    dispatch(deleteMessageFromListAC(message.id || message.tid!))
  }

  const handleToggleDeleteMessagePopup = () => {
    if (!deletePopupOpen) {
      for (const message of selectedMessagesMap.values()) {
        if (message.incoming) {
          setIsIncomingMessage(true)
          break
        } else {
          setIsIncomingMessage(false)
        }
      }
    }
    setDeletePopupOpen(!deletePopupOpen)
  }
  const handleDeleteMessage = (deleteOption: 'forMe' | 'forEveryone') => {
    for (const message of selectedMessagesMap.values()) {
      if (!message.deliveryStatus || message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
        handleDeletePendingMessage(message)
      } else {
        dispatch(deleteMessageAC(activeChannel.id, message.id, deleteOption))
      }
    }
    dispatch(clearSelectedMessagesAC())
  }
  const handleCloseSelectMessages = () => {
    dispatch(clearSelectedMessagesAC())
  }

  const handleSetMentionMember = (mentionMember: any) => {
    setMentionedMembers((prevState: any[]) => [...prevState, mentionMember])
  }
  const handleAddAttachment = async (file: File, isMediaAttachment: boolean) => {
    const customUploader = getCustomUploader()
    const fileType = file.type.split('/')[0]
    const tid = uuidv4()
    let cachedUrl: any
    const reader = new FileReader()
    reader.onload = async () => {
      // @ts-ignore
      const length = reader.result && reader.result.length
      let fileChecksum
      if (length > 3000) {
        const firstPart = reader.result && reader.result.slice(0, 1000)
        const middlePart = reader.result && reader.result.slice(length / 2 - 500, length / 2 + 500)
        const lastPart = reader.result && reader.result.slice(length - 1000, length)
        fileChecksum = `${firstPart}${middlePart}${lastPart}`
      } else {
        fileChecksum = `${reader.result}`
      }
      const checksumHash = await hashString(fileChecksum || '')
      let dataFromDb: any
      try {
        dataFromDb = await getDataFromDB(DB_NAMES.FILES_STORAGE, DB_STORE_NAMES.ATTACHMENTS, checksumHash, 'checksum')
      } catch (e) {
        console.log('error in get data from db . . . . ', e)
      }
      if (dataFromDb) {
        cachedUrl = dataFromDb.url
        setPendingAttachment(tid, { file: cachedUrl })
      } else {
        setPendingAttachment(tid, { file, checksum: checksumHash })
      }
      if (customUploader) {
        if (fileType === 'image') {
          resizeImage(file).then(async (resizedFile: any) => {
            setAttachments((prevState: any[]) => [
              ...prevState,
              {
                data: file,
                cachedUrl,
                upload: false,
                type: isMediaAttachment ? fileType : 'file',
                attachmentUrl: URL.createObjectURL(resizedFile.blob as any),
                tid,
                size: dataFromDb ? dataFromDb.size : file.size,
                metadata: dataFromDb && dataFromDb.metadata
              }
            ])
          })
        } else if (fileType === 'video') {
          setAttachments((prevState: any[]) => [
            ...prevState,
            {
              data: file,
              cachedUrl,
              upload: false,
              type: isMediaAttachment ? fileType : 'file',
              attachmentUrl: URL.createObjectURL(file),
              tid,
              size: dataFromDb ? dataFromDb.size : file.size,
              metadata: dataFromDb && dataFromDb.metadata
            }
          ])
        } else {
          setAttachments((prevState: any[]) => [
            ...prevState,
            {
              data: file,
              cachedUrl,
              upload: false,
              type: 'file',
              tid,
              size: dataFromDb ? dataFromDb.size : file.size,
              metadata: dataFromDb && dataFromDb.metadata
            }
          ])
        }
      } else {
        if (fileType === 'image') {
          if (isMediaAttachment) {
            let metas: any = {}
            if (dataFromDb) {
              metas = dataFromDb.metadata
            } else {
              const { thumbnail, imageWidth, imageHeight } = await createImageThumbnail(file)
              metas.imageHeight = imageHeight
              metas.imageWidth = imageWidth
              metas.thumbnail = thumbnail
            }
            if (file.type === 'image/gif') {
              setAttachments((prevState: any[]) => [
                ...prevState,
                {
                  data: file,
                  cachedUrl,
                  upload: !cachedUrl,
                  attachmentUrl: URL.createObjectURL(file),
                  tid,
                  type: fileType,
                  size: dataFromDb ? dataFromDb.size : file.size,
                  metadata: dataFromDb
                    ? metas
                    : JSON.stringify({
                        tmb: metas.thumbnail,
                        szw: metas.imageWidth,
                        szh: metas.imageHeight
                      })
                }
              ])
            } else {
              if (dataFromDb) {
                console.log('data from db . . . . set metas. ... .. ', metas)
                setAttachments((prevState: any[]) => [
                  ...prevState,
                  {
                    data: file,
                    cachedUrl,
                    upload: false,
                    attachmentUrl: URL.createObjectURL(file),
                    tid,
                    type: fileType,
                    size: dataFromDb.size,
                    metadata: metas
                  }
                ])
              } else {
                resizeImage(file).then(async (resizedFileData: any) => {
                  // resizedFiles.forEach((file: any, index: number) => {
                  const resizedFile = new File([resizedFileData.blob], resizedFileData.file.name)
                  setAttachments((prevState: any[]) => [
                    ...prevState,
                    {
                      data: resizedFile,
                      upload: true,
                      attachmentUrl: URL.createObjectURL(resizedFile),
                      tid,
                      type: fileType,
                      size: resizedFile.size,
                      metadata: JSON.stringify({
                        tmb: metas.thumbnail,
                        szw: resizedFileData.newWidth,
                        szh: resizedFileData.newHeight
                      })
                    }
                  ])
                  // })
                })
              }
            }
          } else {
            let metas: any = {}
            if (dataFromDb) {
              metas = dataFromDb.metadata
            } else {
              const { thumbnail } = await createImageThumbnail(file, undefined, 50, 50)
              metas.thumbnail = thumbnail
            }
            setAttachments((prevState: any[]) => [
              ...prevState,
              {
                data: file,
                // type: file.type.split('/')[0],
                type: 'file',
                cachedUrl,
                upload: !cachedUrl,
                attachmentUrl: URL.createObjectURL(file as any),
                tid,
                size: dataFromDb ? dataFromDb.size : file.size,
                metadata: dataFromDb
                  ? metas
                  : JSON.stringify({
                      tmb: metas.thumbnail
                    })
              }
            ])
          }
        } else if (fileType === 'video') {
          let metas: any = {}
          if (dataFromDb) {
            metas = dataFromDb.metadata
          } else {
            const { thumb, width, height } = await getFrame(URL.createObjectURL(file as any), 0)
            metas.thumb = thumb
            metas.width = width
            metas.height = height
            metas = JSON.stringify(metas)
          }
          setAttachments((prevState: any[]) => [
            ...prevState,
            {
              data: file,
              // type: file.type.split('/')[0],
              type: 'video',
              cachedUrl,
              upload: !cachedUrl,
              size: dataFromDb ? dataFromDb.size : file.size,
              attachmentUrl: URL.createObjectURL(file as any),
              tid,
              metadata: metas
            }
          ])
        } else {
          setAttachments((prevState: any[]) => [
            ...prevState,
            {
              data: file,
              cachedUrl,
              upload: !cachedUrl,
              type: 'file',
              size: dataFromDb ? dataFromDb.size : file.size,
              metadata: dataFromDb && dataFromDb.metadata,
              tid
            }
          ])
        }
      }
    }
    reader.onerror = (e: any) => {
      console.log(' error on read file onError', e)
    }
    reader.readAsBinaryString(file)
  }

  useEffect(() => {
    if (typingTimout === 0) {
      handleSendTypingState(false)
    }
  }, [typingTimout])

  useDidUpdate(() => {
    if (draggedAttachments.length > 0) {
      const attachmentsFiles = draggedAttachments.map((draggedData: any) => {
        const arr = draggedData.data.split(',')
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n)
        }
        return new File([u8arr], draggedData.name, { type: draggedData.type })
      })
      attachmentsFiles.forEach(async (file: any) => {
        handleAddAttachment(file, draggedAttachments[0].attachmentType === 'media')
      })
      dispatch(setDraggedAttachments([], ''))
    }
  }, [draggedAttachments])

  /* const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setRecording((prevState: any) => ({
        ...prevState,
        initRecording: true,
        mediaStream: stream
      }))
    } catch (e) {
    }
  }

  const saveRecord = () => {
    const recorder = recording.mediaRecorder
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  const deleteRecord = () => {
    const recorder = recording.mediaRecorder
    if (recorder)
      recorder.stream.getAudioTracks().forEach((track: any) => track.stop())
    setRecording(recordingInitialState)
  }

  useDidUpdate(() => {
    if (recording.mediaStream) {
      setRecording({
        ...recording,
        mediaRecorder: new MediaRecorder(recording.mediaStream, {
          mimeType: 'audio/webm'
        })
      })
    }
  }, [recording.mediaStream])

  useEffect(() => {
    const MAX_RECORDER_TIME = 15
    let recordingInterval: any = null

    if (recording.initRecording) {
      recordingInterval = setInterval(() => {
        setRecording((prevState) => {
          if (
            prevState.recordingSeconds === MAX_RECORDER_TIME &&
            prevState.recordingMilliseconds === 0
          ) {
            clearInterval(recordingInterval)
            return prevState
          }

          if (
            prevState.recordingMilliseconds >= 0 &&
            prevState.recordingMilliseconds < 99
          ) {
            return {
              ...prevState,
              recordingMilliseconds: prevState.recordingMilliseconds + 1
            }
          }

          if (prevState.recordingMilliseconds === 99) {
            return {
              ...prevState,
              recordingSeconds: prevState.recordingSeconds + 1,
              recordingMilliseconds: 0
            }
          }

          return prevState
        })
      }, 10)
    } else clearInterval(recordingInterval)

    return () => clearInterval(recordingInterval)
  }, [recording.initRecording])

  useEffect(() => {
    const recorder = recording.mediaRecorder
    let chunks: Blob[] = []
    if (recorder && recorder.state === 'inactive') {
      recorder.start()
      recorder.ondataavailable = (e) => {
        chunks.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        chunks = []
        setRecording((prevState) => {
          if (prevState.mediaRecorder) {
            setRecordedFile({
              data: blob,
              attachmentURL: URL.createObjectURL(blob)
            })
            return {
              ...recordingInitialState,
              initRecording: false,
              audio: URL.createObjectURL(blob)
            }
          }
          return recordingInitialState
        })
      }
    }

    return () => {
      if (recorder)
        recorder.stream.getAudioTracks().forEach((track) => track.stop())
    }
  }, [recording.mediaRecorder])

  useEffect(() => {
    if (recordedFile) {
      handleSendEditMessage()
    }
  }, [recordedFile])
*/

  useEffect(() => {
    const updateViewPortWidth = () => {
      const isNextSmallWidthViewport = CAN_USE_DOM && window.matchMedia('(max-width: 1025px)').matches

      if (isNextSmallWidthViewport !== isSmallWidthViewport) {
        setIsSmallWidthViewport(isNextSmallWidthViewport)
      }
    }
    updateViewPortWidth()
    window.addEventListener('resize', updateViewPortWidth)

    return () => {
      window.removeEventListener('resize', updateViewPortWidth)
    }
  }, [isSmallWidthViewport])

  useEffect(() => {
    if (prevActiveChannelId && activeChannel.id && prevActiveChannelId !== activeChannel.id) {
      setMessageText('')
      handleCloseReply()
      setAttachments([])
      handleCloseEditMode()
      clearTimeout(typingTimout)

      const draftMessage = getDraftMessageFromMap(activeChannel.id)
      if (draftMessage) {
        if (draftMessage.messageForReply) {
          dispatch(setMessageForReplyAC(draftMessage.messageForReply))
        }
        setMessageText(draftMessage.text)
        setMentionedMembers(draftMessage.mentionedMembers)
      }
      setShouldClearEditor({ clear: true, draftMessage })
    }
    if (activeChannel.id) {
      prevActiveChannelId = activeChannel.id
    }
    if (messageInputRef.current && inputAutofocus) {
      messageInputRef.current.focus()
    }

    dispatch(getMembersAC(activeChannel.id))
    setMentionedMembers([])
  }, [activeChannel.id])

  useEffect(() => {
    if (
      messageText.trim() ||
      (editMessageText.trim() && editMessageText && editMessageText.trim() !== messageToEdit.body) ||
      attachments.length
    ) {
      if (attachments.length) {
        let videoAttachment = false
        attachments.forEach((att: any) => {
          if (att.type === 'video' || att.data.type.split('/')[0] === 'video') {
            videoAttachment = true
            if (!readyVideoAttachments[att.tid]) {
              setSendMessageIsActive(false)
            } else {
              setSendMessageIsActive(true)
            }
          }
        })
        if (!videoAttachment) {
          setSendMessageIsActive(true)
        }
      } else {
        setSendMessageIsActive(true)
      }
    } else {
      setSendMessageIsActive(false)
    }

    if (messageText.trim()) {
      const draftMessage = getDraftMessageFromMap(activeChannel.id)
      if (draftMessage && draftMessage.mentionedMembers && draftMessage.mentionedMembers.length) {
        setDraftMessageToMap(activeChannel.id, {
          text: messageText,
          mentionedMembers: draftMessage.mentionedMembers,
          messageForReply,
          editorState: realEditorState
        })
      } else {
        setDraftMessageToMap(activeChannel.id, {
          text: messageText,
          mentionedMembers,
          messageForReply,
          editorState: realEditorState
        })
      }

      if (!listenerIsAdded) {
        setListenerIsAdded(true)
        document.body.setAttribute('onbeforeunload', "return () => 'reload?'")
      }
    } else if (getDraftMessageFromMap(activeChannel.id)) {
      removeDraftMessageFromMap(activeChannel.id)
      dispatch(setChannelDraftMessageIsRemovedAC(activeChannel.id))
      if (checkDraftMessagesIsEmpty() && listenerIsAdded) {
        setListenerIsAdded(false)
        document.body.removeAttribute('onbeforeunload')
      }
    }
  }, [messageText, attachments, editMessageText, readyVideoAttachments])

  useDidUpdate(() => {
    if (mentionedMembers && mentionedMembers.length) {
      setDraftMessageToMap(activeChannel.id, { text: messageText, mentionedMembers, messageForReply })
    }
  }, [mentionedMembers])

  useEffect(() => {
    if (emojiBtnRef && emojiBtnRef.current) {
      const { left, width } = emojiBtnRef.current.getBoundingClientRect()
      setEmojisPopupLeftPosition(left - width / 2)
    }
  }, [emojiBtnRef.current])

  useEffect(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      setTimeout(() => {
        const pendingMessagesMap = getPendingMessagesMap()
        Object.keys(pendingMessagesMap).forEach((key: any) => {
          pendingMessagesMap[key].forEach((msg: IMessage) => {
            dispatch(resendMessageAC(msg, key, connectionStatus))
          })
        })
      }, 1000)
    }
  }, [connectionStatus])

  useDidUpdate(() => {
    if (handleAttachmentSelected) {
      handleAttachmentSelected(!!attachments.length)
    }
    if (sendAttachmentSeparately && attachments && attachments.length) {
      handleSendEditMessage(new Event('click'))
    } else {
      if (messageContRef && messageContRef.current) {
        dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
      }
    }
  }, [attachments])

  useEffect(() => {
    if (
      emojiBtnRef.current &&
      messageInputRef.current &&
      emojiBtnRef.current.offsetLeft > messageInputRef.current.offsetWidth
    ) {
      setEmojisInRightSide(true)
    }
    if (attachmentIcoOrder > inputOrder) {
      setAddAttachmentsInRightSide(true)
    }
    if (!inputContainerHeight && inputWrapperRef && inputWrapperRef.current) {
      setInputContainerHeight(inputWrapperRef.current.getBoundingClientRect().height)
    }
  })

  useDidUpdate(() => {
    if (draftMessagesMap[activeChannel.id]) {
      setDraftMessageToMap(activeChannel.id, { text: messageText, mentionedMembers, messageForReply })
    }
    if (messageForReply && messageToEdit) {
      handleCloseEditMode()
    }

    if (messageContRef && messageContRef.current) {
      dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
    }
  }, [messageForReply])

  useDidUpdate(() => {
    if (messageToEdit) {
      if (messageForReply) {
        handleCloseReply()
      }
    }
    if (messageContRef && messageContRef.current) {
      dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
    }
  }, [messageToEdit])

  useEffect(() => {
    /* wavesurfer.current = WaveSurfer.create({
      container: '#waveform',
      waveColor: '#757D8B',
      progressColor: '#0DBD8B',
      // cursorColor: 'transparent',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 0,
      barGap: 2,
      barMinHeight: 1,
      height: 200,
    });

    wavesurfer.current.on('ready', () => {
      wavesurfer.current.play();
    }); */

    setBrowser(detectBrowser())
    if (handleSendMessage) {
      setSendMessageHandler(handleSendMessage)
    }
    let inputHeightTimeout: any = null
    if (messageContRef && messageContRef.current) {
      inputHeightTimeout = setTimeout(() => {
        const inputContHeight = messageContRef.current.getBoundingClientRect().height
        setEmojisPopupBottomPosition(inputContHeight)
        dispatch(setSendMessageInputHeightAC(inputContHeight))
      }, 800)
    }
    messageContRef.current.addEventListener('paste', handlePastAttachments)
    messageContRef.current.addEventListener('cut', handleCut)
    document.addEventListener('mousedown', handleClick)
    return () => {
      if (inputHeightTimeout) {
        clearTimeout(inputHeightTimeout)
      }
      prevActiveChannelId = undefined
      document.removeEventListener('mousedown', handleClick)

      if (messageContRef && messageContRef.current) {
        messageContRef.current.removeEventListener('paste', handlePastAttachments)
        messageContRef.current.removeEventListener('cut', handleCut)
      }
    }
  }, [])

  return (
    <Container
      margin={margin}
      border={border}
      ref={messageContRef}
      theme={theme}
      mentionColor={colors.primary}
      toolBarTop={selectedText && selectedText.current ? selectedText.current.top : ''}
      toolBarLeft={selectedText && selectedText.current ? selectedText.current.left : ''}
      selectionBackgroundColor={textSelectionBackgroundColor || colors.primaryLight}
    >
      {selectedMessagesMap && selectedMessagesMap.size > 0 ? (
        <SelectedMessagesWrapper>
          {selectedMessagesMap.size} {selectedMessagesMap.size > 1 ? ' messages selected' : ' message selected'}
          <CustomButton
            onClick={handleToggleForwardMessagePopup}
            backgroundColor={colors.primaryLight}
            marginLeft='32px'
          >
            <ForwardIcon />
            Forward
          </CustomButton>
          <CustomButton
            onClick={handleToggleDeleteMessagePopup}
            color={colors.red1}
            backgroundColor={colors.primaryLight}
            marginLeft='16px'
          >
            <DeleteIcon />
            Delete
          </CustomButton>
          <CloseIconWrapper onClick={handleCloseSelectMessages}>
            <CloseIcon />
          </CloseIconWrapper>
          {forwardPopupOpen && (
            <ForwardMessagePopup
              handleForward={handleForwardMessage}
              togglePopup={handleToggleForwardMessagePopup}
              buttonText='Forward'
              title='Forward message'
            />
          )}
          {deletePopupOpen && (
            <ConfirmPopup
              handleFunction={handleDeleteMessage}
              togglePopup={handleToggleDeleteMessagePopup}
              buttonText='Delete'
              description={`Who do you want to remove ${
                selectedMessagesMap.size > 1 ? 'these messages' : 'this message'
              } for?`}
              isDeleteMessage
              isIncomingMessage={isIncomingMessage}
              myRole={activeChannel.userRole}
              allowDeleteIncoming={getAllowEditDeleteIncomingMessage()}
              isDirectChannel={activeChannel.type === CHANNEL_TYPE.DIRECT}
              title={`Delete message${selectedMessagesMap.size > 1 ? 's' : ''}`}
            />
          )}
        </SelectedMessagesWrapper>
      ) : (
        <React.Fragment>
          {!activeChannel.id ? (
            <Loading />
          ) : isBlockedUserChat || isDeletedUserChat || disableInput ? (
            <BlockedUserInfo>
              <BlockInfoIcon />{' '}
              {isDeletedUserChat
                ? 'This user has been deleted.'
                : disableInput
                ? "Sender doesn't support replies"
                : 'You blocked this user.'}
            </BlockedUserInfo>
          ) : !activeChannel.userRole && activeChannel.type !== CHANNEL_TYPE.DIRECT ? (
            <JoinChannelCont onClick={handleJoinToChannel} color={colors.primary}>
              Join
            </JoinChannelCont>
          ) : (
              activeChannel.type === CHANNEL_TYPE.BROADCAST || activeChannel.type === CHANNEL_TYPE.PUBLIC
                ? !(activeChannel.userRole === 'admin' || activeChannel.userRole === 'owner')
                : activeChannel.type !== CHANNEL_TYPE.DIRECT && !checkActionPermission('sendMessage')
            ) ? (
            <ReadOnlyCont color={colors.textColor1} iconColor={colors.primary}>
              <EyeIcon /> Read only
            </ReadOnlyCont>
          ) : (
            <React.Fragment>
              <TypingIndicator>
                {typingIndicator &&
                  typingIndicator.typingState &&
                  (CustomTypingIndicator ? (
                    <CustomTypingIndicator from={typingIndicator.from} typingState={typingIndicator.typingState} />
                  ) : (
                    <TypingIndicatorCont>
                      <TypingFrom>
                        {makeUsername(
                          getFromContacts && typingIndicator.from && contactsMap[typingIndicator.from.id],
                          typingIndicator.from,
                          getFromContacts
                        )}{' '}
                        is typing
                      </TypingFrom>
                      <TypingAnimation>
                        <DotOne />
                        <DotTwo />
                        <DotThree />
                      </TypingAnimation>
                    </TypingIndicatorCont>
                  ))}
              </TypingIndicator>
              {messageToEdit && (
                <EditReplyMessageCont>
                  <CloseEditMode onClick={handleCloseEditMode}>
                    <CloseIcon />
                  </CloseEditMode>
                  <EditReplyMessageHeader color={colors.primary}>
                    {editMessageIcon || <EditIcon />}
                    Edit Message
                  </EditReplyMessageHeader>
                  <EditMessageText>
                    {MessageTextFormat({
                      text: messageToEdit.body,
                      message: messageToEdit,
                      contactsMap,
                      getFromContacts,
                      asSampleText: true
                    })}
                  </EditMessageText>
                </EditReplyMessageCont>
              )}
              {messageForReply && (
                <EditReplyMessageCont>
                  <CloseEditMode onClick={handleCloseReply}>
                    <CloseIcon />
                  </CloseEditMode>
                  <ReplyMessageCont>
                    {!!(messageForReply.attachments && messageForReply.attachments.length) &&
                      (messageForReply.attachments[0].type === attachmentTypes.image ||
                      messageForReply.attachments[0].type === attachmentTypes.video ? (
                        <Attachment
                          attachment={messageForReply.attachments[0]}
                          backgroundColor={selectedFileAttachmentsBoxBackground || ''}
                          isRepliedMessage
                        />
                      ) : (
                        messageForReply.attachments[0].type === attachmentTypes.file && (
                          <ReplyIconWrapper backgroundColor={colors.primary}>
                            <ChoseFileIcon />
                          </ReplyIconWrapper>
                        )
                      ))}
                    <div>
                      <EditReplyMessageHeader color={colors.primary}>
                        {replyMessageIcon || <ReplyIcon />} Reply to
                        <UserName>
                          {user.id === messageForReply.user.id
                            ? user.firstName
                              ? `${user.firstName} ${user.lastName}`
                              : user.id
                            : makeUsername(contactsMap[messageForReply.user.id], messageForReply.user, getFromContacts)}
                        </UserName>
                      </EditReplyMessageHeader>
                      {messageForReply.attachments && messageForReply.attachments.length ? (
                        messageForReply.attachments[0].type === attachmentTypes.voice ? (
                          'Voice'
                        ) : messageForReply.attachments[0].type === attachmentTypes.image ? (
                          <TextInOneLine>{messageForReply.body || 'Photo'}</TextInOneLine>
                        ) : messageForReply.attachments[0].type === attachmentTypes.video ? (
                          <TextInOneLine>{messageForReply.body || 'Video'}</TextInOneLine>
                        ) : (
                          <TextInOneLine>{messageForReply.body || 'File'}</TextInOneLine>
                        )
                      ) : (
                        MessageTextFormat({
                          text: messageForReply.body,
                          message: messageForReply,
                          contactsMap,
                          getFromContacts
                        })
                      )}
                    </div>
                  </ReplyMessageCont>
                </EditReplyMessageCont>
              )}

              {!!attachments.length && !sendAttachmentSeparately && (
                <ChosenAttachments>
                  {attachments.map((attachment: any) => (
                    <Attachment
                      attachment={attachment}
                      isPreview
                      removeSelected={removeUpload}
                      key={attachment.tid}
                      setVideoIsReadyToSend={setVideoIsReadyToSend}
                      borderRadius={selectedAttachmentsBorderRadius}
                      selectedFileAttachmentsIcon={selectedFileAttachmentsIcon}
                      backgroundColor={selectedFileAttachmentsBoxBackground || colors.backgroundColor}
                      selectedFileAttachmentsBoxBorder={selectedFileAttachmentsBoxBorder}
                      selectedFileAttachmentsTitleColor={selectedFileAttachmentsTitleColor}
                      selectedFileAttachmentsSizeColor={selectedFileAttachmentsSizeColor}
                    />
                  ))}
                </ChosenAttachments>
              )}
              <SendMessageInputContainer iconColor={colors.primary} minHeight={minHeight}>
                <UploadFile ref={fileUploader} onChange={handleFileUpload} multiple type='file' />
                <MessageInputWrapper
                  className='message_input_wrapper'
                  borderRadius={borderRadius}
                  ref={inputWrapperRef}
                  backgroundColor={backgroundColor || colors.backgroundColor}
                  channelDetailsIsOpen={channelDetailsIsOpen}
                  messageInputOrder={inputOrder}
                  messageInputPaddings={inputPaddings}
                >
                  {showAddEmojis && (
                    <EmojiButton
                      order={emojiIcoOrder}
                      isEmojisOpened={isEmojisOpened}
                      ref={emojiBtnRef}
                      hoverColor={colors.primary}
                      height={inputContainerHeight || minHeight}
                      onClick={() => {
                        setIsEmojisOpened(!isEmojisOpened)
                      }}
                    >
                      {AddEmojisIcon || <EmojiSmileIcon />}
                    </EmojiButton>
                  )}
                  {showAddAttachments && (
                    <DropDown
                      theme={theme}
                      forceClose={showChooseAttachmentType}
                      position={addAttachmentsInRightSide ? 'top' : 'topRight'}
                      margin='auto 0 0'
                      order={attachmentIcoOrder}
                      trigger={
                        <AddAttachmentIcon
                          ref={addAttachmentsBtnRef}
                          color={colors.primary}
                          height={inputContainerHeight || minHeight}
                        >
                          {AddAttachmentsIcon || <AttachmentIcon />}
                        </AddAttachmentIcon>
                      }
                    >
                      <DropdownOptionsUl>
                        <DropdownOptionLi
                          key={1}
                          textColor={colors.textColor1}
                          hoverBackground={colors.hoverBackgroundColor}
                          onClick={() => onOpenFileUploader(mediaExtensions)}
                          iconWidth='20px'
                          iconColor={colors.textColor2}
                        >
                          <ChoseMediaIcon />
                          Photo or video
                        </DropdownOptionLi>
                        <DropdownOptionLi
                          key={2}
                          textColor={colors.textColor1}
                          hoverBackground={colors.hoverBackgroundColor}
                          onClick={() => onOpenFileUploader('')}
                          iconWidth='20px'
                          iconColor={colors.textColor2}
                        >
                          <ChoseFileIcon />
                          File
                        </DropdownOptionLi>
                      </DropdownOptionsUl>
                    </DropDown>
                  )}
                  <LexicalWrapper
                    ref={messageInputRef}
                    order={inputOrder}
                    backgroundColor={inputBackgroundColor}
                    paddings={inputPaddings}
                    mentionColor={colors.primary}
                    className={inputCustomClassname}
                    selectionBackgroundColor={textSelectionBackgroundColor || colors.primaryLight}
                    borderRadius={inputBorderRadius}
                  >
                    <LexicalComposer initialConfig={initialConfig}>
                      <AutoFocusPlugin />
                      <ClearEditorPlugin
                        shouldClearEditor={shouldClearEditor}
                        setEditorCleared={() => setShouldClearEditor({ clear: false })}
                      />
                      {/* eslint-disable-next-line react/jsx-no-bind */}
                      <OnChangePlugin onChange={onChange} />
                      <EditMessagePlugin
                        editMessage={messageToEdit}
                        contactsMap={contactsMap}
                        getFromContacts={getFromContacts}
                        setMentionedMember={setMentionedMembers}
                      />
                      <FormatMessagePlugin
                        editorState={realEditorState}
                        setMessageBodyAttributes={setMessageBodyAttributes}
                        messageText={messageToEdit ? editMessageText : messageText}
                        setMessageText={messageToEdit ? setEditMessageText : setMessageText}
                        messageToEdit={messageToEdit}
                      />
                      <React.Fragment>
                        {isEmojisOpened && (
                          <EmojisPopup
                            // handleAddEmoji={handleAddEmoji}
                            // messageText={messageText}
                            // ccc={handleTyping}
                            handleEmojiPopupToggle={handleEmojiPopupToggle}
                            rightSide={emojisInRightSide}
                            bottomPosition={`${emojisPopupBottomPosition}px`}
                            leftPosition={`${emojisPopupLeftPosition}px`}
                          />
                        )}
                        {allowSetMention && (
                          <MentionsPlugin
                            setMentionMember={handleSetMentionMember}
                            contactsMap={contactsMap}
                            userId={user.id}
                            getFromContacts={getFromContacts}
                            members={activeChannelMembers}
                          />
                        )}
                        <RichTextPlugin
                          contentEditable={
                            <div onKeyDown={handleSendEditMessage} className='rich_text_editor' ref={onRef}>
                              <ContentEditable className='content_editable_input' />
                            </div>
                          }
                          placeholder={<Placeholder paddings={inputPaddings}>Type message here ...</Placeholder>}
                          ErrorBoundary={LexicalErrorBoundary}
                        />
                        {floatingAnchorElem && !isSmallWidthViewport && (
                          <React.Fragment>
                            {/* <DraggableBlockPlugin anchorElem={floatingAnchorElem} /> */}
                            {/* <CodeActionMenuPlugin anchorElem={floatingAnchorElem} /> */}
                            <FloatingTextFormatToolbarPlugin anchorElem={floatingAnchorElem} />
                          </React.Fragment>
                        )}
                      </React.Fragment>
                    </LexicalComposer>
                  </LexicalWrapper>
                </MessageInputWrapper>
                <SendMessageIcon
                  isActive={sendMessageIsActive}
                  order={sendIconOrder}
                  color={colors.backgroundColor}
                  height={inputContainerHeight || minHeight}
                  onClick={sendMessageIsActive ? handleSendEditMessage : null}
                >
                  <SendIcon />
                </SendMessageIcon>
                {/*  {recording.initRecording ? (
            <AudioCont />
          ) : (
            <MessageInput
              order={inputOrder}
              onChange={handleTyping}
              onKeyPress={handleSendEditMessage}
              // onKeyDown={handleKeyDown}
              value={messageText}
              ref={messageInputRef}
              placeholder='Type message here...'
            />
          )}

          {sendMessageIsActive ? (
            <SendMessageIcon order={sendIcoOrder} onClick={handleSendEditMessage}>
              <SendIcon />
            </SendMessageIcon>
          ) : recording.initRecording ? (
            <React.Fragment>
              <RecordingTimer>
                {recording.recordingSeconds}:{recording.recordingMilliseconds}
              </RecordingTimer>
              <SendMessageIcon order={sendIcoOrder} onClick={deleteRecord}>
                <DelteIcon />
              </SendMessageIcon>
              <SendMessageIcon order={sendIcoOrder} onClick={saveRecord}>
                <SendIcon />
              </SendMessageIcon>
            </React.Fragment>
          ) : (
            <SendMessageIcon order={sendIcoOrder} onClick={startRecording}>
              <RecordIcon />
            </SendMessageIcon>
          )} */}
              </SendMessageInputContainer>
            </React.Fragment>
          )}
        </React.Fragment>
      )}
    </Container>
  )
}

const Container = styled.div<{
  margin?: string
  border?: string
  borderRadius?: string
  ref?: any
  height?: number
  theme?: string
  mentionColor?: string
  toolBarTop: string
  toolBarLeft: string
  selectionBackgroundColor: string
}>`
  margin: ${(props) => props.margin || '30px 0 16px'};
  border: ${(props) => props.border || ''};
  border-radius: ${(props) => props.borderRadius || '4px'};
  position: relative;
  padding: 0 12px;

  & span.rdw-suggestion-dropdown {
    position: absolute;
    bottom: 100%;
    height: 160px;
    min-width: 150px;
    display: flex;
    flex-direction: column;
    overflow: auto;
    padding: 6px 12px;
    border: 1px solid #ccc;
    background: #fff;
    z-index: 99;
  }

  & .text_formatting_toolbar {
    display: ${(props) => (props.toolBarTop || props.toolBarLeft ? 'block' : 'none')};
    position: fixed;
    top: ${(props) => props.toolBarTop};
    left: ${(props) => props.toolBarLeft};
  }

  & .rdw-suggestion-option-active {
    background-color: rgb(243, 245, 248);
  }
  & .custom_editor {
    cursor: text;

    & .rdw-mention-link {
      color: ${(props) => props.mentionColor || colors.primary};
    }
  }
`

const EditReplyMessageCont = styled.div<any>`
  position: relative;
  left: -12px;
  width: calc(100% - 8px);
  padding: 8px 16px;
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  color: ${colors.textColor1};
  background-color: ${colors.backgroundColor};
  z-index: 19;
  border-bottom: 1px solid ${colors.gray1};
`

const EditMessageText = styled.p<any>`
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`

const CloseEditMode = styled.span`
  position: absolute;
  top: 8px;
  right: 12px;
  width: 20px;
  height: 20px;
  text-align: center;
  line-height: 22px;
  cursor: pointer;

  & > svg {
    color: ${colors.textColor2};
  }
`

const UserName = styled.span<any>`
  font-weight: 500;
  margin-left: 4px;
`

const EditReplyMessageHeader = styled.h4<any>`
  display: flex;
  margin: 0 0 2px;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color || colors.primary};

  > svg {
    margin-right: 4px;
    width: 16px;
    height: 16px;
  }
`

const AddAttachmentIcon = styled.span<any>`
  display: flex;
  height: ${(props) => (props.height ? `${props.height}px` : '36px')};
  align-items: center;
  margin: 0 8px;
  cursor: pointer;
  line-height: 13px;
  z-index: 2;
  order: ${(props) => (props.order === 0 || props.order ? props.order : 1)};

  > svg {
    ${(props) => (props.isActive ? `color: ${props.color || colors.primary};` : 'color: #898B99;')};
    width: 24px;
  }

  &:hover > svg {
    color: ${(props) => props.color || colors.primary};
  }
`

const SendMessageInputContainer = styled.div<{ minHeight?: string; iconColor?: string; messageForReply?: string }>`
  display: flex;
  align-items: flex-end;
  position: relative;
  min-height: ${(props) => props.minHeight || '36px'};
  box-sizing: border-box;
  border-radius: ${(props) => (props.messageForReply ? '0 0 4px 4px' : '4px')};

  & .dropdown-trigger.open {
    color: #ccc;

    & ${AddAttachmentIcon} {
      & > svg {
        color: ${(props) => props.iconColor || colors.primary};
      }
    ;
    }
  }
}
`

const MessageInputWrapper = styled.div<{
  channelDetailsIsOpen?: boolean
  backgroundColor?: string
  borderRadius?: string
  messageInputOrder?: number
  messageInputPaddings?: string
}>`
  display: flex;
  width: 100%;
  max-width: calc(100% - 50px);
  //max-width: ${(props) =>
    props.channelDetailsIsOpen ? `calc(100% - ${props.channelDetailsIsOpen ? 362 : 0}px)` : ''};
  //max-width: calc(100% - 110px);
  background-color: ${(props) => props.backgroundColor || colors.backgroundColor};
  border-radius: ${(props) => props.borderRadius || '18px'};
  position: relative;
`

const LexicalWrapper = styled.div<{
  order?: number
  color?: string
  borderRadius?: string
  backgroundColor?: string
  paddings?: string
  mentionColor?: string
  isChrome?: boolean
  selectionBackgroundColor?: string
}>`
  position: relative;
  width: 100%;

  & .rich_text_editor {
    margin: 8px 6px;
    width: 100%;
    max-height: 80px;
    min-height: 20px;
    display: block;
    border: none;
    color: ${(props) => props.color};
    box-sizing: border-box;
    outline: none !important;
    font-size: 15px;
    line-height: 20px;
    overflow: auto;
    border-radius: ${(props) => props.borderRadius};
    background-color: ${(props) => props.backgroundColor};
    padding: ${(props) => props.paddings};
    order: ${(props) => (props.order === 0 || props.order ? props.order : 1)};

    &::selection {
      background-color: ${(props) => props.selectionBackgroundColor || colors.primary};
    }
    & span::selection {
      background-color: ${(props) => props.selectionBackgroundColor || colors.primary};
    }

    &:empty:before {
      content: attr(data-placeholder);
    }

    & .content_editable_input {
      border: none !important;
      outline: none !important;
    }
    & .mention {
      color: ${(props) => props.mentionColor || colors.primary};
      background-color: inherit !important;
      //user-modify: read-only;
    }

    & span.bold {
      font-weight: bold;
    }
    & .editor_paragraph {
      margin: 0;
    }
    & .text_bold {
      font-weight: bold;
    }
    & .text_italic {
      font-style: italic;
    }
    & .text_underline {
      text-decoration: underline;
    }
    & .text_strikethrough {
      text-decoration: line-through;
    }
    & .text_underlineStrikethrough {
      text-decoration: underline line-through;
    }
    & code {
      font-family: inherit;
      letter-spacing: 4px;
    }
  }
`

const Placeholder = styled.span<{ paddings?: string }>`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  color: ${colors.placeholderTextColor};
  margin: 8px 6px;

  padding: ${(props) => props.paddings};
`

const EmojiButton = styled.span<any>`
  display: flex;
  height: ${(props) => (props.height ? `${props.height}px` : '36px')};
  align-items: center;
  position: relative;
  margin: auto 8px 0 8px;
  cursor: pointer;
  line-height: 13px;
  z-index: 2;
  order: ${(props) => (props.order === 0 || props.order ? props.order : 2)};
  -webkit-tap-highlight-color: transparent;

  > svg {
    ${(props) => (props.isEmojisOpened ? `color: ${props.hoverColor || colors.primary};` : 'color: #898B99;')};
    width: 24px;
    height: 24px;
  }

  &:hover > svg {
    color: ${(props) => props.hoverColor || colors.primary};
  }
`

const SendMessageIcon = styled.span<any>`
  display: flex;
  height: ${(props) => (props.height ? `${props.height}px` : '36px')};
  align-items: center;
  margin: 0 8px;
  cursor: pointer;
  line-height: 13px;
  order: ${(props) => (props.order === 0 || props.order ? props.order : 4)};
  -webkit-tap-highlight-color: transparent;

  color: ${(props) => (props.isActive ? colors.primary : props.color)};
`

/* const AudioCont = styled.div<any>`
  display: flex;
  width: 100%;
  justify-content: flex-end;
`

const RecordingTimer = styled.span<any>`
  display: inline-block;
  width: 50px;
  font-size: 16px;
  color: ${colors.gray6};
` */

const ChosenAttachments = styled.div<{ fileBoxWidth?: string }>`
  display: flex;
  align-items: center;
  padding: 16px 16px 14px;
  overflow-x: auto;

  & ${AttachmentImg} {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    object-fit: cover;
  }

  & ${AttachmentFile} {
    width: 240px;
    padding: 5px 12px;
    border-radius: 8px;
    height: 50px;
  }
`

const TypingIndicator = styled.div`
  position: absolute;
  bottom: 100%;
  left: 16px;
`

const TypingIndicatorCont = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
`

const TypingFrom = styled.h5`
  margin: 0 4px 0 0;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.2px;
  color: ${colors.textColor2};
`
const sizeAnimation = keyframes`
  0% {
    width: 2px;
    height: 2px;
    opacity: 0.4;
  }
  50% {
    width: 2px;
    height: 2px;
    opacity: 0.4;
  }
  100% {
    width: 6px;
    height: 6px;
    opacity: 1;
  }
`
const DotOne = styled.span``
const DotTwo = styled.span``
const DotThree = styled.span``
const TypingAnimation = styled.div`
  display: flex;

  & > span {
    position: relative;
    width: 6px;
    height: 6px;
    margin-right: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation-timing-function: linear;

    &:after {
      content: '';
      position: absolute;

      width: 3.5px;
      height: 3.5px;
      border-radius: 50%;
      background-color: ${colors.borderColor2}
      animation-name: ${sizeAnimation};
      animation-duration: 0.6s;
      animation-iteration-count: infinite;
    }
  }

  & ${DotOne} {
    &:after {
      animation-delay: 0s;
    }
  }

  & ${DotTwo} {
    &:after {
      animation-delay: 0.2s;
    }
  }

  & ${DotThree} {
    &:after {
      animation-delay: 0.3s;
    }
  }
`
const Loading = styled.div`
  height: 36px;
`
const BlockedUserInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  color: ${colors.textColor1};

  & > svg {
    margin-right: 12px;
  }
`
const JoinChannelCont = styled.div<{ color?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 -12px;
  padding: 14px;
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color || colors.primary};
  background-color: ${colors.backgroundColor};
  cursor: pointer;
`
const ReadOnlyCont = styled.div<{ color?: string; iconColor?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color || colors.textColor1};

  & > svg {
    margin-right: 12px;
    color: ${(props) => props.iconColor || colors.primary};
  }
`
const ReplyMessageCont = styled.div`
  display: flex;
`
const ReplyIconWrapper = styled.span<{ backgroundColor?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  width: 40px;
  height: 40px;
  background-color: ${(props) => props.backgroundColor || colors.primary};
  border-radius: 50%;

  & > svg {
    width: 20px;
    height: 20px;
    color: ${colors.white};
  }
`
/* interface Recording {
  recordingSeconds: number
  recordingMilliseconds: number
  initRecording: boolean
  mediaStream: null | MediaStream
  mediaRecorder: null | MediaRecorder
  audio?: string
} */

const SelectedMessagesWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
`

const CustomButton = styled.span<{ color?: string; backgroundColor?: string; marginLeft?: string }>`
  color: ${(props) => props.color || colors.textColor1};
  padding: 8px 16px;
  background-color: ${(props) => props.backgroundColor || colors.primaryLight};
  margin-left: ${(props) => props.marginLeft || '8px'};
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: Inter, sans-serif;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  > svg {
    width: 20px;
    height: 20px;
    margin-right: 8px;
  }
`

const CloseIconWrapper = styled.span`
  display: inline-flex;
  cursor: pointer;
  margin-left: auto;
  padding: 10px;
`

export default SendMessageInput
