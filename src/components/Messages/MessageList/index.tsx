import styled from 'styled-components'
import React, { useRef, useEffect, useState, FC, useCallback } from 'react'
import { shallowEqual } from 'react-redux'
import { useDispatch, useSelector } from 'store/hooks'
import moment from 'moment'
// Store
import {
  clearSelectedMessagesAC,
  getMessagesAC,
  loadMoreMessagesAC,
  resendMessageAC,
  resendPendingPollActionsAC,
  scrollToNewMessageAC,
  setScrollToMessagesAC,
  showScrollToNewMessageButtonAC,
  setUnreadScrollToAC
} from '../../../store/message/actions'
import {
  activeChannelMessagesSelector,
  messagesHasNextSelector,
  messagesHasPrevSelector,
  messagesLoadingState,
  openedMessageMenuSelector,
  scrollToMentionedMessageSelector,
  scrollToMessageHighlightSelector,
  scrollToMessageBehaviorSelector,
  scrollToMessageSelector,
  scrollToNewMessageSelector,
  selectedMessagesMapSelector,
  showScrollToNewMessageButtonSelector,
  pendingPollActionsSelector,
  pendingMessagesMapSelector,
  unreadScrollToSelector
} from '../../../store/message/selector'
import { setDraggedAttachmentsAC } from '../../../store/channel/actions'
import { themeSelector } from '../../../store/theme/selector'
import { activeChannelSelector, isDraggingSelector, tabIsActiveSelector } from '../../../store/channel/selector'
import { browserTabIsActiveSelector, connectionStatusSelector, contactsMapSelector } from '../../../store/user/selector'
import { CONNECTION_STATUS } from '../../../store/user/constants'
// Hooks
import { useColor } from '../../../hooks'
// Assets
import { ReactComponent as ChooseFileIcon } from '../../../assets/svg/choseFile.svg'
import { ReactComponent as ChooseMediaIcon } from '../../../assets/svg/choseMedia.svg'
import { ReactComponent as NoMessagesIcon } from '../../../assets/svg/noMessagesIcon.svg'
// Helpers
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
import { setAllowEditDeleteIncomingMessage } from '../../../helpers/message'
import { THEME_COLORS } from '../../../UIHelper/constants'
import {
  IAttachment,
  IChannel,
  IContactsMap,
  IMarker,
  IMessage,
  IUser,
  ILabels,
  MessageInfoTab,
  ITabsStyles,
  IListItemStyles,
  OGMetadataProps
} from '../../../types'
import { LOADING_STATE } from '../../../helpers/constants'
// Components
import MessageDivider from '../../MessageDivider'
import SliderPopup from '../../../common/popups/sliderPopup'
import SystemMessage from '../SystemMessage'
import Message from '../../Message'
import { IAttachmentProperties, IMessageStyles } from '../../Message/Message.types'
import { HiddenMessageProperty, MESSAGE_TYPE } from 'types/enum'
import { getClient } from 'common/client'
import log from 'loglevel'

// moved to component-scoped refs below

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
  fontFamily?: string
  ownMessageOnRightSide?: boolean
  messageWidthPercent?: string | number
  messageStatusAndTimePosition?: 'onMessage' | 'bottomOfMessage'
  messageStatusDisplayingType?: 'ticks' | 'text'
  outgoingMessageStyles?: IMessageStyles
  incomingMessageStyles?: IMessageStyles
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
    handleRetractVote?: () => void
    handleEndVote?: () => void

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
    handleRetractVote?: () => void
    handleEndVote?: () => void
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
    handleOpenUserProfile: (user: IUser) => void
    isThreadMessage?: boolean
    unsupportedMessage: boolean
    onInviteLinkClick?: (key: string) => void
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
  retractVoteIcon?: JSX.Element
  endVoteIcon?: JSX.Element
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
  infoIconOrder?: number
  showInfoMessage?: boolean
  reactionIconTooltipText?: string
  editIconTooltipText?: string
  replyIconTooltipText?: string
  infoIconTooltipText?: string
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
  newMessagesSeparatorSpaceColor?: string
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
  attachmentsPreview?: IAttachmentProperties
  sameUserMessageSpacing?: string
  differentUserMessageSpacing?: string
  backgroundColor?: string
  messageTextFontSize?: string
  messageTextLineHeight?: string
  hiddenMessagesProperties?: HiddenMessageProperty[]
  shouldOpenUserProfileForMention?: boolean
  showInfoMessageProps?: {
    togglePopup?: () => void
    labels?: ILabels
    tabsOrder?: { key: MessageInfoTab; label: string; data: IMarker[] }[]
    showCounts?: boolean
    avatarSize?: number
    maxWidth?: string
    minWidth?: string
    height?: string
    renderItem?: (marker: IMarker, defaultNode: JSX.Element) => JSX.Element
    formatDate?: (date: Date) => string
    tabsStyles?: ITabsStyles
    listItemStyles?: IListItemStyles
  }
  ogMetadataProps?: OGMetadataProps
}

const MessageList: React.FC<MessagesProps> = ({
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
  outgoingMessageStyles,
  incomingMessageStyles,
  ownRepliedMessageBackground,
  incomingRepliedMessageBackground,
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
  showInfoMessage,
  reportMessage,
  reactionIcon,
  editIcon,
  copyIcon,
  replyIcon,
  replyInThreadIcon,
  forwardIcon,
  deleteIcon,
  selectIcon,
  retractVoteIcon,
  endVoteIcon,
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
  infoIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  copyIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
  infoIconTooltipText,
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
  newMessagesSeparatorSpaceColor,
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
  attachmentsPreview = {
    show: true,
    canDelete: true,
    canDownload: true,
    canForward: true
  },
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
  messageStatusAndTimeLineHeight,
  hiddenMessagesProperties,
  shouldOpenUserProfileForMention,
  showInfoMessageProps = {},
  ogMetadataProps
}) => {
  const {
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: outgoingMessageBackground,
    [THEME_COLORS.BACKGROUND]: themeBackgroundColor,
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.OVERLAY_BACKGROUND]: overlayBackground,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_2]: surface2,
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND_X]: incomingMessageBackgroundX
  } = useColor()

  const ChatClient = getClient()
  const { user } = ChatClient

  const dispatch = useDispatch()
  const theme = useSelector(themeSelector)
  const channel: IChannel = useSelector(activeChannelSelector)
  const [scrollIntoView, setScrollIntoView] = useState(false)
  const contactsMap: IContactsMap = useSelector(contactsMapSelector, shallowEqual)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)
  const openedMessageMenuId = useSelector(openedMessageMenuSelector, shallowEqual)
  const tabIsActive = useSelector(tabIsActiveSelector, shallowEqual)
  const selectedMessagesMap = useSelector(selectedMessagesMapSelector)
  const scrollToNewMessage = useSelector(scrollToNewMessageSelector, shallowEqual)
  const scrollToMentionedMessage = useSelector(scrollToMentionedMessageSelector, shallowEqual)
  const scrollToRepliedMessage = useSelector(scrollToMessageSelector, shallowEqual)
  const scrollToMessageHighlight = useSelector(scrollToMessageHighlightSelector, shallowEqual)
  const scrollToMessageBehavior = useSelector(scrollToMessageBehaviorSelector, shallowEqual)
  const browserTabIsActive = useSelector(browserTabIsActiveSelector, shallowEqual)
  const hasNextMessages = useSelector(messagesHasNextSelector, shallowEqual)
  const hasPrevMessages = useSelector(messagesHasPrevSelector, shallowEqual)
  const messagesLoading = useSelector(messagesLoadingState)
  const draggingSelector = useSelector(isDraggingSelector, shallowEqual)
  const pollPendingPollActions = useSelector(pendingPollActionsSelector, shallowEqual)
  const pendingMessagesMap = useSelector(pendingMessagesMapSelector, shallowEqual)
  const showScrollToNewMessageButton = useSelector(showScrollToNewMessageButtonSelector, shallowEqual)
  const unreadScrollTo = useSelector(unreadScrollToSelector, shallowEqual)
  const messages = useSelector(activeChannelMessagesSelector, shallowEqual) || []
  const [unreadMessageId, setUnreadMessageId] = useState('')
  const [mediaFile, setMediaFile] = useState<any>(null)
  const [isDragging, setIsDragging] = useState<any>(null)
  const [showTopDate, setShowTopDate] = useState<any>(null)
  const [stopScrolling, setStopScrolling] = useState<any>(false)
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const hideTopDateTimeout = useRef<any>(null)
  // const [hideMessages, setHideMessages] = useState<any>(false)
  // const [activeChannel, setActiveChannel] = useState<any>(channel)
  const [lastVisibleMessageId, setLastVisibleMessageId] = useState('')
  const [scrollToReply, setScrollToReply] = useState<any>(null)
  const [previousScrollTop, setPreviousScrollTop] = useState(0)
  const [shouldPreserveScroll, setShouldPreserveScroll] = useState(false)
  const messageForReply: any = {}
  const attachmentsSelected = false
  const [topDateLabel, setTopDateLabel] = useState<string>('')
  const scrollRef = useRef<any>(null)
  // Refs replacing former module-scope mutable state
  const loadFromServerRef = useRef<boolean>(false)
  const loadDirectionRef = useRef<string>('')
  const nextDisableRef = useRef<boolean>(false)
  const prevDisableRef = useRef<boolean>(false)
  const scrollToBottomRef = useRef<boolean>(false)
  const shouldLoadMessagesRef = useRef<'next' | 'prev' | ''>('')
  const loadingRef = useRef<boolean>(false)
  const messagesIndexMapRef = useRef<Record<string, number>>({})
  const scrollRafRef = useRef<number | null>(null)
  const loadingMessagesTimeoutRef = useRef<any>(null)
  const renderTopDate = () => {
    const container = scrollRef.current
    if (!container) return
    const dateLabels: NodeListOf<HTMLElement> = container.querySelectorAll('.divider')
    let text = ''
    for (let i = dateLabels.length - 1; i >= 0; i--) {
      const dateLabel = dateLabels[i]
      // If scroll position is around the divider itself, hide the fixed top date label
      const aroundThreshold = 40
      const labelTop = dateLabel.offsetTop - 28
      const labelBottom = labelTop + (dateLabel.offsetHeight || 0) - 28
      if (container.scrollTop >= labelTop - aroundThreshold && container.scrollTop <= labelBottom + aroundThreshold) {
        setShowTopDate(false)
        break
      }
      if (!text && container.scrollTop > labelTop - 28) {
        const span = dateLabel?.firstChild && ((dateLabel.firstChild as HTMLElement).firstChild as HTMLElement)
        text = span ? span.innerText || '' : ''
        setTopDateLabel(text)
        break
      }
    }
  }

  // @ts-ignore
  const handleMessagesListScroll = useCallback(async () => {
    const target = scrollRef.current
    if (!target) return
    if (scrollToMentionedMessage) {
      if (target.scrollTop <= -50 || channel.lastMessage.id !== messages[messages.length - 1].id) {
        dispatch(showScrollToNewMessageButtonAC(true))
      } else {
        dispatch(showScrollToNewMessageButtonAC(false))
      }
      return
    }
    setShowTopDate(true)
    clearTimeout(hideTopDateTimeout.current)
    // hideTopDateTimeout.current = setTimeout(() => {
    //   setShowTopDate(false)
    // }, 1000)
    renderTopDate()
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
    if (target.scrollTop <= -50) {
      dispatch(showScrollToNewMessageButtonAC(true))
    } else {
      dispatch(showScrollToNewMessageButtonAC(false))
    }
    if (scrollToReply) {
      target.scrollTop = scrollToReply
      return
    }
    const currentIndex = messagesIndexMapRef.current[lastVisibleMessageId]
    const hasIndex = typeof currentIndex === 'number'
    if ((hasIndex && currentIndex < 15) || forceLoadPrevMessages) {
      if (connectionStatus === CONNECTION_STATUS.CONNECTED && !scrollToNewMessage.scrollToBottom && hasPrevMessages) {
        if (loadingRef.current || messagesLoading === LOADING_STATE.LOADING || prevDisableRef.current) {
          shouldLoadMessagesRef.current = 'prev'
        } else {
          if (shouldLoadMessagesRef.current === 'prev') {
            shouldLoadMessagesRef.current = ''
          }
          loadDirectionRef.current = 'prev'
          handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
          if (!getHasPrevCached()) {
            loadFromServerRef.current = true
          }
          nextDisableRef.current = true
        }
      }
    }
    if ((hasIndex && currentIndex >= messages.length - 15) || target.scrollTop === 0) {
      if (
        connectionStatus === CONNECTION_STATUS.CONNECTED &&
        !scrollToNewMessage.scrollToBottom &&
        (hasNextMessages || getHasNextCached())
      ) {
        if (loadingRef.current || messagesLoading === LOADING_STATE.LOADING || nextDisableRef.current) {
          shouldLoadMessagesRef.current = 'next'
        } else {
          if (shouldLoadMessagesRef.current === 'next') {
            shouldLoadMessagesRef.current = ''
          }
          loadDirectionRef.current = 'next'
          prevDisableRef.current = true
          handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
        }
      }
    }
    if (hasIndex && currentIndex > messages.length - 10) {
      nextDisableRef.current = false
    }
  }, [
    channel?.lastMessage?.id,
    messages,
    scrollToMentionedMessage,
    scrollToNewMessage,
    messagesLoading,
    hasPrevMessages,
    hasNextMessages,
    lastVisibleMessageId,
    connectionStatus,
    getHasPrevCached,
    getHasNextCached,
    scrollToReply
  ])

  const onScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      handleMessagesListScroll()
    })
  }, [handleMessagesListScroll])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }
  }, [])

  const handleScrollToRepliedMessage = async (messageId: string) => {
    prevDisableRef.current = true
    nextDisableRef.current = true
    if (messages.findIndex((msg: IMessage) => msg.id === messageId) >= 10) {
      const repliedMessage = document.getElementById(messageId)
      if (repliedMessage) {
        scrollRef.current.scrollTo({
          top: repliedMessage.offsetTop - scrollRef.current.offsetHeight / 2,
          behavior: 'smooth'
        })
        repliedMessage.classList.add('highlight')
        const positiveValue =
          repliedMessage.offsetTop - scrollRef.current.offsetHeight / 2 < 0
            ? repliedMessage.offsetTop - scrollRef.current.offsetHeight * -1
            : repliedMessage.offsetTop - scrollRef.current.offsetHeight / 2
        setTimeout(
          () => {
            repliedMessage.classList.remove('highlight')
            prevDisableRef.current = false
            nextDisableRef.current = false
          },
          1000 + positiveValue * 0.1
        )
      }
    } else {
      dispatch(getMessagesAC(channel, undefined, messageId))
    }
  }

  const handleLoadMoreMessages = (direction: string, limit: number) => {
    if (scrollToMentionedMessage) {
      return
    }
    const lastMessageId = messages.length && messages[messages.length - 1].id
    const firstMessageId = messages.length && messages[0].id
    const hasPrevCached = getHasPrevCached()
    const hasNextCached = getHasNextCached()
    if (messagesLoading === LOADING_STATE.LOADED && connectionStatus === CONNECTION_STATUS.CONNECTED) {
      if (direction === MESSAGE_LOAD_DIRECTION.PREV && firstMessageId && (hasPrevMessages || hasPrevCached)) {
        loadingRef.current = true
        dispatch(loadMoreMessagesAC(channel.id, limit, direction, firstMessageId, hasPrevMessages))
      } else if (direction === MESSAGE_LOAD_DIRECTION.NEXT && lastMessageId && (hasNextMessages || hasNextCached)) {
        loadingRef.current = true
        dispatch(loadMoreMessagesAC(channel.id, limit, direction, lastMessageId, hasNextMessages))
      }
    }
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
  const readDroppedFiles = (e: any) =>
    new Promise<any[]>((resolve) => {
      const fileList: File[] = Object.values(e.dataTransfer.files)
      const attachmentsFiles: any[] = []
      let readFiles = 0
      let errorCount = 0

      fileList.forEach((attachment) => {
        const fileReader = new FileReader()

        fileReader.onload = (event: any) => {
          const file = event.target.result
          attachmentsFiles.push({ name: attachment.name, data: file, type: attachment.type })
          readFiles++

          if (readFiles + errorCount === fileList.length) {
            resolve(attachmentsFiles)
          }
        }

        fileReader.onerror = () => {
          errorCount++

          if (readFiles + errorCount === fileList.length) {
            resolve(attachmentsFiles)
          }
        }

        fileReader.readAsDataURL(attachment)
      })
    })

  const handleDropFile = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      readDroppedFiles(e)
        .then((result) => {
          dispatch(setDraggedAttachmentsAC(result as any, 'file'))
        })
        .catch((error) => {
          console.error('Error in handleDropFile:', error)
        })
      e.dataTransfer.clearData()
    }
  }

  const handleDropMedia = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      readDroppedFiles(e)
        .then((result) => {
          dispatch(setDraggedAttachmentsAC(result as any, 'media'))
        })
        .catch((error) => {
          console.error('Error in handleDropMedia:', error)
        })
      e.dataTransfer.clearData()
    }
  }

  useEffect(() => {
    if (
      messages.length > 0 &&
      messages[messages.length - 1]?.id === channel.lastMessage?.id &&
      scrollRef.current &&
      scrollRef.current.scrollTop > -50 &&
      !showScrollToNewMessageButton
    ) {
      dispatch(showScrollToNewMessageButtonAC(false))
      prevDisableRef.current = false
    }
  }, [messages, channel?.lastMessage?.id, scrollRef?.current?.scrollTop, showScrollToNewMessageButton])

  useEffect(() => {
    if (scrollToRepliedMessage) {
      loadingRef.current = false
      scrollRef.current.style.scrollBehavior = 'inherit'
      const repliedMessage = document.getElementById(scrollToRepliedMessage)
      if (repliedMessage) {
        setScrollToReply(repliedMessage && repliedMessage.offsetTop - (channel.backToLinkedChannel ? 0 : 200))
        scrollRef.current.scrollTo({
          top: repliedMessage && repliedMessage.offsetTop - (channel.backToLinkedChannel ? 0 : 200),
          behavior: scrollToMessageBehavior
        })
        scrollRef.current.style.scrollBehavior = scrollToMessageBehavior
        if (!channel.backToLinkedChannel && scrollToMessageHighlight) {
          repliedMessage && repliedMessage.classList.add('highlight')
        }
        const positiveValue =
          repliedMessage.offsetTop - scrollRef.current.offsetHeight / 2 < 0
            ? repliedMessage.offsetTop - scrollRef.current.offsetHeight * -1
            : repliedMessage.offsetTop - scrollRef.current.offsetHeight / 2
        setTimeout(
          () => {
            if (!channel.backToLinkedChannel && scrollToMessageHighlight) {
              const repliedMessage = document.getElementById(scrollToRepliedMessage)
              repliedMessage && repliedMessage.classList.remove('highlight')
            }
            prevDisableRef.current = false
            setScrollToReply(null)
            scrollRef.current.style.scrollBehavior = 'instant'
          },
          1000 + positiveValue * 0.1
        )
      }
      dispatch(setScrollToMessagesAC(null))
    }
  }, [scrollToRepliedMessage])

  useEffect(() => {
    if (scrollToNewMessage.scrollToBottom) {
      if (scrollToNewMessage.isIncomingMessage) {
        if (scrollRef.current.scrollTop > -100) {
          scrollRef.current.scrollTo({
            top: 0,
            behavior: 'smooth'
          })
        }
      } else {
        nextDisableRef.current = true
        prevDisableRef.current = true
        scrollRef.current.scrollTo({
          top: 0,
          behavior: 'smooth'
        })
        dispatch(showScrollToNewMessageButtonAC(false))
        setTimeout(() => {
          prevDisableRef.current = false
        }, 800)
      }
    }
  }, [scrollToNewMessage])

  useEffect(() => {
    if (!mediaFile && isDragging) {
      setIsDragging(false)
    }
  }, [mediaFile])

  useEffect(() => {
    if (!draggingSelector) {
      setIsDragging(false)
    }
  }, [draggingSelector])

  useEffect(() => {
    setHasNextCached(false)
    setHasPrevCached(false)
    // reset per-channel scroll flags and indexes
    messagesIndexMapRef.current = {}
    loadFromServerRef.current = false
    loadDirectionRef.current = ''
    nextDisableRef.current = false
    prevDisableRef.current = false
    shouldLoadMessagesRef.current = ''
    loadingRef.current = false
    if (channel.backToLinkedChannel) {
      const visibleMessages = getVisibleMessagesMap()
      const visibleMessagesIds = Object.keys(visibleMessages)
      const messageId = visibleMessagesIds[visibleMessagesIds.length - 1]
      dispatch(getMessagesAC(channel, undefined, messageId, undefined, undefined, undefined, 'instant'))
      setUnreadMessageId(messageId)
    } else {
      if (!channel.isLinkedChannel) {
        clearVisibleMessagesMap()
      }
      if (channel) {
        dispatch(getMessagesAC(channel, undefined, undefined, undefined, true))
      }
      if (channel.id) {
        if (channel.newMessageCount && channel.newMessageCount > 0) {
          setUnreadMessageId(channel.lastDisplayedMessageId)
        } else {
          setUnreadMessageId('')
        }
      }
    }
    setMediaFile(null)
    if (selectedMessagesMap && selectedMessagesMap.size) {
      dispatch(clearSelectedMessagesAC())
    }
    setPreviousScrollTop(0)
    setShouldPreserveScroll(false)
    nextDisableRef.current = false
    prevDisableRef.current = false
    scrollToBottomRef.current = true
    setAllowEditDeleteIncomingMessage(allowEditDeleteIncomingMessage)
  }, [channel.id])

  useEffect(() => {
    if (!isDragging) {
      renderTopDate()
    }
  }, [isDragging])

  useEffect(() => {
    if (messages.length > 0 && hiddenMessagesProperties?.includes(HiddenMessageProperty.hideAfterSendMessage)) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.user.id === user.id) {
        setUnreadMessageId('')
      }
    }
  }, [messages, hiddenMessagesProperties, user?.id])

  useEffect(() => {
    if (scrollRef.current) {
      const isAtBottom = scrollRef.current.scrollTop > -50
      if (!isAtBottom) {
        setPreviousScrollTop(scrollRef.current.scrollTop)
        setShouldPreserveScroll(true)
      }
    }

    if (loadingRef.current) {
      if (loadDirectionRef.current !== 'next') {
        const lastVisibleMessage: any = document.getElementById(lastVisibleMessageId)
        if (lastVisibleMessage) {
          scrollRef.current.style.scrollBehavior = 'inherit'
          scrollRef.current.scrollTop = lastVisibleMessage.offsetTop
          scrollRef.current.style.scrollBehavior = 'smooth'
        }
        if (loadFromServerRef.current) {
          const timeout = setTimeout(() => {
            loadingRef.current = false
            loadFromServerRef.current = false
            nextDisableRef.current = false
            const currentIndex = messagesIndexMapRef.current[lastVisibleMessageId]
            if (shouldLoadMessagesRef.current === 'prev' && typeof currentIndex === 'number' && currentIndex < 15) {
              handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
            }
            if (
              shouldLoadMessagesRef.current === 'next' &&
              typeof currentIndex === 'number' &&
              currentIndex > messages.length - 15
            ) {
              handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
            }
          }, 50)
          if (loadingMessagesTimeoutRef.current) {
            clearTimeout(loadingMessagesTimeoutRef.current)
          }
          loadingMessagesTimeoutRef.current = timeout
        } else {
          loadingRef.current = false
          if (shouldLoadMessagesRef.current === 'prev') {
            handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
            shouldLoadMessagesRef.current = ''
          }
          if (shouldLoadMessagesRef.current === 'next') {
            handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
            shouldLoadMessagesRef.current = ''
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
        loadingRef.current = false
        prevDisableRef.current = false
        if (shouldLoadMessagesRef.current === 'prev') {
          handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
          shouldLoadMessagesRef.current = ''
        }
        if (shouldLoadMessagesRef.current === 'next') {
          handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
          shouldLoadMessagesRef.current = ''
        }
      }
    }

    renderTopDate()
    if (scrollToBottomRef.current) {
      if (channel.backToLinkedChannel) {
        dispatch(scrollToNewMessageAC(false))
      } else {
        dispatch(scrollToNewMessageAC(true))
      }
      scrollToBottomRef.current = false
    }

    if (shouldPreserveScroll && scrollRef.current && previousScrollTop > 0) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.style.scrollBehavior = 'inherit'
          scrollRef.current.scrollTop = previousScrollTop
          scrollRef.current.style.scrollBehavior = 'smooth'
        }
        setShouldPreserveScroll(false)
        setPreviousScrollTop(0)
      })
    }
    return () => {
      if (loadingMessagesTimeoutRef.current) {
        clearTimeout(loadingMessagesTimeoutRef.current)
      }
    }
  }, [messages])

  useEffect(() => {
    if (messagesLoading === LOADING_STATE.LOADED) {
      const timeout = setTimeout(() => {
        loadingRef.current = false
        loadFromServerRef.current = false
        nextDisableRef.current = false
        const currentIndex = messagesIndexMapRef.current[lastVisibleMessageId]
        if (shouldLoadMessagesRef.current === 'prev' && typeof currentIndex === 'number' && currentIndex < 15) {
          handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
        }
        if (
          shouldLoadMessagesRef.current === 'next' &&
          typeof currentIndex === 'number' &&
          currentIndex > messages.length - 15
        ) {
          handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
        }
      }, 50)
      if (loadingMessagesTimeoutRef.current) {
        clearTimeout(loadingMessagesTimeoutRef.current)
      }
      loadingMessagesTimeoutRef.current = timeout
    }
    return () => {
      if (loadingMessagesTimeoutRef.current) {
        clearTimeout(loadingMessagesTimeoutRef.current)
      }
    }
  }, [messagesLoading, messages, lastVisibleMessageId])

  useEffect(() => {
    let interval: any = null
    log.info('connection status is changed.. .... ', connectionStatus, 'channel  ... ', channel)
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      Object.keys(pendingMessagesMap).forEach((key: any) => {
        pendingMessagesMap[key].forEach((msg: IMessage) => {
          dispatch(resendMessageAC(msg, key, connectionStatus))
        })
      })
      // Resend pending poll actions
      if (Object.keys(pollPendingPollActions).length > 0) {
        dispatch(resendPendingPollActionsAC(connectionStatus))
      }
      let count = 0
      interval = setInterval(() => {
        if (count > 20) {
          clearInterval(interval)
        }
        count++
        if (
          channel.id &&
          Object.keys(pollPendingPollActions).length === 0 &&
          Object.keys(pendingMessagesMap).length === 0
        ) {
          clearInterval(interval)
          loadingRef.current = false
          prevDisableRef.current = false
          nextDisableRef.current = false
          clearMessagesMap()
          removeAllMessages()
          dispatch(getMessagesAC(channel))
        }
      }, 100)
    }
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [connectionStatus])

  useEffect(() => {
    if (channel.newMessageCount && channel.newMessageCount > 0 && unreadScrollTo) {
      const scrollElement = document.getElementById('scrollableDiv')
      if (scrollElement) {
        scrollElement.style.scrollBehavior = 'inherit'
      }
      const lastReadMessageNode: any = document.getElementById(channel.lastDisplayedMessageId)
      if (lastReadMessageNode && scrollElement) {
        scrollElement.scrollTo({
          top: lastReadMessageNode.offsetTop - 200,
          behavior: 'smooth'
        })
        setScrollIntoView(true)
        setTimeout(() => {
          dispatch(setUnreadScrollToAC(false))
          setScrollIntoView(false)
        }, 100)
      }
    }
  }, [
    channel.id,
    channel.newMessageCount,
    scrollRef.current,
    unreadScrollTo,
    channel.lastDisplayedMessageId,
    scrollIntoView,
    messages.length
  ])

  // Cleanup hideTopDate timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTopDateTimeout.current) {
        clearTimeout(hideTopDateTimeout.current)
      }
    }
  }, [])

  return (
    <React.Fragment>
      {isDragging && !(attachmentsPreview?.show && mediaFile) && (
        <DragAndDropContainer
          id='draggingContainer'
          draggable
          onDragLeave={handleDragOut}
          topOffset={scrollRef && scrollRef.current && scrollRef.current.offsetTop}
          height={scrollRef && scrollRef.current && scrollRef.current.offsetHeight}
          backgroundColor={backgroundColor || background}
        >
          {/* {isDragging === 'media' ? ( */}
          {/*  <React.Fragment> */}
          <DropAttachmentArea
            backgroundColor={outgoingMessageBackground}
            color={textPrimary}
            margin='32px 32px 12px'
            iconBackgroundColor={background}
            draggable
            onDrop={handleDropFile}
            onDragOver={handleDragOver}
            borderColor={border}
            draggedBorderColor={accentColor}
          >
            <IconWrapper backgroundColor={surface1} draggable iconColor={accentColor}>
              <ChooseFileIcon />
            </IconWrapper>
            Drag & drop to send as file
          </DropAttachmentArea>
          {isDragging === 'media' && (
            <DropAttachmentArea
              backgroundColor={outgoingMessageBackground}
              color={textPrimary}
              iconBackgroundColor={background}
              draggable
              onDrop={handleDropMedia}
              onDragOver={handleDragOver}
              borderColor={border}
              draggedBorderColor={accentColor}
            >
              <IconWrapper backgroundColor={surface1} draggable iconColor={accentColor}>
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
        {showTopFixedDate && topDateLabel && (
          <MessageTopDate
            visible={showTopDate}
            dateDividerFontSize={dateDividerFontSize}
            dateDividerTextColor={dateDividerTextColor || textOnPrimary}
            dateDividerBorder={dateDividerBorder}
            dateDividerBackgroundColor={dateDividerBackgroundColor || overlayBackground}
            dateDividerBorderRadius={dateDividerBorderRadius}
            topOffset={scrollRef && scrollRef.current && scrollRef.current.offsetTop}
          >
            <span>{topDateLabel}</span>
          </MessageTopDate>
        )}
        {/* {!hideMessages && ( */}
        <Container
          id='scrollableDiv'
          className={isScrolling ? 'show-scrollbar' : ''}
          ref={scrollRef}
          stopScrolling={stopScrolling}
          onScroll={onScroll}
          onMouseEnter={() => setIsScrolling(true)}
          onMouseLeave={() => setIsScrolling(false)}
          onDragEnter={handleDragIn}
          backgroundColor={backgroundColor || themeBackgroundColor}
          thumbColor={surface2}
        >
          {messages.length && messages.length > 0 ? (
            <MessagesBox
              enableResetScrollToCoords={false}
              replyMessage={messageForReply && messageForReply.id}
              attachmentsSelected={attachmentsSelected}
              className='messageBox'
            >
              {messages.map((message: any, index: number) => {
                const prevMessage = messages[index - 1]
                const nextMessage = messages[index + 1]
                const isUnreadMessage =
                  !!(unreadMessageId && unreadMessageId === message.id && nextMessage) && !channel.backToLinkedChannel
                messagesIndexMapRef.current[message.id] = index
                return (
                  <React.Fragment key={message.id || message.tid}>
                    <CreateMessageDateDivider
                      // lastIndex={index === 0}
                      noMargin={
                        !isUnreadMessage &&
                        prevMessage &&
                        prevMessage.type === MESSAGE_TYPE.SYSTEM &&
                        message.type !== MESSAGE_TYPE.SYSTEM
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
                      chatBackgroundColor={backgroundColor || themeBackgroundColor}
                      dateDividerBorderRadius={dateDividerBorderRadius}
                      marginBottom={
                        prevMessage && prevMessage.type === MESSAGE_TYPE.SYSTEM && message.type !== MESSAGE_TYPE.SYSTEM
                          ? '16px'
                          : '0'
                      }
                      marginTop={differentUserMessageSpacing}
                    />
                    {message.type === MESSAGE_TYPE.SYSTEM ? (
                      <SystemMessage
                        key={message.id || message.tid}
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
                      <MessageWrapper
                        key={message.id || message.tid}
                        id={message.id}
                        className={
                          (message.incoming ? incomingMessageStyles?.classname : outgoingMessageStyles?.classname) || ''
                        }
                        highlightBg={incomingMessageBackgroundX}
                      >
                        <Message
                          message={message}
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
                          outgoingMessageStyles={outgoingMessageStyles}
                          ownRepliedMessageBackground={ownRepliedMessageBackground}
                          incomingMessageStyles={incomingMessageStyles}
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
                          showInfoMessage={showInfoMessage}
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
                          retractVoteIcon={retractVoteIcon}
                          endVoteIcon={endVoteIcon}
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
                          infoIconOrder={infoIconOrder}
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
                          infoIconTooltipText={infoIconTooltipText}
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
                          shouldOpenUserProfileForMention={shouldOpenUserProfileForMention}
                          showInfoMessageProps={showInfoMessageProps}
                          ogMetadataProps={ogMetadataProps}
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
                        newMessagesSeparatorSpaceColor={newMessagesSeparatorSpaceColor}
                        dividerText={newMessagesSeparatorText || 'Unread Messages'}
                        marginTop={message.type === MESSAGE_TYPE.SYSTEM ? '0px' : ''}
                        marginBottom={message.type === MESSAGE_TYPE.SYSTEM ? '16px' : '0'}
                        chatBackgroundColor={backgroundColor || themeBackgroundColor}
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
                <NoMessagesText color={textSecondary}>No messages yet, start the chat</NoMessagesText>
                {/* {channel.type === CHANNEL_TYPE.DIRECT
                  ? ' chat'
                  : channel.type === CHANNEL_TYPE.GROUP || channel.type === CHANNEL_TYPE.PRIVATE
                  ? ' group chat'
                  : ' channel'} */}
              </NoMessagesContainer>
            )
          )}
          {attachmentsPreview?.show && mediaFile && (
            <SliderPopup
              channel={channel}
              setIsSliderOpen={setMediaFile}
              currentMediaFile={mediaFile}
              attachmentsPreview={attachmentsPreview}
            />
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

export const Container = styled.div<{ stopScrolling?: boolean; backgroundColor?: string; thumbColor: string }>`
  display: flex;
  flex-direction: column-reverse;
  flex-grow: 1;
  position: relative;
  overflow: auto;
  scroll-behavior: smooth;
  will-change: left, top;
  background-color: ${(props) => props.backgroundColor};
  overflow-x: hidden;

  &::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
  }

  &.show-scrollbar::-webkit-scrollbar-thumb {
    background: ${(props) => props.thumbColor};
    border-radius: 4px;
  }
  &.show-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
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
  width: calc(100% - 8px);

  span {
    display: inline-block;
    max-width: 380px;
    font-style: normal;
    font-weight: normal;
    font-size: ${(props) => props.dateDividerFontSize || '14px'};
    color: ${(props) => props.dateDividerTextColor};
    background-color: ${(props) => `${props.dateDividerBackgroundColor}66`};
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

export const DragAndDropContainer = styled.div<{ topOffset?: number; height?: number; backgroundColor?: string }>`
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
  background-color: ${(props) => props.backgroundColor};
  z-index: 999;
`

export const IconWrapper = styled.span<{ backgroundColor: string; iconColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  width: 64px;
  background-color: ${(props) => props.backgroundColor};
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

export const DropAttachmentArea = styled.div<{
  backgroundColor: string
  color: string
  margin?: string
  iconBackgroundColor: string
  borderColor: string
  draggedBorderColor: string
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  height: 100%;
  border: 1px dashed ${(props) => props.borderColor};
  border-radius: 16px;
  margin: ${(props) => props.margin || '12px 32px 32px'};
  font-weight: 400;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
  transition: all 0.1s;

  &.dragover {
    background-color: ${(props) => props.backgroundColor};
    border: 1px dashed ${(props) => props.draggedBorderColor};

    ${IconWrapper} {
      background-color: ${(props) => props.iconBackgroundColor};
    }
  }
`

export const MessageWrapper = styled.div<{ highlightBg: string }>`
  &.highlight {
    & .message_item {
      transition: all 0.2s ease-in-out;
      padding-top: 4px;
      padding-bottom: 4px;
      background-color: ${(props) => props.highlightBg || '#d5d5d5'};
    }
  }

  & .message_item {
    transition: all 0.2s ease-in-out;
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
