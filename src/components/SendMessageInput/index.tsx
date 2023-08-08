import React, { FC, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import styled, { keyframes } from 'styled-components'
// import { Editor } from 'react-draft-wysiwyg'
// import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css'
// import { convertToRaw, EditorState } from 'draft-js'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { ReactComponent as SendIcon } from '../../assets/svg/send.svg'
import { ReactComponent as EyeIcon } from '../../assets/svg/eye.svg'
// import { ReactComponent as RecordIcon } from '../../assets/lib/svg/recordButton.svg'
import { ReactComponent as EditIcon } from '../../assets/svg/editIcon.svg'
import { ReactComponent as ReplyIcon } from '../../assets/svg/replyIcon.svg'
import { ReactComponent as AttachmentIcon } from '../../assets/svg/addAttachment.svg'
import { ReactComponent as CloseIcon } from '../../assets/svg/close.svg'
import { ReactComponent as EmojiSmileIcon } from '../../assets/svg/emojiSmileIcon.svg'
import { ReactComponent as ChoseFileIcon } from '../../assets/svg/choseFile.svg'
import { ReactComponent as BlockInfoIcon } from '../../assets/svg/error_circle.svg'
import { ReactComponent as ChoseMediaIcon } from '../../assets/svg/choseMedia.svg'
import { colors } from '../../UIHelper/constants'
import EmojisPopup from '../Emojis'
import Attachment, { AttachmentFile, AttachmentImg } from '../Attachment'
// import { useDidUpdate } from '../../hooks'
import {
  editMessageAC,
  resendMessageAC,
  sendMessageAC,
  sendTextMessageAC,
  setMessageForReplyAC,
  setMessageToEditAC,
  setSendMessageInputHeightAC
} from '../../store/message/actions'
import { detectBrowser, detectOS, getCaretPosition, placeCaretAtEnd, setCursorPosition } from '../../helpers'
import { getDuplicateMentionsFromMeta, makeUsername, MessageTextFormat, typingTextFormat } from '../../helpers/message'
import { DropdownOptionLi, DropdownOptionsUl, TextInOneLine, UploadFile } from '../../UIHelper'
import { messageForReplySelector, messageToEditSelector } from '../../store/message/selector'
import {
  activeChannelSelector,
  channelInfoIsOpenSelector,
  draggedAttachmentsSelector,
  typingIndicatorSelector
} from '../../store/channel/selector'
import { IMember, IMessage, IUser } from '../../types'
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
import { getCustomUploader, getSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import {
  checkDraftMessagesIsEmpty,
  deleteVideoThumb,
  getDraftMessageFromMap,
  getPendingMessagesMap,
  removeDraftMessageFromMap,
  setDraftMessageToMap,
  setPendingAttachment,
  setSendMessageHandler
} from '../../helpers/messagesHalper'
import { attachmentTypes, CHANNEL_TYPE, DB_NAMES, DB_STORE_NAMES } from '../../helpers/constants'
import usePermissions from '../../hooks/usePermissions'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { useDidUpdate } from '../../hooks'
import { getClient } from '../../common/client'
import { CONNECTION_STATUS } from '../../store/user/constants'
import MentionMembersPopup from '../../common/popups/mentions'
import LinkifyIt from 'linkify-it'
import { themeSelector } from '../../store/theme/selector'
import { getDataFromDB } from '../../helpers/indexedDB'
// import { activeChannelMembersSelector } from '../../store/member/selector'

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
  allowMentionUser = true
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
  const messageForReply = useSelector(messageForReplySelector)
  const draggedAttachments = useSelector(draggedAttachmentsSelector)
  // const members = useSelector(activeChannelMembersSelector, shallowEqual)
  const isDirectChannel = activeChannel.type === CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && activeChannel.members.find((member: IMember) => member.id !== user.id)
  const isBlockedUserChat = directChannelUser && directChannelUser.blocked
  const isDeletedUserChat = directChannelUser && directChannelUser.activityState === 'Deleted'
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
  // const [messageTextWs, setMessageTextWs] = useState(EditorState.createEmpty())
  const [editMessageText, setEditMessageText] = useState('')
  const [readyVideoAttachments, setReadyVideoAttachments] = useState({})
  const [showChooseAttachmentType, setShowChooseAttachmentType] = useState(false)
  const [isEmojisOpened, setIsEmojisOpened] = useState(false)
  const [emojisInRightSide, setEmojisInRightSide] = useState(false)
  const [addAttachmentsInRightSide, setAddAttachmentsInRightSide] = useState(false)

  // const [recording, setRecording] = useState<Recording>(recordingInitialState)
  // const [recordedFile, setRecordedFile] = useState<any>(null)

  const [mentionedMembers, setMentionedMembers] = useState<any>([])

  const [mentionedMembersDisplayName, setMentionedMembersDisplayName] = useState<any>({})

  const [currentMentions, setCurrentMentions] = useState<any>(undefined)
  const [pendingMentions, setPendingMentions] = useState<any>([])

  const [mentionTyping, setMentionTyping] = useState(false)

  const [selectionPos, setSelectionPos] = useState<any>()

  const [inputContainerHeight, setInputContainerHeight] = useState<any>()

  const [typingTimout, setTypingTimout] = useState<any>()
  const [inTypingStateTimout, setInTypingStateTimout] = useState<any>()
  const [inTypingState, setInTypingState] = useState(false)
  const [sendMessageIsActive, setSendMessageIsActive] = useState(false)
  const [openMention, setOpenMention] = useState(false)
  const [attachments, setAttachments]: any = useState([])
  const typingIndicator = useSelector(typingIndicatorSelector(activeChannel.id))
  const contactsMap = useSelector(contactsMapSelector)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)
  const fileUploader = useRef<any>(null)
  const inputWrapperRef = useRef<any>(null)
  const messageInputRef = useRef<any>(null)
  const emojiBtnRef = useRef<any>(null)
  const addAttachmentsBtnRef = useRef<any>(null)

  const mediaExtensions = '.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.wmv,.flv,.webm,.jfif'

  /* const onEditorStateChange = (editorState: any) => {
    const entityMap = convertToRaw(messageTextWs.getCurrentContent()).entityMap
    const mentions: any = []

    Object.values(entityMap).forEach((entity) => {
      if (entity.type === 'MENTION') {
        mentions.push(entity.data)
      }
    })
    console.log('mentions . .. . . ', mentions)
    setMessageTextWs(editorState)
  }
*/
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
    dispatch(sendTypingAC(typingState))
  }

  const handleAddEmoji = (emoji: string) => {
    const selPos = getCaretPosition(messageInputRef.current)
    const messageTextToFormat = editMessageText || messageText
    const newText = messageTextToFormat.slice(0, selPos) + emoji + messageTextToFormat.slice(selPos)
    if (editMessageText) {
      setEditMessageText(newText)
    } else {
      setMessageText(newText)
    }
    let editingMentions: any = []
    if (messageToEdit && messageToEdit.mentionedUsers && messageToEdit.mentionedUsers.length > 0) {
      // Get duplicate mentions from metadata
      editingMentions = getDuplicateMentionsFromMeta(messageToEdit.metadata, messageToEdit.mentionedUsers)
    }
    const mentions =
      editingMentions && editingMentions.length ? [...editingMentions, ...mentionedMembers] : mentionedMembers
    if (mentions.length && mentions.length > 0) {
      messageInputRef.current.innerHTML = typingTextFormat({
        text: newText,
        mentionedMembers: [
          ...mentions.map((menMem: any) => ({
            ...menMem,
            displayName: `@${makeUsername(contactsMap[menMem.id], menMem, getFromContacts)}`.trim()
          }))
        ]
      })
    } else {
      messageInputRef.current.innerText = newText
    }
    setCursorPosition(messageInputRef.current, selPos + emoji.length)
  }

  const handleSetMention = (member: IMember) => {
    const mentionDisplayName = makeUsername(
      user.id === member.id ? member : contactsMap[member.id],
      member,
      getFromContacts
    ).trim()
    const mentionToChange = mentionedMembers.find((men: any) => men.start === currentMentions.start)
    if (mentionToChange) {
      setMentionedMembers(
        mentionedMembers.map((menMem: any) => {
          if (menMem.start === currentMentions.start) {
            return {
              ...member,
              start: currentMentions.start,
              end: currentMentions.start + 1 + mentionDisplayName.length
            }
          } else {
            return menMem
          }
        })
      )
      const mentionDisplayNameToChange = { ...mentionedMembersDisplayName }
      delete mentionDisplayNameToChange[mentionToChange.id]
      setMentionedMembersDisplayName(mentionDisplayNameToChange)
    } else {
      setMentionedMembers((members: any) => [
        ...members,
        { ...member, start: currentMentions.start, end: currentMentions.start + 1 + mentionDisplayName.length }
      ])
    }
    if (!mentionedMembersDisplayName[member.id]) {
      setMentionedMembersDisplayName((prevState: any) => ({
        ...prevState,
        [member.id]: { id: member.id, displayName: `@${mentionDisplayName}` }
      }))
    }
    setMentionTyping(false)
    const messageTextToFormat = editMessageText || messageText
    const currentText = `${messageTextToFormat.slice(
      0,
      mentionToChange ? mentionToChange.start + 1 : currentMentions.start + 1
    )}${mentionDisplayName}${messageTextToFormat.slice(
      mentionToChange ? mentionToChange.end : currentMentions.start + 1 + currentMentions.typed.length
    )}`
    const mentionedMembersPositions: any = []
    if (mentionedMembers && mentionedMembers.length > 0) {
      let lastFoundIndex = 0
      const starts: any = {}
      mentionedMembers.forEach((menMem: any) => {
        const mentionDisplayName = `@${makeUsername(contactsMap[menMem.id], menMem, getFromContacts).trim()}`
        const menIndex = currentText.indexOf(mentionDisplayName, lastFoundIndex)
        lastFoundIndex = menIndex + mentionDisplayName.length

        if (!starts[menIndex]) {
          mentionedMembersPositions.push({
            displayName: mentionDisplayName,
            start: menIndex,
            end: menIndex + mentionDisplayName.length
          })
        }
        starts[menIndex] = true
        // }
      })
    }
    const currentTextCont = typingTextFormat({
      text: currentText,
      mentionedMembers: [
        ...mentionedMembersPositions,
        {
          displayName: `@${mentionDisplayName}`,
          start: mentionToChange ? mentionToChange.start : currentMentions.start,
          end: mentionToChange ? mentionToChange.end : currentMentions.start + 1 + mentionDisplayName.length
        }
      ],
      currentMentionEnd: mentionToChange ? mentionToChange.end : currentMentions.start + 1 + mentionDisplayName.length
    })
    if (editMessageText) {
      setEditMessageText(currentText)
    } else {
      setMessageText(currentText)
    }
    messageInputRef.current.innerHTML = currentTextCont
    setCursorPosition(messageInputRef.current, currentMentions.start + 2 + mentionDisplayName.length, true)
    const updateCurrentMentions = { ...currentMentions }
    updateCurrentMentions.typed = mentionDisplayName
    updateCurrentMentions.id = member.id
    updateCurrentMentions.end = updateCurrentMentions.start + mentionDisplayName.length

    setCurrentMentions(updateCurrentMentions)
    setPendingMentions(pendingMentions.filter((mention: any) => mention.start !== updateCurrentMentions.start))
    messageInputRef.current.focus()
  }
  const handleCloseMentionsPopup = (setPending?: boolean) => {
    setOpenMention(false)
    setMentionTyping(false)
    if (setPending) {
      setPendingMentions([
        ...pendingMentions,
        { ...currentMentions, end: currentMentions.start + 1 + currentMentions.typed.length }
      ])

      console.log('set pending mentions... .', [
        ...pendingMentions,
        { ...currentMentions, end: currentMentions.start + 1 + currentMentions.typed.length }
      ])
    }
    setCurrentMentions(undefined)
  }
  const handleTyping = (e: any) => {
    if (!e.currentTarget.innerText.trim()) {
      setSendMessageIsActive(false)
    } else {
      setSendMessageIsActive(true)
    }
    if (!(openMention && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) {
      if (messageToEdit) {
        setEditMessageText(e.currentTarget.innerText)
      } else {
        setMessageText(e.currentTarget.innerText)
      }
      // e.currentTarget.html = e.currentTarget.innerText
      if (allowMentionUser) {
        handleMentionDetect(e)
      }

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
  }
  const handleMentionDetect = (e: any) => {
    const selPos = getCaretPosition(e.currentTarget)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowTop' || e.key === 'ArrowDown') {
      setSelectionPos(selPos)
    }
    if (currentMentions && currentMentions.start === selPos - 1 && !mentionTyping) {
      setMentionTyping(true)
      setOpenMention(true)
    }
    const lastTwoChar = messageInputRef.current.innerText.slice(0, selPos).slice(-2)
    if (
      lastTwoChar.trimStart() === '@' &&
      !mentionTyping &&
      (activeChannel.type === CHANNEL_TYPE.GROUP || activeChannel.type === 'private')
    ) {
      setCurrentMentions({
        start: selPos - 1,
        typed: ''
      })

      setMentionTyping(true)
      setOpenMention(true)
    }
    let shouldClose = false
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // const selPos2 = getCaretPosition(e.currentTarget)
      // console.log('selPos 2 pos .. . ', selPos2)
      // const mentionToEdit = mentionedMembers.find((menMem: any) => menMem.start <= selPos && menMem.end >= selPos + 1)
      // if (mentionToEdit) {
      //   const editingMentionPosition = 0
      const mentionedMembersPositions: any = []
      /* const sortedMentionedMembersDspNames = mentionedMembersDisplayName.sort((a: any, b: any) =>
            a.displayName < b.displayName ? 1 : b.displayName < a.displayName ? -1 : 0
          ) */
      // const findIndexes: any = []
      const currentText = messageInputRef.current.innerText
      if (mentionedMembers && mentionedMembers.length > 0) {
        let lastFoundIndex = 0
        const starts: any = {}
        const updatedMentionedMembers: any = []
        // console.log('mentionedMembers . . . . .  92133', mentionedMembers)
        mentionedMembers.forEach((menMem: any) => {
          const mentionDisplayName = menMem.displayName || mentionedMembersDisplayName[menMem.id].displayName
          // console.log('find index of mentionDisplayName. .. .  .', mentionDisplayName)
          // console.log('find index on text . .. .  .', currentText)
          // console.log('find index from . .. .  .', lastFoundIndex)
          const menIndex = currentText.indexOf(mentionDisplayName, lastFoundIndex)
          // console.log('found in index .. ', menIndex)
          lastFoundIndex = menIndex + mentionDisplayName.length
          /* if (menMem.start === mentionToEdit.start) {
              editingMentionPosition = menIndex
            } */
          // if (!starts[menMem.start] && menMem.start !== mentionToEdit.start) {
          if (menIndex >= 0 && !starts[menMem.start]) {
            updatedMentionedMembers.push({ ...menMem, start: menIndex, end: menIndex + mentionDisplayName.length })
            mentionedMembersPositions.push({
              displayName: mentionDisplayName,
              start: menIndex,
              // loc: menMem.start - trimLength,
              end: menIndex + mentionDisplayName.length
              // len: menMem.end - menMem.start
            })
          }
          starts[menMem.start] = true
          // }
        })
        // console.log('set mentioned members,,., ', updatedMentionedMembers)
        setMentionedMembers(updatedMentionedMembers)
        messageInputRef.current.innerHTML = typingTextFormat({
          text: currentText,
          mentionedMembers: [...mentionedMembersPositions]
        })
      }
      if (messageToEdit) {
        setEditMessageText(currentText)
      } else {
        setMessageText(currentText)
      }
      // console.log('set pos .. . ', selPos)
      // if (mentionedMembers && mentionedMembers.length && selPos > 0) {
      if (selPos > 0) {
        setSelectionPos(selPos)
        setCursorPosition(messageInputRef.current, selPos)
      }
      // } else
      if (currentMentions) {
        // console.log('currentMentions.start . ..  . .. ', currentMentions.start)
        // console.log('selPos . ..  . .. ', selPos)
        if (currentMentions.start >= selPos) {
          shouldClose = true
          setCurrentMentions(undefined)
          setOpenMention(false)
          setMentionTyping(false)
        } else {
          setCurrentMentions({
            start: currentMentions.start,
            typed: messageText.slice(currentMentions.start + 1, selPos)
          })
        }
      }
    }
    if (mentionTyping) {
      if (e.key === ' ') {
        // console.log('lastTwoChar. . . . . . ', lastTwoChar)
        // if (/  /.test(str)lastTwoChar === '  ') {
        setSelectionPos(selPos)
        handleCloseMentionsPopup(true)
      } else if (!currentMentions.end && !shouldClose) {
        const typedMessage = e.currentTarget.innerText
        const updateCurrentMentions = { ...currentMentions }
        updateCurrentMentions.typed = typedMessage.slice(updateCurrentMentions.start + 1, selPos)
        setCurrentMentions(updateCurrentMentions)
      }
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
    const { shiftKey, charCode, type } = event
    const isEnter: boolean = charCode === 13 && shiftKey === false && !openMention
    const shouldSend =
      (isEnter || type === 'click') && (messageToEdit || messageText || (attachments.length && attachments.length > 0))
    if (isEnter) {
      event.preventDefault()
    }
    if (shouldSend) {
      if (messageToEdit) {
        handleEditMessage()
      } else if (messageText || (attachments.length && attachments.length > 0)) {
        const messageTexToSend = messageText.trim()
        const mentionedMembersPositions: any = []
        if (mentionedMembers && mentionedMembers.length > 0) {
          let lastFoundIndex = 0
          const starts: any = {}
          mentionedMembers.forEach((menMem: any) => {
            const mentionDisplayName = mentionedMembersDisplayName[menMem.id].displayName
            const menIndex = messageTexToSend.indexOf(mentionDisplayName, lastFoundIndex)
            lastFoundIndex = menIndex + mentionDisplayName.length
            if (!starts[menIndex]) {
              mentionedMembersPositions.push({
                id: menMem.id,
                loc: menIndex,
                len: mentionDisplayName.length
              })
            }
            starts[menIndex] = true
            // }
          })
        }
        const messageToSend: any = {
          metadata: mentionedMembersPositions,
          body: messageTexToSend,
          mentionedMembers: [],
          attachments: [],
          type: 'text'
        }

        messageToSend.mentionedMembers = mentionedMembers.filter(
          (v: any, i: any, a: any) => a.findIndex((t: any) => t.id === v.id) === i
        )
        // messageToSend.type = /(https?:\/\/[^\s]+)/.test(messageToSend.body) ? 'link' : messageToSend.type

        if (messageForReply) {
          messageToSend.parentMessage = messageForReply
        }

        if (messageTexToSend && !attachments.length) {
          const linkify = new LinkifyIt()
          const match = linkify.match(messageTexToSend)
          // const messageTextArr = [messageTexToSend]
          let firstUrl: any
          if (match) {
            firstUrl = match[0].url
          }
          /* messageTextArr.forEach((textPart) => {
              if (urlRegex.test(textPart)) {
                const textArray = textPart.split(urlRegex)
                textArray.forEach(async (part) => {
                  if (urlRegex.test(part)) {
                    if (!firstUrl) {
                      firstUrl = part
                    }
                  }
                })
              }
            }) */
          if (firstUrl) {
            messageToSend.attachments = [
              {
                type: attachmentTypes.link,
                data: firstUrl,
                upload: false
              }
            ]
          }
          dispatch(sendTextMessageAC(messageToSend, activeChannel.id, connectionStatus))
        }
        if (attachments.length) {
          const sendAsSeparateMessage = getSendAttachmentsAsSeparateMessages()
          console.log('send as separate message ... ', sendAsSeparateMessage)
          messageToSend.attachments = attachments.map((attachment: any, index: any) => {
            const attachmentToSend = {
              name: attachment.data.name,
              data: attachment.data,
              attachmentId: attachment.attachmentId,
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
              dispatch(
                sendMessageAC(
                  {
                    ...messageToSend,
                    attachments: [attachmentToSend]
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
            dispatch(sendMessageAC(messageToSend, activeChannel.id, connectionStatus, false))
          }
        }
        setMessageText('')

        messageInputRef.current.innerText = ''
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
      setMentionedMembers([])
      setMentionedMembersDisplayName([])
      setOpenMention(false)
      setMentionTyping(false)
      setCurrentMentions(undefined)
      dispatch(setCloseSearchChannelsAC(true))
    }
  }
  const handleEditMessage = () => {
    const messageTexToSend = editMessageText.trim()
    if (messageTexToSend) {
      const mentionedMembersPositions: any = []
      const mentionedUserForSend: any = []
      if (mentionedMembers && mentionedMembers.length) {
        let lastFoundIndex = 0
        const starts: any = {}
        mentionedMembers.forEach((menMem: any) => {
          const mentionDisplayName = `@${makeUsername(contactsMap[menMem.id], menMem, getFromContacts)}`.trim()
          const menIndex = messageTexToSend.indexOf(mentionDisplayName, lastFoundIndex)
          if (menIndex >= 0) {
            lastFoundIndex = menIndex + mentionDisplayName.length
            if (!starts[menIndex]) {
              mentionedMembersPositions.push({
                id: menMem.id,
                loc: menIndex,
                len: mentionDisplayName.length
              })
            }
            starts[menIndex] = true

            mentionedUserForSend.push(menMem)
          }

          // }
        })

        /* const findIndexes: any[] = []
        mentionedUserForSend.forEach((menMem: any) => {
          // eslint-disable-next-line max-len
          const mentionedMembersDisplayName = `@${menMem.firstName}${menMem.lastName !== '' ? ` ${menMem.lastName}` : ''}`
          let menIndex = messageTexToSend.indexOf(mentionedMembersDisplayName)
          let existingIndex = findIndexes.includes(menIndex)
          let i = 0
          if (menIndex < 0) {
            mentionedUserForSend = messageToEdit.mentionedUsers.filter((menUs: any) => menUs.id !== menMem.id)
          } else {
            while (existingIndex) {
              menIndex = messageTexToSend.indexOf(menMem.displayName, menIndex + 1)
              existingIndex = findIndexes.includes(menIndex)
              // eslint-disable-next-line no-plusplus
              i++
              if (i > mentionedUserForSend.length) {
                break
              }
            }

            const mentionDisplayLength = mentionedMembersDisplayName.length
            if (!mentionedMembersPositions[menMem.id] && menIndex >= 0) {
              findIndexes.push(menIndex)
              mentionedMembersPositions = {
                ...mentionedMembersPositions,
                [menMem.id]: {
                  loc: menIndex,
                  len: mentionDisplayLength
                }
              }
            }
          }
        }) */
      }
      const messageToSend = {
        ...messageToEdit,
        metadata: mentionedMembersPositions,
        mentionedUsers: mentionedUserForSend,
        body: messageTexToSend
      }

      messageToSend.type = /(https?:\/\/[^\s]+)/.test(messageToSend.body) ? 'link' : messageToSend.type
      dispatch(editMessageAC(activeChannel.id, messageToSend))
      handleCloseEditMode()
    }
  }
  const handleCloseEditMode = () => {
    setEditMessageText('')
    if (messageInputRef.current) {
      messageInputRef.current.innerText = ''
    }

    setMentionedMembers([])
    setMentionedMembersDisplayName([])
    setOpenMention(false)
    setMentionTyping(false)
    setCurrentMentions(undefined)
    dispatch(setMessageToEditAC(null))
  }
  const removeUpload = (attachmentId: string) => {
    if (attachmentId) {
      deleteVideoThumb(attachmentId)
      setAttachments(attachments.filter((item: any) => item.attachmentId !== attachmentId))
    } else {
      setAttachments([])
    }
  }

  const handleFileUpload = (e: any) => {
    // const { files } = fileUploader.current
    const isMediaAttachment = e.target.accept === mediaExtensions
    const fileList = Object.values(e.target.files)
    // if (fileList.length > 10) {
    //   alert('You are chosen more than 10 attachment')
    // } else {
    fileList.forEach(async (file: any) => {
      handleAddAttachment(file, isMediaAttachment)
    })
    // }
    /* const { files } = fileUploader.current
    const fileList = Object.values(files)
    fileList.forEach((file, index) => {
      setAttachments((prevState: any[]) => [
        ...prevState,
        {
          data: file,
          attachmentUrl: URL.createObjectURL(file as any),
          attachmentId: Date.now() + index
        }
      ])
    }) */
    fileUploader.current.value = ''
  }

  const onOpenFileUploader = (attachmentType: string) => {
    setShowChooseAttachmentType(false)
    fileUploader.current.accept = attachmentType
    fileUploader.current.click()
  }

  const handlePastAttachments = (e: any) => {
    const os = detectOS()
    const browser = detectBrowser()
    if (os === 'Windows' && browser === 'Firefox') {
      e.preventDefault()
      setMessageText(e.clipboardData.getData('text/plain').trim())
      document.execCommand('inserttext', false, e.clipboardData.getData('text/plain').trim())
    } else {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault()
        const fileList: File[] = Object.values(e.clipboardData.files)
        fileList.forEach(async (file: any) => {
          handleAddAttachment(file, true)
        })
      } else {
        e.preventDefault()
        setMessageText(e.clipboardData.getData('text/plain').trim())
        document.execCommand('inserttext', false, e.clipboardData.getData('text/plain').trim())
        //
        // e.currentTarget.innerText = e.clipboardData.getData('Text')
        // placeCaretAtEnd(messageInputRef.current)
      }
    }
  }

  const handleCut = () => {
    setMentionTyping(false)
    setMessageText('')
    setCurrentMentions(undefined)
    setOpenMention(false)
    setMentionedMembers([])
  }

  const handleEmojiPopupToggle = (bool: boolean) => {
    setIsEmojisOpened(bool)
    messageInputRef.current.focus()
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
  useEffect(() => {
    if (mentionTyping) {
      if (
        selectionPos <= currentMentions.start ||
        selectionPos > currentMentions.start + 1 + currentMentions.typed.length
      ) {
        handleCloseMentionsPopup(true)
      }
    } else if (pendingMentions && pendingMentions.length) {
      const currentPendingMention = pendingMentions.find(
        (mention: any) => selectionPos <= mention.end && selectionPos > mention.start
      )
      if (currentPendingMention) {
        delete currentPendingMention.end
        setCurrentMentions(currentPendingMention)
        setMentionTyping(true)
        setOpenMention(true)
        setPendingMentions(pendingMentions.filter((mention: any) => mention.start !== currentPendingMention.start))
      }
    }
    /* if (mentionedMembers.length) {
      // const currentPos = getCaretPosition(messageInputRef.current)
      const mentionToEdit = mentionedMembers.find(
        (menMem: any) => menMem.start < selectionPos && menMem.end >= selectionPos
      )
      if (mentionToEdit) {
        setMentionEdit(mentionToEdit)
        // if (!currentMentions) {
        setCurrentMentions({
          start: mentionToEdit.start,
          typed: ''
        })
        // }
        setOpenMention(true)
        setMentionTyping(true)
      } else if (openMention || mentionTyping) {
        handleCloseMentionsPopup()
        setMentionTyping(false)
        setOpenMention(false)
      }
    } */
  }, [selectionPos])

  const handleAddAttachment = async (file: File, isMediaAttachment: boolean) => {
    const customUploader = getCustomUploader()
    const sendAsSeparateMessage = getSendAttachmentsAsSeparateMessages()
    const fileType = file.type.split('/')[0]
    const attachmentId = uuidv4()
    let cachedUrl: any
    const reader = new FileReader()

    reader.onload = async () => {
      // @ts-ignore
      const length = reader.result && reader.result.length
      const firstPart = reader.result && reader.result.slice(0, 100)
      const middlePart = reader.result && reader.result.slice(length / 2 - 50, length / 2)
      const lastPart = reader.result && reader.result.slice(length - 100, length)
      const fileSignature = `${firstPart}${middlePart}${lastPart}`
      const dataFromDb = await getDataFromDB(DB_NAMES.FILES_STORAGE, DB_STORE_NAMES.ATTACHMENTS, fileSignature)
      if (dataFromDb) {
        cachedUrl = dataFromDb.url
      } else {
        setPendingAttachment(attachmentId, { signature: fileSignature })
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
                attachmentId,
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
              attachmentId,
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
              attachmentId,
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
                  attachmentId,
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
                    upload: !cachedUrl,
                    attachmentUrl: URL.createObjectURL(file),
                    attachmentId,
                    type: fileType,
                    size: dataFromDb ? dataFromDb.size : file.size,
                    metadata: sendAsSeparateMessage
                      ? ''
                      : JSON.stringify({
                          tmb: metas.thumbnail,
                          szw: metas.imageWidth,
                          szh: metas.imageHeight
                        })
                  }
                ])
              } else {
                resizeImage(file).then(async (resizedFile: any) => {
                  // resizedFiles.forEach((file: any, index: number) => {
                  setAttachments((prevState: any[]) => [
                    ...prevState,
                    {
                      data: new File([resizedFile.blob], resizedFile.file.name),
                      cachedUrl,
                      upload: !cachedUrl,
                      attachmentUrl: URL.createObjectURL(file),
                      attachmentId,
                      type: fileType,
                      size: dataFromDb ? dataFromDb.size : file.size,
                      metadata: sendAsSeparateMessage
                        ? ''
                        : JSON.stringify({
                            tmb: metas.thumbnail,
                            szw: resizedFile.newWidth,
                            szh: resizedFile.newHeight
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
                attachmentId,
                size: dataFromDb ? dataFromDb.size : file.size,
                metadata: dataFromDb
                  ? metas.thumbnail
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
          } /* else {
            const { thumb, width, height } = await getFrame(URL.createObjectURL(file as any), 1)
            metas.thumb = thumb
            metas.width = width
            metas.height = height
          } */
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
              attachmentId,
              metadata: dataFromDb ? metas : ''
            }
          ])
        } else {
          setAttachments((prevState: any[]) => [
            ...prevState,
            {
              data: file,
              cachedUrl,
              upload: !cachedUrl,
              // type: file.type.split('/')[0],
              type: 'file',
              size: dataFromDb ? dataFromDb.size : file.size,
              attachmentUrl: URL.createObjectURL(file as any),
              attachmentId
            }
          ])
        }
      }
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
      const attachmentsFiles = draggedAttachments.map(
        (draggedData: any) => {
          const arr = draggedData.data.split(',')
          const bstr = atob(arr[1])
          let n = bstr.length
          const u8arr = new Uint8Array(n)
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
          }
          return new File([u8arr], draggedData.name, { type: draggedData.type })
        }
        /* new File([draggedData.data], draggedData.name, {
            type: draggedData.type
          }) */
      )
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
    if (prevActiveChannelId && activeChannel.id && prevActiveChannelId !== activeChannel.id) {
      setMessageText('')
      // messageInputRef.current.innerText = ''
      handleCloseReply()
      setMentionedMembersDisplayName([])
      setAttachments([])
      handleCloseEditMode()
      clearTimeout(typingTimout)
      if (messageInputRef && messageInputRef.current) {
        messageInputRef.current.focus()
      }
    } /* else if (activeChannel.id) {
      prevActiveChannelId = activeChannel.id
    } */
    if (activeChannel.id) {
      prevActiveChannelId = activeChannel.id
    }
    if (messageInputRef.current && inputAutofocus) {
      messageInputRef.current.focus()
    }

    setMentionedMembers([])
    setOpenMention(false)
    setCurrentMentions(undefined)
    setMentionTyping(false)
    /* if (allowMentionUser) {
      dispatch(getMembersAC(activeChannel.id))
    } */
    const draftMessage = getDraftMessageFromMap(activeChannel.id)
    if (draftMessage) {
      setMessageText(draftMessage.text)
      setMentionedMembers(draftMessage.mentionedMembers)
      const mentionedMembersPositions: any = []
      if (draftMessage.mentionedMembers && draftMessage.mentionedMembers.length > 0) {
        let lastFoundIndex = 0
        const starts: any = {}
        draftMessage.mentionedMembers.forEach((menMem: any) => {
          const mentionDisplayName = `@${makeUsername(contactsMap[menMem.id], menMem, getFromContacts).trim()}`
          const menIndex = draftMessage.text.indexOf(mentionDisplayName, lastFoundIndex)
          lastFoundIndex = menIndex + mentionDisplayName.length
          setMentionedMembersDisplayName((prevState: any) => ({
            ...prevState,
            [menMem.id]: { id: menMem.id, displayName: mentionDisplayName }
          }))
          if (!starts[menIndex]) {
            mentionedMembersPositions.push({
              displayName: mentionDisplayName,
              start: menIndex,
              end: menIndex + mentionDisplayName.length
            })
          }
          starts[menIndex] = true
          // }
        })
      }

      messageInputRef.current.innerHTML = typingTextFormat({
        text: draftMessage.text,
        mentionedMembers: [...mentionedMembersPositions]
      })
      setCursorPosition(messageInputRef.current, draftMessage.text.length)
      if (inputAutofocus) {
        messageInputRef.current.focus()
      }
    }
  }, [activeChannel.id])
  useEffect(() => {
    if (
      messageText.trim() ||
      (editMessageText.trim() && editMessageText !== messageToEdit.body) ||
      attachments.length
    ) {
      if (attachments.length) {
        let videoAttachment = false
        attachments.forEach((att: any) => {
          if (att.type === 'video' || att.data.type.split('/')[0] === 'video') {
            videoAttachment = true
            if (!readyVideoAttachments[att.attachmentId]) {
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

    if (messageText) {
      setDraftMessageToMap(activeChannel.id, { text: messageText, mentionedMembers })
      if (!listenerIsAdded) {
        setListenerIsAdded(true)
        document.body.setAttribute('onbeforeunload', "return () => 'reload?'")
      }
    } else if (getDraftMessageFromMap(activeChannel.id)) {
      removeDraftMessageFromMap(activeChannel.id)
      if (checkDraftMessagesIsEmpty() && listenerIsAdded) {
        dispatch(setChannelDraftMessageIsRemovedAC(activeChannel.id))
        setListenerIsAdded(false)
        document.body.removeAttribute('onbeforeunload')
      }
    }
  }, [messageText, attachments, editMessageText, readyVideoAttachments])

  useDidUpdate(() => {
    if (mentionedMembers && mentionedMembers.length) {
      setDraftMessageToMap(activeChannel.id, { text: messageText, mentionedMembers })
    }
  }, [mentionedMembers])

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
    if (emojiBtnRef.current && emojiBtnRef.current.offsetLeft > messageInputRef.current.offsetWidth) {
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
    if (messageForReply && messageToEdit) {
      handleCloseEditMode()
    }

    if (messageContRef && messageContRef.current) {
      dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
    }
    if (messageInputRef.current) {
      messageInputRef.current.focus()
    }
  }, [messageForReply])

  useDidUpdate(() => {
    if (messageToEdit && messageInputRef.current) {
      if (messageToEdit.mentionedUsers && messageToEdit.mentionedUsers.length) {
        const formattedText = MessageTextFormat({
          text: messageToEdit.body,
          message: messageToEdit,
          contactsMap,
          getFromContacts,
          asSampleText: true
        })
        setEditMessageText(formattedText)
        // Get duplicate mentions from metadata
        const mentions = getDuplicateMentionsFromMeta(messageToEdit.metadata, messageToEdit.mentionedUsers)
        const mentionedMembersPositions: any = []
        const editingMentionedMembers: any = []
        let lastFoundIndex = 0
        const starts: any = {}
        mentions.forEach((menMem: any) => {
          const mentionDisplayName = `@${makeUsername(contactsMap[menMem.id], menMem, getFromContacts)}`.trim()
          const menIndex = formattedText.indexOf(mentionDisplayName, lastFoundIndex)
          lastFoundIndex = menIndex + mentionDisplayName.length
          if (!starts[menIndex]) {
            const mentionInfo = {
              displayName: mentionDisplayName,
              start: menIndex,
              end: menIndex + mentionDisplayName.length
            }
            editingMentionedMembers.push({ ...menMem, ...mentionInfo })
            mentionedMembersPositions.push(mentionInfo)
          }
          starts[menIndex] = true
          // }
        })
        setMentionedMembers(editingMentionedMembers)
        messageInputRef.current.innerHTML = typingTextFormat({
          text: messageToEdit.body,
          mentionedMembers: [...mentionedMembersPositions]
        })
      } else {
        setEditMessageText(messageToEdit.body || '')
        messageInputRef.current.innerText = messageToEdit.body
      }
      // Creates range object
      placeCaretAtEnd(messageInputRef.current)

      // Set cursor on focus
      messageInputRef.current.focus()
      if (messageForReply) {
        handleCloseReply()
      }
    }
    if (messageContRef && messageContRef.current) {
      dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
    }

    if (messageInputRef.current) {
      messageInputRef.current.focus()
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

    if (handleSendMessage) {
      setSendMessageHandler(handleSendMessage)
    }
    let inputHeightTimeout: any = null
    if (messageContRef && messageContRef.current) {
      inputHeightTimeout = setTimeout(() => {
        dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
      }, 800)
    }
    document.addEventListener('mousedown', handleClick)
    return () => {
      if (inputHeightTimeout) {
        clearTimeout(inputHeightTimeout)
      }
      prevActiveChannelId = undefined
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  return (
    <Container margin={margin} border={border} ref={messageContRef} theme={theme}>
      {/* <Editor
        wrapperClassName='demo-wrapper'
        editorClassName='demo-editor'
        editorState={messageTextWs}
        mention={{
          separator: ' ',
          trigger: '@',
          suggestions: members.map((member: IMember) => {
            const displayName = makeUsername(contactsMap[member.id], member, getFromContacts)
            return {
              text: displayName,
              value: displayName,
              url: member.id
            }
          })
        }}
        onEditorStateChange={onEditorStateChange}
        toolbar={{ options: [] }}
      /> */}
      {!activeChannel.id ? (
        <Loading />
      ) : isBlockedUserChat || isDeletedUserChat || disabled ? (
        <BlockedUserInfo>
          <BlockInfoIcon />{' '}
          {isDeletedUserChat
            ? 'This user has been deleted.'
            : disabled
            ? "Sender doesn't support replies"
            : 'You blocked this user.'}
        </BlockedUserInfo>
      ) : !activeChannel.userRole && activeChannel.type !== CHANNEL_TYPE.DIRECT ? (
        <JoinChannelCont onClick={handleJoinToChannel} color={colors.primary}>
          Join
        </JoinChannelCont>
      ) : (
          activeChannel.type === CHANNEL_TYPE.BROADCAST
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
          {/* <EmojiContainer rigthSide={emojisInRightSide} ref={emojisRef} isEmojisOpened={isEmojisOpened}> */}
          {isEmojisOpened && (
            <EmojisPopup
              handleAddEmoji={handleAddEmoji}
              // messageText={messageText}
              // ccc={handleTyping}
              handleEmojiPopupToggle={handleEmojiPopupToggle}
              rightSide={emojisInRightSide}
              bottomPosition={'100%'}
            />
          )}
          {/* </EmojiContainer> */}
          {messageToEdit && (
            <EditReplyMessageCont>
              <CloseEditMode onClick={handleCloseEditMode}>
                <CloseIcon />
              </CloseEditMode>
              <EditReplyMessageHeader color={colors.primary}>
                {editMessageIcon || <EditIcon />}
                Edit Message
              </EditReplyMessageHeader>
              <EditMessageText>{messageToEdit.body}</EditMessageText>
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
                  key={attachment.attachmentId}
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
            <MentionsContainer mentionsIsOpen={openMention}>
              {openMention && (
                <MentionMembersPopup
                  theme={theme}
                  channelId={activeChannel.id}
                  addMentionMember={handleSetMention}
                  searchMention={currentMentions.typed}
                  handleMentionsPopupClose={handleCloseMentionsPopup}
                />
              )}
            </MentionsContainer>
            <UploadFile ref={fileUploader} onChange={handleFileUpload} multiple type='file' />
            <MessageInputWrapper
              borderRadius={borderRadius}
              ref={inputWrapperRef}
              backgroundColor={backgroundColor || colors.backgroundColor}
              channelDetailsIsOpen={channelDetailsIsOpen}
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
              <MessageInput
                contentEditable
                suppressContentEditableWarning
                onKeyUp={handleTyping}
                onChange={handleTyping}
                onPaste={handlePastAttachments}
                color={colors.textColor1}
                onCut={handleCut}
                onKeyPress={handleSendEditMessage}
                data-placeholder='Type message here ...'
                // onKeyDown={handleKeyDown}
                // value={editMessageText || messageText}
                borderRadius={inputBorderRadius}
                order={inputOrder}
                backgroundColor={inputBackgroundColor}
                paddings={inputPaddings}
                ref={messageInputRef}
                mentionColor={colors.primary}
                className={inputCustomClassname}
                // placeholder='Type message here...'
              />
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

  & .rdw-suggestion-option {
  }
  & .rdw-suggestion-option-active {
    background-color: rgb(243, 245, 248);
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

/*
const CloseReply = styled.span`
  position: absolute;
  right: 14px;
  top: 8px;
  cursor: pointer;
`
*/

const MessageInputWrapper = styled.div<{
  channelDetailsIsOpen?: boolean
  backgroundColor?: string
  borderRadius?: string
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
const MessageInput = styled.div<{
  order?: number
  color?: string
  borderRadius?: string
  backgroundColor?: string
  paddings?: string
  mentionColor?: string
}>`
  margin: 8px 6px;
  width: 100%;
  max-height: 80px;
  min-height: 20px;
  display: block;
  border: none;
  font: inherit;
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

  &:empty:before {
    content: attr(data-placeholder);
  }

  &:before {
    position: relative;
    top: calc(50% - 10px);
    left: 0;
    font-size: 15px;
    color: ${colors.textColor3};
    pointer-events: none;
    unicode-bidi: plaintext;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  &::placeholder {
    font-size: 15px;
    color: ${colors.textColor3};
    opacity: 1;
  }

  & span.mention_user {
    color: ${(props) => props.mentionColor || colors.primary};
    user-modify: read-only;
  }

  //caret-color: #000;
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

// TODO Mentions
/* const MentionButton = styled.span<any>`
  margin: 0 5px;
  cursor: pointer;
  line-height: 13px;
  z-index: 2;
  > svg {
    ${(props) =>
      props.isEmojisOpened ? `color: ${colors.cobalt1};` : 'color: #898B99;'}
  }

  &:hover > svg {
    color: ${colors.cobalt1};
  }
` */

/* const EmojiContainer = styled.div<any>`
  position: absolute;
  left: ${(props) => (props.rigthSide ? '-276px' : '-8px')};
  bottom: 46px;
  z-index: 9998;
` */

export const MentionsContainer = styled.div<{ mentionsIsOpen?: boolean }>`
  position: absolute;
  left: 0;
  bottom: 100%;
  z-index: 9998;
`

/* const TypingMessage = styled.div`
  position: absolute;
  top: -21px;
  font-style: italic;
  color: #7c7e8e;
  font-size: 14px;
` */

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
      background-color: #818c99;
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

export default SendMessageInput
