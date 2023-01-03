import { put, call, takeLatest, takeEvery } from 'redux-saga/effects'

import {
  ADD_MESSAGE,
  ADD_REACTION,
  DELETE_MESSAGE,
  DELETE_REACTION,
  EDIT_MESSAGE,
  GET_MESSAGES,
  GET_MESSAGES_ATTACHMENTS,
  LOAD_MORE_MESSAGES,
  LOAD_MORE_MESSAGES_ATTACHMENTS,
  PAUSE_ATTACHMENT_UPLOADING,
  RESEND_MESSAGE,
  RESUME_ATTACHMENT_UPLOADING,
  SEND_MESSAGE,
  SEND_TEXT_MESSAGE,
  UPDATE_MESSAGE,
  UPLOAD_ATTACHMENT_COMPILATION
} from './constants'

import { IAction, IAttachment, IChannel, IMessage } from '../../types'
import { getClient } from '../../common/client'
import { getChannelFromMap, query } from '../../helpers/channelHalper'
import {
  addAttachmentsAC,
  addMessageAC,
  addMessagesAC,
  addReactionToMessageAC,
  deleteReactionFromMessageAC,
  scrollToNewMessageAC,
  // sendTextMessageAC,
  setAttachmentsAC,
  setAttachmentsCompleteAC,
  setMessagesAC,
  setMessagesHasNextAC,
  setMessagesHasPrevAC,
  setMessagesLoadingStateAC,
  setScrollToMessagesAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC
} from './actions'
import { LOADING_STATE, UPLOAD_STATE } from '../../helpers/constants'
import { markChannelAsReadAC, updateChannelLastMessageAC } from '../channel/actions'
import {
  addReactionToMessageOnMap,
  getAllMessages,
  getMessagesFromMap,
  setAllMessages,
  setHasNextCached,
  setHasPrevCached,
  setMessagesToMap,
  updateMessageOnMap,
  MESSAGES_MAX_LENGTH,
  getHasPrevCached,
  getFromAllMessagesByMessageId,
  MESSAGE_LOAD_DIRECTION,
  getHasNextCached,
  addAllMessages,
  addMessageToMap,
  updateMessageOnAllMessages,
  getVideoThumb,
  IAttachmentMeta,
  deleteVideoThumb
} from '../../helpers/messagesHalper'
import { CONNECTION_STATUS } from '../user/constants'
import { customUpload, getCustomUploader, pauseUpload, resumeUpload } from '../../helpers/customUploader'
import { createImageThumbnail, getImageSize } from '../../helpers/resizeImage'
import store from '../index'
import { IProgress } from '../../components/ChatContainer'
// let msgCount = 1
function* sendMessage(action: IAction): any {
  // let messageForCatch = {}
  try {
    const { payload } = action
    const { message, connectionState, channelId, sendAttachmentsAsSeparateMessage } = payload
    const channel = yield call(getChannelFromMap, channelId)
    const mentionedUserIds = message.mentionedMembers.map((member: any) => member.id)
    // let attachmentsToSend: IAttachment[] = []
    const customUploader = getCustomUploader()

    if (message.attachments && message.attachments.length) {
      // const attachmentsCopy = [...message.attachments]

      if (sendAttachmentsAsSeparateMessage) {
        let thumbnailMetas: IAttachmentMeta = {}
        const messageAttachment = { ...message.attachments[0], url: message.attachments[0].data }
        const fileType = messageAttachment.data.type.split('/')[0]
        if (fileType === 'video') {
          thumbnailMetas = getVideoThumb(messageAttachment.attachmentId)
        }
        messageAttachment.metadata = {
          ...messageAttachment.metadata,
          ...(thumbnailMetas &&
            thumbnailMetas.thumbnail && {
              thumbnail: thumbnailMetas.thumbnail,
              width: thumbnailMetas.imageWidth,
              height: thumbnailMetas.imageHeight,
              ...(thumbnailMetas.duration && { duration: thumbnailMetas.duration })
            })
        }
        const messageBuilder = channel.createMessageBuilder()
        messageBuilder
          .setBody(message.body)
          .setAttachments([])
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
        const messageCopy = {
          ...messageToSend,
          attachments: [messageAttachment]
        }
        const pendingMessage = JSON.parse(
          JSON.stringify({
            ...messageCopy,
            createdAt: new Date(Date.now()),
            parent: message.parent
          })
        )
        yield put(addMessageAC(pendingMessage))
        addMessageToMap(channelId, pendingMessage)
        addAllMessages([pendingMessage], MESSAGE_LOAD_DIRECTION.NEXT)
        let filePath: any
        yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, messageAttachment))
        if (customUploader) {
          const handleUploadProgress = ({ loaded, total }: IProgress) => {
            console.log('progress  ,,, ', loaded / total)
          }
          const handleUpdateLocalPath = (updatedLink: string) => {
            filePath = updatedLink
            thumbnailMetas = getVideoThumb(messageAttachment.attachmentId)
            messageCopy.attachments[0] = { ...messageCopy.attachments[0], attachmentUrl: updatedLink }

            store.dispatch({
              type: UPDATE_MESSAGE,
              payload: {
                message: JSON.parse(
                  JSON.stringify({
                    ...messageCopy
                  })
                )
              }
            })
          }
          const uri = yield call(customUpload, messageAttachment, handleUploadProgress, handleUpdateLocalPath)
          yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.SUCCESS, messageAttachment))
          let fileSize = messageAttachment.size
          let imgAttachmentMeta
          if (fileType === 'image') {
            fileSize = yield call(getImageSize, filePath)
            thumbnailMetas = yield call(
              createImageThumbnail,
              null,
              filePath,
              messageAttachment.type === 'file' ? 50 : undefined,
              messageAttachment.type === 'file' ? 50 : undefined
            )
            imgAttachmentMeta = JSON.stringify({
              ...messageAttachment.metadata,
              ...(thumbnailMetas &&
                thumbnailMetas.thumbnail && {
                  thumbnail: thumbnailMetas.thumbnail,
                  width: thumbnailMetas.imageWidth,
                  height: thumbnailMetas.imageHeight,
                  ...(thumbnailMetas.duration && { duration: thumbnailMetas.duration })
                })
            })
          }

          const attachmentBuilder = channel.createAttachmentBuilder(uri, messageAttachment.type)
          const attachmentToSend = attachmentBuilder
            .setName(messageAttachment.name)
            .setMetadata(imgAttachmentMeta || JSON.stringify({ ...messageAttachment.metadata }))
            .setFileSize(fileSize)
            .setUpload(false)
            .create()
          // not for SDK, for displaying attachments and their progress
          attachmentToSend.attachmentId = messageAttachment.attachmentId
          attachmentToSend.attachmentUrl = messageAttachment.attachmentUrl

          messageToSend.attachments = [attachmentToSend]

          if (connectionState === CONNECTION_STATUS.CONNECTED) {
            const messageResponse = yield call(channel.sendMessage, messageToSend)
            /* if (msgCount <= 200) {
              const messageToSend: any = {
                // metadata: mentionedMembersPositions,
                body: `${msgCount}`,
                mentionedMembers: [],
                attachments: [],
                type: 'text'
              }
              yield put(sendMessageAC(messageToSend, channelId, 'Connected'))
              msgCount++
            } */
            const messageUpdateData = {
              id: messageResponse.id,
              deliveryStatus: messageResponse.deliveryStatus,
              attachments: [{ ...messageResponse.attachments[0], attachmentUrl: attachmentToSend.attachmentUrl }],
              mentionedUsers: messageResponse.mentionedUsers,
              metadata: messageResponse.metadata,
              parent: messageResponse.parent,
              repliedInThread: messageResponse.repliedInThread,
              createdAt: messageResponse.createdAt
            }
            yield put(updateMessageAC(messageToSend.tid, messageUpdateData))

            if (fileType === 'video') {
              deleteVideoThumb(messageAttachment.attachmentId)
            }
            updateMessageOnMap(channel.id, {
              messageId: messageToSend.tid,
              params: messageUpdateData
            })
            updateMessageOnAllMessages(messageToSend.tid, messageUpdateData)
            yield put(
              updateChannelLastMessageAC(JSON.parse(JSON.stringify(messageResponse)), { id: channel.id } as IChannel)
            )
          }
        }
      } else {
        let attachmentsToSend: IAttachment[] = message.attachments.map((attachment: any) => {
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

          const uploadedAttachments = yield call(uploadAllAttachments)
          attachmentsToSend = yield call(async () => {
            return await Promise.all(
              uploadedAttachments.map(async (att: { attachment: IAttachment; uri: string; filePath: string }) => {
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
          yield put(
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
          const messageResponse = yield call(channel.sendMessage, messageToSend)
          /* if (msgCount <= 200) {
            const messageToSend: any = {
              // metadata: mentionedMembersPositions,
              body: `${msgCount}`,
              mentionedMembers: [],
              attachments: [],
              type: 'text'
            }
            yield put(sendMessageAC(messageToSend, channelId, 'Connected'))
            msgCount++
          } */
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
          yield put(updateMessageAC(messageToSend.tid, messageUpdateData))
          updateMessageOnMap(channel.id, {
            messageId: messageToSend.tid,
            params: messageUpdateData
          })
          yield put(
            updateChannelLastMessageAC(JSON.parse(JSON.stringify(messageResponse)), { id: channel.id } as IChannel)
          )
        }
      }
    }
    yield put(scrollToNewMessageAC(true, true))
    // const sendAsSeparateMessage = getSendAttachmentsAsSeparateMessages()
    // if (attachmentsToSend.length) {
    /* if (sendAsSeparateMessage) {
        const groupId = uuidv4()
        for (let i = 0; i < attachmentsToSend.length; i++) {
          const messageBuilder = channel.createMessageBuilder()
          const groupMeta = { ...message.metadata, groupId }
          messageBuilder
            .setBody(i === 0 ? message.body : '')
            .setAttachments(message.attachments)
            .setMentionUserIds(mentionedUserIds)
            .setType(message.type)
            .setDisplayCount(message.type === 'system' ? 0 : 1)
            .setMetadata(JSON.stringify(groupMeta))
          if (message.parent) {
            messageBuilder.setParentMessageId(message.parent ? message.parent.id : null)
          }
          if (message.repliedInThread) {
            messageBuilder.setReplyInThread()
          }
          const messageToSend = messageBuilder.create()
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
          yield put(
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
          console.log('upload attachment is started ... ')
          let filePath
          yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, attachmentsToSend[i]))
          if (customUploader) {
            const uri = yield call(
              customUpload,
              attachmentsToSend[i],
              ({ loaded, total }) => {
                console.log('progress  ,,, ', loaded / total)
              },
              (updatedLink: string) => {
                console.log('put local path for updated image .. ', updatedLink)
                filePath = updatedLink
                const messageCopy = {
                  ...messageToSend,
                  attachments: [{ ...attachmentsToSend[i], attachmentUrl: updatedLink }]
                }
                console.log('put separate message for attachment.... ... . ')
                store.dispatch({
                  type: UPDATE_MESSAGE,
                  payload: {
                    message: JSON.parse(
                      JSON.stringify({
                        ...messageCopy
                      })
                    )
                  }
                })
              }
            )

            console.log('upload attachment is ended ... ')
            yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.SUCCESS, attachmentsToSend[i]))
            let thumbnailMetas: { thumbnail?: string; imageWidth?: number; imageHeight?: number } = {}
            const ext = getFileExtension(attachmentsToSend[i].name)
            if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
              thumbnailMetas = yield call(
                createImageThumbnail,
                null,
                filePath,
                attachmentsToSend[i].type === 'file' ? 50 : undefined,
                attachmentsToSend[i].type === 'file' ? 50 : undefined
              )
            }

            messageToSend.attachments = [
              {
                ...attachmentsToSend[i],
                url: uri,
                metadata: JSON.stringify({
                  ...attachmentsToSend[i].metadata,
                  ...(thumbnailMetas.thumbnail && {
                    thumbnail: thumbnailMetas.thumbnail,
                    width: thumbnailMetas.imageWidth,
                    height: thumbnailMetas.imageHeight
                  })
                })
              }
            ]
          } else {
            messageToSend.attachments = [attachmentsToSend[i]]
          }

          if (connectionState === CONNECTION_STATUS.CONNECTED) {
            console.log('send separate message for attachment. ... ', messageToSend)
            const messageResponse = yield call(channel.sendMessage, messageToSend)
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
            yield put(updateMessageAC(messageToSend.tid, messageUpdateData))
            updateMessageOnMap(channel.id, {
              messageId: messageToSend.tid,
              params: messageUpdateData
            })
            yield put(
              updateChannelLastMessageAC(JSON.parse(JSON.stringify(messageResponse)), { id: channel.id } as IChannel)
            )
          }
        }
      } else */
    // messageForCatch = messageToSend
  } catch (e) {
    console.log('error on send message ... ', e)
    // yield put(setErrorNotification(`${e.message} ${e.code}`));
  }
}

function* sendTextMessage(action: IAction): any {
  // let messageForCatch = {}
  try {
    const { payload } = action
    const { message, connectionState, channelId } = payload
    const channel = yield call(getChannelFromMap, channelId)
    const mentionedUserIds = message.mentionedMembers.map((member: any) => member.id)

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

    const pendingMessage = JSON.parse(
      JSON.stringify({
        ...messageToSend,
        createdAt: new Date(Date.now()),
        parent: message.parent
      })
    )
    if (!getHasNextCached()) {
      yield put(addMessageAC(pendingMessage))
    }
    addMessageToMap(channelId, pendingMessage)
    addAllMessages([pendingMessage], MESSAGE_LOAD_DIRECTION.NEXT)
    yield put(scrollToNewMessageAC(true, true))
    if (connectionState === CONNECTION_STATUS.CONNECTED) {
      const messageResponse = yield call(channel.sendMessage, messageToSend)
      /* if (msgCount <= 200) {
          const messageToSend: any = {
            // metadata: mentionedMembersPositions,
            body: `${msgCount}`,
            mentionedMembers: [],
            attachments: [],
            type: 'text'
          }
          yield put(sendTextMessageAC(messageToSend, channelId, 'Connected'))
          msgCount++
        } */
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
      yield put(updateMessageAC(messageToSend.tid, messageUpdateData))
      updateMessageOnMap(channel.id, {
        messageId: messageToSend.tid,
        params: messageUpdateData
      })
      updateMessageOnAllMessages(messageToSend.tid, messageUpdateData)
      yield put(updateChannelLastMessageAC(JSON.parse(JSON.stringify(messageResponse)), { id: channel.id } as IChannel))
    }
    // messageForCatch = messageToSend
  } catch (e) {
    console.log('error on send message ... ', e)
    // yield put(setErrorNotification(`${e.message} ${e.code}`));
  }
}

function* resendMessage(action: IAction): any {
  try {
    const { payload } = action
    const { message, channelId } = payload
    const channel = yield call(getChannelFromMap, channelId)
    const messageToResend = { ...message }
    if (messageToResend.createdAt) {
      delete messageToResend.createdAt
    }
    const messageResponse = yield call(channel.reSendMessage, messageToResend)
    yield put(updateMessageAC(message.id || message.tid, messageResponse))
  } catch (e) {
    console.log('ERROR in resend message', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* deleteMessage(action: IAction): any {
  try {
    const { payload } = action
    const { messageId, channelId, deleteOption } = payload

    const channel = yield call(getChannelFromMap, channelId)

    const deletedMessage = yield call(channel.deleteMessageById, messageId, deleteOption === 'forMe')

    yield put(updateMessageAC(deletedMessage.id, deletedMessage))
    updateMessageOnMap(channel.id, {
      messageId: deletedMessage.id,
      params: deletedMessage
    })
    if (channel.lastMessage.id === messageId) {
      yield put(updateChannelLastMessageAC(deletedMessage, channel))
    }
  } catch (e) {
    console.log('ERROR in delete message', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* editMessage(action: IAction): any {
  try {
    const { payload } = action
    const { message, channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)
    const editedMessage = yield call(channel.editMessage, {
      ...message,
      metadata: JSON.stringify(message.metadata)
    })
    yield put(updateMessageAC(editedMessage.id, editedMessage))
    updateMessageOnMap(channel.id, {
      messageId: editedMessage.id,
      params: editedMessage
    })
  } catch (e) {
    console.log('ERROR in edit message', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* getMessagesQuery(action: IAction): any {
  try {
    const { channel, loadWithLastMessage, messageId, limit } = action.payload
    if (channel.id) {
      const SceytChatClient = getClient()
      const messageQueryBuilder = new (SceytChatClient.chatClient.MessageListQueryBuilder as any)(channel.id)
      messageQueryBuilder.limit(limit || 50)
      messageQueryBuilder.reverse(true)
      const messageQuery = yield call(messageQueryBuilder.build)
      query.messageQuery = messageQuery
      yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
      let result: { messages: IMessage[]; hasNext: boolean } = { messages: [], hasNext: false }
      if (loadWithLastMessage) {
        if (channel.unreadMessageCount && channel.unreadMessageCount > 0) {
          setHasNextCached(false)
          setHasPrevCached(false)
          setAllMessages([])
          result = yield call(messageQuery.loadPreviousMessageId, '0')
          yield put(setMessagesHasPrevAC(result.hasNext))
          yield put(markChannelAsReadAC(channel.id))
        } else {
          result.messages = getFromAllMessagesByMessageId('', '', true)
        }
      } else if (messageId) {
        const allMessages = getAllMessages()
        const messageIndex = allMessages.findIndex((msg) => msg.id === messageId)
        const maxLengthPart = MESSAGES_MAX_LENGTH / 2
        if (messageIndex >= maxLengthPart) {
          result.messages = allMessages.slice(messageIndex - maxLengthPart, messageIndex + maxLengthPart)
          setHasPrevCached(messageIndex > maxLengthPart)
          setHasNextCached(allMessages.length > maxLengthPart)
        } else {
          messageQuery.limit = MESSAGES_MAX_LENGTH

          result = yield call(messageQuery.loadNearMessageId, messageId)
          yield put(setMessagesHasNextAC(true))
          setAllMessages([...result.messages])
          setHasPrevCached(false)
          setHasNextCached(false)
        }
        yield put(setScrollToMessagesAC(messageId))
      } else if (channel.unreadMessageCount && channel.lastReadMessageId) {
        // dispatch(setMessagesPrevCompleteAC(true))
        setAllMessages([])
        messageQuery.limit = MESSAGES_MAX_LENGTH
        // result = await messageQuery.loadPreviousMessageId, '0')
        if (getMessagesFromMap(channel.id) && getMessagesFromMap(channel.id).length) {
          result.messages = getMessagesFromMap(channel.id)
        } else {
          result = yield call(messageQuery.loadNearMessageId, channel.lastReadMessageId)
        }

        yield put(setMessagesHasPrevAC(true))
        yield put(setMessagesHasNextAC(channel.lastMessage.id !== result.messages[result.messages.length - 1].id))

        setAllMessages([...result.messages])
        setMessagesToMap(channel.id, result.messages)
        /*
        if (channel.lastReadMessageId) {
          yield put(setMessagesNextCompleteAC(true))
          yield put(setMessagesPrevCompleteAC(true))
          messageQuery.limit = 30
          // result = yield call(messageQuery.loadPreviousMessageId, '0')
          result = yield call(messageQuery.loadNearMessageId, channel.lastReadMessageId)
        } else {
          messageQuery.limit = 20
          result = yield call(messageQuery.loadNext)
        }
        yield put(setMessagesNextCompleteAC(true)) */
      } else {
        setAllMessages([])
        const cachedMessages = getMessagesFromMap(channel.id)
        if (cachedMessages && cachedMessages.length && !channel.unreadMessageCount) {
          setAllMessages([...cachedMessages])
          yield put(setMessagesAC(cachedMessages))
        }
        // yield put(setMessagesNextCompleteAC(false))
        result = yield call(messageQuery.loadPrevious)
        setMessagesToMap(channel.id, result.messages)
        setAllMessages([...result.messages])
        yield put(setMessagesHasPrevAC(result.hasNext))
      }
      yield put(setMessagesAC(result.messages))
      // yield put(addMessagesAC(result.messages, 1, channel.unreadMessageCount));
      yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
    }
  } catch (e) {
    console.log('error in message query', e)
    /* if (e.code !== 10008) {
      yield put(setErrorNotification(e.message));
    } */
  }
}

function* loadMoreMessages(action: IAction): any {
  try {
    const { payload } = action
    const { limit, direction, channelId, messageId, hasNext } = payload
    const SceytChatClient = getClient()
    const messageQueryBuilder = new (SceytChatClient.chatClient.MessageListQueryBuilder as any)(channelId)
    messageQueryBuilder.reverse(true)
    const messageQuery = yield call(messageQueryBuilder.build)
    messageQuery.limit = limit || 5

    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
    let result: { messages: IMessage[]; hasNext: boolean } = { messages: [], hasNext: false }

    if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
      if (getHasPrevCached()) {
        result.messages = getFromAllMessagesByMessageId(messageId, MESSAGE_LOAD_DIRECTION.PREV)
      } else if (hasNext) {
        result = yield call(messageQuery.loadPreviousMessageId, messageId)
        if (result.messages.length) {
          addAllMessages(result.messages, MESSAGE_LOAD_DIRECTION.PREV)
        }
        yield put(setMessagesHasPrevAC(result.hasNext))
      }
    } else {
      if (getHasNextCached()) {
        result.messages = getFromAllMessagesByMessageId(messageId, MESSAGE_LOAD_DIRECTION.NEXT)
      } else if (hasNext) {
        result = yield call(messageQuery.loadNextMessageId, messageId)
        if (result.messages.length) {
          addAllMessages(result.messages, MESSAGE_LOAD_DIRECTION.NEXT)
        }
        yield put(setMessagesHasNextAC(result.hasNext))
      }
    }
    /*   if (result.messages[result.messages.length - 1].id === messageId) {
      result.messages.pop()
    } */
    yield put(addMessagesAC(result.messages, direction))
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log('error in load more messages')
    /* if (e.code !== 10008) {
      yield put(setErrorNotification(e.message));
    } */
  }
}

function* addReaction(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, messageId, key, score, reason, enforceUnique } = payload
    const channel = yield call(getChannelFromMap, channelId)
    const { message, reaction } = yield call(channel.addReaction, messageId, key, score, reason, enforceUnique)
    yield put(addReactionToMessageAC(message, reaction, true))
    addReactionToMessageOnMap(channelId, message, reaction, true)
  } catch (e) {
    console.log('ERROR in add reaction', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* deleteReaction(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, messageId, key } = payload
    const channel = yield call(getChannelFromMap, channelId)
    const { message, reaction } = yield call(channel.deleteReaction, messageId, key)
    yield put(deleteReactionFromMessageAC(message, reaction, true))
  } catch (e) {
    console.log('ERROR in delete reaction', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* getMessageAttachments(action: IAction): any {
  try {
    const { channelId, messageType } = action.payload
    const SceytChatClient = getClient()
    const MessageByTypeQueryBuilder = new (SceytChatClient.chatClient.MessageListByTypeQueryBuilder as any)(
      channelId,
      messageType
    )
    MessageByTypeQueryBuilder.limit(34)
    const MessageByTypeQuery = yield call(MessageByTypeQueryBuilder.build)
    query.MessageByTypeQuery = MessageByTypeQuery
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
    const { messages, complete } = yield call(MessageByTypeQuery.loadNext)
    yield put(setAttachmentsCompleteAC(!complete))
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
    yield put(setAttachmentsAC(messages, messageType))
  } catch (e) {
    console.log('error in message attachment query')
    // yield put(setErrorNotification(e.message))
  }
}

function* loadMoreMessageAttachments(action: any) {
  try {
    const { messageType } = action.payload
    const { MessageByTypeQuery } = query
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
    const { messages, complete } = yield call(MessageByTypeQuery.loadNext)
    yield put(setAttachmentsCompleteAC(!complete))
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
    yield put(addAttachmentsAC(messages, messageType))
  } catch (e) {
    console.log('error in message attachment query', e)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}

function* pauseAttachmentUploading(action: any) {
  try {
    const { attachmentId } = action.payload
    if (getCustomUploader()) {
      const isPaused = pauseUpload(attachmentId)
      if (isPaused) {
        yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, { attachmentId: attachmentId }))
      }
    }
  } catch (e) {
    console.log('error in pause attachment uploading', e)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}
function* resumeAttachmentUploading(action: any) {
  try {
    const { attachmentId } = action.payload
    console.log('resume for attachment ... ', attachmentId)
    if (getCustomUploader()) {
      const isResumed = resumeUpload(attachmentId)
      if (isResumed) {
        yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, { attachmentId: attachmentId }))
      }
    }
  } catch (e) {
    console.log('error in resume attachment uploading', e)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}

export default function* MessageSaga() {
  yield takeEvery(SEND_MESSAGE, sendMessage)
  yield takeEvery(SEND_TEXT_MESSAGE, sendTextMessage)
  yield takeEvery(RESEND_MESSAGE, resendMessage)
  yield takeLatest(EDIT_MESSAGE, editMessage)
  yield takeEvery(DELETE_MESSAGE, deleteMessage)
  yield takeLatest(GET_MESSAGES, getMessagesQuery)
  yield takeLatest(GET_MESSAGES_ATTACHMENTS, getMessageAttachments)
  yield takeLatest(LOAD_MORE_MESSAGES_ATTACHMENTS, loadMoreMessageAttachments)
  yield takeLatest(ADD_REACTION, addReaction)
  yield takeLatest(DELETE_REACTION, deleteReaction)
  yield takeLatest(LOAD_MORE_MESSAGES, loadMoreMessages)
  yield takeEvery(PAUSE_ATTACHMENT_UPLOADING, pauseAttachmentUploading)
  yield takeEvery(RESUME_ATTACHMENT_UPLOADING, resumeAttachmentUploading)
}
