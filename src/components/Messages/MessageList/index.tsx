import styled from 'styled-components'
import React, { useCallback, useEffect, useState, FC } from 'react'
import { shallowEqual } from 'react-redux'
import { useDispatch, useSelector } from 'store/hooks'
// Store
import {
  getChannelMentionsAC,
  markMessagesAsDeliveredAC,
  markMessagesAsReadAC,
  setDraggedAttachmentsAC,
  updateChannelDataAC
} from '../../../store/channel/actions'
import {
  activeChannelMessagesSelector,
  loadingNextMessagesStateSelector,
  loadingPrevMessagesStateSelector,
  messagesHasNextSelector,
  messagesHasPrevSelector,
  openedMessageMenuSelector,
  sendMessageInputHeightSelector,
  scrollToMentionedMessageSelector,
  scrollToNewMessageSelector,
  selectedMessagesMapSelector,
  showScrollToNewMessageButtonSelector,
  unreadScrollToSelector,
  unreadMessageIdSelector
} from '../../../store/message/selector'
import { activeChannelSelector, isDraggingSelector } from '../../../store/channel/selector'
import { browserTabIsActiveSelector, connectionStatusSelector, contactsMapSelector } from '../../../store/user/selector'
// Hooks
import { useColor } from '../../../hooks'
// Assets
import { ReactComponent as ChooseFileIcon } from '../../../assets/svg/choseFile.svg'
import { ReactComponent as ChooseMediaIcon } from '../../../assets/svg/choseMedia.svg'
import { ReactComponent as NoMessagesIcon } from '../../../assets/svg/noMessagesIcon.svg'
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
import { LOADING_STATE, MESSAGE_DELIVERY_STATUS } from '../../../helpers/constants'
// Components
import MessageDivider from '../../MessageDivider'
import SliderPopup from '../../../common/popups/sliderPopup'
import SystemMessage from '../SystemMessage'
import Message from '../../Message'
import { IAttachmentProperties, IMessageStyles } from '../../Message/Message.types'
import { HiddenMessageProperty, MESSAGE_TYPE } from 'types/enum'
import { getClient } from 'common/client'
import { useChatController } from './useChatController'
import ScrollToBottomButton from './ScrollToBottomButton'
import ScrollToUnreadMentionsButton from './ScrollToUnreadMentionsButton'
import {
  registerMessageListNavigator,
  unregisterMessageListNavigator,
  registerJumpToLatest,
  unregisterJumpToLatest
} from '../../../helpers/messageListNavigator'
import { getMessageLocalRef } from '../../../helpers/messagesHalper'
import { createMessageMarkerBatcher, DEFAULT_MARKER_BATCH_DEBOUNCE_MS } from '../../../helpers/messageMarkerBatcher'

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
  collapsedCharacterLimit?: number
  createChatOnAvatarTap?: boolean
  allowSendAttachment?: boolean
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
  shouldOpenUserProfileForMention,
  showInfoMessageProps = {},
  ogMetadataProps,
  collapsedCharacterLimit,
  createChatOnAvatarTap = true,
  allowSendAttachment = true
}) => {
  const {
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: outgoingMessageBackground,
    [THEME_COLORS.BACKGROUND]: themeBackgroundColor,
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_2]: surface2,
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND_X]: incomingMessageBackgroundX,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.OVERLAY_BACKGROUND]: overlayBackground
  } = useColor()

  const ChatClient = getClient()
  const { user } = ChatClient
  const currentUserId = user?.id ? String(user.id) : ''

  const dispatch = useDispatch()
  const channel: IChannel = useSelector(activeChannelSelector)
  const contactsMap: IContactsMap = useSelector(contactsMapSelector, shallowEqual)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)
  const sendMessageInputHeight: number = useSelector(sendMessageInputHeightSelector)
  const openedMessageMenuId = useSelector(openedMessageMenuSelector, shallowEqual)
  const selectedMessagesMap = useSelector(selectedMessagesMapSelector)
  const scrollToNewMessage = useSelector(scrollToNewMessageSelector, shallowEqual)
  const scrollToMentionedMessage = useSelector(scrollToMentionedMessageSelector, shallowEqual)
  const browserTabIsActive = useSelector(browserTabIsActiveSelector, shallowEqual)
  const hasNextMessages = useSelector(messagesHasNextSelector, shallowEqual)
  const hasPrevMessages = useSelector(messagesHasPrevSelector, shallowEqual)
  const loadingPrevMessages = useSelector(loadingPrevMessagesStateSelector)
  const loadingNextMessages = useSelector(loadingNextMessagesStateSelector)
  const draggingSelector = useSelector(isDraggingSelector, shallowEqual)
  const showScrollToNewMessageButton = useSelector(showScrollToNewMessageButtonSelector, shallowEqual)
  const unreadScrollTo = useSelector(unreadScrollToSelector, shallowEqual)
  const messages = useSelector(activeChannelMessagesSelector, shallowEqual) || []
  const unreadMessageId = useSelector(unreadMessageIdSelector, shallowEqual)
  const [mediaFile, setMediaFile] = useState<any>(null)
  const [isDragging, setIsDragging] = useState<any>(null)
  const [stopScrolling, setStopScrolling] = useState<any>(false)
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const [stickyDate, setStickyDate] = useState<string>('')
  const markerBatcherRef = React.useRef<ReturnType<typeof createMessageMarkerBatcher> | null>(null)
  if (!markerBatcherRef.current) {
    markerBatcherRef.current = createMessageMarkerBatcher({
      debounceMs: DEFAULT_MARKER_BATCH_DEBOUNCE_MS,
      onFlushRead: (channelId, messageIds) => {
        dispatch(markMessagesAsReadAC(channelId, messageIds))
      },
      onFlushDelivered: (channelId, messageIds) => {
        dispatch(markMessagesAsDeliveredAC(channelId, messageIds))
      }
    })
  }
  // const [hideMessages, setHideMessages] = useState<any>(false)
  // const [activeChannel, setActiveChannel] = useState<any>(channel)

  const {
    scrollRef,
    setLastVisibleMessageId,
    handleScrollToRepliedMessage,
    messagesIndexMapRef,
    timelineItems,
    isJumpingToItem,
    jumpToLatest,
    jumpToItem
  } = useChatController({
    messages,
    channel,
    hasPrevMessages,
    hasNextMessages,
    loadingPrevMessages,
    loadingNextMessages,
    connectionStatus,
    scrollToNewMessage,
    scrollToMentionedMessage,
    showScrollToNewMessageButton,
    unreadScrollTo,
    unreadMessageId,
    selectedMessagesMap,
    allowEditDeleteIncomingMessage,
    dispatch
  })

  const queueReadMarker = useCallback((channelId: string, messageId?: string) => {
    markerBatcherRef.current?.enqueueRead(channelId, messageId)
  }, [])

  const queueDeliveredMarker = useCallback((channelId: string, messageId?: string) => {
    markerBatcherRef.current?.enqueueDelivered(channelId, messageId)
  }, [])

  const updateStickyDate = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const dividers = Array.from(container.querySelectorAll<HTMLElement>('[data-date-label]'))
    const STICKY_ZONE = 40
    let currentDate = ''
    let closestTop = -Infinity
    for (const el of dividers) {
      const rect = el.getBoundingClientRect()
      const distFromTop = rect.top - containerRect.top
      const inFlowEl = el.querySelector<HTMLElement>('.divider')
      const wasInZone = inFlowEl?.dataset.stickyZone === '1'
      // Hysteresis: enter zone at STICKY_ZONE, only exit when STICKY_ZONE + 16px away
      // Prevents rapid blinking when the divider hovers near the boundary (e.g. at history edge)
      const inZone = wasInZone ? distFromTop <= STICKY_ZONE + 16 : distFromTop <= STICKY_ZONE
      // Fade the in-flow divider with a CSS transition (only update when zone status changes)
      if (inFlowEl) {
        if (inZone !== wasInZone) {
          inFlowEl.dataset.stickyZone = inZone ? '1' : '0'
          inFlowEl.style.transition = 'opacity 0.2s ease'
          inFlowEl.style.opacity = inZone ? '0' : '1'
        }
      }
      // Sticky label tracks whichever divider is deepest inside the zone (highest rect.top)
      if (inZone && rect.top >= closestTop) {
        closestTop = rect.top
        currentDate = el.getAttribute('data-date-label') || ''
      }
    }
    setStickyDate((prev) => (prev !== currentDate ? currentDate : prev))
  }, [])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    container.addEventListener('scroll', updateStickyDate, { passive: true })
    return () => container.removeEventListener('scroll', updateStickyDate)
  }, [updateStickyDate])

  useEffect(() => {
    return () => {
      markerBatcherRef.current?.flushAll()
      markerBatcherRef.current?.clearAll()
    }
  }, [])

  useEffect(() => {
    updateStickyDate()
  }, [messages, updateStickyDate])

  const handleScrollToBottom = () => {
    if (!channel?.lastMessage) {
      return
    }

    if (channel.lastMessage.id && String(channel.lastMessage.user.id) !== currentUserId) {
      dispatch(markMessagesAsReadAC(channel.id, [channel.lastMessage.id]))
    }

    jumpToLatest(true)
  }

  const isMessageRead = useCallback(
    (messageId: string) => {
      const message = messages.find((msg: any) => msg.id === messageId)
      return message?.userMarkers?.some((marker: any) => marker.name === MESSAGE_DELIVERY_STATUS.READ)
    },
    [messages]
  )

  const handleScrollToMentions = useCallback(
    (mentionIds: string[]) => {
      if (!channel?.id || !mentionIds.length) {
        return
      }

      const nextUnreadMentionId = mentionIds.find((mentionId) => !isMessageRead(mentionId))
      if (!nextUnreadMentionId) {
        dispatch(updateChannelDataAC(channel.id, { mentionsIds: [] }))
        return
      }

      const remainingMentionIds = mentionIds.filter((mentionId) => mentionId !== nextUnreadMentionId)
      handleScrollToRepliedMessage(nextUnreadMentionId)
      dispatch(markMessagesAsReadAC(channel.id, [nextUnreadMentionId]))
      dispatch(updateChannelDataAC(channel.id, { mentionsIds: remainingMentionIds }))

      if (channel.newMentionCount >= 3 && remainingMentionIds.length < 3) {
        dispatch(getChannelMentionsAC(channel.id))
      }
    },
    [channel?.id, channel.newMentionCount, dispatch, handleScrollToRepliedMessage, isMessageRead]
  )

  useEffect(() => {
    registerMessageListNavigator(jumpToItem)
    return () => unregisterMessageListNavigator()
  }, [jumpToItem])

  useEffect(() => {
    registerJumpToLatest(jumpToLatest)
    return () => unregisterJumpToLatest()
  }, [jumpToLatest])

  useEffect(() => {
    if (channel.newMentionCount && (!channel.mentionsIds || channel.mentionsIds.length < 3)) {
      dispatch(getChannelMentionsAC(channel.id))
    }
  }, [channel.id, channel.mentionsIds, channel.newMentionCount, dispatch])

  const handleDragIn = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (isDragging) return
    if (!e.dataTransfer.types.includes('Files')) return

    let filesType: string

    // Safari doesn't provide items during dragenter - show both options
    if (!e.dataTransfer.items || e.dataTransfer.items.length === 0) {
      filesType = 'media'
    } else {
      // Browser provides items (Chrome, Firefox) - detect type
      const fileList: DataTransferItem[] = Array.from(e.dataTransfer.items)
      const hasMedia = fileList.some((item) => {
        const fileType = item.type.split('/')[0]
        return fileType === 'image' || fileType === 'video'
      })
      filesType = hasMedia ? 'media' : 'file'
    }

    setIsDragging(filesType)
  }

  const handleDragOver = (e: any) => {
    e.preventDefault()
    e.target && e.target.classList.add('dragover')
  }
  const handleDragOut = (e: any) => {
    e.preventDefault()
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
    setMediaFile(null)
  }, [channel.id])

  const handleMediaItemClickStable = useCallback((attachment: IAttachment) => {
    if (attachment?.id) setMediaFile(attachment)
  }, [])

  const renderTimelineMessage = ({
    message,
    prevMessage,
    nextMessage,
    index,
    isUnreadMessage,
    nextMessageStartsUnreadSection,
    isHighlighted
  }: {
    message: IMessage
    prevMessage: IMessage | null
    nextMessage: IMessage | null
    index: number
    isUnreadMessage: boolean
    nextMessageStartsUnreadSection: boolean
    isHighlighted: boolean
  }) => {
    const localRef = getMessageLocalRef(message)
    messagesIndexMapRef.current[localRef] = index

    if (message.type === MESSAGE_TYPE.SYSTEM) {
      return (
        <SystemMessage
          key={localRef}
          channel={channel}
          message={message}
          nextMessage={nextMessage as IMessage}
          connectionStatus={connectionStatus}
          differentUserMessageSpacing={differentUserMessageSpacing}
          tabIsActive={browserTabIsActive}
          contactsMap={contactsMap}
          fontSize={dateDividerFontSize}
          textColor={dateDividerTextColor}
          border={dateDividerBorder}
          backgroundColor={dateDividerBackgroundColor}
          borderRadius={dateDividerBorderRadius}
          setLastVisibleMessageId={setLastVisibleMessageId}
          queueReadMarker={queueReadMarker}
          disableAutoReadTracking
        />
      )
    }

    return (
      <MessageWrapper
        key={localRef}
        id={localRef || undefined}
        className={`${(message.incoming ? incomingMessageStyles?.classname : outgoingMessageStyles?.classname) || ''} ${
          isHighlighted ? 'highlight' : ''
        }`.trim()}
        highlightBg={incomingMessageBackgroundX}
      >
        <Message
          message={message}
          channel={channel}
          stopScrolling={setStopScrolling}
          handleMediaItemClick={handleMediaItemClickStable}
          handleScrollToRepliedMessage={handleScrollToRepliedMessage}
          prevMessage={prevMessage as IMessage}
          nextMessage={nextMessage as IMessage}
          isUnreadMessage={isUnreadMessage}
          nextMessageStartsUnreadSection={nextMessageStartsUnreadSection}
          unreadMessageId={unreadMessageId}
          setLastVisibleMessageId={setLastVisibleMessageId}
          queueReadMarker={queueReadMarker}
          queueDeliveredMarker={queueDeliveredMarker}
          isThreadMessage={false}
          disableAutoReadTracking
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
          tabIsActive={browserTabIsActive}
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
          collapsedCharacterLimit={collapsedCharacterLimit}
          createChatOnAvatarTap={createChatOnAvatarTap}
        />
      </MessageWrapper>
    )
  }

  return (
    <React.Fragment>
      {allowSendAttachment && isDragging && !(attachmentsPreview?.show && mediaFile) && (
        <DragAndDropContainer
          id='draggingContainer'
          draggable
          onDragLeave={handleDragOut}
          topOffset={scrollRef.current?.offsetTop}
          height={scrollRef.current?.offsetHeight}
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
        </DragAndDropContainer>
      )}
      <React.Fragment>
        {/* {!hideMessages && ( */}
        <ScrollViewport>
          <Container
            id='scrollableDiv'
            className={isScrolling ? 'show-scrollbar' : ''}
            ref={scrollRef}
            stopScrolling={stopScrolling}
            onMouseEnter={() => setIsScrolling(true)}
            onMouseLeave={() => setIsScrolling(false)}
            onDragEnter={handleDragIn}
            backgroundColor={backgroundColor || themeBackgroundColor}
            thumbColor={surface2}
          >
            {messages.length && messages.length > 0 ? (
              <MessagesBox className='messageBox' id='messageBox' $isJumping={isJumpingToItem}>
                {timelineItems.map((timelineItem, index) => {
                  if (timelineItem.type === 'date-divider') {
                    return (
                      <div key={timelineItem.key} data-date-label={timelineItem.label}>
                        <MessageDivider
                          index={index}
                          dividerText={timelineItem.label}
                          dateDividerFontSize={dateDividerFontSize}
                          dateDividerTextColor={dateDividerTextColor}
                          dateDividerBorder={dateDividerBorder}
                          dateDividerBackgroundColor={dateDividerBackgroundColor}
                          dateDividerBorderRadius={dateDividerBorderRadius}
                          marginTop={differentUserMessageSpacing}
                          chatBackgroundColor={backgroundColor || themeBackgroundColor}
                        />
                      </div>
                    )
                  }

                  if (timelineItem.type === 'unread-divider') {
                    return (
                      <div data-message-list-unread-divider='true' key={timelineItem.key}>
                        <MessageDivider
                          newMessagesSeparatorTextColor={newMessagesSeparatorTextColor}
                          newMessagesSeparatorFontSize={newMessagesSeparatorFontSize}
                          newMessagesSeparatorWidth={newMessagesSeparatorWidth}
                          newMessagesSeparatorBorder={newMessagesSeparatorBorder}
                          newMessagesSeparatorBorderRadius={newMessagesSeparatorBorderRadius}
                          newMessagesSeparatorBackground={newMessagesSeparatorBackground}
                          newMessagesSeparatorLeftRightSpaceWidth={newMessagesSeparatorTextLeftRightSpacesWidth}
                          newMessagesSeparatorSpaceColor={newMessagesSeparatorSpaceColor}
                          dividerText={newMessagesSeparatorText || 'Unread Messages'}
                          chatBackgroundColor={backgroundColor || themeBackgroundColor}
                          unread
                        />
                      </div>
                    )
                  }

                  return (
                    <div
                      data-message-list-item-id={timelineItem.localRef}
                      key={timelineItem.key}
                      ref={timelineItem.registerItemElement}
                    >
                      {renderTimelineMessage({
                        message: timelineItem.item,
                        prevMessage: timelineItem.prevItem,
                        nextMessage: timelineItem.nextItem,
                        index: timelineItem.index,
                        isUnreadMessage: timelineItem.isUnread && !channel.backToLinkedChannel,
                        nextMessageStartsUnreadSection:
                          timelineItem.nextItemStartsUnreadSection && !channel.backToLinkedChannel,
                        isHighlighted: timelineItem.isHighlighted
                      })}
                    </div>
                  )
                })}
              </MessagesBox>
            ) : (
              loadingPrevMessages === LOADING_STATE.LOADED &&
              loadingNextMessages === LOADING_STATE.LOADED && (
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
          {showTopFixedDate && stickyDate && (
            <StickyDateLabel
              dateDividerFontSize={dateDividerFontSize}
              dateDividerTextColor={dateDividerTextColor || textOnPrimary}
              dateDividerBackgroundColor={
                dateDividerBackgroundColor || newMessagesSeparatorBackground || overlayBackground
              }
              dateDividerBorderRadius={dateDividerBorderRadius}
            >
              <span>{stickyDate}</span>
            </StickyDateLabel>
          )}
        </ScrollViewport>
        <ScrollToBottomButton
          show={!!showScrollToNewMessageButton && messages?.length}
          bottomOffset={sendMessageInputHeight}
          backgroundColor={surface1}
          badgeBackgroundColor={accentColor}
          count={channel?.newMessageCount}
          onClick={handleScrollToBottom}
        />
        <ScrollToUnreadMentionsButton
          show={!!channel.newMentionCount && messages?.length}
          bottomOffset={sendMessageInputHeight}
          backgroundColor={surface1}
          badgeBackgroundColor={accentColor}
          count={channel.newMentionCount || 0}
          stackedAbove={!!showScrollToNewMessageButton}
          onClick={() => handleScrollToMentions(channel.mentionsIds || [])}
        />
      </React.Fragment>

      {/* // )} */}
    </React.Fragment>
  )
}
// const MemoizedMessageList =

export default MessageList

export const Container = styled.div<{ stopScrolling?: boolean; backgroundColor?: string; thumbColor: string }>`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  transform: scaleY(-1);
  background-color: ${(props) => props.backgroundColor};
  overflow-y: overlay;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  margin-top: auto;

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

const MessagesBox = styled.div<{ $isJumping?: boolean }>`
  display: flex;
  padding-top: 5px;
  flex-direction: column;
  padding-bottom: 6px;
  width: 100%;
  transform: scaleY(-1);
  backface-visibility: hidden;
  filter: ${(props) => (props.$isJumping ? 'blur(4px)' : 'none')};
  transition: filter 0.2s ease;
`

const ScrollViewport = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`

const StickyDateLabel = styled.div<{
  dateDividerFontSize?: string
  dateDividerTextColor?: string
  dateDividerBackgroundColor?: string
  dateDividerBorderRadius?: string
}>`
  position: absolute;
  top: 8px;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
  padding-right: 8px;

  span {
    display: inline-block;
    font-size: ${(props) => props.dateDividerFontSize || '14px'};
    color: ${(props) => props.dateDividerTextColor};
    background-color: ${(props) =>
      props.dateDividerBackgroundColor ? `${props.dateDividerBackgroundColor}66` : 'rgba(0,0,0,0.3)'};
    box-sizing: border-box;
    border-radius: ${(props) => props.dateDividerBorderRadius || '14px'};
    padding: 5px 16px;
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
      background-color: ${(props) => props.highlightBg || '#d5d5d5'};
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
  transform: scaleY(-1);
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
