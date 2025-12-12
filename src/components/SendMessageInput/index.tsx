import React, { FC, useEffect, useMemo, useRef, useState } from 'react'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
import { v4 as uuidv4 } from 'uuid'
import styled, { keyframes } from 'styled-components'
import LinkifyIt from 'linkify-it'

// Rich text editor
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, FORMAT_TEXT_COMMAND } from 'lexical'
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
import EmojisPopup from './EmojisPlugin'
import log from 'loglevel'

// Action creators
import {
  clearSelectedMessagesAC,
  deleteMessageAC,
  deleteMessageFromListAC,
  editMessageAC,
  forwardMessageAC,
  sendMessageAC,
  sendTextMessageAC,
  setMessageForReplyAC,
  setMessageToEditAC,
  setSendMessageInputHeightAC
} from '../../store/message/actions'
import {
  joinChannelAC,
  sendTypingAC,
  setChannelDraftMessageIsRemovedAC,
  setCloseSearchChannelsAC,
  setDraggedAttachmentsAC
} from '../../store/channel/actions'
import { getMembersAC } from '../../store/member/actions'

// Selectors
import {
  messageForReplySelector,
  messageToEditSelector,
  selectedMessagesMapSelector
} from '../../store/message/selector'
import {
  activeChannelSelector,
  channelInfoIsOpenSelector,
  draggedAttachmentsSelector,
  typingOrRecordingIndicatorArraySelector
} from '../../store/channel/selector'
import { connectionStatusSelector, contactsMapSelector } from '../../store/user/selector'
import { activeChannelMembersSelector } from '../../store/member/selector'
import { themeSelector } from '../../store/theme/selector'

// Helpers
import {
  checkIsTypeKeyPressed,
  compareMessageBodyAttributes,
  EditorTheme,
  getAllowEditDeleteIncomingMessage,
  makeUsername
} from '../../helpers/message'
import { DropdownOptionLi, DropdownOptionsUl, TextInOneLine, UploadFile } from '../../UIHelper'
import { THEME_COLORS } from '../../UIHelper/constants'
import { createImageThumbnail, resizeImage } from '../../helpers/resizeImage'
import { detectBrowser, detectOS, hashString } from '../../helpers'
import { IMember, IMessage } from '../../types'
import { getCustomUploader, getSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import {
  checkDraftMessagesIsEmpty,
  deletePendingMessage,
  deleteVideoThumb,
  draftMessagesMap,
  getAudioRecordingFromMap,
  getDraftMessageFromMap,
  removeDraftMessageFromMap,
  setDraftMessageToMap,
  setPendingAttachment,
  setSendMessageHandler
} from '../../helpers/messagesHalper'
import {
  attachmentTypes,
  DEFAULT_CHANNEL_TYPE,
  DB_NAMES,
  DB_STORE_NAMES,
  MESSAGE_DELIVERY_STATUS,
  USER_STATE
} from '../../helpers/constants'
import { hideUserPresence } from '../../helpers/userHelper'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { getFrame } from '../../helpers/getVideoFrame'
import { CAN_USE_DOM } from '../../helpers/canUseDOM'

// Hooks
import usePermissions from '../../hooks/usePermissions'
import { useDidUpdate, useColor } from '../../hooks'

// Icons
import { ReactComponent as SendIcon } from '../../assets/svg/send.svg'
import { ReactComponent as EyeIcon } from '../../assets/svg/eye.svg'
import { ReactComponent as EditIcon } from '../../assets/svg/editIcon.svg'
import { ReactComponent as ReplyIcon } from '../../assets/svg/replyIcon.svg'
import { ReactComponent as AttachmentIcon } from '../../assets/svg/addAttachment.svg'
import { ReactComponent as EmojiSmileIcon } from '../../assets/svg/emojiSmileIcon.svg'
import { ReactComponent as ChooseFileIcon } from '../../assets/svg/choseFile.svg'
import { ReactComponent as PollIcon } from '../../assets/svg/poll.svg'
import { ReactComponent as BlockInfoIcon } from '../../assets/svg/error_circle.svg'
import { ReactComponent as ChooseMediaIcon } from '../../assets/svg/choseMedia.svg'
import { ReactComponent as CloseIcon } from '../../assets/svg/close.svg'
import { ReactComponent as DeleteIcon } from '../../assets/svg/deleteIcon.svg'
import { ReactComponent as ForwardIcon } from '../../assets/svg/forward.svg'

// Components
import Attachment, { AttachmentFile, AttachmentImg } from '../Attachment'
import DropDown from '../../common/dropdown'
import ConfirmPopup from '../../common/popups/delete'
import ForwardMessagePopup from '../../common/popups/forwardMessage'
import AudioRecord from '../AudioRecord'

import { getClient } from '../../common/client'
import { getDataFromDB } from '../../services/indexedDB'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { MessageTextFormat } from '../../messageUtils'
import RecordingAnimation from './RecordingAnimation'
import CreatePollPopup from './Poll/CreatePollPopup'
import { MESSAGE_TYPE } from 'types/enum'

function AutoFocusPlugin({ messageForReply }: any) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    // Focus the editor when the effect fires!
    editor.focus()
  }, [editor, messageForReply])

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
        } else {
          const paragraphNode = $createParagraphNode()
          rootNode.append(paragraphNode)
          rootNode.selectEnd()
        }
        const selection: any = $getSelection()
        if (selection.hasFormat('bold')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
        }
        if (selection.hasFormat('italic')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
        }
        if (selection.hasFormat('underline')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')
        }
        if (selection.hasFormat('strikethrough')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
        }
        if (selection.hasFormat('subscript')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')
        }
        if (selection.hasFormat('superscript')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')
        }
        if (selection.hasFormat('code')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
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
  log.error(error)
}

let prevActiveChannelId: any
let attachmentsUpdate: any = []

interface SendMessageProps {
  draggedAttachments?: boolean
  // eslint-disable-next-line no-unused-vars
  handleAttachmentSelected?: (state: boolean) => void
  // eslint-disable-next-line no-unused-vars
  handleSendMessage?: (message: IMessage, channelId: string) => Promise<IMessage>
  CustomSendMessageButton?: JSX.Element
  inputCustomClassname?: string
  disabled?: boolean
  CustomDisabledInput?: FC<{}>
  showAddEmojis?: boolean
  AddEmojisIcon?: JSX.Element
  emojiIcoOrder?: number
  showAddAttachments?: boolean
  allowedMediaExtensions?: string[]
  showChooseFileAttachment?: boolean
  showChooseMediaAttachment?: boolean
  attachmentSizeLimitErrorMessage?: string
  allowedMediaExtensionsErrorMessage?: string
  chooseMediaAttachmentText?: string
  chooseFileAttachmentText?: string
  mediaAttachmentSizeLimit?: number
  fileAttachmentSizeLimit?: number
  AddAttachmentsIcon?: JSX.Element
  attachmentIcoOrder?: number
  sendIconOrder?: number
  inputOrder?: number
  CustomTypingIndicator?: FC<{
    from: {
      id: string
      name: string
      typingState?: boolean
      recordingState?: boolean
    }[]
  }>
  backgroundColor?: string
  margin?: string
  padding?: string
  minHeight?: string
  border?: string
  borderRadius?: string
  borderRadiusOnOpenedEditReplyMessage?: string
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
  replyMessageBackgroundColor?: string
  replyMessageTextColor?: string
  replyEditMessageContainerWidth?: string
  replyEditMessageContainerBorderRadius?: string
  replyEditMessageContainerBottomPosition?: string
  replyEditMessageContainerLeftPosition?: string
  replyEditMessageContainerPadding?: string
  editMessageIcon?: JSX.Element
  editMessageBackgroundColor?: string
  editMessageTextColor?: string
  voiceMessage?: boolean
  sendAttachmentSeparately?: boolean
  allowMentionUser?: boolean
  allowTextEdit?: boolean
  textSelectionBackgroundColor?: string
  placeholderText?: string
  placeholderTextColor?: string
  audioRecordingMaxDuration?: number
  pollOptions?: {
    showAddPoll?: boolean
    choosePollText?: string
    pollOptions?: {
      id: string
      text: string
      votes: number
    }[]
  }
}

const SendMessageInput: React.FC<SendMessageProps> = ({
  handleAttachmentSelected,
  // draggedAttachments,
  handleSendMessage,
  disabled = false,
  CustomDisabledInput,
  CustomSendMessageButton,
  sendIconOrder,
  inputOrder = 1,
  showAddEmojis = true,
  AddEmojisIcon,
  emojiIcoOrder = 2,
  showAddAttachments = true,
  showChooseFileAttachment = true,
  showChooseMediaAttachment = true,
  chooseMediaAttachmentText,
  chooseFileAttachmentText,
  mediaAttachmentSizeLimit,
  attachmentSizeLimitErrorMessage,
  allowedMediaExtensions,
  allowedMediaExtensionsErrorMessage,
  AddAttachmentsIcon,
  attachmentIcoOrder = 0,
  CustomTypingIndicator,
  margin,
  padding,
  border,
  minHeight,
  borderRadius,
  borderRadiusOnOpenedEditReplyMessage = '0px 0px 18px 18px',
  inputBorderRadius,
  backgroundColor,
  inputBackgroundColor,
  inputCustomClassname,
  inputPaddings,
  selectedAttachmentsBorderRadius,
  selectedFileAttachmentsIcon,
  selectedFileAttachmentsBoxBackground,
  selectedFileAttachmentsBoxBorder,
  selectedFileAttachmentsTitleColor,
  selectedFileAttachmentsSizeColor,
  replyMessageIcon,
  replyMessageBackgroundColor,
  replyMessageTextColor,
  editMessageIcon,
  editMessageBackgroundColor,
  editMessageTextColor,
  replyEditMessageContainerWidth,
  replyEditMessageContainerBorderRadius,
  replyEditMessageContainerBottomPosition,
  replyEditMessageContainerPadding,
  replyEditMessageContainerLeftPosition,
  sendAttachmentSeparately,
  allowMentionUser = true,
  allowTextEdit = true,
  textSelectionBackgroundColor,
  voiceMessage = true,
  placeholderText,
  placeholderTextColor,
  audioRecordingMaxDuration,
  pollOptions
}) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections,
    [THEME_COLORS.SURFACE_1]: surface1Background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.WARNING]: errorColor,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLORS.HIGHLIGHTED_BACKGROUND]: highlightedBackground,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary
  } = useColor()

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
  const isDirectChannel = activeChannel && activeChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && activeChannel.members.find((member: IMember) => member.id !== user.id)
  const disableInput = disabled || (directChannelUser && hideUserPresence && hideUserPresence(directChannelUser))
  const isBlockedUserChat = directChannelUser && directChannelUser.blocked
  const isDeletedUserChat = directChannelUser && directChannelUser.state === USER_STATE.DELETED
  const allowSetMention =
    allowMentionUser &&
    (activeChannel.type === DEFAULT_CHANNEL_TYPE.PRIVATE || activeChannel.type === DEFAULT_CHANNEL_TYPE.GROUP)

  // Voice recording
  const [showRecording, setShowRecording] = useState<boolean>(false)
  const [checkActionPermission] = usePermissions(activeChannel.userRole)
  const [listenerIsAdded, setListenerIsAdded] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [editMessageText, setEditMessageText] = useState('')
  const [readyVideoAttachments, setReadyVideoAttachments] = useState<{ [key: string]: boolean }>({})
  const [showChooseAttachmentType, setShowChooseAttachmentType] = useState(false)
  const [isEmojisOpened, setIsEmojisOpened] = useState(false)
  const [emojisInRightSide, setEmojisInRightSide] = useState(false)
  const [emojisPopupLeftPosition, setEmojisPopupLeftPosition] = useState(0)
  const [emojisPopupBottomPosition, setEmojisPopupBottomPosition] = useState(0)
  const [addAttachmentsInRightSide, setAddAttachmentsInRightSide] = useState(false)
  const [showPoll, setShowPoll] = useState(false)
  const [shouldClearEditor, setShouldClearEditor] = useState<{ clear: boolean; draftMessage?: any }>({ clear: false })
  const [messageBodyAttributes, setMessageBodyAttributes] = useState<any>([])
  const [mentionedUsers, setMentionedUsers] = useState<any>([])
  const [browser, setBrowser] = useState<any>('')
  const [mentionsIsOpen, setMentionsIsOpen] = useState<any>(false)

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
  const [mediaExtensions, setMediaExtensions] = useState('.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.wmv,.flv,.webm,.jfif')
  const [uploadErrorMessage, setUploadErrorMessage] = useState('')

  const typingOrRecordingIndicator = useSelector(typingOrRecordingIndicatorArraySelector(activeChannel.id))
  const contactsMap = useSelector(contactsMapSelector)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)

  const messageContRef = useRef<any>(null)
  const fileUploader = useRef<any>(null)
  const inputWrapperRef = useRef<any>(null)
  const messageInputRef = useRef<any>(null)
  const emojiBtnRef = useRef<any>(null)
  const addAttachmentsBtnRef = useRef<any>(null)

  const [realEditorState, setRealEditorState] = useState()
  const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null)
  const [isSmallWidthViewport, setIsSmallWidthViewport] = useState<boolean>(false)

  const addAttachmentByMenu = showChooseFileAttachment && showChooseMediaAttachment

  function onChange(editorState: any) {
    setRealEditorState(editorState)
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

  const handleSendTypingState = (typingState: boolean, code?: string) => {
    if (code) {
      const isTypeKeyPressed = checkIsTypeKeyPressed(code)
      if (!isTypeKeyPressed) {
        return
      }
    }
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

  const handleDoubleClick = (e: any) => {
    if (e.target.matches('.mention') || e.target.closest('.mention')) {
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(e.target)
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }

  const handleSendEditMessage = (
    event?: any,
    pollDetails?: {
      name: string
      options: { id: string; name: string }[]
      anonymous: boolean
      allowMultipleVotes: boolean
      allowVoteRetract: boolean
      id: string
    }
  ) => {
    const { shiftKey, type, code } = event
    const isEnter: boolean = (code === 'Enter' || code === 'NumpadEnter') && shiftKey === false
    const isPoll = pollDetails && pollDetails.options.length > 0 && pollDetails.name.trim()
    const messageTextForSend = isPoll ? pollDetails?.name.trim() : messageText.trim()
    const shouldSend =
      (isEnter || type === 'click') &&
      (messageToEdit || messageTextForSend || (attachments.length && attachments.length > 0))
    if (isEnter) {
      event.preventDefault()
      if (!messageTextForSend?.trim() && !attachments.length && !messageToEdit) {
        setShouldClearEditor({ clear: true })
      }
    }

    if (shouldSend && !mentionsIsOpen) {
      event.preventDefault()
      event.stopPropagation()
      if (messageToEdit) {
        handleEditMessage()
      } else if (messageTextForSend?.trim() || (attachments.length && attachments.length > 0)) {
        const messageTexToSend = messageTextForSend?.trim()
        const messageToSend: any = {
          // metadata: mentionedUsersPositions,
          body: messageTexToSend,
          // body: 'test message',
          bodyAttributes: messageBodyAttributes,
          mentionedUsers: [],
          attachments: [],
          type: 'text'
        }
        const mentionUsersToSend: any = []
        if (messageBodyAttributes && messageBodyAttributes.length) {
          messageBodyAttributes.forEach((att: any) => {
            if (att.type === 'mention') {
              // let mentionsToFind = [...mentionedUsers]
              // const draftMessage = getDraftMessageFromMap(activeChannel.id)
              // if (draftMessage) {
              //   mentionsToFind = [...draftMessage.mentionedUsers, ...mentionedUsers]
              // }
              // const mentionToAdd = mentionsToFind.find((mention: any) => mention.id === att.metadata)
              // mentionUsersToSend.push(mentionToAdd)
              mentionUsersToSend.push({ id: att.metadata })
            }
          })
        }
        messageToSend.mentionedUsers = mentionUsersToSend

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
        if (messageTexToSend?.trim() && !attachments.length) {
          if (linkAttachment) {
            messageToSend.attachments = [linkAttachment]
          }
          if (isPoll) {
            messageToSend.pollDetails = pollDetails
            messageToSend.type = 'poll'
            messageToSend.body = messageTextForSend?.trim()
          }
          dispatch(sendTextMessageAC(messageToSend, activeChannel.id, connectionStatus))
        }
        if (attachments.length) {
          const sendAsSeparateMessage = getSendAttachmentsAsSeparateMessages()
          messageToSend.attachments = attachments.map((attachment: any) => {
            return {
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
          })
          // if (!sendAsSeparateMessage) {
          const attachmentsToSent = [...messageToSend.attachments]
          if (linkAttachment) {
            attachmentsToSent.push(linkAttachment)
          }
          dispatch(
            sendMessageAC(
              { ...messageToSend, attachments: attachmentsToSent },
              activeChannel.id,
              connectionStatus,
              sendAsSeparateMessage
            )
          )
          // }
        }
        setMessageText('')

        fileUploader.current.value = ''
        if (inTypingState) {
          handleSendTypingState(false)
        }
        clearTimeout(typingTimout)
        setTypingTimout(undefined)
      }
      setAttachments([])
      attachmentsUpdate = []
      handleCloseReply()
      setShouldClearEditor({ clear: true })
      setMentionedUsers([])
      setMessageBodyAttributes([])
      dispatch(setCloseSearchChannelsAC(true))
    } else {
      if (typingTimout) {
        if (!inTypingStateTimout) {
          handleSendTypingState(true, code)
        }
        clearTimeout(typingTimout)
      } else {
        handleSendTypingState(true, code)
      }

      setTypingTimout(
        setTimeout(() => {
          setTypingTimout(0)
        }, 2000)
      )
    }
  }

  const handleEditMessage = () => {
    const messageTexToSend = editMessageText.trim()
    if (messageTexToSend) {
      let linkAttachment: any
      if (messageTexToSend) {
        const linkify = new LinkifyIt()
        const match = linkify.match(messageTexToSend)
        if (match) {
          linkAttachment = {
            type: attachmentTypes.link,
            data: match[0].url,
            upload: false
          }
        }
      }
      const mentionedUsersPositions: any = []
      const mentionUsersToSend: any = []
      if (mentionedUsers && mentionedUsers.length) {
        if (messageBodyAttributes && messageBodyAttributes.length) {
          messageBodyAttributes.forEach((att: any) => {
            if (att.type === 'mention') {
              let mentionsToFind = [...mentionedUsers]
              const draftMessage = getDraftMessageFromMap(activeChannel.id)
              if (draftMessage) {
                mentionsToFind = [...draftMessage.mentionedUsers, ...mentionedUsers]
              }
              const mentionToAdd = mentionsToFind.find((mention: any) => mention.id === att.metadata)
              mentionUsersToSend.push(mentionToAdd)
            }
          })
        }
      }
      const messageToSend = {
        ...messageToEdit,
        ...(linkAttachment ? { attachments: [linkAttachment] } : {}),
        metadata: mentionedUsersPositions,
        bodyAttributes: messageBodyAttributes,
        mentionedUsers: mentionUsersToSend,
        body: messageTexToSend
      }
      messageToSend.type = /(https?:\/\/[^\s]+)/.test(messageToSend.body) ? 'link' : messageToSend.type
      dispatch(editMessageAC(activeChannel.id, messageToSend))
    }
    handleCloseEditMode()
  }

  const handleCloseEditMode = () => {
    setEditMessageText('')
    setMentionedUsers([])
    dispatch(setMessageToEditAC(null))
  }

  const removeUpload = (attachmentId: string) => {
    if (attachmentId) {
      const updatedAttachments = attachmentsUpdate.filter((item: any) => item.tid !== attachmentId)
      deleteVideoThumb(attachmentId)
      setAttachments(updatedAttachments)
      attachmentsUpdate = updatedAttachments
    } else {
      setAttachments([])
      attachmentsUpdate = []
    }
  }

  const showFileUploadError = (message: string) => {
    setUploadErrorMessage(message)
    setTimeout(() => {
      setUploadErrorMessage('')
    }, 3000)
  }

  const handleFileUpload = (e: any) => {
    const isMediaAttachment = e.target.accept === mediaExtensions
    const fileList = Object.values(e.target.files)

    fileList.forEach(async (file: any) => {
      let allowUpload = true
      let errorMessage = ''
      if (isMediaAttachment) {
        if (mediaAttachmentSizeLimit && file.size / 1024 > mediaAttachmentSizeLimit) {
          allowUpload = false
          errorMessage =
            attachmentSizeLimitErrorMessage ?? `File size exceeds the limit of ${mediaAttachmentSizeLimit} KB.`
        }
        if (allowedMediaExtensions?.length) {
          const fileName = file.name
          const fileExtension = fileName.split('.').pop().toLowerCase()

          if (!allowedMediaExtensions.includes(fileExtension)) {
            allowUpload = false
            errorMessage =
              allowedMediaExtensionsErrorMessage ??
              `Invalid file type. Allowed extensions are: ${allowedMediaExtensions.join(', ')}.`
          }
        }
      }
      if (allowUpload) {
        handleAddAttachment(file, isMediaAttachment)
      } else {
        showFileUploadError(errorMessage)
      }
    })

    fileUploader.current.value = ''
  }

  const onOpenFileUploader = (attachmentType: string) => {
    setShowChooseAttachmentType(false)
    fileUploader.current.accept = attachmentType
    fileUploader.current.click()
  }

  const handleOpenPoll = () => {
    setShowPoll(true)
  }

  const handlePastAttachments = (e: any) => {
    // Allow pasting into explicit allow-paste inputs (e.g., poll popup fields)
    const target = e.target as HTMLElement
    if (target && (target as any).dataset && (target as any).dataset.allowPaste === 'true') {
      return
    }
    const os = detectOS()
    if (!(os === 'Windows' && browser === 'Firefox')) {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault()
        const fileList: File[] = Object.values(e.clipboardData.files)
        fileList.forEach(async (file: any) => {
          let allowUpload = true
          let errorMessage = ''
          if (mediaAttachmentSizeLimit && file.size / 1024 > mediaAttachmentSizeLimit) {
            allowUpload = false
            errorMessage =
              attachmentSizeLimitErrorMessage ?? `File size exceeds the limit of ${mediaAttachmentSizeLimit} KB.`
          }
          if (allowedMediaExtensions?.length) {
            const fileName = file.name
            const fileExtension = fileName.split('.').pop().toLowerCase()

            if (!allowedMediaExtensions.includes(fileExtension)) {
              allowUpload = false
              errorMessage =
                allowedMediaExtensionsErrorMessage ??
                `Invalid file type. Allowed extensions are: ${allowedMediaExtensions.join(', ')}.`
            }
          }
          if (allowUpload) {
            handleAddAttachment(file, true)
          } else {
            showFileUploadError(errorMessage)
          }
        })
      } else {
        e.preventDefault()
      }
    }
  }

  const handleCut = () => {
    setMessageText('')
    setMentionedUsers([])
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
    deletePendingMessage(activeChannel.id, message)
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
    setMentionedUsers((prevState: any[]) => [...prevState, mentionMember])
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
        log.error('error in get data from db . . . . ', e)
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
            const { thumbnail, imageWidth, imageHeight } = await createImageThumbnail(file)
            setAttachments((prevState: any[]) => [
              ...prevState,
              {
                data: file,
                cachedUrl,
                upload: false,
                type: isMediaAttachment ? fileType : 'file',
                attachmentUrl: URL.createObjectURL(resizedFile.blob as any),
                tid,
                size: isMediaAttachment ? (resizedFile?.blob ? resizedFile?.blob?.size : file.size) : file.size,
                metadata: {
                  ...(dataFromDb && dataFromDb.metadata),
                  szw: imageWidth,
                  szh: imageHeight,
                  tmb: thumbnail
                }
              }
            ])
          })
        } else if (fileType === 'video') {
          const { thumb, width, height } = await getFrame(URL.createObjectURL(file as any), 0)
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
              metadata: {
                ...(dataFromDb && dataFromDb.metadata),
                szw: width,
                szh: height,
                tmb: thumb
              }
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
            metas.tmb = thumb
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
      log.info(' error on read file onError', e)
    }
    reader.readAsBinaryString(file)
  }

  useEffect(() => {
    if (typingTimout === 0) {
      handleSendTypingState(false)
    }
  }, [typingTimout])

  useEffect(() => {
    if (allowedMediaExtensions?.length) {
      setMediaExtensions(`.${allowedMediaExtensions.join(',.')}`)
    }
  }, [allowedMediaExtensions])

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
      const isMediaAttachment = draggedAttachments[0].attachmentType === 'media'
      attachmentsFiles.forEach(async (file: any) => {
        let allowUpload = true
        let errorMessage = ''

        if (isMediaAttachment) {
          if (mediaAttachmentSizeLimit && file.size / 1024 > mediaAttachmentSizeLimit) {
            allowUpload = false
            errorMessage =
              attachmentSizeLimitErrorMessage ?? `File size exceeds the limit of ${mediaAttachmentSizeLimit} KB.`
          }
          if (allowedMediaExtensions?.length) {
            const fileName = file.name
            const fileExtension = fileName.split('.').pop().toLowerCase()

            if (!allowedMediaExtensions.includes(fileExtension)) {
              allowUpload = false
              errorMessage =
                allowedMediaExtensionsErrorMessage ??
                `Invalid file type. Allowed extensions are: ${allowedMediaExtensions.join(', ')}.`
            }
          }
        }

        if (allowUpload) {
          handleAddAttachment(file, isMediaAttachment)
        } else {
          showFileUploadError(errorMessage)
        }
      })
      dispatch(setDraggedAttachmentsAC([], ''))
    }
  }, [draggedAttachments])

  const sendRecordedFile = (recordedFile: any, id: string) => {
    if (recordedFile) {
      const tid = uuidv4()
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

        setPendingAttachment(tid, { file: recordedFile, checksum: checksumHash })
        const messageToSend = {
          metadata: '',
          body: '',
          mentionedUsers: [],
          attachments: [
            {
              name: `${uuidv4()}.mp3`,
              data: recordedFile.file,
              tid,
              upload: true,
              size: recordedFile.file.size,
              attachmentUrl: recordedFile.objectUrl,
              metadata: JSON.stringify({ tmb: recordedFile.thumb, dur: recordedFile.dur }),
              type: attachmentTypes.voice
            }
          ],
          type: 'text'
        }
        dispatch(sendMessageAC(messageToSend, id, connectionStatus))
      }

      reader.onerror = (e: any) => {
        log.info(' error on read file onError', e)
      }
      reader.readAsBinaryString(recordedFile.file)
    }
  }

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
      attachmentsUpdate = []
      handleCloseEditMode()
      clearTimeout(typingTimout)

      const draftMessage = getDraftMessageFromMap(activeChannel.id)
      if (draftMessage) {
        if (draftMessage.messageForReply) {
          dispatch(setMessageForReplyAC(draftMessage.messageForReply))
        }
        setMessageText(draftMessage.text)
        setMentionedUsers(draftMessage.mentionedUsers)
      }
      setShouldClearEditor({ clear: true, draftMessage })
    }
    if (activeChannel.id) {
      prevActiveChannelId = activeChannel.id
    }

    if (activeChannel.id) {
      dispatch(getMembersAC(activeChannel.id))
    }
    setMentionedUsers([])
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
          if ((att.type === 'video' || att.data.type.split('/')[0] === 'video') && att.type !== 'file') {
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
      if (editMessageText) {
        if (
          editMessageText.trim() !== messageToEdit.body ||
          !compareMessageBodyAttributes(messageBodyAttributes, messageToEdit.bodyAttributes)
        ) {
          setSendMessageIsActive(true)
        } else {
          setSendMessageIsActive(false)
        }
      } else {
        setSendMessageIsActive(false)
      }
    }

    if (messageText.trim()) {
      const draftMessage = getDraftMessageFromMap(activeChannel.id)
      if (draftMessage && draftMessage.mentionedUsers && draftMessage.mentionedUsers.length) {
        setDraftMessageToMap(activeChannel.id, {
          text: messageText,
          mentionedUsers: draftMessage.mentionedUsers,
          messageForReply,
          editorState: realEditorState,
          bodyAttributes: messageBodyAttributes
        })
      } else {
        setDraftMessageToMap(activeChannel.id, {
          text: messageText,
          mentionedUsers,
          messageForReply,
          editorState: realEditorState,
          bodyAttributes: messageBodyAttributes
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
  }, [messageText, attachments, editMessageText, readyVideoAttachments, messageBodyAttributes, messageToEdit])

  useDidUpdate(() => {
    if (mentionedUsers && mentionedUsers.length) {
      setDraftMessageToMap(activeChannel.id, {
        text: messageText,
        mentionedUsers,
        messageForReply,
        bodyAttributes: messageBodyAttributes
      })
    }
  }, [mentionedUsers])

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
    attachmentsUpdate = attachments
  }, [attachments])

  useEffect(() => {
    if (emojiBtnRef.current && messageInputRef.current) {
      const windowHeight = window.innerHeight
      const { left, width, top } = emojiBtnRef.current.getBoundingClientRect()
      setEmojisPopupBottomPosition(windowHeight - top)
      setEmojisPopupLeftPosition(left - width / 2)
      if (emojiBtnRef.current.getBoundingClientRect().left > messageInputRef.current.getBoundingClientRect().left) {
        setEmojisInRightSide(true)
      }
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
      setDraftMessageToMap(activeChannel.id, {
        text: messageText,
        mentionedUsers,
        messageForReply,
        bodyAttributes: messageBodyAttributes
      })
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
    } else {
      setShouldClearEditor({ clear: true })
    }
    if (messageContRef && messageContRef.current) {
      dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
    }
  }, [messageToEdit])

  useEffect(() => {
    setBrowser(detectBrowser())
    if (handleSendMessage) {
      setSendMessageHandler(handleSendMessage)
    }
    let inputHeightTimeout: any = null
    if (messageContRef && messageContRef.current) {
      inputHeightTimeout = setTimeout(() => {
        const inputContHeight = messageContRef.current.getBoundingClientRect().height
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

  const typingOrRecording = useMemo(() => {
    const dataValues = typingOrRecordingIndicator ? Object.values(typingOrRecordingIndicator) : []
    const filteredItems = dataValues.filter((item: any) => item.typingState || item.recordingState)
    return {
      items: filteredItems,
      isTyping: !!filteredItems.find((item: any) => item.typingState),
      isRecording: !!filteredItems.find((item: any) => item.recordingState)
    }
  }, [typingOrRecordingIndicator])

  const formatTypingIndicatorText = (users: any[], maxShownUsers: number = 3) => {
    if (users.length === 0) return ''
    if (users.length === 1) {
      const user = users[0]
      const userName = makeUsername(
        getFromContacts && user.from && contactsMap[user.from.id],
        user.from,
        getFromContacts
      )
      return `${userName}${
        typingOrRecording?.isTyping
          ? activeChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT
            ? ' is typing'
            : ''
          : activeChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT
            ? ' is recording'
            : ''
      }`
    }

    if (users.length <= maxShownUsers) {
      const userNames = users.map((user) =>
        makeUsername(getFromContacts && user.from && contactsMap[user.from.id], user.from, getFromContacts)
      )
      return userNames.join(', ')
    } else {
      const firstNames = users
        .slice(0, maxShownUsers)
        .map((user) =>
          makeUsername(getFromContacts && user.from && contactsMap[user.from.id], user.from, getFromContacts)
        )
      const othersCount = users.length - maxShownUsers

      return `${firstNames
        .map((name, index) => `${name}${index < firstNames.length - 1 ? ', ' : ''}`)
        .join('')} and ${othersCount} other${othersCount > 1 ? 's' : ''}`
    }
  }

  const isPollMessageSelected = useMemo(() => {
    return selectedMessagesMap?.values()?.some((message: IMessage) => message.type === MESSAGE_TYPE.POLL)
  }, [selectedMessagesMap])

  return (
    <SendMessageWrapper backgroundColor={backgroundColor || background}>
      <Container
        margin={margin}
        padding={padding}
        border={border}
        ref={messageContRef}
        mentionColor={accentColor}
        toolBarTop={selectedText && selectedText.current ? selectedText.current.top : ''}
        toolBarLeft={selectedText && selectedText.current ? selectedText.current.left : ''}
        selectionBackgroundColor={textSelectionBackgroundColor || background}
      >
        {uploadErrorMessage && <UploadErrorMessage color={errorColor}>{uploadErrorMessage}</UploadErrorMessage>}
        {selectedMessagesMap && selectedMessagesMap.size > 0 ? (
          <SelectedMessagesWrapper>
            <MessageCountWrapper color={textPrimary}>
              {selectedMessagesMap.size} {selectedMessagesMap.size > 1 ? ' messages selected' : ' message selected'}
            </MessageCountWrapper>
            {!isPollMessageSelected && (
              <CustomButton
                onClick={handleToggleForwardMessagePopup}
                backgroundColor={backgroundHovered}
                marginLeft='32px'
                color={textPrimary}
              >
                <ForwardIcon />
                Forward
              </CustomButton>
            )}
            <CustomButton
              onClick={handleToggleDeleteMessagePopup}
              color={errorColor}
              backgroundColor={backgroundHovered}
              marginLeft='16px'
            >
              <DeleteIcon />
              Delete
            </CustomButton>
            <CloseIconWrapper onClick={handleCloseSelectMessages} color={textPrimary}>
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
                isDirectChannel={activeChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT}
                title={`Delete message${selectedMessagesMap.size > 1 ? 's' : ''}`}
              />
            )}
          </SelectedMessagesWrapper>
        ) : (
          <React.Fragment>
            {!activeChannel.id ? (
              <Loading />
            ) : isBlockedUserChat || isDeletedUserChat || disableInput ? (
              <React.Fragment>
                {disableInput && CustomDisabledInput ? (
                  <CustomDisabledInput />
                ) : (
                  <BlockedUserInfo color={textPrimary}>
                    <BlockInfoIcon />{' '}
                    {isDeletedUserChat
                      ? 'This user has been deleted.'
                      : disableInput
                        ? "Sender doesn't support replies"
                        : 'You blocked this user.'}
                  </BlockedUserInfo>
                )}
              </React.Fragment>
            ) : !activeChannel.userRole && activeChannel.type !== DEFAULT_CHANNEL_TYPE.DIRECT ? (
              <JoinChannelCont backgroundColor={backgroundSections} onClick={handleJoinToChannel} color={accentColor}>
                Join
              </JoinChannelCont>
            ) : (
                activeChannel.type === DEFAULT_CHANNEL_TYPE.BROADCAST ||
                activeChannel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                  ? !(activeChannel.userRole === 'admin' || activeChannel.userRole === 'owner')
                  : activeChannel.type !== DEFAULT_CHANNEL_TYPE.DIRECT && !checkActionPermission('sendMessage')
              ) ? (
              <ReadOnlyCont color={textPrimary} iconColor={accentColor}>
                <EyeIcon /> Read only
              </ReadOnlyCont>
            ) : (
              <React.Fragment>
                {showPoll && (
                  <CreatePollPopup
                    togglePopup={() => setShowPoll(false)}
                    onCreate={(event, payload) => {
                      handleSendEditMessage(event, payload)
                    }}
                  />
                )}
                <TypingIndicator>
                  {typingOrRecording?.items.length > 0 &&
                    (CustomTypingIndicator ? (
                      <CustomTypingIndicator
                        from={typingOrRecording?.items.map((item: any) => ({
                          id: item.from.id,
                          name: item.from.name,
                          typingState: item.typingState,
                          recordingState: item.recordingState
                        }))}
                      />
                    ) : (
                      <TypingIndicatorCont>
                        <TypingFrom color={textSecondary}>
                          {formatTypingIndicatorText(typingOrRecording?.items, 3)}
                        </TypingFrom>
                        {typingOrRecording?.isTyping ? (
                          <TypingAnimation borderColor={iconInactive}>
                            <DotOne />
                            <DotTwo />
                            <DotThree />
                          </TypingAnimation>
                        ) : (
                          <RecordingAnimation borderColor={iconInactive} />
                        )}
                      </TypingIndicatorCont>
                    ))}
                </TypingIndicator>
                {messageToEdit && (
                  <EditReplyMessageCont
                    width={replyEditMessageContainerWidth}
                    borderRadius={replyEditMessageContainerBorderRadius}
                    left={replyEditMessageContainerLeftPosition}
                    bottom={replyEditMessageContainerBottomPosition}
                    padding={replyEditMessageContainerPadding}
                    color={editMessageTextColor || textPrimary}
                    backgroundColor={editMessageBackgroundColor || surface1Background}
                  >
                    <CloseEditMode color={textSecondary} onClick={handleCloseEditMode}>
                      <CloseIcon />
                    </CloseEditMode>
                    <EditReplyMessageHeader color={accentColor}>
                      {editMessageIcon || <EditIcon />}
                      Edit Message
                    </EditReplyMessageHeader>
                    <EditMessageText>
                      {MessageTextFormat({
                        text: messageToEdit.body,
                        message: messageToEdit,
                        contactsMap,
                        getFromContacts,
                        asSampleText: true,
                        accentColor,
                        textSecondary
                      })}
                    </EditMessageText>
                  </EditReplyMessageCont>
                )}
                {messageForReply && (
                  <EditReplyMessageCont
                    width={replyEditMessageContainerWidth}
                    borderRadius={replyEditMessageContainerBorderRadius}
                    bottom={replyEditMessageContainerBottomPosition}
                    left={replyEditMessageContainerLeftPosition}
                    padding={replyEditMessageContainerPadding}
                    color={replyMessageTextColor || textPrimary}
                    backgroundColor={replyMessageBackgroundColor || surface1Background}
                  >
                    <CloseEditMode color={textSecondary} onClick={handleCloseReply}>
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
                            <ReplyIconWrapper backgroundColor={accentColor} iconColor={textOnPrimary}>
                              <ChooseFileIcon />
                            </ReplyIconWrapper>
                          )
                        ))}
                      <ReplyMessageBody linkColor={accentColor}>
                        <EditReplyMessageHeader color={accentColor}>
                          {replyMessageIcon || <ReplyIcon />} Reply to
                          <UserName>
                            {user.id === messageForReply.user.id
                              ? user.firstName
                                ? `${user.firstName} ${user.lastName}`
                                : user.id
                              : makeUsername(
                                  contactsMap[messageForReply.user.id],
                                  messageForReply.user,
                                  getFromContacts
                                )}
                          </UserName>
                        </EditReplyMessageHeader>
                        {messageForReply.attachments && messageForReply.attachments.length ? (
                          messageForReply.attachments[0].type === attachmentTypes.voice ? (
                            'Voice'
                          ) : messageForReply.body &&
                            messageForReply.bodyAttributes &&
                            messageForReply.bodyAttributes.length > 0 ? (
                            MessageTextFormat({
                              text: messageForReply.body,
                              message: {
                                ...messageForReply,
                                mentionedUsers:
                                  messageForReply.mentionedUsers && messageForReply.mentionedUsers.length > 0
                                    ? messageForReply.mentionedUsers
                                    : activeChannelMembers &&
                                        messageForReply.bodyAttributes &&
                                        messageForReply.bodyAttributes.length > 0
                                      ? messageForReply.bodyAttributes
                                          .filter((attr: any) => attr.type.includes('mention'))
                                          .map((attr: any) => {
                                            const member = activeChannelMembers.find((m: any) => m.id === attr.metadata)
                                            return member || null
                                          })
                                          .filter((m: IMember | null): m is IMember => m !== null)
                                      : messageForReply.mentionedUsers || [],
                                channel: activeChannelMembers ? { members: activeChannelMembers } : undefined
                              },
                              contactsMap,
                              getFromContacts,
                              accentColor,
                              textSecondary
                            })
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
                            getFromContacts,
                            accentColor,
                            textSecondary
                          })
                        )}
                      </ReplyMessageBody>
                    </ReplyMessageCont>
                  </EditReplyMessageCont>
                )}

                {!!attachments.length && !sendAttachmentSeparately && (
                  <ChosenAttachments>
                    {[...attachments].map((attachment: any) => (
                      <div key={attachment.tid}>
                        <Attachment
                          attachment={attachment}
                          isPreview
                          removeSelected={removeUpload}
                          key={attachment.tid}
                          setVideoIsReadyToSend={setVideoIsReadyToSend}
                          borderRadius={selectedAttachmentsBorderRadius}
                          selectedFileAttachmentsIcon={selectedFileAttachmentsIcon}
                          backgroundColor={selectedFileAttachmentsBoxBackground || backgroundSections}
                          selectedFileAttachmentsBoxBorder={selectedFileAttachmentsBoxBorder}
                          selectedFileAttachmentsTitleColor={selectedFileAttachmentsTitleColor}
                          selectedFileAttachmentsSizeColor={selectedFileAttachmentsSizeColor}
                        />
                      </div>
                    ))}
                  </ChosenAttachments>
                )}
                <SendMessageInputContainer iconColor={accentColor} minHeight={minHeight}>
                  <UploadFile ref={fileUploader} onChange={handleFileUpload} multiple type='file' />
                  {(showRecording || getAudioRecordingFromMap(activeChannel.id)) && !messageToEdit ? (
                    <AudioCont />
                  ) : (
                    <MessageInputWrapper
                      className='message_input_wrapper'
                      borderRadius={
                        messageForReply || messageToEdit ? borderRadiusOnOpenedEditReplyMessage : borderRadius
                      }
                      ref={inputWrapperRef}
                      backgroundColor={inputBackgroundColor || surface1Background}
                      channelDetailsIsOpen={channelDetailsIsOpen}
                      messageInputOrder={inputOrder}
                      messageInputPaddings={inputPaddings}
                    >
                      {showAddEmojis && (
                        <EmojiButton
                          order={emojiIcoOrder}
                          isEmojisOpened={isEmojisOpened}
                          ref={emojiBtnRef}
                          color={iconInactive}
                          hoverColor={accentColor}
                          height={inputContainerHeight || minHeight}
                          onClick={() => {
                            setIsEmojisOpened(!isEmojisOpened)
                          }}
                        >
                          {AddEmojisIcon || <EmojiSmileIcon />}
                        </EmojiButton>
                      )}
                      {showAddAttachments && addAttachmentByMenu ? (
                        <DropDown
                          theme={theme}
                          forceClose={showChooseAttachmentType}
                          position={addAttachmentsInRightSide ? 'top' : 'topRight'}
                          margin='auto 0 0'
                          order={attachmentIcoOrder}
                          trigger={
                            <AddAttachmentIcon
                              ref={addAttachmentsBtnRef}
                              color={iconInactive}
                              hoverColor={accentColor}
                              height={inputContainerHeight || minHeight}
                            >
                              {AddAttachmentsIcon || <AttachmentIcon />}
                            </AddAttachmentIcon>
                          }
                        >
                          <DropdownOptionsUl>
                            {showChooseMediaAttachment && (
                              <DropdownOptionLi
                                key={1}
                                textColor={textPrimary}
                                hoverBackground={backgroundHovered}
                                onClick={() => onOpenFileUploader(mediaExtensions)}
                                iconWidth='20px'
                                iconColor={iconInactive}
                              >
                                <ChooseMediaIcon />
                                {chooseMediaAttachmentText ?? 'Photo or video'}
                              </DropdownOptionLi>
                            )}
                            {showChooseFileAttachment && (
                              <DropdownOptionLi
                                key={2}
                                textColor={textPrimary}
                                hoverBackground={backgroundHovered}
                                onClick={() => onOpenFileUploader('')}
                                iconWidth='20px'
                                iconColor={iconInactive}
                              >
                                <ChooseFileIcon />
                                {chooseFileAttachmentText ?? 'File'}
                              </DropdownOptionLi>
                            )}
                            {pollOptions?.showAddPoll && (
                              <DropdownOptionLi
                                key={3}
                                textColor={textPrimary}
                                hoverBackground={backgroundHovered}
                                onClick={handleOpenPoll}
                                iconWidth='20px'
                                iconColor={iconInactive}
                              >
                                <PollIcon />
                                {pollOptions?.choosePollText ?? 'Poll'}
                              </DropdownOptionLi>
                            )}
                          </DropdownOptionsUl>
                        </DropDown>
                      ) : (
                        (showChooseMediaAttachment || showChooseFileAttachment) && (
                          <AddAttachmentIcon
                            ref={addAttachmentsBtnRef}
                            color={iconInactive}
                            hoverColor={accentColor}
                            height={inputContainerHeight || minHeight}
                            onClick={() => onOpenFileUploader(showChooseMediaAttachment ? mediaExtensions : '')}
                          >
                            {AddAttachmentsIcon || <AttachmentIcon />}
                          </AddAttachmentIcon>
                        )
                      )}
                      <LexicalWrapper
                        ref={messageInputRef}
                        order={inputOrder}
                        paddings={inputPaddings}
                        mentionColor={accentColor}
                        className={inputCustomClassname}
                        highlightedBackground={textSelectionBackgroundColor || highlightedBackground}
                        borderRadius={inputBorderRadius}
                        color={textPrimary}
                      >
                        <LexicalComposer initialConfig={initialConfig}>
                          <AutoFocusPlugin messageForReply={messageForReply} />
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
                            setMentionedMember={setMentionedUsers}
                          />
                          <FormatMessagePlugin
                            editorState={realEditorState}
                            setMessageBodyAttributes={setMessageBodyAttributes}
                            setMessageText={messageToEdit ? setEditMessageText : setMessageText}
                            messageToEdit={messageToEdit}
                            activeChannelMembers={activeChannelMembers}
                            contactsMap={contactsMap}
                            getFromContacts={getFromContacts}
                            setMentionedMember={handleSetMentionMember}
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
                                setMentionsIsOpen={setMentionsIsOpen}
                              />
                            )}
                            <HistoryPlugin />
                            <RichTextPlugin
                              contentEditable={
                                <div
                                  onKeyDown={handleSendEditMessage}
                                  onDoubleClick={handleDoubleClick}
                                  className='rich_text_editor'
                                  ref={onRef}
                                >
                                  <ContentEditable className='content_editable_input' />
                                </div>
                              }
                              placeholder={
                                <Placeholder color={placeholderTextColor || textFootnote} paddings={inputPaddings}>
                                  {placeholderText || 'Type message here ...'}
                                </Placeholder>
                              }
                              ErrorBoundary={LexicalErrorBoundary}
                            />
                            {floatingAnchorElem && !isSmallWidthViewport && allowTextEdit && (
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
                  )}

                  {sendMessageIsActive ||
                  (!voiceMessage && !getAudioRecordingFromMap(activeChannel?.id)?.file) ||
                  messageToEdit ? (
                    <SendMessageButton
                      isCustomButton={CustomSendMessageButton}
                      isActive={sendMessageIsActive}
                      order={sendIconOrder}
                      color={backgroundSections}
                      height={inputContainerHeight || minHeight}
                      onClick={sendMessageIsActive ? handleSendEditMessage : null}
                      iconColor={accentColor}
                      activeColor={accentColor}
                    >
                      {CustomSendMessageButton || <SendIcon />}
                    </SendMessageButton>
                  ) : (
                    <SendMessageButton
                      isActive={true}
                      order={sendIconOrder}
                      height={inputContainerHeight || minHeight}
                      color={accentColor}
                      iconColor={accentColor}
                      activeColor={accentColor}
                    >
                      <AudioRecord
                        sendRecordedFile={sendRecordedFile}
                        setShowRecording={setShowRecording}
                        showRecording={showRecording}
                        channelId={activeChannel.id}
                        maxRecordingDuration={audioRecordingMaxDuration}
                      />
                    </SendMessageButton>
                  )}
                </SendMessageInputContainer>
              </React.Fragment>
            )}
          </React.Fragment>
        )}
      </Container>
    </SendMessageWrapper>
  )
}

const SendMessageWrapper = styled.div<{ backgroundColor: string }>`
  background-color: ${(props) => props.backgroundColor};
  position: relative;
  z-index: 100;
`
const Container = styled.div<{
  margin?: string
  padding?: string
  border?: string
  borderRadius?: string
  ref?: any
  height?: number
  mentionColor: string
  toolBarTop: string
  toolBarLeft: string
  selectionBackgroundColor: string
}>`
  margin: ${(props) => props.margin || '30px 0 16px'};
  border: ${(props) => props.border || ''};
  border-radius: ${(props) => props.borderRadius || '4px'};
  position: relative;
  padding: ${(props) => props.padding || '0 calc(4% + 32px)'};
  z-index: 100;

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
      color: ${(props) => props.mentionColor};
    }
  }
`

const EditReplyMessageCont = styled.div<{
  backgroundColor: string
  color: string
  width?: string
  borderRadius?: string
  left?: string
  bottom?: string
  padding?: string
}>`
  position: relative;
  left: ${(props) => props.left || '0'};
  bottom: ${(props) => props.bottom || '0'};
  width: ${(props) => props.width || 'calc(100% - 82px)'};
  border-radius: ${(props) => props.borderRadius || '18px 18px 0 0'};
  padding: ${(props) => props.padding || '8px 16px 12px'};
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
  background-color: ${(props) => props.backgroundColor};
  z-index: 19;
  box-sizing: content-box;
`

const EditMessageText = styled.p<any>`
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
`
const UploadErrorMessage = styled.p<{ color: string }>`
  margin: 0;
  position: absolute;
  top: -30px;
  color: ${(props) => props.color};
`

const CloseEditMode = styled.span<{ color: string }>`
  position: absolute;
  top: 8px;
  right: 12px;
  width: 20px;
  height: 20px;
  text-align: center;
  line-height: 22px;
  cursor: pointer;

  & > svg {
    color: ${(props) => props.color};
  }
`

const UserName = styled.span<any>`
  font-weight: 500;
  margin-left: 4px;
`

const ReplyMessageBody = styled.div<{ linkColor: string }>`
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  a {
    color: ${(props) => props.linkColor};
  }
`

const EditReplyMessageHeader = styled.h4<{ color: string }>`
  display: flex;
  margin: 0 0 2px;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};

  > svg {
    margin-right: 4px;
    width: 16px;
    height: 16px;
  }
`

const AddAttachmentIcon = styled.span<{
  color: string
  hoverColor: string
  height?: number
  order?: number
  isActive?: boolean
}>`
  display: flex;
  height: ${(props) => (props.height ? `${props.height}px` : '36px')};
  align-items: center;
  margin: 0 8px;
  cursor: pointer;
  line-height: 13px;
  z-index: 2;
  order: ${(props) => (props.order === 0 || props.order ? props.order : 1)};

  > svg {
    ${(props) => (props.isActive ? `color: ${props.hoverColor};` : `color: ${props.color};`)};
    width: 24px;
  }

  &:hover > svg {
    color: ${(props) => props.hoverColor};
  }
`

const SendMessageInputContainer = styled.div<{ minHeight?: string; iconColor: string; messageForReply?: string }>`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  position: relative;
  min-height: ${(props) => props.minHeight || '36px'};
  box-sizing: border-box;
  border-radius: ${(props) => (props.messageForReply ? '0 0 4px 4px' : '4px')};

  & .dropdown-trigger.open {
    color: #ccc;

    & ${AddAttachmentIcon} {
      & > svg {
        color: ${(props) => props.iconColor};
      }
    ;
    }
  }
}
`

const MessageInputWrapper = styled.div<{
  channelDetailsIsOpen?: boolean
  backgroundColor: string
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
  background-color: ${(props) => props.backgroundColor};
  border-radius: ${(props) => props.borderRadius || '18px'};
  position: relative;
`

const LexicalWrapper = styled.div<{
  order?: number
  color?: string
  borderRadius?: string
  backgroundColor?: string
  paddings?: string
  mentionColor: string
  isChrome?: boolean
  highlightedBackground?: string
}>`
  position: relative;
  width: 100%;

  & .rich_text_editor {
    width: 100%;
    max-height: 80px;
    min-height: 20px;
    display: block;
    border: none;
    box-sizing: border-box;
    outline: none !important;
    overflow: auto;
    border-radius: ${(props) => props.borderRadius};
    background-color: ${(props) => props.backgroundColor};
    padding: ${(props) => props.paddings || '8px 6px'};
    color: ${(props) => props.color};
    order: ${(props) => (props.order === 0 || props.order ? props.order : 1)};

    & p {
      font-size: 15px;
      line-height: 20px;
      color: ${(props) => props.color};
    }

    &::selection {
      background-color: ${(props) => props.highlightedBackground};
    }

    & *::selection {
      background-color: ${(props) => props.highlightedBackground};
    }

    & span::selection {
      background-color: ${(props) => props.highlightedBackground};
    }

    &:empty:before {
      content: attr(data-placeholder);
    }

    & .content_editable_input {
      border: none !important;
      outline: none !important;
    }

    & .mention {
      color: ${(props) => props.mentionColor};
      background-color: inherit !important;
      user-modify: read-only;
    }

    & span.bold {
      font-weight: bold;
    }

    & .editor_paragraph {
      margin: 0;
    }

    & .text_bold {
      font-weight: 600;
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

const Placeholder = styled.span<{ paddings?: string; color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  color: ${(props) => props.color};
  padding: ${(props) => props.paddings || '8px 6px'};
  line-height: 20px;

  @media (max-width: 768px) {
    font-size: 13px;
  }
`

const EmojiButton = styled.span<{
  color: string
  hoverColor: string
  height?: number
  order?: number
  isEmojisOpened?: boolean
}>`
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
    ${(props) => (props.isEmojisOpened ? `color: ${props.hoverColor};` : `color: ${props.color};`)};
    width: 24px;
    height: 24px;
  }

  &:hover > svg {
    color: ${(props) => props.hoverColor};
  }
`

const SendMessageButton = styled.span<{
  height?: string
  isActive?: boolean
  order?: number
  isCustomButton?: any
  onClick?: any
  iconColor: string
  activeColor: string
}>`
  ${(props) =>
    !props.isCustomButton &&
    `
  display: flex;
  height: ${props.height ? `${props.height}px` : '36px'};
  align-items: center;
  // margin: 0 8px 0 auto;
  cursor: ${props.isActive && 'pointer'};
  line-height: 13px;
  order: ${props.order === 0 || props.order ? props.order : 4};
  -webkit-tap-highlight-color: transparent;

  color: ${props.isActive ? props.activeColor : props.color};
  & > svg {
    color: ${props.iconColor};
  }
  `}
`

const AudioCont = styled.div<any>`
  display: flex;
  width: 100%;
  justify-content: flex-end;
`

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
  gap: 4px;
`

const TypingFrom = styled.h5<{ color: string }>`
  margin: 0 4px 0 0;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
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
const TypingAnimation = styled.div<{ borderColor: string }>`
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
      background-color: ${(props) => props.borderColor};
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
const BlockedUserInfo = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  color: ${(props) => props.color};

  & > svg {
    margin-right: 12px;
  }
`
const JoinChannelCont = styled.div<{ backgroundColor: string; color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 -12px;
  padding: 14px;
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
  background-color: ${(props) => props.backgroundColor};
  cursor: pointer;
`
const ReadOnlyCont = styled.div<{ color: string; iconColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};

  & > svg {
    margin-right: 12px;
    color: ${(props) => props.iconColor};
  }
`
const ReplyMessageCont = styled.div`
  display: flex;
`
const ReplyIconWrapper = styled.span<{ backgroundColor: string; iconColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  width: 40px;
  height: 40px;
  background-color: ${(props) => props.backgroundColor};
  border-radius: 50%;

  & > svg {
    width: 20px;
    height: 20px;
    color: ${(props) => props.iconColor};
  }
`

const SelectedMessagesWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
`

const MessageCountWrapper = styled.div<{ color: string }>`
  display: flex;
  justify-content: flex-start;
  min-width: 170.5px;
  color: ${(props) => props.color};
`

const CustomButton = styled.span<{ color: string; backgroundColor: string; marginLeft?: string }>`
  color: ${(props) => props.color};
  padding: 8px 16px;
  background-color: ${(props) => props.backgroundColor};
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

const CloseIconWrapper = styled.span<{ color: string }>`
  display: inline-flex;
  cursor: pointer;
  margin-left: auto;
  padding: 10px;
  color: ${(props) => props.color};
`

export default SendMessageInput
