/* import { useEffect, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { getClient } from '../../common/client'
import { getChannelFromMap, query } from '../../helpers/channelHalper'
import {
  addMessageAC,
  resendMessageAC,
  setMessagesLoadingStateAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC
  // setMessagesNextCompleteAC,
  // setMessagesPrevCompleteAC
} from '../../store/message/actions'
import { LOADING_STATE, MESSAGE_DELIVERY_STATUS, UPLOAD_STATE } from '../../helpers/constants'
import { IAttachment, IChannel, IMessage } from '../../types'
import {
  channelNewMessageSelector,
  messageNewMarkersSelector,
  messageUpdatedSelector,
  scrollToNewMessageSelector
} from '../../store/message/selector'
import { getContactsAC } from '../../store/user/actions'
import { connectionStatusSelector } from '../../store/user/selector'
import { CONNECTION_STATUS } from '../../store/user/constants'
import {
  addMessageToMap,
  getMessagesFromMap,
  messagesDiff,
  setMessagesToMap,
  updateMessageOnMap
} from '../../helpers/messagesHalper'
import { useDidUpdate } from '../index'
import { customUpload, getCustomUploader } from '../../helpers/customUploader'
import { IProgress } from '../../components/ChatContainer'
import store from '../../store'
import { ADD_MESSAGE, UPLOAD_ATTACHMENT_COMPILATION } from '../../store/message/constants'
import { getFileExtension } from '../../helpers'
import { createImageThumbnail } from '../../helpers/resizeImage'
import { updateChannelLastMessageAC } from '../../store/channel/actions' */

// export default function useMessages(channel: IChannel) {
// eslint-disable-next-line max-len
/* const MAX_MESSAGES_LENGTH = 70
  const LOAD_MAX_MESSAGE_COUNT = 15

  const dispatch = useDispatch()
  const newMessage: IMessage = useSelector(channelNewMessageSelector, shallowEqual)
  const scrollToNewMessage = useSelector(scrollToNewMessageSelector, shallowEqual)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)
  const updatedMessage: { messageId: string; params: IMessage } = useSelector(messageUpdatedSelector)
  const newMarkers: { name: string; markersMap: any } = useSelector(messageNewMarkersSelector)
  const [pendingMessages, setPendingMessages] = useState<{ [key: string]: IMessage[] }>({})
  const [messages, setMessages] = useState<IMessage[]>([])
  const [receivedNewMessage, setReceivedNewMessage] = useState<IMessage>()
  const [allMessages, setAllMessages] = useState<IMessage[]>([])
  const [hasNext, setHasNext] = useState<boolean>(true)
  const [hasPrev, setHasPrev] = useState<boolean>(true)
  const [cachedMessages, setCachedMessages] = useState<{ prev: boolean; next: boolean }>({ prev: false, next: false })

  const handleSendMessage = async (
    message: any,
    connectionState: string,
    channelId: string,
    sendAttachmentsAsSeparateMessage: boolean
  ) => {
    const channel = getChannelFromMap(channelId)
    const mentionedUserIds = message.mentionedMembers.map((member: any) => member.id)
    console.log('received message with attachments for send  .. ', message)
    let attachmentsToSend: IAttachment[] = []
    const customUploader = getCustomUploader()

    if (message.attachments && message.attachments.length) {
      const attachmentsCopy = [...message.attachments]
      attachmentsToSend = attachmentsCopy.map((attachment: any) => {
        const attachmentBuilder = channel.createAttachmentBuilder(attachment.data, attachment.type)
        const att = attachmentBuilder
          .setName(attachment.name)
          .setMetadata(attachment.metadata)
          .setUpload(customUploader ? false : attachment.upload)
          .create()
        if (!customUploader) {
          att.progress = (progressPercent: any) => {
            console.log('progress ... ', progressPercent)
            // attachmentsListeners.progress(progressPercent, attachment.attachmentId);
          }
          att.completion = (updatedAttachment: any, error: any) => {
            if (error) {
              console.log('fail to upload attachment ... ', error)
              // attachmentsListeners.compilation(UPLOAD_STATE.FAIL, messageForCatch.tid, attachment);
            } else {
              console.log('success attachment. .. ', updatedAttachment)
              // eslint-disable-next-line max-len
              // attachmentsListeners.compilation(UPLOAD_STATE.SUCCESS, messageForCatch.tid, { ...updatedAttachment, attachmentId: attachment.attachmentId });
            }
          }
        }
        // not for SDK, for displaying attachments and their progress
        att.attachmentId = attachment.attachmentId
        att.attachmentUrl = attachment.attachmentUrl
        return att
      })

      console.log('created attachments to send .. ', attachmentsToSend)
      if (sendAttachmentsAsSeparateMessage) {
        const messageBuilder = channel.createMessageBuilder()
        messageBuilder
          .setBody(message.body)
          .setAttachments(attachmentsToSend)
          .setMentionUserIds(mentionedUserIds)
          .setType(message.type)
          .setDisplayCount(message.type === 'system' ? 0 : 1)
          .setMetadata(JSON.stringify(message.metadata))
        if (message.parent) {
          messageBuilder.setParentMessageId(message.parent ? message.parent.id : null)
        }
        if (message.repliedInThread) {
          messageBuilder.setReplyInThread()
        }
        const messageToSend = messageBuilder.create()
        console.log('created message for send ... ', messageToSend)
        const messageCopy = {
          ...messageToSend,
          attachments: [
            {
              attachmentId: message.attachments[0].attachmentId,
              name: message.attachments[0].name,
              data: {},
              type: message.attachments[0].type,
              attachmentUrl: message.attachments[0].attachmentUrl
            }
          ]
        }
        console.log('put message ----- ', {
          ...messageCopy,
          createdAt: new Date(Date.now()),
          parent: message.parent
        })
        setReceivedNewMessage({
          ...messageCopy,
          createdAt: new Date(Date.now()),
          parent: message.parent
        })
        let filePath
        dispatch(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, attachmentsToSend[0]))
        if (customUploader) {
          const handleUploadProgress = ({ loaded, total }: IProgress) => {
            console.log('progress  ,,, ', loaded / total)
          }
          const handleUpdateLocalPath = (updatedLink: string) => {
            console.log('put local path for updated image .. ', updatedLink)
            filePath = updatedLink
            messageCopy.attachments[0] = { ...messageCopy.attachments[0], attachmentUrl: updatedLink }

            console.log('update  attachment src for attachment.... ... . ')
            handleUpdateMessage({ messageId: messageCopy.tid, params: { ...messageCopy } })
            /!* store.dispatch({
              type: UPDATE_MESSAGE,
              payload: {
                message: JSON.parse(
                  JSON.stringify({
                    ...messageCopy
                  })
                )
              }
            }) *!/
          }

          console.log('goes to upload attachments... ', attachmentsToSend[0])
          const uri = await customUpload(attachmentsToSend[0], handleUploadProgress, handleUpdateLocalPath)
          console.log('success upload attachments... ', attachmentsToSend[0])
          dispatch(updateAttachmentUploadingStateAC(UPLOAD_STATE.SUCCESS, attachmentsToSend[0]))
          let thumbnailMetas: { thumbnail?: string; imageWidth?: number; imageHeight?: number } = {}
          const ext = getFileExtension(attachmentsToSend[0].name)
          if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
            thumbnailMetas = await createImageThumbnail(
              null,
              filePath,
              attachmentsToSend[0].type === 'file' ? 50 : undefined,
              attachmentsToSend[0].type === 'file' ? 50 : undefined
            )
          }

          messageToSend.attachments = [
            {
              ...attachmentsToSend[0],
              url: uri,
              metadata: JSON.stringify({
                ...attachmentsToSend[0].metadata,
                ...(thumbnailMetas.thumbnail && {
                  thumbnail: thumbnailMetas.thumbnail,
                  width: thumbnailMetas.imageWidth,
                  height: thumbnailMetas.imageHeight
                })
              })
            }
          ]

          if (connectionState === CONNECTION_STATUS.CONNECTED) {
            console.log('send separate message for attachment. ... ', messageToSend)

            const messageResponse = await channel.sendMessage(messageToSend)
            /!* if (msgCount <= 200) {
              const messageToSend: any = {
                // metadata: mentionedMembersPositions,
                body: `${msgCount}`,
                mentionedMembers: [],
                attachments: [],
                type: 'text'
              }
              yield put(sendMessageAC(messageToSend, channelId, 'Connected'))
              msgCount++
            } *!/
            const messageUpdateData = {
              id: messageResponse.id,
              deliveryStatus: messageResponse.deliveryStatus,
              attachments: [{ ...messageResponse.attachments[0], attachmentUrl: attachmentsToSend[0].attachmentUrl }],
              mentionedUsers: messageResponse.mentionedUsers,
              metadata: messageResponse.metadata,
              parent: messageResponse.parent,
              repliedInThread: messageResponse.repliedInThread,
              createdAt: messageResponse.createdAt
            }
            dispatch(updateMessageAC(messageToSend.tid, messageUpdateData))
            updateMessageOnMap(channel.id, {
              messageId: messageToSend.tid,
              params: messageUpdateData
            })
            dispatch(
              updateChannelLastMessageAC(JSON.parse(JSON.stringify(messageResponse)), { id: channel.id } as IChannel)
            )
          }
        }
      } else {
        const messageBuilder = channel.createMessageBuilder()
        messageBuilder
          .setBody(message.body)
          .setAttachments(message.attachments)
          .setMentionUserIds(mentionedUserIds)
          .setType(message.type)
          .setDisplayCount(message.type === 'system' ? 0 : 1)
          .setMetadata(JSON.stringify(message.metadata))
        if (message.parent) {
          messageBuilder.setParentMessageId(message.parent ? message.parent.id : null)
        }
        if (message.repliedInThread) {
          messageBuilder.setReplyInThread()
        }
        const messageToSend = messageBuilder.create()
        if (customUploader) {
          const attachmentsLocalPaths = {}
          let receivedPaths = 1
          const uploadAllAttachments = async () => {
            return await Promise.all(
              attachmentsToSend.map((attachment) => {
                return customUpload(
                  attachment,
                  ({ loaded, total }) => {
                    console.log('progress  ,,, ', loaded / total)
                  },
                  (updatedLink: string) => {
                    if (attachment.attachmentId) {
                      receivedPaths++
                      attachmentsLocalPaths[attachment.attachmentId] = updatedLink
                      if (receivedPaths === attachmentsToSend.length) {
                        const messageCopy = {
                          ...messageToSend,
                          attachments: message.attachments.map((att: any) => ({
                            attachmentId: att.attachmentId,
                            name: att.name,
                            data: {},
                            type: att.type,
                            attachmentUrl: attachmentsLocalPaths[attachment.attachmentId!]
                          }))
                        }
                        console.log('put  message for all attachment.... ... . ')
                        store.dispatch({
                          type: ADD_MESSAGE,
                          payload: {
                            message: JSON.parse(
                              JSON.stringify({
                                ...messageCopy,
                                createdAt: new Date(Date.now()),
                                parent: message.parent
                              })
                            )
                          }
                        })
                      }
                    }
                  }
                )
              })
            )
          }

          const uploadedAttachments = await uploadAllAttachments()
          // @ts-ignore
          attachmentsToSend = await (async () => {
            return await Promise.all(
              uploadedAttachments.map(async (att: any) => {
                return new Promise((resolve) => {
                  // yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, att.attachment))
                  store.dispatch({
                    type: UPLOAD_ATTACHMENT_COMPILATION,
                    payload: { attachmentUploadingState: UPLOAD_STATE.UPLOADING, attachment: att.attachment }
                  })
                  createImageThumbnail(null, att.filePath).then(({ thumbnail, imageWidth, imageHeight }) => {
                    store.dispatch({
                      type: UPLOAD_ATTACHMENT_COMPILATION,
                      payload: { attachmentUploadingState: UPLOAD_STATE.SUCCESS, attachment: att.attachment }
                    })
                    return resolve({
                      ...att.attachment,
                      url: att.uri,
                      metadata: JSON.stringify({
                        thumbnail: thumbnail,
                        width: imageWidth,
                        height: imageHeight
                      })
                    })
                  })
                })
              })
            )
          })
        } else {
          const messageCopy = {
            ...messageToSend,
            attachments: message.attachments.map((att: any) => ({
              attachmentId: att.attachmentId,
              name: att.name,
              data: {},
              type: att.type,
              attachmentUrl: att.attachmentUrl
            }))
          }
          console.log('put pending message with attachments ......')
          dispatch(
            addMessageAC(
              JSON.parse(
                JSON.stringify({
                  ...messageCopy,
                  createdAt: new Date(Date.now()),
                  parent: message.parent
                })
              )
            )
          )
        }
        messageToSend.attachments = attachmentsToSend
        if (connectionState === CONNECTION_STATUS.CONNECTED) {
          const messageResponse = await channel.sendMessage(messageToSend)
          /!* if (msgCount <= 200) {
            const messageToSend: any = {
              // metadata: mentionedMembersPositions,
              body: `${msgCount}`,
              mentionedMembers: [],
              attachments: [],
              type: 'text'
            }
            yield put(sendMessageAC(messageToSend, channelId, 'Connected'))
            msgCount++
          } *!/
          const messageUpdateData = {
            id: messageResponse.id,
            deliveryStatus: messageResponse.deliveryStatus,
            attachments: messageResponse.attachments,
            mentionedUsers: messageResponse.mentionedUsers,
            metadata: messageResponse.metadata,
            parent: messageResponse.parent,
            repliedInThread: messageResponse.repliedInThread,
            createdAt: messageResponse.createdAt
          }
          dispatch(updateMessageAC(messageToSend.tid, messageUpdateData))
          updateMessageOnMap(channel.id, {
            messageId: messageToSend.tid,
            params: messageUpdateData
          })
          dispatch(
            updateChannelLastMessageAC(JSON.parse(JSON.stringify(messageResponse)), { id: channel.id } as IChannel)
          )
        }
      }
    }
  }

  const handleUpdateMessage = (updatedMessage: { messageId: string; params: IMessage }) => {
    setMessages((prevState) => {
      return prevState.map((message) => {
        if (message.tid === updatedMessage.messageId || message.id === updatedMessage.messageId) {
          return { ...message, ...updatedMessage.params }
        }
        return message
      })
    })
    setAllMessages((prevState) => {
      return prevState.map((message) => {
        if (message.tid === updatedMessage.messageId || message.id === updatedMessage.messageId) {
          return { ...message, ...updatedMessage.params }
        }
        return message
      })
    })
  }
  const handleUpdateMessages = (updatedMessages: IMessage[]) => {
    const messagesMap = {}
    updatedMessages.forEach((message) => {
      messagesMap[message.id] = message
    })
    setMessages((prevState) => {
      return prevState.map((message) => {
        if (messagesMap[message.id]) {
          const updateMessage = messagesMap[message.id]
          if (message.tid === updateMessage.id || message.id === updateMessage.id) {
            if (messagesDiff(message, updateMessage)) {
              return { ...updateMessage }
            }
          }
        }
        return message
      })
    })
    setAllMessages((prevState) => {
      return prevState.map((message) => {
        if (messagesMap[message.id]) {
          const updateMessage = messagesMap[message.id]
          if (message.tid === updateMessage.id || message.id === updateMessage.id) {
            if (messagesDiff(message, updateMessage)) {
              return { ...updateMessage }
            }
          }
        }
        return message
      })
    })
  }
  const handleGetMessages = async (cachedMessages?: IMessage[], messageId?: string) => {
    if (cachedMessages && cachedMessages.length && !channel.newMessageCount) {
      setAllMessages(cachedMessages)
      setMessages(cachedMessages)
    }
    const SceytChatClient = getClient()
    const messageQueryBuilder = new (SceytChatClient.chatClient.MessageListQueryBuilder as any)(channel.id)
    messageQueryBuilder.limit(50)
    messageQueryBuilder.reverse(true)
    const messageQuery = await messageQueryBuilder.build()
    query.messageQuery = messageQuery
    dispatch(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
    let result: any = {}
    if (messageId) {
      const messageIndex = allMessages.findIndex((msg) => msg.id === messageId)
      if (messageIndex >= 20) {
        setMessages(allMessages.slice(messageIndex - 20, messageIndex + 79))
        // setCachedMessages({ ...cachedMessages, next: allMessages.length > messageIndex + 79 })
        setCachedMessages({ prev: messageIndex < 21, next: allMessages.length > messageIndex + 79 })
      } else {
        messageQuery.limit = 60
        result = await messageQuery.loadNearMessageId(messageId)
        setHasNext(true)
        setMessages(result.messages)
        setAllMessages(result.messages)
        setCachedMessages({ prev: false, next: false })
        return
      }
    } else {
      if (channel.newMessageCount && channel.lastDisplayedMsgId) {
        if (channel.lastDisplayedMsgId) {
          // dispatch(setMessagesNextCompleteAC(true))
          // dispatch(setMessagesPrevCompleteAC(true))
          messageQuery.limit = 60
          // result = await messageQuery.loadPreviousMessageId, '0')
          result = await messageQuery.loadNearMessageId(channel.lastDisplayedMsgId)
          setHasNext(channel.lastMessage.id !== result.messages[result.messages.length - 1].id)
        }
        setMessages(result.messages)
        setAllMessages(result.messages)
        setMessagesToMap(channel.id, result.messages)
        // dispatch(setMessagesNextCompleteAC(true))
      } else {
        // setMessagesNextCompleteAC(false)

        /!* dispatch(setMessagesNextCompleteAC(true))
          dispatch(setMessagesPrevCompleteAC(true))
          messageQuery.limit = 60
          // result = await messageQuery.loadPreviousMessageId, '0')
          result = await messageQuery.loadNearMessageId('351476386134794240') *!/
        result = await messageQuery.loadPrevious()
        setHasPrev(result.hasNext)
        setHasNext(false)
        // dispatch(setMessagesPrevCompleteAC(result.hasNext))

        if (cachedMessages && cachedMessages.length) {
          handleUpdateMessages(result.messages)
        } else {
          setAllMessages(result.messages)
          setMessages(result.messages)
          setMessagesToMap(channel.id, result.messages)
          // setMessages(result.messages)
        }
      }
    }
    // addMessagesAC(result.messages, 1, channel.newMessageCount));
    dispatch(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
  }

  const handleAddMessages = (newMessages: IMessage[], direction: 'prev' | 'next', fromCache?: boolean) => {
    const newMessagesLength = newMessages.length
    if (fromCache) {
      if (direction === 'next') {
        const lastMessageId = messages[messages.length - 1].id
        const lastElIndex = allMessages.findIndex((mes) => mes.id === lastMessageId)
        const messagesForAdd = allMessages.slice(lastElIndex + 1, lastElIndex + LOAD_MAX_MESSAGE_COUNT + 1)
        setCachedMessages({ next: !(messagesForAdd.length < LOAD_MAX_MESSAGE_COUNT), prev: true })
        const slicedMessages = [...messages]
        slicedMessages.splice(0, messagesForAdd.length)
        // console.log('called handle add messages. .. next')
        setMessages([...slicedMessages, ...messagesForAdd])
      } else {
        const firsElIndex = allMessages.findIndex((mes) => mes.id === messages[0].id)
        const messagesForAdd = allMessages.slice(
          firsElIndex <= LOAD_MAX_MESSAGE_COUNT ? 0 : firsElIndex - (LOAD_MAX_MESSAGE_COUNT + 1),
          firsElIndex - 1
        )
        setCachedMessages({
          next: true,
          prev: !(messagesForAdd.length < LOAD_MAX_MESSAGE_COUNT || firsElIndex === 0)
        })

        const slicedMessages = [...messages]
        slicedMessages.splice(-messagesForAdd.length)
        // console.log('called handle add messages. .. prev')
        setMessages([...messagesForAdd, ...slicedMessages])
      }
    } else {
      if (messages.length >= MAX_MESSAGES_LENGTH) {
        const slicedMessages = [...messages]
        if (direction === 'next') {
          setCachedMessages({ ...cachedMessages, prev: true })
          slicedMessages.splice(0, newMessages.length)
          // console.log('called handle add messages. .. next 2')
          setMessages([...slicedMessages, ...newMessages])
        } else {
          setCachedMessages({ ...cachedMessages, next: true })
          slicedMessages.splice(-newMessagesLength)
          // console.log('called handle add messages. .. prev 2')
          setMessages([...newMessages, ...slicedMessages])
        }
      } else if (newMessagesLength + messages.length > MAX_MESSAGES_LENGTH) {
        const sliceElementCount = newMessagesLength + messages.length - MAX_MESSAGES_LENGTH
        const slicedMessages = [...messages]
        if (direction === 'prev') {
          setCachedMessages({ ...cachedMessages, next: true })
          slicedMessages.splice(-sliceElementCount)
          // console.log('called handle add messages. .. prev 3')
          setMessages([...newMessages, ...slicedMessages])
        } else {
          setCachedMessages({ ...cachedMessages, prev: true })
          slicedMessages.splice(0, sliceElementCount)
          // console.log('called handle add messages. .. next 3')
          setMessages([...slicedMessages, ...newMessages])
        }
      } else {
        if (direction === 'prev') {
          // console.log('called handle add messages. .. prev 4')
          setMessages((prev) => [...newMessages, ...prev])
        } else {
          // console.log('called handle add messages. .. next 4')
          setMessages((prev) => [...prev, ...newMessages])
        }
      }
      if (direction === 'prev') {
        setAllMessages([...newMessages, ...allMessages])
      } else {
        setAllMessages([...allMessages, ...newMessages])
      }
    }
  }
  const handleSetPendingMessage = (newMessage: IMessage) => {
    console.log('set pending message ... ', newMessage)
    console.log('channel.id ... ', channel.id)
    console.log('pending messages . ... ', pendingMessages)
    setPendingMessages((prevState) => {
      const stateCopy = { ...prevState }
      if (prevState[channel.id]) {
        stateCopy[channel.id] = [...prevState[channel.id], newMessage]
      } else {
        stateCopy[channel.id] = [newMessage]
      }
      console.log('state copy. ... ', stateCopy)
      return stateCopy
    })
  }
  useEffect(() => {
    console.log('pendingMessages .. . ', pendingMessages)
  }, [pendingMessages])

  useEffect(() => {
    console.log('messages on hook.. . ', messages)
  }, [messages])

  useEffect(() => {
    setCachedMessages({ prev: false, next: false })
    setMessages([])
    setAllMessages([])
    setHasNext(true)
    setHasPrev(true)
    if (channel.id) {
      dispatch(getContactsAC())
      const cachedMessages = getMessagesFromMap(channel.id)
      handleGetMessages(cachedMessages)
    }
  }, [channel.id])

  useEffect(() => {
    if (scrollToNewMessage.scrollToBottom && scrollToNewMessage.updateMessageList) {
      /!* setMessages([])
      setCachedMessages({ prev: false, next: false })
      const cachedMessages = getMessagesFromMap(channel.id)
      handleGetMessages(cachedMessages) *!/
    }
  }, [scrollToNewMessage])

  useEffect(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      if (channel.id) {
        setAllMessages([])
        setMessages([])
        handleGetMessages()
      }
      Object.keys(pendingMessages).forEach((channelId) => {
        if (pendingMessages[channelId].length > 0) {
          pendingMessages[channelId].forEach((message) => {
            dispatch(resendMessageAC(channelId, message))
          })
        }
      })
    }
  }, [connectionStatus])

  useEffect(() => {
    if (newMessage) {
      setReceivedNewMessage(newMessage)
    }
  }, [newMessage])

  useEffect(() => {
    if (receivedNewMessage) {
      console.log('received new message on hook ... ', receivedNewMessage)
      if (receivedNewMessage.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
        handleSetPendingMessage(receivedNewMessage)
      } else {
        setMessages((prevState) => [...prevState, receivedNewMessage])
        setAllMessages((prevState) => [...prevState, receivedNewMessage])
        addMessageToMap(channel.id, receivedNewMessage)
      }
    }
  }, [receivedNewMessage])

  useDidUpdate(() => {
    if (newMarkers && newMarkers.markersMap) {
      setMessages((prevState) => {
        const { name } = newMarkers
        const { markersMap } = newMarkers
        return prevState.map((message) => {
          if (
            markersMap[message.id] &&
            (message.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT || name === MESSAGE_DELIVERY_STATUS.READ)
          ) {
            return { ...message, deliveryStatus: name }
          }
          return message
        })
      })
      setAllMessages((prevState) => {
        const { name } = newMarkers
        const { markersMap } = newMarkers
        return prevState.map((message) => {
          if (
            markersMap[message.id] &&
            (message.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT || name === MESSAGE_DELIVERY_STATUS.READ)
          ) {
            return { ...message, deliveryStatus: name }
          }
          return message
        })
      })
    }
  }, [newMarkers])

  useDidUpdate(() => {
    if (updatedMessage) {
      console.log('pendingMessages on update message . ', pendingMessages)
      const pendingMessageIndex =
        pendingMessages[channel.id] &&
        pendingMessages[channel.id].findIndex((mes) => mes.tid === updatedMessage.messageId)
      if (pendingMessageIndex >= 0) {
        let addMessage = pendingMessages[channel.id][pendingMessageIndex]
        setPendingMessages((prevState) => {
          const stateCopy = { ...prevState }
          stateCopy[channel.id] = prevState[channel.id].filter((mes) => mes.tid !== updatedMessage.messageId)
          return stateCopy
        })
        addMessage = { ...addMessage, ...updatedMessage.params }
        setMessages((prevState) => [...prevState, addMessage])
        setAllMessages((prevState) => [...prevState, addMessage])
        addMessageToMap(channel.id, addMessage)
      } else {
        handleUpdateMessage(updatedMessage)
      }
    }
  }, [updatedMessage])

  return {
    messages,
    handleSendMessage,
    handleGetMessages,
    handleAddMessages,
    pendingMessages,
    cachedMessages,
    hasNext,
    hasPrev
  } as const */
// }
