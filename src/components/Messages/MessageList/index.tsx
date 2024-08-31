import styled from 'styled-components'
import React, { useRef, useEffect, useState, useMemo, FC } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import moment from 'moment'
// Store
import {
  clearSelectedMessagesAC,
  getMessagesAC,
  loadMoreMessagesAC,
  scrollToNewMessageAC,
  setScrollToMessagesAC,
  showScrollToNewMessageButtonAC
} from '../../../store/message/actions'
import {
  messagesHasNextSelector,
  messagesHasPrevSelector,
  messagesLoadingState,
  openedMessageMenuSelector,
  scrollToMessageSelector,
  scrollToNewMessageSelector,
  selectedMessagesMapSelector
} from '../../../store/message/selector'
import { setDraggedAttachmentsAC } from '../../../store/channel/actions'
import { themeSelector } from '../../../store/theme/selector'
import { activeChannelSelector, isDraggingSelector, tabIsActiveSelector } from '../../../store/channel/selector'
import { browserTabIsActiveSelector, connectionStatusSelector, contactsMapSelector } from '../../../store/user/selector'
import { CONNECTION_STATUS } from '../../../store/user/constants'
// Hooks
import { useDidUpdate, useColor } from '../../../hooks'
// Assets
import { ReactComponent as ChooseFileIcon } from '../../../assets/svg/choseFile.svg'
import { ReactComponent as ChooseMediaIcon } from '../../../assets/svg/choseMedia.svg'
import { ReactComponent as NoMessagesIcon } from '../../../assets/svg/noMessagesIcon.svg'
// Helpers
import { getUnreadScrollTo, setUnreadScrollTo } from '../../../helpers/channelHalper'
import {
  clearMessagesMap,
  clearVisibleMessagesMap,
  getHasNextCached,
  getHasPrevCached,
  getVisibleMessagesMap,
  LOAD_MAX_MESSAGE_COUNT,
  MESSAGE_LOAD_DIRECTION,
  removeAllMessages,
  setHasNextCached,
  setHasPrevCached
} from '../../../helpers/messagesHalper'
import { isJSON, setAllowEditDeleteIncomingMessage } from '../../../helpers/message'
import { colors, THEME_COLOR_NAMES } from '../../../UIHelper/constants'
import { IAttachment, IChannel, IContactsMap, IMessage, IUser } from '../../../types'
import { LOADING_STATE } from '../../../helpers/constants'
// Components
import MessageDivider from '../../MessageDivider'
import SliderPopup from '../../../common/popups/sliderPopup'
import SystemMessage from '../SystemMessage'
import Message from '../../Message'

let loading = false
let loadFromServer = false
// let lastPrevLoadedId: string = ''
// let firstPrevLoadedId: string = ''
// let hasNextMessages = true
// let hasPrevMessages = true
let loadDirection = ''
// let nextTargetMessage = ''
// @ts-ignore
let nextDisable = false
let prevDisable = false
let scrollToBottom = false
let shouldLoadMessages: 'next' | 'prev' | ''
const messagesIndexMap = {}

const CreateMessageDateDivider = ({
  lastIndex,
  currentMessageDate,
  nextMessageDate,
  messagesHasNext,
  dateDividerFontSize,
  dateDividerTextColor,
  dateDividerBorder,
  dateDividerBackgroundColor,
  dateDividerBorderRadius,
  noMargin,
  theme,
  marginBottom,
  marginTop,
  chatBackgroundColor
}: {
  lastIndex: boolean
  currentMessageDate: Date
  nextMessageDate: Date
  messagesHasNext: boolean
  dateDividerFontSize?: string
  dateDividerTextColor?: string
  dateDividerBorder?: string
  dateDividerBackgroundColor?: string
  dateDividerBorderRadius?: string
  noMargin?: boolean
  theme?: any
  marginBottom?: string
  marginTop?: string
  chatBackgroundColor?: string
}) => {
  const today = moment().endOf('day')
  const current = moment(currentMessageDate).endOf('day')
  const differentDays = !(nextMessageDate && current.diff(moment(nextMessageDate).endOf('day'), 'days') === 0)
  let dividerText = ''
  if (differentDays && !today.diff(current, 'days')) {
    dividerText = 'Today'
  } /* else if (differentDays && !today.add(-1, 'days').diff(current, 'days')) {
    dividerText = 'Yesterday'
  } */ else if (differentDays) {
    dividerText = moment().year() === moment(current).year() ? current.format('MMMM D') : current.format('MMMM D YYYY')
  }
  return !differentDays ? null : (
    <MessageDivider
      theme={theme}
      dividerText={dividerText}
      visibility={messagesHasNext && lastIndex}
      dateDividerFontSize={dateDividerFontSize}
      dateDividerTextColor={dateDividerTextColor}
      dateDividerBorder={dateDividerBorder}
      dateDividerBackgroundColor={dateDividerBackgroundColor}
      dateDividerBorderRadius={dateDividerBorderRadius}
      noMargin={noMargin}
      marginBottom={marginBottom}
      marginTop={marginTop}
      chatBackgroundColor={chatBackgroundColor}
    />
  )
}

interface MessagesProps {
  messages: IMessage[]
  fontFamily?: string
  ownMessageOnRightSide?: boolean
  messageWidthPercent?: string | number
  messageStatusAndTimePosition?: 'onMessage' | 'bottomOfMessage'
  messageStatusDisplayingType?: 'ticks' | 'text'
  ownMessageBackground?: string
  incomingMessageBackground?: string
  ownRepliedMessageBackground?: string
  incomingRepliedMessageBackground?: string
  showMessageStatus?: boolean
  showMessageTimeAndStatusOnlyOnHover?: boolean
  showMessageTime?: boolean
  showMessageStatusForEachMessage?: boolean
  showMessageTimeForEachMessage?: boolean
  hoverBackground?: boolean
  showSenderNameOnDirectChannel?: boolean
  showSenderNameOnOwnMessages?: boolean
  showSenderNameOnGroupChannel?: boolean
  showOwnAvatar?: boolean
  MessageActionsMenu?: FC<{
    message: IMessage
    channel: IChannel
    handleSetMessageForEdit?: () => void
    handleResendMessage?: () => void
    handleOpenDeleteMessage?: () => void
    handleOpenForwardMessage?: () => void
    handleCopyMessage?: () => void
    handleReportMessage?: () => void
    handleOpenEmojis?: () => void
    handleReplyMessage?: () => void

    isThreadMessage?: boolean
    rtlDirection?: boolean
  }>
  CustomMessageItem?: FC<{
    channel: IChannel
    message: IMessage
    prevMessage: IMessage
    nextMessage: IMessage
    unreadMessageId: string
    isUnreadMessage: boolean
    messageActionsShow: boolean
    selectionIsActive?: boolean
    emojisPopupOpen: boolean
    frequentlyEmojisOpen: boolean
    messageTextRef: any
    emojisPopupPosition: string
    handleSetMessageForEdit?: () => void
    handleResendMessage?: () => void
    handleOpenDeleteMessage?: () => void
    handleOpenForwardMessage?: () => void
    handleCopyMessage?: () => void
    handleReportMessage?: () => void
    handleSelectMessage?: () => void
    handleOpenEmojis?: () => void
    handleReplyMessage?: () => void
    handleMouseEnter: () => void
    handleMouseLeave: () => void
    closeMessageActions?: () => void
    setEmojisPopupOpen: () => void
    handleCreateChat: (user: IUser) => void
    handleReactionAddDelete: (selectedEmoji: any) => void
    handleScrollToRepliedMessage: (messageId: string) => void
    handleMediaItemClick?: (attachment: IAttachment) => void
    isThreadMessage?: boolean
  }>
  messageReaction?: boolean
  editMessage?: boolean
  copyMessage?: boolean
  replyMessage?: boolean
  replyMessageInThread?: boolean
  forwardMessage?: boolean
  deleteMessage?: boolean
  selectMessage?: boolean
  reportMessage?: boolean
  reactionIcon?: JSX.Element
  editIcon?: JSX.Element
  copyIcon?: JSX.Element
  replyIcon?: JSX.Element
  replyInThreadIcon?: JSX.Element
  forwardIcon?: JSX.Element
  deleteIcon?: JSX.Element
  selectIcon?: JSX.Element
  starIcon?: JSX.Element
  staredIcon?: JSX.Element
  reportIcon?: JSX.Element
  messageStatusSize?: string
  messageStatusColor?: string
  messageReadStatusColor?: string
  messageStateFontSize?: string
  messageStateColor?: string
  messageTimeFontSize?: string
  messageTimeColor?: string
  messageStatusAndTimeLineHeight?: string
  openFrequentlyUsedReactions?: boolean
  fixEmojiCategoriesTitleOnTop?: boolean
  emojisCategoryIconsPosition?: 'top' | 'bottom'
  emojisContainerBorderRadius?: string
  reactionIconOrder?: number
  editIconOrder?: number
  copyIconOrder?: number
  replyIconOrder?: number
  replyInThreadIconOrder?: number
  forwardIconOrder?: number
  deleteIconOrder?: number
  selectIconOrder?: number
  allowEditDeleteIncomingMessage?: boolean
  starIconOrder?: number
  reportIconOrder?: number
  reactionIconTooltipText?: string
  editIconTooltipText?: string
  replyIconTooltipText?: string
  copyIconTooltipText?: string
  replyInThreadIconTooltipText?: string
  forwardIconTooltipText?: string
  deleteIconTooltipText?: string
  selectIconTooltipText?: string
  starIconTooltipText?: string
  reportIconTooltipText?: string
  messageActionIconsColor?: string
  dateDividerFontSize?: string
  dateDividerTextColor?: string
  dateDividerBorder?: string
  dateDividerBorderRadius?: string
  dateDividerBackgroundColor?: string
  showTopFixedDate?: boolean
  inlineReactionIcon?: JSX.Element
  reactionsDisplayCount?: number
  showEachReactionCount?: boolean
  showTotalReactionCount?: boolean
  reactionItemBorder?: string
  reactionItemBorderRadius?: string
  reactionItemBackground?: string
  reactionItemPadding?: string
  reactionItemMargin?: string
  reactionsFontSize?: string
  reactionsContainerBoxShadow?: string
  reactionsContainerBorder?: string
  reactionsContainerBorderRadius?: string
  reactionsContainerPadding?: string
  reactionsContainerBackground?: string
  reactionsContainerTopPosition?: string
  reactionsDetailsPopupBorderRadius?: string
  reactionsDetailsPopupHeaderItemsStyle?: 'bubbles' | 'inline'
  newMessagesSeparatorText?: string
  newMessagesSeparatorFontSize?: string
  newMessagesSeparatorTextColor?: string
  newMessagesSeparatorWidth?: string
  newMessagesSeparatorBorder?: string
  newMessagesSeparatorBorderRadius?: string
  newMessagesSeparatorBackground?: string
  newMessagesSeparatorTextLeftRightSpacesWidth?: string
  fileAttachmentsBoxWidth?: number
  fileAttachmentsBoxBackground?: string
  fileAttachmentsBoxBorder?: string
  fileAttachmentsTitleColor?: string
  fileAttachmentsSizeColor?: string
  fileAttachmentsIcon?: JSX.Element
  imageAttachmentMaxWidth?: number
  imageAttachmentMaxHeight?: number
  videoAttachmentMaxWidth?: number
  videoAttachmentMaxHeight?: number
  attachmentsPreview?: boolean
  sameUserMessageSpacing?: string
  differentUserMessageSpacing?: string
  backgroundColor?: string
  messageTextFontSize?: string
  messageTextLineHeight?: string
}

const MessageList: React.FC<MessagesProps> = ({
  messages,
  fontFamily,
  ownMessageOnRightSide = true,
  messageWidthPercent,
  messageStatusAndTimePosition,
  messageStatusDisplayingType,
  showMessageStatus,
  showMessageTimeAndStatusOnlyOnHover,
  showMessageTime,
  showMessageStatusForEachMessage,
  showMessageTimeForEachMessage,
  ownMessageBackground = colors.primaryLight,
  incomingMessageBackground = colors.backgroundColor,
  ownRepliedMessageBackground = colors.ownRepliedMessageBackground,
  incomingRepliedMessageBackground = colors.incomingRepliedMessageBackground,
  hoverBackground = false,
  showSenderNameOnDirectChannel = false,
  showSenderNameOnOwnMessages = false,
  showSenderNameOnGroupChannel = true,
  showOwnAvatar = false,
  MessageActionsMenu,
  CustomMessageItem,
  messageReaction,
  editMessage,
  copyMessage,
  replyMessage,
  replyMessageInThread,
  forwardMessage,
  deleteMessage,
  selectMessage,
  reportMessage,
  reactionIcon,
  editIcon,
  copyIcon,
  replyIcon,
  replyInThreadIcon,
  forwardIcon,
  deleteIcon,
  selectIcon,
  allowEditDeleteIncomingMessage = true,
  starIcon,
  staredIcon,
  reportIcon,
  reactionIconOrder,
  openFrequentlyUsedReactions,
  fixEmojiCategoriesTitleOnTop,
  emojisCategoryIconsPosition,
  emojisContainerBorderRadius,
  reactionsDisplayCount,
  showEachReactionCount,
  showTotalReactionCount,
  reactionItemBorder,
  reactionItemBorderRadius,
  reactionItemBackground,
  reactionItemPadding,
  reactionItemMargin,
  reactionsFontSize,
  reactionsContainerBoxShadow,
  reactionsContainerBorder,
  reactionsContainerBorderRadius,
  reactionsContainerBackground,
  reactionsContainerPadding,
  reactionsContainerTopPosition,
  reactionsDetailsPopupBorderRadius,
  reactionsDetailsPopupHeaderItemsStyle = 'bubbles',
  editIconOrder,
  copyIconOrder,
  replyIconOrder,
  replyInThreadIconOrder,
  forwardIconOrder,
  deleteIconOrder,
  selectIconOrder,
  starIconOrder,
  reportIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  copyIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
  selectIconTooltipText,
  starIconTooltipText,
  reportIconTooltipText,
  messageActionIconsColor,
  dateDividerFontSize,
  dateDividerTextColor,
  dateDividerBorder,
  dateDividerBackgroundColor,
  dateDividerBorderRadius,
  showTopFixedDate = true,
  inlineReactionIcon,
  newMessagesSeparatorText,
  newMessagesSeparatorFontSize,
  newMessagesSeparatorTextColor,
  newMessagesSeparatorWidth,
  newMessagesSeparatorBorder,
  newMessagesSeparatorBorderRadius,
  newMessagesSeparatorBackground,
  newMessagesSeparatorTextLeftRightSpacesWidth,
  fileAttachmentsIcon,
  fileAttachmentsBoxWidth,
  fileAttachmentsBoxBackground,
  fileAttachmentsBoxBorder,
  fileAttachmentsTitleColor,
  fileAttachmentsSizeColor,
  imageAttachmentMaxWidth,
  imageAttachmentMaxHeight,
  videoAttachmentMaxWidth,
  videoAttachmentMaxHeight,
  attachmentsPreview = true,
  sameUserMessageSpacing,
  differentUserMessageSpacing,
  backgroundColor,
  messageTextFontSize,
  messageTextLineHeight,
  messageStatusSize,
  messageStatusColor,
  messageReadStatusColor,
  messageStateFontSize,
  messageStateColor,
  messageTimeFontSize,
  messageTimeColor,
  messageStatusAndTimeLineHeight
}) => {
  const accentColor = useColor(THEME_COLOR_NAMES.ACCENT)
  const textPrimary = useColor(THEME_COLOR_NAMES.TEXT_PRIMARY)
  const dispatch = useDispatch()
  const theme = useSelector(themeSelector)
  const channel: IChannel = useSelector(activeChannelSelector)
  const contactsMap: IContactsMap = useSelector(contactsMapSelector, shallowEqual)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)
  const openedMessageMenuId = useSelector(openedMessageMenuSelector, shallowEqual)
  const tabIsActive = useSelector(tabIsActiveSelector, shallowEqual)
  const selectedMessagesMap = useSelector(selectedMessagesMapSelector)
  const scrollToNewMessage = useSelector(scrollToNewMessageSelector, shallowEqual)
  const scrollToRepliedMessage = useSelector(scrollToMessageSelector, shallowEqual)
  const browserTabIsActive = useSelector(browserTabIsActiveSelector, shallowEqual)
  const hasNextMessages = useSelector(messagesHasNextSelector, shallowEqual)
  const hasPrevMessages = useSelector(messagesHasPrevSelector, shallowEqual)
  const messagesLoading = useSelector(messagesLoadingState)
  const draggingSelector = useSelector(isDraggingSelector, shallowEqual)
  // const messages = useSelector(activeChannelMessagesSelector, shallowEqual)
  const [unreadMessageId, setUnreadMessageId] = useState('')
  const [mediaFile, setMediaFile] = useState<any>(null)
  const [isDragging, setIsDragging] = useState<any>(null)
  const [showTopDate, setShowTopDate] = useState<any>(null)
  const [stopScrolling, setStopScrolling] = useState<any>(false)

  const hideTopDateTimeout = useRef<any>(null)
  // const [hideMessages, setHideMessages] = useState<any>(false)
  // const [activeChannel, setActiveChannel] = useState<any>(channel)
  const [lastVisibleMessageId, setLastVisibleMessageId] = useState('')
  const [scrollToReply, setScrollToReply] = useState<any>(null)
  // eslint-disable-next-line max-len
  // const { handleGetMessages, handleAddMessages, pendingMessages, cachedMessages, hasNext, hasPrev } = useMessages(channel)
  const messageForReply: any = {}
  const messageList = useMemo(() => messages, [messages])
  // const messagesLoading = useSelector(messagesLoadingState) || 2
  const attachmentsSelected = false
  const messagesBoxRef = useRef<any>(null)
  const messageTopDateRef = useRef<any>(null)
  const scrollRef = useRef<any>(null)
  const renderTopDate = () => {
    const dateLabels = document.querySelectorAll('.divider')
    const messageTopDate = messageTopDateRef.current
    let text = ''
    for (let i = dateLabels.length - 1; i >= 0; i--) {
      const dateLabel = dateLabels[i]
      const span = dateLabel?.firstChild?.firstChild
      // @ts-ignore
      if (!text && scrollRef.current.scrollTop > dateLabel.offsetTop) {
        // @ts-ignore
        text = span && span.innerText
        // @ts-ignore
        span.style.display = 'none'
      } else {
        // @ts-ignore
        span.style.display = 'block'
      }
    }
    if (text) {
      messageTopDate.innerText = text
      messageTopDate.style.display = 'inline'
    } else {
      messageTopDate.style.display = 'none'
    }
  }
  // @ts-ignore
  const handleMessagesListScroll = async (event: any) => {
    setShowTopDate(true)
    clearTimeout(hideTopDateTimeout.current)
    hideTopDateTimeout.current = setTimeout(() => {
      setShowTopDate(false)
    }, 1000)

    // const nextMessageNode: any = document.getElementById(nextTargetMessage)
    // const lastVisibleMessage: any = document.getElementById(lastVisibleMessageId)
    renderTopDate()
    const { target } = event
    let forceLoadPrevMessages = false
    if (-target.scrollTop + target.offsetHeight + 30 > target.scrollHeight) {
      forceLoadPrevMessages = true
    }
    if (
      target.scrollTop === 0 &&
      scrollToNewMessage.scrollToBottom &&
      scrollToNewMessage.updateMessageList &&
      messagesLoading !== LOADING_STATE.LOADING
    ) {
      dispatch(getMessagesAC(channel, true))
    }
    if (scrollToReply) {
      target.scrollTop = scrollToReply
    } else {
      if (target.scrollTop <= -50) {
        dispatch(showScrollToNewMessageButtonAC(true))
      } else {
        dispatch(showScrollToNewMessageButtonAC(false))
      }
      if (messagesIndexMap[lastVisibleMessageId] < 15 || forceLoadPrevMessages) {
        if (connectionStatus === CONNECTION_STATUS.CONNECTED && !scrollToNewMessage.scrollToBottom && hasPrevMessages) {
          if (messagesLoading === LOADING_STATE.LOADING || loading || prevDisable) {
            shouldLoadMessages = 'prev'
          } else {
            if (shouldLoadMessages === 'prev') {
              shouldLoadMessages = ''
            }
            loadDirection = 'prev'
            handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
            if (!getHasPrevCached()) {
              loadFromServer = true
            }
            nextDisable = true
          }
        }
      }
      if (messagesIndexMap[lastVisibleMessageId] >= messages.length - 15 || target.scrollTop === 0) {
        if (
          connectionStatus === CONNECTION_STATUS.CONNECTED &&
          !scrollToNewMessage.scrollToBottom &&
          (hasNextMessages || getHasNextCached())
        ) {
          if (messagesLoading === LOADING_STATE.LOADING || loading || nextDisable) {
            shouldLoadMessages = 'next'
          } else {
            if (shouldLoadMessages === 'next') {
              shouldLoadMessages = ''
            }
            loadDirection = 'next'
            prevDisable = true
            handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
          }
        }
      }

      /* if (
        connectionStatus === CONNECTION_STATUS.CONNECTED &&
        !prevDisable &&
        messagesLoading !== LOADING_STATE.LOADING &&
        !scrollToRepliedMessage &&
        -target.scrollTop >= target.scrollHeight - target.offsetHeight - scrollHeightTarget &&
        /!* hasPrev && *!/ !loading &&
        !scrollToNewMessage.scrollToBottom &&
        messages.length
      ) {
        loadDirection = 'prev'
        // console.log('load prev messages........ ')
        prevMessageId = messages[0].id
        // console.log('MESSAGE_LOAD_DIRECTION.PREV _-------------------', MESSAGE_LOAD_DIRECTION.PREV)
        handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
        if (!getHasPrevCached()) {
          // console.log('load from server ..... ', true)
          loadFromServer = true
        }
        /!*   if (cachedMessages.prev) {
          loading = true
          handleAddMessages([], 'prev', true)
        } else if (hasPrevMessages) {
          await handleLoadMoreMessages('prev', 15)
        }
       *!/
        // if (hasPrevMessages && lastVisibleMessage) {
        nextDisable = true
        // target.scrollTop = lastVisibleMessage.offsetTop
        // }
        // dispatch(loadMoreMessagesAC(10, 'prev', channel.id))
      } */
      if (messagesIndexMap[lastVisibleMessageId] > messages.length - 10) {
        nextDisable = false
      }
      /*  if (
        !nextDisable &&
        connectionStatus === CONNECTION_STATUS.CONNECTED &&
        messagesLoading !== LOADING_STATE.LOADING &&
        (hasNextMessages || getHasNextCached()) &&
        -target.scrollTop <= 400 &&
        // (hasNext || cachedMessages.next) &&
        !loading &&
        !scrollToNewMessage.scrollToBottom
      ) {
        loadDirection = 'next'

        // console.log('load next......... ')
        /!* if (lastVisibleMessage) {
          target.scrollTop = lastVisibleMessage.offsetTop - 10
        } *!/
        // dispatch(loadMoreMessagesAC(10, 'next', channel.id))
        // if (hasNextMessages && lastVisibleMessage) {
        prevDisable = true
        // }
        // console.log('MESSAGE_LOAD_DIRECTION.PREV _-------------------', MESSAGE_LOAD_DIRECTION.NEXT)
        handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
        /!* if (cachedMessages.next) {
          loading = true
          handleAddMessages([], 'next', true)
        } else if (hasNextMessages) {
          await handleLoadMoreMessages('next', 15)
        } *!/
      } */
    }
  }

  const handleScrollToRepliedMessage = async (messageId: string) => {
    prevDisable = true
    nextDisable = true
    if (messages.findIndex((msg) => msg.id === messageId) >= 10) {
      const repliedMessage = document.getElementById(messageId)
      if (repliedMessage) {
        scrollRef.current.scrollTop = repliedMessage.offsetTop - scrollRef.current.offsetHeight / 2
        repliedMessage.classList.add('highlight')
        setTimeout(() => {
          repliedMessage.classList.remove('highlight')
          prevDisable = false
          nextDisable = false
        }, 1000)
      }
    } else {
      // await handleGetMessages(undefined, messageId)
      dispatch(getMessagesAC(channel, undefined, messageId))
    }
  }

  const handleLoadMoreMessages = (direction: string, limit: number) => {
    const lastMessageId = messages.length && messages[messages.length - 1].id
    const firstMessageId = messages.length && messages[0].id
    // messageQueryBuilder.reverse(true)
    // setMessagesLoadingStateAC(LOADING_STATE.LOADING)
    // let result: any = {}
    const hasPrevCached = getHasPrevCached()
    const hasNextCached = getHasNextCached()
    if (!loading && connectionStatus === CONNECTION_STATUS.CONNECTED) {
      if (direction === MESSAGE_LOAD_DIRECTION.PREV && firstMessageId && (hasPrevMessages || hasPrevCached)) {
        loading = true
        // result = await messageQuery.loadPreviousMessageId(firstMessageId)
        dispatch(loadMoreMessagesAC(channel.id, limit, direction, firstMessageId, hasPrevMessages))
        // lastPrevLoadedId = messageQuery.firstMessageId
        // hasPrevMessages = result.hasNext

        // handleAddMessages(result.messages, 'prev')
        // addMessagesToMap(channel.id, result.messages, 'prev')
      } else if (
        direction === MESSAGE_LOAD_DIRECTION.NEXT &&
        lastMessageId &&
        (hasNextMessages || hasNextCached)
        // channel.newMessageCount &&
        // channel.newMessageCount > 0
      ) {
        loading = true
        dispatch(loadMoreMessagesAC(channel.id, limit, direction, lastMessageId, hasNextMessages))
        /* messageQuery.loadNextMessageId(lastMessageId).then((result: any) => {
          firstPrevLoadedId = messageQuery.lastMessageId
          hasNextMessages = result.hasNext
          if (result.messages.length) {
            handleAddMessages(result.messages, 'next')
            addMessagesToMap(channel.id, result.messages, 'next')
          }
        }) */
      }
      // setMessagesLoadingStateAC(LOADING_STATE.LOADED)
    }
    // addMessagesAC(result.messages, direction)
  }

  const handleDragIn = (e: any) => {
    e.preventDefault()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      let filesType = 'file'
      const fileList: DataTransferItem[] = Array.from(e.dataTransfer.items)
      fileList.forEach((file) => {
        const fileType = file.type.split('/')[0]
        if (fileType === 'image' || fileType === 'video') {
          filesType = 'media'
        }
      })
      setIsDragging(filesType)
    }
  }

  const handleDragOver = (e: any) => {
    e.preventDefault()
    e.target && e.target.classList.add('dragover')
  }
  const handleDragOut = (e: any) => {
    if (e.target.classList.contains('dragover')) {
      e.target.classList.remove('dragover')
    }
    if (!e.relatedTarget || !e.relatedTarget.draggable) {
      setIsDragging(false)
    }
  }
  const handleDropFile = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList: File[] = Object.values(e.dataTransfer.files)
      const attachmentsFiles: any = []
      new Promise<void>((resolve) => {
        fileList.forEach((attachment, index) => {
          const fileReader = new FileReader()
          fileReader.onload = (event: any) => {
            const file = event.target.result
            attachmentsFiles.push({ name: attachment.name, data: file, type: attachment.type })
            if (fileList.length - 1 === index) {
              resolve()
            }
          }
          fileReader.readAsDataURL(attachment)
        })
      }).then(() => {
        dispatch(setDraggedAttachmentsAC(attachmentsFiles, 'file'))
      })
      e.dataTransfer.clearData()
    }
  }

  const handleDropMedia = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList: File[] = Object.values(e.dataTransfer.files)
      const attachmentsFiles: any = []
      new Promise<void>((resolve) => {
        let readFiles = 0
        fileList.forEach((attachment) => {
          const fileReader = new FileReader()
          fileReader.onload = (event: any) => {
            const file = event.target.result
            attachmentsFiles.push({ name: attachment.name, data: file, type: attachment.type })
            readFiles++
            if (fileList.length === readFiles) {
              resolve()
            }
          }
          fileReader.readAsDataURL(attachment)
        })
      }).then(() => {
        dispatch(setDraggedAttachmentsAC(attachmentsFiles, 'media'))
      })
      e.dataTransfer.clearData()
    }
  }

  useEffect(() => {
    if (scrollToRepliedMessage) {
      loading = false
      scrollRef.current.style.scrollBehavior = 'inherit'
      const repliedMessage = document.getElementById(scrollToRepliedMessage)
      if (repliedMessage) {
        setScrollToReply(repliedMessage && repliedMessage.offsetTop - (channel.backToLinkedChannel ? 0 : 200))
        scrollRef.current.scrollTop =
          repliedMessage && repliedMessage.offsetTop - (channel.backToLinkedChannel ? 0 : 200)
        if (!channel.backToLinkedChannel) {
          repliedMessage && repliedMessage.classList.add('highlight')
        }
        setTimeout(() => {
          if (!channel.backToLinkedChannel) {
            const repliedMessage = document.getElementById(scrollToRepliedMessage)
            repliedMessage && repliedMessage.classList.remove('highlight')
          }
          prevDisable = false
          setScrollToReply(null)
          scrollRef.current.style.scrollBehavior = 'smooth'
        }, 800)
      }
      dispatch(setScrollToMessagesAC(null))
    }
  }, [scrollToRepliedMessage])

  useEffect(() => {
    if (scrollToNewMessage.scrollToBottom) {
      if (scrollToNewMessage.isIncomingMessage) {
        if (scrollRef.current.scrollTop > -100) {
          scrollRef.current.scrollTop = 0
        }
      } else {
        nextDisable = true
        prevDisable = true
        scrollRef.current.scrollTop = 0
        dispatch(showScrollToNewMessageButtonAC(false))
        setTimeout(() => {
          prevDisable = false
        }, 800)
      }

      // loading = true
      /* if (scrollToNewMessage.updateMessageList && messagesLoading !== LOADING_STATE.LOADING) {
        setTimeout(() => {
          if (getHasNextCached()) {
            dispatch(getMessagesAC(channel, true))
          }
        }, 800)
      } */
    }
  }, [scrollToNewMessage])

  useDidUpdate(() => {
    if (isDragging) {
      setIsDragging(false)
    }
  }, [browserTabIsActive])

  useDidUpdate(() => {
    if (!mediaFile && isDragging) {
      setIsDragging(false)
    }
  }, [mediaFile])

  useDidUpdate(() => {
    if (!draggingSelector) {
      setIsDragging(false)
    }
  }, [draggingSelector])

  useEffect(() => {
    setHasNextCached(false)
    setHasPrevCached(false)
    if (channel.backToLinkedChannel) {
      const visibleMessages = getVisibleMessagesMap()
      const visibleMessagesIds = Object.keys(visibleMessages)
      // const messageId = visibleMessagesIds[Math.floor(visibleMessagesIds.length / 2)]
      const messageId = visibleMessagesIds[visibleMessagesIds.length - 1]

      dispatch(getMessagesAC(channel, undefined, messageId))
      setUnreadMessageId(messageId)
    } else {
      if (!channel.isLinkedChannel) {
        clearVisibleMessagesMap()
      }
      if (channel) {
        dispatch(getMessagesAC(channel))
      }
      if (channel.id) {
        if (channel.newMessageCount && channel.newMessageCount > 0) {
          setUnreadMessageId(channel.lastDisplayedMsgId)
        } else {
          setUnreadMessageId('')
        }
      }
    }
    setMediaFile(null)
    if (selectedMessagesMap && selectedMessagesMap.size) {
      dispatch(clearSelectedMessagesAC())
    }

    // lastPrevLoadedId = ''
    // firstPrevLoadedId = ''
    // hasNextMessages = true
    // hasPrevMessages = true
    nextDisable = false
    prevDisable = false
    scrollToBottom = true

    setAllowEditDeleteIncomingMessage(allowEditDeleteIncomingMessage)
    // messageTopDateRef.current.innerText = ''
    // setActiveChannel(channel)
  }, [channel.id])

  useDidUpdate(() => {
    if (!isDragging) {
      renderTopDate()
    }
  }, [isDragging])

  /* useEffect(() => {
    if (channel.id !== activeChannelId) {
      setHideMessages(true)
      activeChannelId = channel.id
    }
  }) */
  useEffect(() => {
    // setHideMessages(false)
    // nextTargetMessage = !hasNextMessages ? '' : messages[messages.length - 4] && messages[messages.length - 4].id
    if (loading) {
      // setTimeout(() => {
      if (loadDirection !== 'next') {
        const lastVisibleMessage: any = document.getElementById(lastVisibleMessageId)
        if (lastVisibleMessage) {
          scrollRef.current.style.scrollBehavior = 'inherit'
          scrollRef.current.scrollTop = lastVisibleMessage.offsetTop
          scrollRef.current.style.scrollBehavior = 'smooth'
          /*  if (lastVisibleMessage && scrollToLastVisible) {
            scrollRef.current.style.scrollBehavior = 'inherit'
            scrollRef.current.scrollTop = lastVisibleMessage.offsetTop
            scrollRef.current.style.scrollBehavior = 'smooth'
          } */
        }
        if (loadFromServer) {
          setTimeout(() => {
            loading = false
            loadFromServer = false
            nextDisable = false
            if (shouldLoadMessages === 'prev' && messagesIndexMap[lastVisibleMessageId] < 15) {
              handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
            }
            if (shouldLoadMessages === 'next' && messagesIndexMap[lastVisibleMessageId] > messages.length - 15) {
              handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
            }
          }, 50)
        } else {
          loading = false
          if (shouldLoadMessages === 'prev') {
            handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
            shouldLoadMessages = ''
          }
          if (shouldLoadMessages === 'next') {
            handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
            shouldLoadMessages = ''
          }
        }
      } else {
        const lastVisibleMessage: any = document.getElementById(lastVisibleMessageId)
        if (lastVisibleMessage) {
          scrollRef.current.style.scrollBehavior = 'inherit'
          scrollRef.current.scrollTop =
            lastVisibleMessage.offsetTop - scrollRef.current.offsetHeight + lastVisibleMessage.offsetHeight
          scrollRef.current.style.scrollBehavior = 'smooth'
        }
        loading = false
        prevDisable = false
        if (shouldLoadMessages === 'prev') {
          handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
          shouldLoadMessages = ''
        }
        if (shouldLoadMessages === 'next') {
          handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
          shouldLoadMessages = ''
        }
      }
      // }, 200)
    }
    if (scrollToNewMessage.scrollToBottom && messages.length) {
      setTimeout(() => {
        dispatch(scrollToNewMessageAC(false, false, false))
      }, 500)
    }
    /* let updatedAttachments: any = []
    if (messages.length) {
      messages.forEach((message) => {
        if (message.attachments.length) {
          message.attachments.forEach((attachment: IAttachment) => {
            if (attachment.type === 'image' || attachment.type === 'video') {
              updatedAttachments = [...updatedAttachments, attachment]
            }
          })
        }
      })
    }
    setAttachments(updatedAttachments) */

    renderTopDate()
    if (scrollToBottom) {
      dispatch(scrollToNewMessageAC(true))
      scrollToBottom = false
      /* setTimeout(() => {
        scrollRef.current.scrollTop = 0
        scrollToBottom = false
      }, 100) */
    }
  }, [messages])
  useDidUpdate(() => {
    console.log('connection status is changed.. .... ', connectionStatus, 'channel  ... ', channel)
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      loading = false
      prevDisable = false
      nextDisable = false
      clearMessagesMap()
      removeAllMessages()
      if (channel.id) {
        dispatch(getMessagesAC(channel))
      }
      // dispatch(switchChannelActionAC(activeChannel.id))
    }
  }, [connectionStatus])
  /* useEffect(() => {
  }, [pendingMessages]) */
  useEffect(() => {
    if (channel.newMessageCount && channel.newMessageCount > 0 && getUnreadScrollTo()) {
      if (scrollRef.current) {
        scrollRef.current.style.scrollBehavior = 'inherit'
      }
      const lastReadMessageNode: any = document.getElementById(channel.lastDisplayedMsgId)
      if (lastReadMessageNode) {
        scrollRef.current.scrollTop = lastReadMessageNode.offsetTop
        if (scrollRef.current) {
          scrollRef.current.style.scrollBehavior = 'smooth'
        }
        setUnreadScrollTo(false)
      }

      /* const unreads: any = document.querySelectorAll('.unread')[0]
      if (unreads && messagesLoading === LOADING_STATE.LOADED) {
        scrollRef.current.scrollTo(0, unreads.offsetTop - messagesBoxRef.current.offsetHeight / 2)
        scrollRef.current.scrollTop = -5
        setUnreadScrollTo(false)
      } */
    }
  })

  return (
    <React.Fragment>
      {isDragging && !(attachmentsPreview && mediaFile) && (
        <DragAndDropContainer
          id='draggingContainer'
          draggable
          onDragLeave={handleDragOut}
          topOffset={scrollRef && scrollRef.current && scrollRef.current.offsetTop}
          height={scrollRef && scrollRef.current && scrollRef.current.offsetHeight}
        >
          {/* {isDragging === 'media' ? ( */}
          {/*  <React.Fragment> */}
          <DropAttachmentArea
            color={textPrimary}
            margin='32px 32px 12px'
            draggable
            onDrop={handleDropFile}
            onDragOver={handleDragOver}
          >
            <IconWrapper draggable iconColor={accentColor}>
              <ChooseFileIcon />
            </IconWrapper>
            Drag & drop to send as file
          </DropAttachmentArea>
          {isDragging === 'media' && (
            <DropAttachmentArea draggable color={textPrimary} onDrop={handleDropMedia} onDragOver={handleDragOver}>
              <IconWrapper draggable iconColor={accentColor}>
                <ChooseMediaIcon />
              </IconWrapper>
              Drag & drop to send as media
            </DropAttachmentArea>
          )}
          {/* </React.Fragment> */}
          {/* ) : ( */}
          {/*  <div>File</div> */}
          {/* )} */}
        </DragAndDropContainer>
      )}
      <React.Fragment>
        {showTopFixedDate && (
          <MessageTopDate
            visible={showTopDate}
            dateDividerFontSize={dateDividerFontSize}
            dateDividerTextColor={dateDividerTextColor || textPrimary}
            dateDividerBorder={dateDividerBorder}
            dateDividerBackgroundColor={dateDividerBackgroundColor || colors.backgroundColor}
            dateDividerBorderRadius={dateDividerBorderRadius}
            topOffset={scrollRef && scrollRef.current && scrollRef.current.offsetTop}
          >
            <span ref={messageTopDateRef} />
          </MessageTopDate>
        )}
        {/* {!hideMessages && ( */}
        <Container
          id='scrollableDiv'
          ref={scrollRef}
          stopScrolling={stopScrolling}
          onScroll={handleMessagesListScroll}
          onDragEnter={handleDragIn}
          backgroundColor={backgroundColor}
        >
          {messages.length && messages.length > 0 ? (
            <MessagesBox
              enableResetScrollToCoords={false}
              replyMessage={messageForReply && messageForReply.id}
              attachmentsSelected={attachmentsSelected}
              ref={messagesBoxRef}
              className='messageBox'
            >
              {messageList.map((message: any, index: number) => {
                const prevMessage = messages[index - 1]
                const nextMessage = messages[index + 1]
                const isUnreadMessage =
                  !!(unreadMessageId && unreadMessageId === message.id && nextMessage) && !channel.backToLinkedChannel
                const messageMetas = isJSON(message.metadata) ? JSON.parse(message.metadata) : message.metadata
                messagesIndexMap[message.id] = index
                return (
                  <React.Fragment key={message.id || message.tid}>
                    <CreateMessageDateDivider
                      // lastIndex={index === 0}
                      noMargin={
                        !isUnreadMessage && prevMessage && prevMessage.type === 'system' && message.type !== 'system'
                      }
                      theme={theme}
                      lastIndex={false}
                      currentMessageDate={message.createdAt}
                      nextMessageDate={prevMessage && prevMessage.createdAt}
                      messagesHasNext={hasPrevMessages}
                      dateDividerFontSize={dateDividerFontSize}
                      dateDividerTextColor={dateDividerTextColor}
                      dateDividerBorder={dateDividerBorder}
                      dateDividerBackgroundColor={dateDividerBackgroundColor}
                      chatBackgroundColor={backgroundColor}
                      dateDividerBorderRadius={dateDividerBorderRadius}
                      marginBottom={
                        prevMessage && prevMessage.type === 'system' && message.type !== 'system' ? '16px' : '0'
                      }
                      marginTop={differentUserMessageSpacing}
                    />
                    {message.type === 'system' ? (
                      <SystemMessage
                        channel={channel}
                        message={message}
                        nextMessage={nextMessage}
                        connectionStatus={connectionStatus}
                        differentUserMessageSpacing={differentUserMessageSpacing}
                        tabIsActive={browserTabIsActive}
                        contactsMap={contactsMap}
                        fontSize={dateDividerFontSize}
                        textColor={dateDividerTextColor}
                        border={dateDividerBorder}
                        backgroundColor={dateDividerBackgroundColor}
                        borderRadius={dateDividerBorderRadius}
                      />
                    ) : (
                      <MessageWrapper id={message.id}>
                        <Message
                          message={{
                            ...message,
                            metadata: messageMetas
                          }}
                          theme={theme}
                          channel={channel}
                          stopScrolling={setStopScrolling}
                          handleMediaItemClick={(attachment) => setMediaFile(attachment)}
                          handleScrollToRepliedMessage={handleScrollToRepliedMessage}
                          prevMessage={prevMessage}
                          nextMessage={nextMessage}
                          isUnreadMessage={isUnreadMessage}
                          unreadMessageId={unreadMessageId}
                          setLastVisibleMessageId={(msgId) => setLastVisibleMessageId(msgId)}
                          isThreadMessage={false}
                          fontFamily={fontFamily}
                          ownMessageOnRightSide={ownMessageOnRightSide}
                          messageWidthPercent={messageWidthPercent}
                          messageStatusAndTimePosition={messageStatusAndTimePosition}
                          messageStatusDisplayingType={messageStatusDisplayingType}
                          ownMessageBackground={ownMessageBackground}
                          ownRepliedMessageBackground={ownRepliedMessageBackground}
                          incomingMessageBackground={incomingMessageBackground}
                          incomingRepliedMessageBackground={incomingRepliedMessageBackground}
                          showMessageStatus={showMessageStatus}
                          showMessageTimeAndStatusOnlyOnHover={showMessageTimeAndStatusOnlyOnHover}
                          showMessageTime={showMessageTime}
                          showMessageStatusForEachMessage={showMessageStatusForEachMessage}
                          showMessageTimeForEachMessage={showMessageTimeForEachMessage}
                          hoverBackground={hoverBackground}
                          showOwnAvatar={showOwnAvatar}
                          showSenderNameOnDirectChannel={showSenderNameOnDirectChannel}
                          showSenderNameOnOwnMessages={showSenderNameOnOwnMessages}
                          showSenderNameOnGroupChannel={showSenderNameOnGroupChannel}
                          MessageActionsMenu={MessageActionsMenu}
                          CustomMessageItem={CustomMessageItem}
                          messageReaction={messageReaction}
                          editMessage={editMessage}
                          copyMessage={copyMessage}
                          replyMessage={replyMessage}
                          replyMessageInThread={replyMessageInThread}
                          deleteMessage={deleteMessage}
                          selectMessage={selectMessage}
                          allowEditDeleteIncomingMessage={allowEditDeleteIncomingMessage}
                          reportMessage={reportMessage}
                          reactionIcon={reactionIcon}
                          editIcon={editIcon}
                          copyIcon={copyIcon}
                          replyIcon={replyIcon}
                          replyInThreadIcon={replyInThreadIcon}
                          forwardIcon={forwardIcon}
                          deleteIcon={deleteIcon}
                          selectIcon={selectIcon}
                          forwardMessage={forwardMessage}
                          starIcon={starIcon}
                          staredIcon={staredIcon}
                          reportIcon={reportIcon}
                          reactionIconOrder={reactionIconOrder}
                          openFrequentlyUsedReactions={openFrequentlyUsedReactions}
                          emojisCategoryIconsPosition={emojisCategoryIconsPosition}
                          emojisContainerBorderRadius={emojisContainerBorderRadius}
                          fixEmojiCategoriesTitleOnTop={fixEmojiCategoriesTitleOnTop}
                          editIconOrder={editIconOrder}
                          copyIconOrder={copyIconOrder}
                          replyIconOrder={replyIconOrder}
                          replyInThreadIconOrder={replyInThreadIconOrder}
                          forwardIconOrder={forwardIconOrder}
                          deleteIconOrder={deleteIconOrder}
                          selectIconOrder={selectIconOrder}
                          starIconOrder={starIconOrder}
                          reportIconOrder={reportIconOrder}
                          reactionIconTooltipText={reactionIconTooltipText}
                          editIconTooltipText={editIconTooltipText}
                          copyIconTooltipText={copyIconTooltipText}
                          replyIconTooltipText={replyIconTooltipText}
                          replyInThreadIconTooltipText={replyInThreadIconTooltipText}
                          forwardIconTooltipText={forwardIconTooltipText}
                          deleteIconTooltipText={deleteIconTooltipText}
                          selectIconTooltipText={selectIconTooltipText}
                          starIconTooltipText={starIconTooltipText}
                          reportIconTooltipText={reportIconTooltipText}
                          messageActionIconsColor={messageActionIconsColor}
                          inlineReactionIcon={inlineReactionIcon}
                          fileAttachmentsIcon={fileAttachmentsIcon}
                          fileAttachmentsBoxWidth={fileAttachmentsBoxWidth}
                          fileAttachmentsBoxBackground={fileAttachmentsBoxBackground}
                          fileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
                          fileAttachmentsTitleColor={fileAttachmentsTitleColor}
                          fileAttachmentsSizeColor={fileAttachmentsSizeColor}
                          imageAttachmentMaxWidth={imageAttachmentMaxWidth}
                          imageAttachmentMaxHeight={imageAttachmentMaxHeight}
                          videoAttachmentMaxWidth={videoAttachmentMaxWidth}
                          videoAttachmentMaxHeight={videoAttachmentMaxHeight}
                          reactionsDisplayCount={reactionsDisplayCount}
                          showEachReactionCount={showEachReactionCount}
                          showTotalReactionCount={showTotalReactionCount}
                          reactionItemBorder={reactionItemBorder}
                          reactionItemBorderRadius={reactionItemBorderRadius}
                          reactionItemBackground={reactionItemBackground}
                          reactionItemPadding={reactionItemPadding}
                          reactionItemMargin={reactionItemMargin}
                          reactionsFontSize={reactionsFontSize}
                          reactionsContainerBoxShadow={reactionsContainerBoxShadow}
                          reactionsContainerBorder={reactionsContainerBorder}
                          reactionsContainerBorderRadius={reactionsContainerBorderRadius}
                          reactionsContainerPadding={reactionsContainerPadding}
                          reactionsContainerBackground={reactionsContainerBackground}
                          reactionsContainerTopPosition={reactionsContainerTopPosition}
                          reactionsDetailsPopupBorderRadius={reactionsDetailsPopupBorderRadius}
                          reactionsDetailsPopupHeaderItemsStyle={reactionsDetailsPopupHeaderItemsStyle}
                          sameUserMessageSpacing={sameUserMessageSpacing}
                          differentUserMessageSpacing={differentUserMessageSpacing}
                          selectedMessagesMap={selectedMessagesMap}
                          contactsMap={contactsMap}
                          connectionStatus={connectionStatus}
                          openedMessageMenuId={openedMessageMenuId}
                          tabIsActive={tabIsActive}
                          messageTextFontSize={messageTextFontSize}
                          messageTextLineHeight={messageTextLineHeight}
                          messageStatusSize={messageStatusSize}
                          messageStatusColor={messageStatusColor}
                          messageReadStatusColor={messageReadStatusColor}
                          messageStateFontSize={messageStateFontSize}
                          messageStateColor={messageStateColor}
                          messageTimeFontSize={messageTimeFontSize}
                          messageTimeColor={messageTimeColor}
                          messageStatusAndTimeLineHeight={messageStatusAndTimeLineHeight}
                        />
                      </MessageWrapper>
                    )}
                    {isUnreadMessage ? (
                      <MessageDivider
                        theme={theme}
                        newMessagesSeparatorTextColor={newMessagesSeparatorTextColor}
                        newMessagesSeparatorFontSize={newMessagesSeparatorFontSize}
                        newMessagesSeparatorWidth={newMessagesSeparatorWidth}
                        newMessagesSeparatorBorder={newMessagesSeparatorBorder}
                        newMessagesSeparatorBorderRadius={newMessagesSeparatorBorderRadius}
                        newMessagesSeparatorBackground={newMessagesSeparatorBackground}
                        newMessagesSeparatorLeftRightSpaceWidth={newMessagesSeparatorTextLeftRightSpacesWidth}
                        dividerText={newMessagesSeparatorText || 'Unread Messages'}
                        marginTop={message.type === 'system' ? '0px' : ''}
                        marginBottom={message.type === 'system' ? '16px' : '0'}
                        chatBackgroundColor={backgroundColor}
                        unread
                      />
                    ) : null}
                  </React.Fragment>
                )
              })}
            </MessagesBox>
          ) : (
            messagesLoading === LOADING_STATE.LOADED && (
              <NoMessagesContainer color={textPrimary}>
                <NoMessagesIcon />
                <NoMessagesTitle color={textPrimary}>No Messages yet</NoMessagesTitle>
                <NoMessagesText color={colors.textColor2}>No messages yet, start the chat</NoMessagesText>
                {/* {channel.type === CHANNEL_TYPE.DIRECT
                  ? ' chat'
                  : channel.type === CHANNEL_TYPE.GROUP || channel.type === CHANNEL_TYPE.PRIVATE
                  ? ' group chat'
                  : ' channel'} */}
              </NoMessagesContainer>
            )
          )}
          {attachmentsPreview && mediaFile && (
            <SliderPopup channel={channel} setIsSliderOpen={setMediaFile} currentMediaFile={mediaFile} />
          )}
        </Container>
      </React.Fragment>

      {/* // )} */}
    </React.Fragment>
  )
}
// const MemoizedMessageList =

export default MessageList

interface MessageBoxProps {
  readonly enableResetScrollToCoords: boolean
  readonly replyMessage: boolean | string
  readonly attachmentsSelected: boolean
}

export const Container = styled.div<{ stopScrolling?: boolean; backgroundColor?: string }>`
  display: flex;
  flex-direction: column-reverse;
  flex-grow: 1;
  position: relative;
  overflow: auto;
  scroll-behavior: smooth;
  will-change: left, top;
  background-color: ${(props) => props.backgroundColor};
`
export const EmptyDiv = styled.div`
  height: 300px;
`

const MessagesBox = styled.div<MessageBoxProps>`
  //height: auto;
  display: flex;
  //flex-direction: column-reverse;
  flex-direction: column;
  padding-bottom: 20px;
  //overflow: auto;
  //scroll-behavior: unset;
`

export const MessageTopDate = styled.div<{
  topOffset?: number
  marginTop?: string
  marginBottom?: string
  visible?: boolean
  dateDividerFontSize?: string
  dateDividerTextColor?: string
  dateDividerBackgroundColor?: string
  dateDividerBorder?: string
  dateDividerBorderRadius?: string
}>`
  position: absolute;
  justify-content: center;
  width: 100%;
  top: ${(props) => (props.topOffset ? `${props.topOffset + 22}px` : '22px')};
  left: 0;
  margin-top: ${(props) => props.marginTop};
  margin-bottom: ${(props) => props.marginBottom};
  text-align: center;
  z-index: 10;
  background: transparent;
  opacity: ${(props) => (props.visible ? '1' : '0')};
  transition: all 0.2s ease-in-out;

  span {
    display: inline-block;
    max-width: 380px;
    font-style: normal;
    font-weight: normal;
    font-size: ${(props) => props.dateDividerFontSize || '14px'};
    color: ${(props) => props.dateDividerTextColor};
    background: ${(props) => props.dateDividerBackgroundColor || '#ffffff'};
    border: ${(props) => props.dateDividerBorder};
    box-sizing: border-box;
    border-radius: ${(props) => props.dateDividerBorderRadius || '14px'};
    padding: 5px 16px;
    box-shadow:
      0 0 2px rgba(0, 0, 0, 0.08),
      0 2px 24px rgba(0, 0, 0, 0.08);
    text-overflow: ellipsis;
    overflow: hidden;
  }
`

export const DragAndDropContainer = styled.div<{ topOffset?: number; height?: number }>`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  margin-bottom: -31px;
  margin-top: -2px;

  position: absolute;
  left: 0;
  top: ${(props) => (props.topOffset ? `${props.topOffset + 2}px` : 0)};
  width: 100%;
  height: ${(props) => (props.height ? `${props.height + 30}px` : '100%')};
  background-color: ${colors.white};
  z-index: 999;
`

export const IconWrapper = styled.span<{ iconColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  width: 64px;
  background-color: ${colors.backgroundColor};
  border-radius: 50%;
  text-align: center;
  margin-bottom: 16px;
  transition: all 0.3s;
  pointer-events: none;

  & > svg {
    color: ${(props) => props.iconColor};
    width: 32px;
    height: 32px;
  }
`

export const DropAttachmentArea = styled.div<{ color: string; margin?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  height: 100%;
  border: 1px dashed ${colors.textColor2};
  border-radius: 16px;
  margin: ${(props) => props.margin || '12px 32px 32px'};
  font-weight: 400;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
  transition: all 0.1s;

  &.dragover {
    background-color: ${colors.backgroundColor};

    ${IconWrapper} {
      background-color: ${colors.white};
    }
  }
`

export const MessageWrapper = styled.div<{}>`
  &.highlight {
    & .messageBody {
      transform: scale(1.1);
      background-color: #d5d5d5;
    }
  }
`

export const NoMessagesContainer = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  height: 100%;
  width: 100%;
  font-weight: 400;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
`

export const NoMessagesTitle = styled.h4<{ color: string }>`
  margin: 12px 0 8px;
  font-family: Inter, sans-serif;
  text-align: center;
  font-size: 20px;
  font-style: normal;
  font-weight: 500;
  line-height: 24px;
  color: ${(props) => props.color};
`

export const NoMessagesText = styled.p<{ color: string }>`
  margin: 0;
  text-align: center;
  font-feature-settings:
    'clig' off,
    'liga' off;
  font-family: Inter, sans-serif;
  font-size: 15px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px;
  color: ${(props) => props.color};
`
