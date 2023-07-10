import styled from 'styled-components'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import React, { useRef, useEffect, useState } from 'react'
import moment from 'moment'
// import { getUnreadScrollTo, setUnreadScrollTo } from '../../helpers/channelHalper'
import {
  activeChannelMessagesSelector,
  messagesHasNextSelector,
  messagesHasPrevSelector,
  messagesLoadingState,
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
import { browserTabIsActiveSelector, connectionStatusSelector, contactsMapSelector } from '../../store/user/selector'
import {
  clearMessagesMap,
  getHasNextCached,
  getHasPrevCached,
  LOAD_MAX_MESSAGE_COUNT,
  MESSAGE_LOAD_DIRECTION,
  removeAllMessages,
  setHasNextCached,
  setHasPrevCached
} from '../../helpers/messagesHalper'
import SliderPopup from '../../common/popups/sliderPopup'
import { systemMessageUserName } from '../../helpers'
import { isJSON, makeUsername } from '../../helpers/message'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { ReactComponent as ChoseFileIcon } from '../../assets/svg/choseFile.svg'
import { ReactComponent as ChoseMediaIcon } from '../../assets/svg/choseMedia.svg'
import { setDraggedAttachments } from '../../store/channel/actions'
import { useDidUpdate } from '../../hooks'
import { CHANNEL_TYPE, LOADING_STATE } from '../../helpers/constants'
import { getClient } from '../../common/client'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { themeSelector } from '../../store/theme/selector'

let loading = false
let loadFromServer = false
// let lastPrevLoadedId: string = ''
// let firstPrevLoadedId: string = ''
// let hasNextMessages = true
// let hasPrevMessages = true
let loadDirection = ''
// let nextTargetMessage = ''
let nextDisable = false
let prevDisable = false
let prevMessageId = ''

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
  marginTop
}: any) => {
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
    />
  )
}

interface MessagesProps {
  fontFamily?: string
  ownMessageOnRightSide?: boolean
  messageWidthPercent?: string | number
  messageStatusAndTimePosition?: 'onMessage' | 'bottomOfMessage'
  messageStatusDisplayingType?: 'ticks' | 'text'
  ownMessageBackground?: string
  incomingMessageBackground?: string
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
  messageReaction?: boolean
  editMessage?: boolean
  copyMessage?: boolean
  replyMessage?: boolean
  replyMessageInThread?: boolean
  forwardMessage?: boolean
  deleteMessage?: boolean
  reportMessage?: boolean
  reactionIcon?: JSX.Element
  editIcon?: JSX.Element
  copyIcon?: JSX.Element
  replyIcon?: JSX.Element
  replyInThreadIcon?: JSX.Element
  forwardIcon?: JSX.Element
  deleteIcon?: JSX.Element
  starIcon?: JSX.Element
  staredIcon?: JSX.Element
  reportIcon?: JSX.Element
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
  ownMessageBackground = colors.primaryLight,
  incomingMessageBackground = colors.backgroundColor,
  hoverBackground = false,
  showSenderNameOnDirectChannel = false,
  showSenderNameOnOwnMessages = false,
  showSenderNameOnGroupChannel = true,
  showOwnAvatar = false,
  messageReaction = false,
  editMessage = false,
  copyMessage = false,
  replyMessage = false,
  replyMessageInThread = false,
  forwardMessage = false,
  deleteMessage = false,
  reportMessage = false,
  reactionIcon,
  editIcon,
  copyIcon,
  replyIcon,
  replyInThreadIcon,
  forwardIcon,
  deleteIcon,
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
  starIconOrder,
  reportIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  copyIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
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
  differentUserMessageSpacing
}) => {
  const dispatch = useDispatch()
  const theme = useSelector(themeSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const channel: IChannel = useSelector(activeChannelSelector)
  const ChatClient = getClient()
  const { user } = ChatClient
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const connectionStatus = useSelector(connectionStatusSelector)
  const scrollToNewMessage = useSelector(scrollToNewMessageSelector, shallowEqual)
  const scrollToRepliedMessage = useSelector(scrollToMessageSelector, shallowEqual)
  const browserTabIsActive = useSelector(browserTabIsActiveSelector, shallowEqual)
  const hasNextMessages = useSelector(messagesHasNextSelector, shallowEqual)
  const hasPrevMessages = useSelector(messagesHasPrevSelector, shallowEqual)
  const messagesLoading = useSelector(messagesLoadingState)
  const draggingSelector = useSelector(isDraggingSelector, shallowEqual)
  // const messages = useSelector(activeChannelMessagesSelector, shallowEqual)
  // const showScrollToNewMessageButton: IChannel = useSelector(showScrollToNewMessageButtonSelector)
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
  const messages = useSelector(activeChannelMessagesSelector) || []
  // eslint-disable-next-line max-len
  // const { handleGetMessages, handleAddMessages, pendingMessages, cachedMessages, hasNext, hasPrev } = useMessages(channel)
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
    setShowTopDate(true)
    clearTimeout(hideTopDateTimeout.current)
    hideTopDateTimeout.current = setTimeout(() => {
      setShowTopDate(false)
    }, 1000)

    // const nextMessageNode: any = document.getElementById(nextTargetMessage)
    const lastVisibleMessage: any = document.getElementById(lastVisibleMessageId)
    renderTopDate()
    const { target } = event
    // console.log('target.scrollTop. ..  . ..  .. ', target.scrollTop)
    // console.log('scrollToNewMessage.scrollToBottom. ..  . ..  .. ', scrollToNewMessage.scrollToBottom)
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
      if (
        connectionStatus === CONNECTION_STATUS.CONNECTED &&
        !prevDisable &&
        messagesLoading !== LOADING_STATE.LOADING &&
        !scrollToRepliedMessage &&
        -target.scrollTop >= target.scrollHeight - target.offsetHeight - scrollHeightQuarter &&
        /* hasPrev && */ !loading &&
        !scrollToNewMessage.scrollToBottom &&
        messages.length
      ) {
        loadDirection = 'prev'
        // console.log('load prev messages........ ')
        prevMessageId = messages[0].id
        handleLoadMoreMessages(MESSAGE_LOAD_DIRECTION.PREV, LOAD_MAX_MESSAGE_COUNT)
        if (!getHasPrevCached()) {
          // console.log('load from server ..... ', true)
          loadFromServer = true
        }
        /*   if (cachedMessages.prev) {
          loading = true
          handleAddMessages([], 'prev', true)
        } else if (hasPrevMessages) {
          await handleLoadMoreMessages('prev', 15)
        }
       */
        // if (hasPrevMessages && lastVisibleMessage) {
        nextDisable = false
        nextDisable = true
        // target.scrollTop = lastVisibleMessage.offsetTop
        // }
        // dispatch(loadMoreMessagesAC(10, 'prev', channel.id))
      }
      if (lastVisibleMessagePos > 0) {
        nextDisable = false
      } else {
        prevDisable = false
      }
      if (
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
        /* if (lastVisibleMessage) {
          target.scrollTop = lastVisibleMessage.offsetTop - 10
        } */
        // dispatch(loadMoreMessagesAC(10, 'next', channel.id))
        // if (hasNextMessages && lastVisibleMessage) {
        prevDisable = true
        // }
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
        dispatch(setDraggedAttachments(attachmentsFiles, 'file'))
      })
      e.dataTransfer.clearData()
    }
  }

  const handleDropMedia = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const fileList = Array.from(e.dataTransfer.items)
    fileList.forEach((file: any) => {
      const fileType = file.type.split('/')[0]
      console.log('file. .. . ', file.getAsFile())
      console.log('fileType. .. . ', fileType)
    })
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
        dispatch(setDraggedAttachments(attachmentsFiles, 'media'))
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
        setScrollToReply(repliedMessage && repliedMessage.offsetTop - 200)
        scrollRef.current.scrollTop = repliedMessage && repliedMessage.offsetTop - 200
        repliedMessage && repliedMessage.classList.add('highlight')
        setTimeout(() => {
          const repliedMessage = document.getElementById(scrollToRepliedMessage)
          repliedMessage && repliedMessage.classList.remove('highlight')
          setScrollToReply(null)
          scrollRef.current.style.scrollBehavior = 'smooth'
        }, 800)
      }
      dispatch(setScrollToMessagesAC(null))
    }
  }, [scrollToRepliedMessage])

  useEffect(() => {
    if (scrollToNewMessage.scrollToBottom) {
      scrollRef.current.scrollTop = 0
      dispatch(showScrollToNewMessageButtonAC(false))
      // loading = true
      if (scrollToNewMessage.updateMessageList && messagesLoading !== LOADING_STATE.LOADING) {
        setTimeout(() => {
          dispatch(getMessagesAC(channel, !hasNextMessages))
        }, 700)
      }
    }
  }, [scrollToNewMessage])

  useDidUpdate(() => {
    if (isDragging) {
      setIsDragging(false)
    }
  }, [browserTabIsActive])

  useDidUpdate(() => {
    if (!draggingSelector) {
      setIsDragging(false)
    }
  }, [draggingSelector])
  useDidUpdate(() => {
    if (connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      loading = false
      prevDisable = false
      nextDisable = false
    }
  }, [connectionStatus])

  useEffect(() => {
    setHasNextCached(false)
    setHasPrevCached(false)
    dispatch(getMessagesAC(channel))
    if (channel.id) {
      if (channel.newMessageCount && channel.newMessageCount > 0) {
        setUnreadMessageId(channel.lastDisplayedMsgId)
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
        /* if (lastVisibleMessage && lastVisibleMessage.offsetTop >= scrollRef.current.scrollTop) {
          scrollRef.current.scrollTop = lastVisibleMessage.offsetTop
        } */
        if (prevMessageId) {
          let i: any = 0
          let messagesHeight = 0
          while (i !== prevMessageId) {
            if (messages[i]) {
              if (messages[i].id === prevMessageId) {
                i = prevMessageId
              } else {
                const currentMessage = document.getElementById(messages[i].id)
                // eslint-disable-next-line no-unused-expressions
                currentMessage ? (messagesHeight += currentMessage.getBoundingClientRect().height) : messagesHeight
                i++
              }
            } else {
              break
            }
          }

          scrollRef.current.style.scrollBehavior = 'inherit'
          if (lastVisibleMessage && -lastVisibleMessage.offsetTop > messagesHeight) {
            // if (-lastVisibleMessage.offsetTop < scrollRef.current.scrollTop) {
            // console.log('last message pos........ ')
            scrollRef.current.scrollTop = lastVisibleMessage.offsetTop
            // }
          } else {
            // console.log('messages height. . .')
            scrollRef.current.scrollTop = -messagesHeight
          }

          scrollRef.current.style.scrollBehavior = 'smooth'
        }
        if (loadFromServer) {
          setTimeout(() => {
            loading = false
            loadFromServer = false
          }, 50)
        } else {
          loading = false
        }
        /* console.log('-scrollRef.current.scrollTop ... ', -scrollRef.current.scrollTop)
        console.log('scrollRef.current.offsetHeight ... ', scrollRef.current.offsetHeight)
        console.log('scrollRef.current.scrollHeight ... ', scrollRef.current.scrollHeight)

        const scrollHeightQuarter = (scrollRef.current.scrollHeight * 20) / 100

        if (
          -scrollRef.current.scrollTop + scrollRef.current.offsetHeight + 30 >= scrollRef.current.scrollHeight &&
          hasPrevMessages
        ) {
          console.log(
            'set scroll top ... ',
            -(scrollRef.current.scrollHeight - scrollRef.current.offsetHeight - scrollHeightQuarter)
          )
          scrollRef.current.scrollTop = -(
            scrollRef.current.scrollHeight -
            scrollRef.current.offsetHeight -
            scrollHeightQuarter
          )
        } */
      } else {
        // console.log('scrollRef.current.scrollTop ... ', scrollRef.current.scrollTop)
        // console.log('hasNextMessages ... ', hasNextMessages)
        // console.log('getHasNextCached() ... ', getHasNextCached())
        if (scrollRef.current.scrollTop > -5 && (hasNextMessages || getHasNextCached())) {
          scrollRef.current.scrollTop = -200
        }
        loading = false
      }
      // }, 200)
    }
    if (scrollToNewMessage.scrollToBottom && messages.length) {
      setTimeout(() => {
        dispatch(scrollToNewMessageAC(false, false))
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

    // console.log('messages... ', messages)
  }, [messages])
  useDidUpdate(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      if (channel.id) {
        dispatch(getMessagesAC(channel))
      }
      clearMessagesMap()
      removeAllMessages()
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
      {isDragging && (
        <DragAndDropContainer
          id='draggingContainer'
          draggable
          onDragLeave={handleDragOut}
          topOffset={scrollRef && scrollRef.current && scrollRef.current.offsetTop}
          height={scrollRef && scrollRef.current && scrollRef.current.offsetHeight}
        >
          {/* {isDragging === 'media' ? ( */}
          {/*  <React.Fragment> */}
          <DropAttachmentArea margin='32px 32px 12px' draggable onDrop={handleDropFile} onDragOver={handleDragOver}>
            <IconWrapper draggable iconColor={colors.primary}>
              <ChoseFileIcon />
            </IconWrapper>
            Drag & drop to send as file
          </DropAttachmentArea>
          {isDragging === 'media' && (
            <DropAttachmentArea draggable onDrop={handleDropMedia} onDragOver={handleDragOver}>
              <IconWrapper draggable iconColor={colors.primary}>
                <ChoseMediaIcon />
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
            dateDividerTextColor={dateDividerTextColor || colors.textColor1}
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
        >
          {messages.length && messages.length > 0 ? (
            <MessagesBox
              enableResetScrollToCoords={false}
              replyMessage={messageForReply && messageForReply.id}
              attachmentsSelected={attachmentsSelected}
              ref={messagesBoxRef}
              className='messageBox'
            >
              {messages.map((message: any, index: number) => {
                const prevMessage = messages[index - 1]
                const nextMessage = messages[index + 1]
                const isUnreadMessage = !!(unreadMessageId && unreadMessageId === message.id)
                const messageMetas = isJSON(message.metadata) ? JSON.parse(message.metadata) : message.metadata
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
                      dateDividerBorderRadius={dateDividerBorderRadius}
                      marginBottom={prevMessage && prevMessage.type === 'system' && message.type !== 'system'}
                      marginTop={differentUserMessageSpacing}
                    />
                    {message.type === 'system' ? (
                      <MessageTopDate
                        systemMessage
                        marginTop={message.type === 'system' && (differentUserMessageSpacing || '16px')}
                        marginBottom={
                          message.type === 'system' &&
                          nextMessage &&
                          nextMessage.type !== 'system' &&
                          (differentUserMessageSpacing || '16px')
                        }
                        visible={showTopFixedDate}
                        dividerText={message.body}
                        dateDividerFontSize={dateDividerFontSize}
                        dateDividerTextColor={dateDividerTextColor || colors.textColor1}
                        dateDividerBorder={dateDividerBorder}
                        dateDividerBackgroundColor={dateDividerBackgroundColor || colors.backgroundColor}
                        dateDividerBorderRadius={dateDividerBorderRadius}
                      >
                        <span>
                          {message.incoming
                            ? makeUsername(message.user && contactsMap[message.user.id], message.user, getFromContacts)
                            : 'You'}
                          {message.body === 'CC'
                            ? ' created this channel '
                            : message.body === 'CG'
                            ? ' created this group'
                            : message.body === 'AM'
                            ? ` added ${
                                !!(messageMetas && messageMetas.m) &&
                                messageMetas.m
                                  .slice(0, 5)
                                  .map((mem: string) =>
                                    mem === user.id ? 'You' : ` ${systemMessageUserName(contactsMap[mem], mem)}`
                                  )
                              } ${
                                messageMetas && messageMetas.m && messageMetas.m.length > 5
                                  ? `and ${messageMetas.m.length - 5} more`
                                  : ''
                              }`
                            : message.body === 'RM'
                            ? ` removed ${
                                messageMetas &&
                                messageMetas.m &&
                                messageMetas.m
                                  .slice(0, 5)
                                  .map((mem: string) =>
                                    mem === user.id ? 'You' : ` ${systemMessageUserName(contactsMap[mem], mem)}`
                                  )
                              } ${
                                messageMetas && messageMetas.m && messageMetas.m.length > 5
                                  ? `and ${messageMetas.m.length - 5} more`
                                  : ''
                              }`
                            : message.body === 'LG'
                            ? ' left the group'
                            : ''}
                        </span>
                      </MessageTopDate>
                    ) : (
                      <MessageWrapper id={message.id}>
                        <Message
                          message={{
                            ...message,
                            metadata: messageMetas
                          }}
                          channel={channel}
                          stopScrolling={setStopScrolling}
                          handleMediaItemClick={(attachment) => setMediaFile(attachment)}
                          handleScrollToRepliedMessage={handleScrollToRepliedMessage}
                          prevMessage={prevMessage}
                          nextMessage={nextMessage}
                          isUnreadMessage={isUnreadMessage}
                          setLastVisibleMessageId={(msgId) => setLastVisibleMessageId(msgId)}
                          isThreadMessage={false}
                          fontFamily={fontFamily}
                          ownMessageOnRightSide={ownMessageOnRightSide}
                          messageWidthPercent={messageWidthPercent}
                          messageStatusAndTimePosition={messageStatusAndTimePosition}
                          messageStatusDisplayingType={messageStatusDisplayingType}
                          ownMessageBackground={ownMessageBackground}
                          incomingMessageBackground={incomingMessageBackground}
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
                          messageReaction={messageReaction}
                          editMessage={editMessage}
                          copyMessage={copyMessage}
                          replyMessage={replyMessage}
                          replyMessageInThread={replyMessageInThread}
                          deleteMessage={deleteMessage}
                          allowEditDeleteIncomingMessage={allowEditDeleteIncomingMessage}
                          reportMessage={reportMessage}
                          reactionIcon={reactionIcon}
                          editIcon={editIcon}
                          copyIcon={copyIcon}
                          replyIcon={replyIcon}
                          replyInThreadIcon={replyInThreadIcon}
                          forwardIcon={forwardIcon}
                          deleteIcon={deleteIcon}
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
                          starIconOrder={starIconOrder}
                          reportIconOrder={reportIconOrder}
                          reactionIconTooltipText={reactionIconTooltipText}
                          editIconTooltipText={editIconTooltipText}
                          copyIconTooltipText={copyIconTooltipText}
                          replyIconTooltipText={replyIconTooltipText}
                          replyInThreadIconTooltipText={replyInThreadIconTooltipText}
                          forwardIconTooltipText={forwardIconTooltipText}
                          deleteIconTooltipText={deleteIconTooltipText}
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
                        unread
                      />
                    ) : null}
                  </React.Fragment>
                )
              })}
            </MessagesBox>
          ) : (
            messagesLoading === LOADING_STATE.LOADED && (
              <NoMessagesContainer color={colors.textColor1}>
                No messages in this
                {channel.type === CHANNEL_TYPE.DIRECT
                  ? ' chat'
                  : channel.type === CHANNEL_TYPE.GROUP
                  ? ' group chat'
                  : ' channel'}
              </NoMessagesContainer>
            )
          )}
          {attachmentsPreview && mediaFile && (
            <SliderPopup channelId={channel.id} setIsSliderOpen={setMediaFile} currentMediaFile={mediaFile} />
          )}
        </Container>
      </React.Fragment>

      {/* // )} */}
    </React.Fragment>
  )
}

export default MessageList

interface MessageBoxProps {
  readonly enableResetScrollToCoords: boolean
  readonly replyMessage: boolean | string
  readonly attachmentsSelected: boolean
}

export const Container = styled.div<{ stopScrolling?: boolean }>`
  display: flex;
  flex-direction: column-reverse;
  //flex-direction: column;
  flex-grow: 1;
  position: relative;
  //overflow: ${(props) => (props.stopScrolling ? 'hidden' : 'auto')};
  overflow: auto;
  scroll-behavior: smooth;
  will-change: left, top;
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
  margin-top: ${(props) => props.marginTop};
  margin-bottom: ${(props) => props.marginBottom};
  text-align: center;
  z-index: 10;
  background: transparent;
  opacity: ${(props) => (props.visible ? '1' : '0')};
  transition: all 0.2s ease-in-out;
  span {
    //display: ${(props) => !props.systemMessage && 'none'};
    display: inline-block;
    max-width: 380px;
    font-style: normal;
    font-weight: normal;
    font-size: ${(props) => props.dateDividerFontSize || '14px'};
    color: ${(props) => props.dateDividerTextColor || colors.textColor1};
    background: ${(props) => props.dateDividerBackgroundColor || '#ffffff'};
    border: ${(props) => props.dateDividerBorder};
    box-sizing: border-box;
    border-radius: ${(props) => props.dateDividerBorderRadius || '14px'};
    padding: 5px 16px;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.08), 0 2px 24px rgba(0, 0, 0, 0.08);
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

export const IconWrapper = styled.span<{ iconColor?: string }>`
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
    color: ${(props) => props.iconColor || colors.primary};
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
  border: 1px dashed ${colors.textColor2};
  border-radius: 16px;
  margin: ${(props) => props.margin || '12px 32px 32px'};
  font-weight: 400;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${colors.textColor1};
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

export const NoMessagesContainer = styled.div<{ color?: string }>`
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
  color: ${(props) => props.color || colors.textColor1};
`
