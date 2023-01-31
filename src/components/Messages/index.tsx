import styled from 'styled-components'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import React, { useRef, useEffect, useState } from 'react'
import moment from 'moment'
// import { getUnreadScrollTo, setUnreadScrollTo } from '../../helpers/channelHalper'
import {
  activeChannelMessagesSelector,
  messagesHasNextSelector,
  messagesHasPrevSelector,
  scrollToMessageSelector,
  scrollToNewMessageSelector
} from '../../store/message/selector'
import { colors } from '../../UIHelper/constants'
import MessageDivider from '../MessageDivider'
import Message from '../Message'
import { activeChannelSelector, isDraggingSelector } from '../../store/channel/selector'
// import { LOADING_STATE } from '../../helpers/constants'
import {
  getMessagesAC,
  loadMoreMessagesAC,
  scrollToNewMessageAC,
  setScrollToMessagesAC,
  showScrollToNewMessageButtonAC
} from '../../store/message/actions'
import { IChannel, IContactsMap } from '../../types'
import { getUnreadScrollTo, setUnreadScrollTo } from '../../helpers/channelHalper'
import { contactsMapSelector } from '../../store/user/selector'
import {
  getHasNextCached,
  getHasPrevCached,
  LOAD_MAX_MESSAGE_COUNT,
  MESSAGE_LOAD_DIRECTION,
  setHasNextCached,
  setHasPrevCached
} from '../../helpers/messagesHalper'
import SliderPopup from '../../common/popups/sliderPopup'
import { makeUserName, systemMessageUserName } from '../../helpers'
import { getUserDisplayNameFromContact } from '../../helpers/contacts'
import { ReactComponent as ChoseFileIcon } from '../../assets/svg/choseFile.svg'
import { ReactComponent as ChoseMediaIcon } from '../../assets/svg/choseMedia.svg'
import { setDraggedAttachments, setIsDragging } from '../../store/channel/actions'
import { useDidUpdate } from '../../hooks'

let loading = false
// let lastPrevLoadedId: string = ''
// let firstPrevLoadedId: string = ''
// let hasNextMessages = true
// let hasPrevMessages = true
let loadDirection = ''
// let nextTargetMessage = ''
let nextDisable = false
let prevDisable = false
const CreateMessageDateDivider = ({
  lastIndex,
  currentMessageDate,
  nextMessageDate,
  messagesHasNext,
  dateDividerFontSize,
  dateDividerTextColor,
  dateDividerBorder,
  dateDividerBackgroundColor,
  dateDividerBorderRadius
}: any) => {
  const today = moment().endOf('day')
  const current = moment(currentMessageDate).endOf('day')
  const differentDays = !(nextMessageDate && current.diff(moment(nextMessageDate).endOf('day'), 'days') === 0)
  let dividerText = ''
  if (differentDays && !today.diff(current, 'days')) {
    dividerText = 'Today'
  } else if (differentDays && !today.add(-1, 'days').diff(current, 'days')) {
    dividerText = 'Yesterday'
  } else if (differentDays) {
    dividerText =
      moment().year() === moment(current).year() ? current.format('DD MMMM') : current.format('DD MMMM YYYY')
  }
  return !differentDays ? null : (
    <MessageDivider
      dividerText={dividerText}
      visibility={messagesHasNext && lastIndex}
      dateDividerFontSize={dateDividerFontSize}
      dateDividerTextColor={dateDividerTextColor}
      dateDividerBorder={dateDividerBorder}
      dateDividerBackgroundColor={dateDividerBackgroundColor}
      dateDividerBorderRadius={dateDividerBorderRadius}
    />
  )
}

interface MessagesProps {
  fontFamily?: string
  ownMessageOnRightSide?: boolean
  messageWidthPercent?: string | number
  messageTimePosition?: 'topOfMessage' | 'onMessage'
  ownMessageBackground?: string
  incomingMessageBackground?: string
  showMessageStatus?: boolean
  hoverBackground?: boolean
  showSenderNameOnDirectChannel?: boolean
  showSenderNameOnOwnMessages?: boolean
  showOwnAvatar?: boolean
  messageReaction?: boolean
  editMessage?: boolean
  replyMessage?: boolean
  replyMessageInThread?: boolean
  forwardMessage?: boolean
  deleteMessage?: boolean
  reportMessage?: boolean
  reactionIcon?: JSX.Element
  editIcon?: JSX.Element
  replyIcon?: JSX.Element
  replyInThreadIcon?: JSX.Element
  forwardIcon?: JSX.Element
  deleteIcon?: JSX.Element
  starIcon?: JSX.Element
  staredIcon?: JSX.Element
  reportIcon?: JSX.Element
  reactionIconOrder?: number
  editIconOrder?: number
  replyIconOrder?: number
  replyInThreadIconOrder?: number
  forwardIconOrder?: number
  deleteIconOrder?: number
  starIconOrder?: number
  reportIconOrder?: number
  reactionIconTooltipText?: string
  editIconTooltipText?: string
  replyIconTooltipText?: string
  replyInThreadIconTooltipText?: string
  forwardIconTooltipText?: string
  deleteIconTooltipText?: string
  starIconTooltipText?: string
  reportIconTooltipText?: string
  messageActionIconsColor?: string
  messageActionIconsHoverColor?: string
  dateDividerFontSize?: string
  dateDividerTextColor?: string
  dateDividerBorder?: string
  dateDividerBorderRadius?: string
  dateDividerBackgroundColor?: string
  showTopFixedDate?: boolean
  inlineReactionIcon?: JSX.Element
  reactionsBorderColor?: string
  selfReactionsBorderColor?: string
  newMessagesSeparatorText?: string
  newMessagesSeparatorFontSize?: string
  newMessagesSeparatorTextColor?: string
  newMessagesSeparatorWidth?: string
  newMessagesSeparatorBorder?: string
  newMessagesSeparatorBorderRadius?: string
  newMessagesSeparatorBackground?: string
  newMessagesSeparatorTextLeftRightSpacesWidth?: string
  fileAttachmentsBoxWidth?: string
  fileAttachmentsBoxBackground?: string
  fileAttachmentsBoxBorder?: string
  fileAttachmentsTitleColor?: string
  fileAttachmentsSizeColor?: string
  fileAttachmentsIcon?: JSX.Element
}

const Messages: React.FC<MessagesProps> = ({
  fontFamily,
  ownMessageOnRightSide,
  messageWidthPercent,
  messageTimePosition,
  ownMessageBackground,
  incomingMessageBackground,
  showMessageStatus,
  hoverBackground,
  showSenderNameOnDirectChannel,
  showSenderNameOnOwnMessages,
  showOwnAvatar,
  messageReaction,
  editMessage,
  replyMessage,
  replyMessageInThread,
  forwardMessage,
  deleteMessage,
  reportMessage,
  reactionIcon,
  editIcon,
  replyIcon,
  replyInThreadIcon,
  forwardIcon,
  deleteIcon,
  starIcon,
  staredIcon,
  reportIcon,
  reactionIconOrder,
  editIconOrder,
  replyIconOrder,
  replyInThreadIconOrder,
  forwardIconOrder,
  deleteIconOrder,
  starIconOrder,
  reportIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
  starIconTooltipText,
  reportIconTooltipText,
  messageActionIconsColor,
  messageActionIconsHoverColor,
  dateDividerFontSize,
  dateDividerTextColor,
  dateDividerBorder,
  dateDividerBackgroundColor,
  dateDividerBorderRadius,
  showTopFixedDate = true,
  inlineReactionIcon,
  reactionsBorderColor,
  selfReactionsBorderColor,
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
  fileAttachmentsSizeColor
}) => {
  const dispatch = useDispatch()
  const getFromContacts = getUserDisplayNameFromContact()
  const channel: IChannel = useSelector(activeChannelSelector)
  const isDragging: boolean = useSelector(isDraggingSelector)
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const scrollToNewMessage = useSelector(scrollToNewMessageSelector, shallowEqual)
  const scrollToRepliedMessage = useSelector(scrollToMessageSelector, shallowEqual)
  const hasNextMessages = useSelector(messagesHasNextSelector, shallowEqual)
  const hasPrevMessages = useSelector(messagesHasPrevSelector, shallowEqual)

  // const messages = useSelector(activeChannelMessagesSelector, shallowEqual)
  // const showScrollToNewMessageButton: IChannel = useSelector(showScrollToNewMessageButtonSelector)
  const [unreadMessageId, setUnreadMessageId] = useState('')
  const [mediaFile, setMediaFile] = useState<any>(null)
  // const [hideMessages, setHideMessages] = useState<any>(false)
  // const [activeChannel, setActiveChannel] = useState<any>(channel)
  const [lastVisibleMessageId, setLastVisibleMessageId] = useState('')
  const [scrollToReply, setScrollToReply] = useState<any>(null)
  const messages = useSelector(activeChannelMessagesSelector) || []
  // eslint-disable-next-line max-len
  // const { handleGetMessages, handleAddMessages, pendingMessages, cachedMessages, hasNext, hasPrev } = useMessages(channel)
  // const currentChannelPendingMessages = pendingMessages[channel.id] || []
  const currentChannelPendingMessages: any = []
  const messageForReply: any = {}
  // const messagesLoading = useSelector(messagesLoadingState) || 2
  // TODO fix when will implement send message with attachment
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
  const handleMessagesListScroll = async (event: any) => {
    // const nextMessageNode: any = document.getElementById(nextTargetMessage)
    const lastVisibleMessage: any = document.getElementById(lastVisibleMessageId)
    renderTopDate()
    const { target } = event
    const lastVisibleMessagePos = lastVisibleMessage && lastVisibleMessage.offsetTop
    if (scrollToReply) {
      target.scrollTop = scrollToReply
    } else {
      if (target.scrollTop <= -50) {
        dispatch(showScrollToNewMessageButtonAC(true))
      } else {
        dispatch(showScrollToNewMessageButtonAC(false))
      }
      const scrollHeightQuarter = (target.scrollHeight * 20) / 100
      // -target.scrollTop >= target.scrollHeight - target.offsetHeight - 6
      // if (-target.scrollTop >= scrollHeightQuarter && hasPrev) {
      if (
        !prevDisable &&
        -target.scrollTop >= target.scrollHeight - target.offsetHeight - scrollHeightQuarter &&
        /* hasPrev && */ !loading
      ) {
        loadDirection = 'prev'
        handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
        /*   if (cachedMessages.prev) {
          loading = true
          handleAddMessages([], 'prev', true)
        } else if (hasPrevMessages) {
          await handleLoadMoreMessages('prev', 15)
        }
       */
        if (hasPrevMessages && lastVisibleMessage) {
          nextDisable = true
          // target.scrollTop = lastVisibleMessage.offsetTop
        }
        // dispatch(loadMoreMessagesAC(10, 'prev', channel.id))
      }
      if (lastVisibleMessagePos - 420 > target.scrollTop) {
        nextDisable = false
      } else {
        prevDisable = false
      }
      if (
        !nextDisable &&
        -target.scrollTop <= 500 &&
        // (hasNext || cachedMessages.next) &&
        !loading &&
        !scrollToNewMessage.scrollToBottom
      ) {
        loadDirection = 'next'
        /* if (lastVisibleMessage) {
          target.scrollTop = lastVisibleMessage.offsetTop - 10
        } */
        // dispatch(loadMoreMessagesAC(10, 'next', channel.id))
        if (hasNextMessages && lastVisibleMessage) {
          prevDisable = true
        }
        handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.NEXT, LOAD_MAX_MESSAGE_COUNT)
        /* if (cachedMessages.next) {
          loading = true
          handleAddMessages([], 'next', true)
        } else if (hasNextMessages) {
          await handleLoadMoreMessages('next', 15)
        } */
      }
    }
  }

  const handleScrollToRepliedMessage = async (messageId: string) => {
    if (messages.findIndex((msg) => msg.id === messageId) >= 0) {
      const repliedMessage = document.getElementById(messageId)
      if (repliedMessage) {
        scrollRef.current.scrollTop = repliedMessage.offsetTop - scrollRef.current.offsetHeight / 2
        repliedMessage.classList.add('highlight')
        setTimeout(() => {
          repliedMessage.classList.remove('highlight')
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
    if (!loading) {
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
        // channel.unreadMessageCount &&
        // channel.unreadMessageCount > 0
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
    e.stopPropagation()
    e.target && e.target.classList.add('dragover')
  }
  const handleDragOut = (e: any) => {
    if (e.target.classList.contains('dragover')) {
      e.target.classList.remove('dragover')
    }
    if (!e.relatedTarget || !e.relatedTarget.draggable) {
      dispatch(setIsDragging(false))
    }
  }
  const handleDropFile = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch(setIsDragging(false))
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList: File[] = Object.values(e.dataTransfer.files)
      const attachmentsFiles: any = []
      new Promise<void>((resolve) => {
        fileList.map((attachment, index) => {
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
        dispatch(setDraggedAttachments(attachmentsFiles, 'file'))
      })
      e.dataTransfer.clearData()
    }
  }

  const handleDropMedia = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch(setIsDragging(false))
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList: File[] = Object.values(e.dataTransfer.files)
      const attachmentsFiles: any = []
      new Promise<void>((resolve) => {
        fileList.map((attachment, index) => {
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
        dispatch(setDraggedAttachments(attachmentsFiles, 'media'))
      })
      e.dataTransfer.clearData()
    }
  }

  useEffect(() => {
    if (scrollToRepliedMessage) {
      const repliedMessage = document.getElementById(scrollToRepliedMessage)
      setScrollToReply(repliedMessage && repliedMessage.offsetTop - 200)
      scrollRef.current.scrollTop = repliedMessage && repliedMessage.offsetTop - 200
      repliedMessage && repliedMessage.classList.add('highlight')
      setTimeout(() => {
        const repliedMessage = document.getElementById(scrollToRepliedMessage)
        repliedMessage && repliedMessage.classList.remove('highlight')
        setScrollToReply(null)
      }, 1300)
      dispatch(setScrollToMessagesAC(null))
    }
  }, [scrollToRepliedMessage])

  useEffect(() => {
    if (scrollToNewMessage.scrollToBottom) {
      dispatch(showScrollToNewMessageButtonAC(false))
      // lastPrevLoadedId = ''
      // firstPrevLoadedId = ''
      // hasNextMessages = true
      // hasPrevMessages = true
      if (scrollToNewMessage.updateMessageList) {
        dispatch(getMessagesAC(channel, true))
      }
    }
  }, [scrollToNewMessage])

  useEffect(() => {
    setHasNextCached(false)
    setHasPrevCached(false)
    dispatch(getMessagesAC(channel))
    if (channel.id) {
      if (channel.unreadMessageCount && channel.unreadMessageCount > 0) {
        setUnreadMessageId(channel.lastReadMessageId)
      } else {
        setUnreadMessageId('')
      }
    }
    // lastPrevLoadedId = ''
    // firstPrevLoadedId = ''
    // hasNextMessages = true
    // hasPrevMessages = true
    nextDisable = false
    prevDisable = false
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
        if (lastVisibleMessage && lastVisibleMessage.offsetTop >= scrollRef.current.scrollTop) {
          lastVisibleMessage && (scrollRef.current.scrollTop = lastVisibleMessage.offsetTop)
        }
      } else {
        if (scrollRef.current.scrollTop > -5 && (hasNextMessages || getHasNextCached())) {
          scrollRef.current.scrollTop = -400
        }
      }
      loading = false
      // }, 200)
    }
    if (scrollToNewMessage.scrollToBottom && messages.length) {
      scrollRef.current.scrollTop = 0
      dispatch(scrollToNewMessageAC(false))
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

    // console.log('messages... ', messages)
  }, [messages])
  /* useEffect(() => {
  }, [pendingMessages]) */
  useEffect(() => {
    if (getUnreadScrollTo()) {
      const lastReadMessageNode: any = document.getElementById(channel.lastReadMessageId)
      if (lastReadMessageNode) {
        scrollRef.current.scrollTop = lastReadMessageNode.offsetTop
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
      {isDragging && (
        <DragAndDropContainer
          id='draggingContainer'
          draggable
          onDragLeave={handleDragOut}
          topOffset={scrollRef && scrollRef.current && scrollRef.current.offsetTop}
          height={scrollRef && scrollRef.current && scrollRef.current.offsetHeight}
        >
          <DropAttachmentArea margin='32px 32px 12px' draggable onDrop={handleDropFile} onDragOver={handleDragIn}>
            <IconWrapper draggable>
              <ChoseFileIcon />
            </IconWrapper>
            Drag & drop to send as file
          </DropAttachmentArea>
          <DropAttachmentArea draggable onDrop={handleDropMedia} onDragOver={handleDragIn}>
            <IconWrapper draggable>
              <ChoseMediaIcon />
            </IconWrapper>
            Drag & drop to add picture or video
          </DropAttachmentArea>
        </DragAndDropContainer>
      )}
      <React.Fragment>
        {showTopFixedDate && (
          <MessageTopDate
            dateDividerFontSize={dateDividerFontSize}
            dateDividerTextColor={dateDividerTextColor}
            dateDividerBorder={dateDividerBorder}
            dateDividerBackgroundColor={dateDividerBackgroundColor}
            dateDividerBorderRadius={dateDividerBorderRadius}
            topOffset={scrollRef && scrollRef.current && scrollRef.current.offsetTop}
          >
            <span ref={messageTopDateRef} />
          </MessageTopDate>
        )}
        {/* {!hideMessages && ( */}
        <Container id='scrollableDiv' ref={scrollRef} onScroll={handleMessagesListScroll}>
          <MessagesBox
            enableResetScrollToCoords={false}
            replyMessage={messageForReply && messageForReply.id}
            attachmentsSelected={attachmentsSelected}
            ref={messagesBoxRef}
          >
            {messages.map((message: any, index: number) => {
              const prevMessage = messages[index - 1]
              const nextMessage =
                messages[index + 1] || (currentChannelPendingMessages.length > 0 && currentChannelPendingMessages[0])
              const isUnreadMessage = !!(unreadMessageId && unreadMessageId === message.id)
              // @ts-ignore
              return (
                <React.Fragment key={message.id || message.tid}>
                  <CreateMessageDateDivider
                    // lastIndex={index === 0}
                    lastIndex={false}
                    currentMessageDate={message.createdAt}
                    nextMessageDate={prevMessage && prevMessage.createdAt}
                    messagesHasNext={hasPrevMessages}
                    dateDividerFontSize={dateDividerFontSize}
                    dateDividerTextColor={dateDividerTextColor}
                    dateDividerBorder={dateDividerBorder}
                    dateDividerBackgroundColor={dateDividerBackgroundColor}
                    dateDividerBorderRadius={dateDividerBorderRadius}
                  />
                  {message.type === 'system' ? (
                    <MessageTopDate
                      systemMessage
                      visible={showTopFixedDate}
                      dividerText={message.body}
                      dateDividerFontSize={dateDividerFontSize}
                      dateDividerTextColor={dateDividerTextColor}
                      dateDividerBorder={dateDividerBorder}
                      dateDividerBackgroundColor={dateDividerBackgroundColor}
                      dateDividerBorderRadius={dateDividerBorderRadius}
                    >
                      <span>
                        {message.incoming
                          ? makeUserName(message.user && contactsMap[message.user.id], message.user, getFromContacts)
                          : 'You'}
                        {message.body === 'CC'
                          ? ' created this channel '
                          : message.body === 'CG'
                          ? ' created this group'
                          : message.body === 'AM'
                          ? ` added ${
                              message.metadata &&
                              message.metadata.m &&
                              message.metadata.m
                                .slice(0, 5)
                                .map((mem: string) => ` ${systemMessageUserName(contactsMap[mem], mem)}`)
                            } ${
                              message.metadata && message.metadata.m && message.metadata.m.length > 5
                                ? `and ${message.metadata.m.length - 5} more`
                                : ''
                            }`
                          : message.body === 'RM'
                          ? ` removed ${
                              message.metadata &&
                              message.metadata.m &&
                              message.metadata.m
                                .slice(0, 5)
                                .map((mem: string) => ` ${systemMessageUserName(contactsMap[mem], mem)}`)
                            } ${
                              message.metadata && message.metadata.m && message.metadata.m.length > 5
                                ? `and ${message.metadata.m.length - 5} more`
                                : ''
                            }`
                          : ''}
                      </span>
                    </MessageTopDate>
                  ) : (
                    <Message
                      message={message}
                      channel={channel}
                      handleMediaItemClick={(attachment) => setMediaFile(attachment)}
                      senderFromContact={message.user && contactsMap[message.user.id]}
                      handleScrollToRepliedMessage={handleScrollToRepliedMessage}
                      parentSenderFromContact={
                        message.parent && message.parent.user && contactsMap[message.parent.user.id]
                      }
                      prevMessage={prevMessage}
                      nextMessage={nextMessage}
                      firstMessage={index}
                      isUnreadMessage={isUnreadMessage}
                      setLastVisibleMessageId={(msgId) => setLastVisibleMessageId(msgId)}
                      isThreadMessage={false}
                      fontFamily={fontFamily}
                      ownMessageOnRightSide={ownMessageOnRightSide}
                      messageWidthPercent={messageWidthPercent}
                      messageTimePosition={messageTimePosition}
                      ownMessageBackground={ownMessageBackground}
                      incomingMessageBackground={incomingMessageBackground}
                      showMessageStatus={showMessageStatus}
                      hoverBackground={hoverBackground}
                      showOwnAvatar={showOwnAvatar}
                      showSenderNameOnDirectChannel={showSenderNameOnDirectChannel}
                      showSenderNameOnOwnMessages={showSenderNameOnOwnMessages}
                      messageReaction={messageReaction}
                      editMessage={editMessage}
                      replyMessage={replyMessage}
                      replyMessageInThread={replyMessageInThread}
                      deleteMessage={deleteMessage}
                      reportMessage={reportMessage}
                      reactionIcon={reactionIcon}
                      editIcon={editIcon}
                      replyIcon={replyIcon}
                      replyInThreadIcon={replyInThreadIcon}
                      forwardIcon={forwardIcon}
                      deleteIcon={deleteIcon}
                      forwardMessage={forwardMessage}
                      starIcon={starIcon}
                      staredIcon={staredIcon}
                      reportIcon={reportIcon}
                      reactionIconOrder={reactionIconOrder}
                      editIconOrder={editIconOrder}
                      replyIconOrder={replyIconOrder}
                      replyInThreadIconOrder={replyInThreadIconOrder}
                      forwardIconOrder={forwardIconOrder}
                      deleteIconOrder={deleteIconOrder}
                      starIconOrder={starIconOrder}
                      reportIconOrder={reportIconOrder}
                      reactionIconTooltipText={reactionIconTooltipText}
                      editIconTooltipText={editIconTooltipText}
                      replyIconTooltipText={replyIconTooltipText}
                      replyInThreadIconTooltipText={replyInThreadIconTooltipText}
                      forwardIconTooltipText={forwardIconTooltipText}
                      deleteIconTooltipText={deleteIconTooltipText}
                      starIconTooltipText={starIconTooltipText}
                      reportIconTooltipText={reportIconTooltipText}
                      messageActionIconsHoverColor={messageActionIconsHoverColor}
                      messageActionIconsColor={messageActionIconsColor}
                      inlineReactionIcon={inlineReactionIcon}
                      reactionsBorderColor={reactionsBorderColor}
                      selfReactionsBorderColor={selfReactionsBorderColor}
                      fileAttachmentsIcon={fileAttachmentsIcon}
                      fileAttachmentsBoxWidth={fileAttachmentsBoxWidth}
                      fileAttachmentsBoxBackground={fileAttachmentsBoxBackground}
                      fileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
                      fileAttachmentsTitleColor={fileAttachmentsTitleColor}
                      fileAttachmentsSizeColor={fileAttachmentsSizeColor}
                    />
                  )}
                  {isUnreadMessage ? (
                    <MessageDivider
                      newMessagesSeparatorTextColor={newMessagesSeparatorTextColor}
                      newMessagesSeparatorFontSize={newMessagesSeparatorFontSize}
                      newMessagesSeparatorWidth={newMessagesSeparatorWidth}
                      newMessagesSeparatorBorder={newMessagesSeparatorBorder}
                      newMessagesSeparatorBorderRadius={newMessagesSeparatorBorderRadius}
                      newMessagesSeparatorBackground={newMessagesSeparatorBackground}
                      newMessagesSeparatorLeftRightSpaceWidth={newMessagesSeparatorTextLeftRightSpacesWidth}
                      dividerText={newMessagesSeparatorText || 'Unread Messages'}
                      unread
                    />
                  ) : null}
                </React.Fragment>
              )
            })}
            {/* {currentChannelPendingMessages.map((message: any, index: number) => {
            const prevMessage = index === 0 ? messages[messages.length - 1] : currentChannelPendingMessages[index - 1]
            const nextMessage = currentChannelPendingMessages[index + 1]
            return (
              <React.Fragment key={message.id || message.tid}>
                <Message
                  message={message}
                  channel={channel}
                  senderFromContact={contactsMap[message.user.id]}
                  prevMessage={prevMessage}
                  nextMessage={nextMessage}
                  firstMessage={index}
                  setLastVisibleMessageId={(msgId) => setLastVisibleMessageId(msgId)}
                  isPendingMessage
                  isUnreadMessage={false}
                  isThreadMessage={false}
                  fontFamily={fontFamily}
                  ownMessageOnRightSide={ownMessageOnRightSide}
                  messageWidthPercent={messageWidthPercent}
                  messageTimePosition={messageTimePosition}
                  ownMessageBackground={ownMessageBackground}
                  incomingMessageBackground={incomingMessageBackground}
                  statusIconColor={statusIconColor}
                  showMessageStatus={showMessageStatus}
                  hoverBackground={hoverBackground}
                  showOwnAvatar={showOwnAvatar}
                  showSenderNameOnDirectChannel={showSenderNameOnDirectChannel}
                  showSenderNameOnOwnMessages={showSenderNameOnOwnMessages}
                  senderNameColor={senderNameColor}
                  messageReaction={messageReaction}
                  editMessage={editMessage}
                  replyMessage={replyMessage}
                  replyMessageInThread={replyMessageInThread}
                  forwardMessage={forwardMessage}
                  deleteMessage={deleteMessage}
                  reportMessage={reportMessage}
                  reactionIcon={reactionIcon}
                  editIcon={editIcon}
                  replyIcon={replyIcon}
                  replyInThreadIcon={replyInThreadIcon}
                  forwardIcon={forwardIcon}
                  deleteIcon={deleteIcon}
                  starIcon={starIcon}
                  staredIcon={staredIcon}
                  reportIcon={reportIcon}
                  reactionIconOrder={reactionIconOrder}
                  editIconOrder={editIconOrder}
                  replyIconOrder={replyIconOrder}
                  replyInThreadIconOrder={replyInThreadIconOrder}
                  forwardIconOrder={forwardIconOrder}
                  deleteIconOrder={deleteIconOrder}
                  starIconOrder={starIconOrder}
                  reportIconOrder={reportIconOrder}
                  reactionIconTooltipText={reactionIconTooltipText}
                  editIconTooltipText={editIconTooltipText}
                  replyIconTooltipText={replyIconTooltipText}
                  replyInThreadIconTooltipText={replyInThreadIconTooltipText}
                  forwardIconTooltipText={forwardIconTooltipText}
                  deleteIconTooltipText={deleteIconTooltipText}
                  starIconTooltipText={starIconTooltipText}
                  reportIconTooltipText={reportIconTooltipText}
                  messageActionIconsHoverColor={messageActionIconsHoverColor}
                  messageActionIconsColor={messageActionIconsColor}
                  inlineReactionIcon={inlineReactionIcon}
                  reactionsBorderColor={reactionsBorderColor}
                  selfReactionsBorderColor={selfReactionsBorderColor}
                  fileAttachmentsIcon={fileAttachmentsIcon}
                  fileAttachmentsBoxWidth={fileAttachmentsBoxWidth}
                  fileAttachmentsBoxBackground={fileAttachmentsBoxBackground}
                  fileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
                  fileAttachmentsTitleColor={fileAttachmentsTitleColor}
                  fileAttachmentsSizeColor={fileAttachmentsSizeColor}
                />
              </React.Fragment>
            )
          })} */}
          </MessagesBox>
          {mediaFile && (
            <SliderPopup channelId={channel.id} setIsSliderOpen={setMediaFile} currentMediaFile={mediaFile} />
          )}
        </Container>
      </React.Fragment>

      {/* // )} */}
    </React.Fragment>
  )
}

export default Messages

interface MessageBoxProps {
  readonly enableResetScrollToCoords: boolean
  readonly replyMessage: boolean | string
  readonly attachmentsSelected: boolean
}

export const Container = styled.div`
  display: flex;
  flex-direction: column-reverse;
  //flex-direction: column;
  flex-grow: 1;
  position: relative;
  overflow: auto;
  //scroll-behavior: smooth;
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
/*
const SystemMessage = styled.div<any>`
  position: absolute;
  width: 100%;
  top: 30px;
  left: 0;
  text-align: center;
  z-index: 10;
  background: transparent;
  span {
    display: ${(props) => (props.visible ? 'inline-block' : 'none')};
    font-style: normal;
    font-weight: normal;
    font-size: ${(props) => props.dateDividerFontSize || '14px'};
    color: ${(props) => props.dateDividerTextColor || colors.blue6};
    background: ${(props) => props.dateDividerBackgroundColor || '#ffffff'};
    border: ${(props) => props.dateDividerBorder || '1px solid #dfe0eb'};
    box-sizing: border-box;
    border-radius: ${(props) => props.dateDividerBorderRadius || '14px'};
    padding: 5px 16px;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.08), 0 2px 24px rgba(0, 0, 0, 0.08);
  }
`
*/

export const MessageTopDate = styled.div<any>`
  position: ${(props) => (props.systemMessage ? '' : 'absolute')};
  width: 100%;
  top: ${(props) => (props.topOffset ? `${props.topOffset + 22}px` : '22px')};
  left: 0;
  margin-top: ${(props) => props.systemMessage && '2px'};
  margin-bottom: ${(props) => props.systemMessage && '16px'};
  text-align: center;
  z-index: 10;
  background: transparent;
  span {
    //display: ${(props) => !props.systemMessage && 'none'};
    display: inline-block;
    max-width: 300px;
    font-style: normal;
    font-weight: normal;
    font-size: ${(props) => props.dateDividerFontSize || '14px'};
    color: ${(props) => props.dateDividerTextColor || colors.blue6};
    background: ${(props) => props.dateDividerBackgroundColor || '#ffffff'};
    border: ${(props) => props.dateDividerBorder || `1px solid ${colors.gray1}`};
    box-sizing: border-box;
    border-radius: ${(props) => props.dateDividerBorderRadius || '14px'};
    padding: 5px 16px;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.08), 0 2px 24px rgba(0, 0, 0, 0.08);
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

export const IconWrapper = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  width: 64px;
  background-color: ${colors.gray5};
  border-radius: 50%;
  text-align: center;
  margin-bottom: 16px;
  transition: all 0.3s;
  & > svg {
    color: ${colors.primary};
    width: 32px;
    height: 32px;
  }
`

export const DropAttachmentArea = styled.div<{ margin?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  height: 100%;
  border: 1px dashed ${colors.gray3};
  border-radius: 16px;
  margin: ${(props) => props.margin || '12px 32px 32px'};
  font-weight: 400;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${colors.gray6};
  transition: all 0.1s;

  &.dragover {
    border: 1px dashed ${colors.primary};
  }
`
