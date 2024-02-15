import { put, call, takeLatest, takeEvery, select } from 'redux-saga/effects'

import {
  ADD_MESSAGE,
  ADD_REACTION,
  DELETE_MESSAGE,
  DELETE_REACTION,
  EDIT_MESSAGE,
  FORWARD_MESSAGE,
  GET_MESSAGES,
  GET_MESSAGES_ATTACHMENTS,
  GET_REACTIONS,
  LOAD_MORE_MESSAGES,
  LOAD_MORE_MESSAGES_ATTACHMENTS,
  LOAD_MORE_REACTIONS,
  PAUSE_ATTACHMENT_UPLOADING,
  queryDirection,
  REMOVE_UPLOAD_PROGRESS,
  RESEND_MESSAGE,
  RESUME_ATTACHMENT_UPLOADING,
  SEND_MESSAGE,
  SEND_TEXT_MESSAGE,
  UPDATE_MESSAGE,
  UPDATE_UPLOAD_PROGRESS,
  UPLOAD_ATTACHMENT_COMPILATION
} from './constants'

import { IAction, IAttachment, IChannel, IMessage } from '../../types'
import { getClient } from '../../common/client'
import {
  addChannelsToAllChannels,
  getActiveChannelId,
  getChannelFromAllChannels,
  getChannelFromMap,
  query,
  removeChannelFromMap,
  setChannelInMap,
  updateChannelLastMessageOnAllChannels,
  updateChannelOnAllChannels
} from '../../helpers/channelHalper'
import {
  addAttachmentsAC,
  addAttachmentsForPopupAC,
  addMessageAC,
  addMessagesAC,
  addReactionsToListAC,
  addReactionToListAC,
  addReactionToMessageAC,
  deleteReactionFromListAC,
  deleteReactionFromMessageAC,
  getMessagesAC,
  removeAttachmentProgressAC,
  scrollToNewMessageAC,
  setAttachmentsAC,
  setAttachmentsCompleteAC,
  setAttachmentsCompleteForPopupAC,
  setAttachmentsForPopupAC,
  setMessagesAC,
  setMessagesHasNextAC,
  setMessagesHasPrevAC,
  setMessagesLoadingStateAC,
  setReactionsListAC,
  setReactionsLoadingStateAC,
  setScrollToMessagesAC,
  // updateAttachmentUploadingProgressAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC
} from './actions'
import {
  attachmentTypes,
  CHANNEL_TYPE,
  channelDetailsTabs,
  DB_NAMES,
  DB_STORE_NAMES,
  LOADING_STATE,
  MESSAGE_STATUS,
  UPLOAD_STATE
} from '../../helpers/constants'
import {
  addChannelAC,
  markChannelAsReadAC,
  switchChannelActionAC,
  updateChannelDataAC,
  updateChannelLastMessageAC
} from '../channel/actions'
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
  deleteVideoThumb,
  deletePendingAttachment,
  checkChannelExistsOnMessagesMap,
  getPendingMessages,
  setPendingAttachment,
  getPendingAttachment,
  removeReactionToMessageOnMap,
  addReactionOnAllMessages,
  removeReactionOnAllMessages,
  sendMessageHandler,
  removePendingMessageFromMap,
  setPendingMessages,
  addPendingMessageToMap
} from '../../helpers/messagesHalper'
import { CONNECTION_STATUS } from '../user/constants'
import { customUpload, getCustomUploader, pauseUpload, resumeUpload } from '../../helpers/customUploader'
import { createImageThumbnail, getImageSize } from '../../helpers/resizeImage'
import store from '../index'
import { IProgress } from '../../components/ChatContainer'
import { attachmentCompilationStateSelector, messagesHasNextSelector } from './selector'
import { isJSON } from '../../helpers/message'
import { setDataToDB } from '../../services/indexedDB'

function* sendMessage(action: IAction): any {
  // let messageForCatch = {}
  const { payload } = action
  const { message, connectionState, channelId, sendAttachmentsAsSeparateMessage } = payload
  try {
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (channel) {
        setChannelInMap(channel)
      }
    }
    if (channel.isMockChannel) {
      const SceytChatClient = getClient()
      removeChannelFromMap(channelId)
      const createChannelData = {
        type: channel.type,
        members: channel.members,
        metadata: ''
      }
      channel = yield call(SceytChatClient.Channel.create, createChannelData)
      yield put(switchChannelActionAC(JSON.parse(JSON.stringify(channel))))
      addChannelsToAllChannels(channel)
      setChannelInMap(channel)
    }
    yield put(addChannelAC(JSON.parse(JSON.stringify(channel))))
    console.log('send message . . . ', message)
    const mentionedUserIds = message.mentionedMembers ? message.mentionedMembers.map((member: any) => member.id) : []
    // let attachmentsToSend: IAttachment[] = []
    const customUploader = getCustomUploader()

    if (message.attachments && message.attachments.length) {
      // const attachmentsCopy = [...message.attachments]
      if (sendAttachmentsAsSeparateMessage) {
        const linkAttachment = message.attachments.find((a: IAttachment) => a.type === attachmentTypes.link)
        const messagesToSend: IMessage[] = []
        const mediaAttachments = message.attachments.filter((att: IAttachment) => att.type !== attachmentTypes.link)
        if (mediaAttachments && mediaAttachments.length) {
          for (let i = 0; i < mediaAttachments.length; i++) {
            let thumbnailMetas: IAttachmentMeta = {}
            const messageAttachment = { ...mediaAttachments[i], url: mediaAttachments[i].data }
            console.log('messageAttachment..............', messageAttachment)
            const fileType = messageAttachment.url.type.split('/')[0]
            if (!messageAttachment.cachedUrl) {
              if (fileType === 'video') {
                thumbnailMetas = getVideoThumb(messageAttachment.tid)
              } else if (fileType === 'image') {
                thumbnailMetas = yield call(
                  createImageThumbnail,
                  messageAttachment.data,
                  undefined,
                  messageAttachment.type === 'file' ? 50 : undefined,
                  messageAttachment.type === 'file' ? 50 : undefined
                )
              } else if (messageAttachment.type === attachmentTypes.voice) {
                thumbnailMetas = {
                  duration: messageAttachment.metadata.dur,
                  thumbnail: messageAttachment.metadata.tmb
                }
              }
              messageAttachment.metadata = {
                ...messageAttachment.metadata,
                ...(thumbnailMetas && {
                  tmb: thumbnailMetas.thumbnail,
                  szw: thumbnailMetas.imageWidth,
                  szh: thumbnailMetas.imageHeight,
                  dur: thumbnailMetas.duration && Math.floor(thumbnailMetas.duration)
                })
              }
            }

            // messageAttachment.size = message.attachments[0].data.size

            const messageBuilder = channel.createMessageBuilder()
            messageBuilder
              .setBody(i === 0 ? message.body : '')
              .setAttachments([])
              .setBodyAttributes(i === 0 ? message.bodyAttributes : {})
              .setMentionUserIds(i === 0 ? mentionedUserIds : [])
              .setType(message.type)
              .setDisplayCount(message.type === 'system' ? 0 : 1)
              .setSilent(message.type === 'system')
              .setMetadata(i === 0 ? JSON.stringify(message.metadata) : '')
            if (message.parentMessage) {
              messageBuilder.setParentMessageId(message.parentMessage ? message.parentMessage.id : null)
            }
            if (message.repliedInThread) {
              messageBuilder.setReplyInThread()
            }
            const messageToSend = messageBuilder.create()
            setPendingAttachment(messageAttachment.tid, {
              ...messageAttachment.data,
              messageTid: messageToSend.tid,
              channelId: channel.id
            })
            const messageCopy = {
              ...messageToSend,
              attachments: [...messageAttachment]
            }
            messagesToSend.push(messageCopy)
            const pendingMessage = JSON.parse(
              JSON.stringify({
                ...messageCopy,
                createdAt: new Date(Date.now()),
                mentionedUsers: message.mentionedMembers,
                parentMessage: message.parentMessage
              })
            )
            const hasNextMessages = yield select(messagesHasNextSelector)
            if (!getHasNextCached()) {
              if (hasNextMessages) {
                yield put(getMessagesAC(channel))
              } else {
                yield put(addMessageAC(JSON.parse(JSON.stringify(pendingMessage))))
              }
            }
            addMessageToMap(channel.id, pendingMessage)
            addAllMessages([pendingMessage], MESSAGE_LOAD_DIRECTION.NEXT)

            const messagesToAdd = getFromAllMessagesByMessageId('', '', true)
            yield put(setMessagesAC(JSON.parse(JSON.stringify(messagesToAdd))))
            yield put(scrollToNewMessageAC(true))

            /* if (!getHasNextCached() && !hasNe) {
              yield put(addMessageAC(pendingMessage))
            }
            addMessageToMap(channel.id, pendingMessage)
            addAllMessages([pendingMessage], MESSAGE_LOAD_DIRECTION.NEXT)

            yield put(scrollToNewMessageAC(true)) */

            if (!messageAttachment.cachedUrl) {
              yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, messageAttachment.tid))
            }
          }
        }
        for (let i = 0; i < messagesToSend.length; i++) {
          // const attachment = message.attachments[i]
          const messageAttachment = messagesToSend[i].attachments[0]
          const messageToSend = messagesToSend[i]
          const fileType = messageAttachment.url.type.split('/')[0]
          const messageCopy = JSON.parse(JSON.stringify(messagesToSend[i]))
          let filePath: any
          if (customUploader) {
            const handleUploadProgress = ({ loaded, total }: IProgress) => {
              store.dispatch({
                type: UPDATE_UPLOAD_PROGRESS,
                payload: {
                  uploaded: loaded,
                  total,
                  progress: loaded / total,
                  attachmentId: messageAttachment.tid
                }
              })
            }
            let fileSize = messageAttachment.size
            const handleUpdateLocalPath = (updatedLink: string) => {
              if (fileType === 'image') {
                filePath = updatedLink
                messageCopy.attachments[0] = { ...messageCopy.attachments[0], attachmentUrl: updatedLink }
                /* const updateAttachmentPath = {
                  attachments: [{ ...messageCopy.attachments[0], attachmentUrl: updatedLink }]
                } */
                /*   store.dispatch({
                  type: UPDATE_MESSAGE,
                  payload: {
                    message: JSON.parse(
                      JSON.stringify({
                        ...updateAttachmentPath
                      })
                    )
                  }
                }) */
              }
            }
            let uri
            try {
              if (connectionState === CONNECTION_STATUS.CONNECTED) {
                if (messageAttachment.cachedUrl) {
                  uri = messageAttachment.cachedUrl
                  store.dispatch({
                    type: UPDATE_UPLOAD_PROGRESS,
                    payload: {
                      uploaded: messageAttachment.data.size,
                      total: messageAttachment.data.size,
                      progress: 1,
                      attachmentId: messageAttachment.tid
                    }
                  })
                } else {
                  uri = yield call(customUpload, messageAttachment, handleUploadProgress, handleUpdateLocalPath)
                }
                yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.SUCCESS, messageAttachment.tid))
                let thumbnailMetas: any
                if (!messageAttachment.cachedUrl && messageAttachment.url.type.split('/')[0] === 'image') {
                  fileSize = yield call(getImageSize, filePath)
                  thumbnailMetas = yield call(
                    createImageThumbnail,
                    null,
                    filePath,
                    messageAttachment.type === 'file' ? 50 : undefined,
                    messageAttachment.type === 'file' ? 50 : undefined
                  )
                }

                const attachmentMeta = messageAttachment.cachedUrl
                  ? messageAttachment.metadata
                  : JSON.stringify({
                      ...messageAttachment.metadata,
                      ...(thumbnailMetas &&
                        thumbnailMetas.thumbnail && {
                          tmb: thumbnailMetas.thumbnail,
                          szw: thumbnailMetas.imageWidth,
                          szh: thumbnailMetas.imageHeight
                        })
                    })
                const attachmentBuilder = channel.createAttachmentBuilder(uri, messageAttachment.type)
                const attachmentToSend = attachmentBuilder
                  .setName(messageAttachment.name)
                  .setMetadata(attachmentMeta)
                  .setFileSize(fileSize || messageAttachment.size)
                  .setUpload(false)
                  .create()
                let linkAttachmentToSend: IAttachment | null = null
                if (i === 0 && linkAttachment) {
                  const linkAttachmentBuilder = channel.createAttachmentBuilder(
                    linkAttachment.data,
                    linkAttachment.type
                  )
                  linkAttachmentToSend = linkAttachmentBuilder
                    .setName(linkAttachment.name)
                    .setUpload(linkAttachment.upload)
                    .create()
                }
                /* let linkAttachmentToSend
                 if (linkAttachment) {
                   const linkAttachmentBuilder = channel.createAttachmentBuilder(linkAttachment.data, linkAttachment.type)
                   linkAttachmentToSend = linkAttachmentBuilder
                     .setName(linkAttachment.name)
                     .setUpload(linkAttachment.upload)
                     .create()
                 } */
                // not for SDK, for displaying attachments and their progress
                if (linkAttachmentToSend) {
                  messageToSend.attachments = [attachmentToSend, linkAttachmentToSend]
                } else {
                  messageToSend.attachments = [attachmentToSend]
                }
                const messageResponse = yield call(channel.sendMessage, messageToSend)
                messageResponse.attachments[0] = {
                  ...messageResponse.attachments[0],
                  user: JSON.parse(JSON.stringify(messageResponse.user)),
                  tid: messageAttachment.tid,
                  attachmentUrl: messageAttachment.attachmentUrl
                }
                const pendingAttachment = getPendingAttachment(messageAttachment.tid!)
                if (!messageAttachment.cachedUrl) {
                  setDataToDB(
                    DB_NAMES.FILES_STORAGE,
                    DB_STORE_NAMES.ATTACHMENTS,
                    [{ ...messageResponse.attachments[0], checksum: pendingAttachment.checksum }],
                    'checksum'
                  )
                }
                /* if (msgCount <= 200) {
                  const messageToSend: any = {
                    // metadata: mentionedMembersPositions,
                    body: `${msgCount}`,
                    mentionedMembers: [],
                    attachments: [],
                    type: 'text'
                  }
                  yield put(sendMessageAC(messageToSend, channel.id, 'Connected'))
                  msgCount++
                } */
                yield put(removeAttachmentProgressAC(messageAttachment.tid))
                deletePendingAttachment(messageAttachment.tid!)
                const messageUpdateData = {
                  id: messageResponse.id,
                  body: messageResponse.body,
                  type: messageResponse.type,
                  state: messageResponse.state,
                  displayCount: messageResponse.displayCount,
                  deliveryStatus: messageResponse.deliveryStatus,
                  attachments: messageResponse.attachments,
                  mentionedUsers: messageResponse.mentionedUsers,
                  bodyAttributes: messageResponse.bodyAttributes,
                  metadata: messageResponse.metadata,
                  parentMessage: messageResponse.parentMessage,
                  repliedInThread: messageResponse.repliedInThread,
                  createdAt: messageResponse.createdAt
                }
                yield put(updateMessageAC(messageToSend.tid!, JSON.parse(JSON.stringify(messageUpdateData))))

                if (fileType === 'video') {
                  deleteVideoThumb(messageAttachment.tid!)
                }
                updateMessageOnMap(channel.id, {
                  messageId: messageToSend.tid!,
                  params: messageUpdateData
                })
                updateMessageOnAllMessages(messageToSend.tid!, messageUpdateData)

                const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
                updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
                const channelUpdateParam = {
                  lastMessage: messageToUpdate,
                  lastReactedMessage: null
                }
                if (channel.unread) {
                  yield put(markChannelAsReadAC(channel.id))
                }
                yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
              } else {
                // eslint-disable-next-line
                throw Error('Network error')
              }
            } catch (e) {
              console.log('Error on uploading attachment', messageAttachment.tid)
              yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, messageAttachment.tid))

              updateMessageOnMap(channel.id, {
                messageId: messageToSend.tid!,
                params: { state: MESSAGE_STATUS.FAILED }
              })
              updateMessageOnAllMessages(messageToSend.tid!, { state: MESSAGE_STATUS.FAILED })
              yield put(updateMessageAC(messageToSend.tid!, { state: MESSAGE_STATUS.FAILED }))
            }
          }
        }
        // eslint-disable-next-line max-len
        /*    let thumbnailMetas: IAttachmentMeta = {}
        const linkAttachment = message.attachments.find((a: IAttachment) => a.type === attachmentTypes.link)
        const messageAttachment = { ...message.attachments[0], url: message.attachments[0].data }
        const fileType = messageAttachment.url.type.split('/')[0]
        if (!messageAttachment.cachedUrl) {
          if (fileType === 'video') {
            thumbnailMetas = getVideoThumb(messageAttachment.tid)
          } else if (fileType === 'image') {
            thumbnailMetas = yield call(
              createImageThumbnail,
              message.attachments[0].data,
              undefined,
              messageAttachment.type === 'file' ? 50 : undefined,
              messageAttachment.type === 'file' ? 50 : undefined
            )
          } else if (messageAttachment.type === attachmentTypes.voice) {
            thumbnailMetas = {
              duration: messageAttachment.metadata.dur,
              thumbnail: messageAttachment.metadata.tmb
            }
          }
          messageAttachment.metadata = {
            ...messageAttachment.metadata,
            ...(thumbnailMetas && {
              tmb: thumbnailMetas.thumbnail,
              szw: thumbnailMetas.imageWidth,
              szh: thumbnailMetas.imageHeight,
              dur: thumbnailMetas.duration && Math.floor(thumbnailMetas.duration)
            })
          }
        }

        // messageAttachment.size = message.attachments[0].data.size

        const messageBuilder = channel.createMessageBuilder()
        messageBuilder
          .setBody(message.body)
          .setAttachments([])
          .setBodyAttributes(message.bodyAttributes)
          .setMentionUserIds(mentionedUserIds)
          .setType(message.type)
          .setDisplayCount(message.type === 'system' ? 0 : 1)
          .setSilent(message.type === 'system')
          .setMetadata(JSON.stringify(message.metadata))
        if (message.parentMessage) {
          messageBuilder.setParentMessageId(message.parentMessage ? message.parentMessage.id : null)
        }
        if (message.repliedInThread) {
          messageBuilder.setReplyInThread()
        }
        const messageToSend = messageBuilder.create()
        setPendingAttachment(messageAttachment.tid, {
          ...messageAttachment.data,
          messageTid: messageToSend.tid,
          channelId: channel.id
        })
        const messageCopy = {
          ...messageToSend,
          attachments: [...messageAttachment]
        }
        const pendingMessage = JSON.parse(
          JSON.stringify({
            ...messageCopy,
            createdAt: new Date(Date.now()),
            mentionedUsers: message.mentionedMembers,
            parentMessage: message.parentMessage
          })
        )
        const hasNextMessages = yield select(messagesHasNextSelector)
        if (!getHasNextCached()) {
          if (hasNextMessages) {
            yield put(getMessagesAC(channel))
          } else {
            yield put(addMessageAC(JSON.parse(JSON.stringify(pendingMessage))))
          }
        }
        addMessageToMap(channel.id, pendingMessage)
        addAllMessages([pendingMessage], MESSAGE_LOAD_DIRECTION.NEXT)

        const messagesToAdd = getFromAllMessagesByMessageId('', '', true)
        yield put(setMessagesAC(JSON.parse(JSON.stringify(messagesToAdd))))
        yield put(scrollToNewMessageAC(true))

        /!* if (!getHasNextCached() && !hasNe) {
          yield put(addMessageAC(pendingMessage))
        }
        addMessageToMap(channel.id, pendingMessage)
        addAllMessages([pendingMessage], MESSAGE_LOAD_DIRECTION.NEXT)

        yield put(scrollToNewMessageAC(true)) *!/

        let filePath: any
        if (!messageAttachment.cachedUrl) {
          yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, messageAttachment.tid))
        }
        if (customUploader) {
          const handleUploadProgress = ({ loaded, total }: IProgress) => {
            store.dispatch({
              type: UPDATE_UPLOAD_PROGRESS,
              payload: {
                uploaded: loaded,
                total,
                progress: loaded / total,
                attachmentId: messageAttachment.tid
              }
            })
          }
          let fileSize = messageAttachment.size
          const handleUpdateLocalPath = (updatedLink: string) => {
            if (fileType === 'image') {
              /!* fileSize = getImageSize(updatedLink).then((size: any) => {
                store.dispatch({
                  type: UPDATE_UPLOAD_PROGRESS,
                  payload: {
                    total: size,
                    attachmentId: messageAttachment.tid
                  }
                })
              }) *!/
              filePath = updatedLink
              messageCopy.attachments[0] = { ...messageCopy.attachments[0], attachmentUrl: updatedLink }
              const updateAttachmentPath = {
                attachments: [{ ...messageCopy.attachments[0], attachmentUrl: updatedLink }]
              }
              store.dispatch({
                type: UPDATE_MESSAGE,
                payload: {
                  message: JSON.parse(
                    JSON.stringify({
                      ...updateAttachmentPath
                    })
                  )
                }
              })
            }
          }
          let uri
          try {
            if (connectionState === CONNECTION_STATUS.CONNECTED) {
              if (messageAttachment.cachedUrl) {
                uri = messageAttachment.cachedUrl
                store.dispatch({
                  type: UPDATE_UPLOAD_PROGRESS,
                  payload: {
                    uploaded: messageAttachment.data.size,
                    total: messageAttachment.data.size,
                    progress: 1,
                    attachmentId: messageAttachment.tid
                  }
                })
              } else {
                uri = yield call(customUpload, messageAttachment, handleUploadProgress, handleUpdateLocalPath)
              }
              yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.SUCCESS, messageAttachment.tid))
              if (!messageAttachment.cachedUrl && messageAttachment.url.type.split('/')[0] === 'image') {
                fileSize = yield call(getImageSize, filePath)
                thumbnailMetas = yield call(
                  createImageThumbnail,
                  null,
                  filePath,
                  messageAttachment.type === 'file' ? 50 : undefined,
                  messageAttachment.type === 'file' ? 50 : undefined
                )
              }

              const attachmentMeta = messageAttachment.cachedUrl
                ? messageAttachment.metadata
                : JSON.stringify({
                    ...messageAttachment.metadata,
                    ...(thumbnailMetas &&
                      thumbnailMetas.thumbnail && {
                        tmb: thumbnailMetas.thumbnail,
                        szw: thumbnailMetas.imageWidth,
                        szh: thumbnailMetas.imageHeight
                      })
                  })
              const attachmentBuilder = channel.createAttachmentBuilder(uri, messageAttachment.type)
              const attachmentToSend = attachmentBuilder
                .setName(messageAttachment.name)
                .setMetadata(attachmentMeta)
                .setFileSize(fileSize || messageAttachment.size)
                .setUpload(false)
                .create()
              let linkAttachmentToSend
              if (linkAttachment) {
                const linkAttachmentBuilder = channel.createAttachmentBuilder(linkAttachment.data, linkAttachment.type)
                linkAttachmentToSend = linkAttachmentBuilder
                  .setName(linkAttachment.name)
                  .setUpload(linkAttachment.upload)
                  .create()
              }
              // not for SDK, for displaying attachments and their progress
              if (linkAttachmentToSend) {
                messageToSend.attachments = [attachmentToSend, linkAttachmentToSend]
              } else {
                messageToSend.attachments = [attachmentToSend]
              }
              const messageResponse = yield call(channel.sendMessage, messageToSend)
              messageResponse.attachments[0] = {
                ...messageResponse.attachments[0],
                user: JSON.parse(JSON.stringify(messageResponse.user)),
                tid: messageAttachment.tid,
                attachmentUrl: messageAttachment.attachmentUrl
              }
              const pendingAttachment = getPendingAttachment(messageAttachment.tid)
              if (!messageAttachment.cachedUrl) {
                setDataToDB(
                  DB_NAMES.FILES_STORAGE,
                  DB_STORE_NAMES.ATTACHMENTS,
                  [{ ...messageResponse.attachments[0], checksum: pendingAttachment.checksum }],
                  'checksum'
                )
              }
              /!* if (msgCount <= 200) {
                const messageToSend: any = {
                  // metadata: mentionedMembersPositions,
                  body: `${msgCount}`,
                  mentionedMembers: [],
                  attachments: [],
                  type: 'text'
                }
                yield put(sendMessageAC(messageToSend, channel.id, 'Connected'))
                msgCount++
              } *!/
              yield put(removeAttachmentProgressAC(messageAttachment.tid))
              deletePendingAttachment(messageAttachment.tid)
              const messageUpdateData = {
                id: messageResponse.id,
                body: messageResponse.body,
                type: messageResponse.type,
                state: messageResponse.state,
                displayCount: messageResponse.displayCount,
                deliveryStatus: messageResponse.deliveryStatus,
                attachments: messageResponse.attachments,
                mentionedUsers: messageResponse.mentionedUsers,
                bodyAttributes: messageResponse.bodyAttributes,
                metadata: messageResponse.metadata,
                parentMessage: messageResponse.parentMessage,
                repliedInThread: messageResponse.repliedInThread,
                createdAt: messageResponse.createdAt
              }
              yield put(updateMessageAC(messageToSend.tid, JSON.parse(JSON.stringify(messageUpdateData))))

              if (fileType === 'video') {
                deleteVideoThumb(messageAttachment.tid)
              }
              updateMessageOnMap(channel.id, {
                messageId: messageToSend.tid,
                params: messageUpdateData
              })
              updateMessageOnAllMessages(messageToSend.tid, messageUpdateData)

              const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
              updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
              const channelUpdateParam = {
                lastMessage: messageToUpdate,
                lastReactedMessage: null
              }
              if (channel.unread) {
                yield put(markChannelAsReadAC(channel.id))
              }
              yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
            } else {
              // eslint-disable-next-line
              throw Error('Network error')
            }
          } catch (e) {
            console.log('Error on uploading attachment', messageAttachment.tid)
            yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, messageAttachment.tid))

            updateMessageOnMap(channel.id, {
              messageId: messageToSend.tid,
              params: { state: MESSAGE_STATUS.FAILED }
            })
            updateMessageOnAllMessages(messageToSend.tid, { state: MESSAGE_STATUS.FAILED })
            yield put(updateMessageAC(messageToSend.tid, { state: MESSAGE_STATUS.FAILED }))
          }
        } else {
          const attachmentBuilder = channel.createAttachmentBuilder(messageAttachment.url, messageAttachment.type)
          const attachmentToSend = attachmentBuilder
            .setName(messageAttachment.name)
            .setMetadata(JSON.stringify(messageAttachment.metadata))
            .setUpload(messageAttachment.upload)
            .create()
          if (!customUploader) {
            attachmentToSend.progress = (progressPercent: any) => {
              console.log('progress ... ', progressPercent)
              // attachmentsListeners.progress(progressPercent, attachment.tid);
            }
            attachmentToSend.completion = (updatedAttachment: any, error: any) => {
              if (error) {
                console.log('fail to upload attachment ... ', error)
                // attachmentsListeners.compilation(UPLOAD_STATE.FAIL, messageForCatch.tid, attachment);
              } else {
                console.log('success attachment. .. ', updatedAttachment)
               // attachmentsListeners.compilation(UPLOAD_STATE.SUCCESS, messageForCatch.tid,
               // { ...updatedAttachment, attachmentId: attachment.tid });
              }
            }
          }
          // not for SDK, for displaying attachments and their progress
          attachmentToSend.tid = messageAttachment.tid
          attachmentToSend.attachmentUrl = messageAttachment.attachmentUrl
          messageToSend.attachments = [attachmentToSend]
          const messageResponse = yield call(channel.sendMessage, messageToSend)
          /!* if (msgCount <= 200) {
            const messageToSend: any = {
              // metadata: mentionedMembersPositions,
              body: `${msgCount}`,
              mentionedMembers: [],
              attachments: [],
              type: 'text'
            }
            yield put(sendMessageAC(messageToSend, channel.id, 'Connected'))
            msgCount++
          } *!/
          deletePendingAttachment(messageAttachment.tid)
          const messageUpdateData = {
            id: messageResponse.id,
            body: messageResponse.body,
            type: messageResponse.type,
            state: messageResponse.state,
            displayCount: messageResponse.displayCount,
            deliveryStatus: messageResponse.deliveryStatus,
            attachments: messageResponse.attachments,
            mentionedUsers: messageResponse.mentionedUsers,
            metadata: messageResponse.metadata,
            parentMessage: messageResponse.parentMessage,
            bodyAttributes: messageResponse.bodyAttributes,
            repliedInThread: messageResponse.repliedInThread,
            createdAt: messageResponse.createdAt
          }
          yield put(updateMessageAC(messageToSend.tid, JSON.parse(JSON.stringify(messageUpdateData))))

          if (fileType === 'video') {
            deleteVideoThumb(messageAttachment.tid)
          }
          updateMessageOnMap(channel.id, {
            messageId: messageToSend.tid,
            params: messageUpdateData
          })
          updateMessageOnAllMessages(messageToSend.tid, messageUpdateData)
          const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
          updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
          // yield put(updateChannelLastMessageAC(messageToUpdate, { id: channel.id } as IChannel))
          const channelUpdateParam = {
            lastMessage: messageToUpdate,
            lastReactedMessage: null
          }
          if (channel.unread) {
            yield put(markChannelAsReadAC(channel.id))
          }
          yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
          updateChannelOnAllChannels(channel.id, channelUpdateParam)
        } */
      } else {
        let attachmentsToSend: IAttachment[] = message.attachments.map((attachment: any) => {
          let uri
          if (attachment.cachedUrl) {
            uri = attachment.cachedUrl
          }

          const attachmentBuilder = channel.createAttachmentBuilder(uri || attachment.data, attachment.type)

          const att = attachmentBuilder
            .setName(attachment.name)
            .setMetadata(attachment.metadata)
            .setUpload(customUploader ? false : attachment.upload)
            .setFileSize(attachment.size)
            .create()

          if (!customUploader) {
            const handleUpdateUploadProgress = (percent: number) => {
              store.dispatch({
                type: UPDATE_UPLOAD_PROGRESS,
                payload: {
                  uploaded: attachment.size * (percent / 100),
                  total: attachment.size,
                  progress: percent,
                  attachmentId: attachment.tid
                }
              })
            }
            if (attachment.upload) {
              store.dispatch({
                type: UPLOAD_ATTACHMENT_COMPILATION,
                payload: {
                  attachmentUploadingState: UPLOAD_STATE.UPLOADING,
                  attachmentId: attachment.tid
                }
              })
            }
            att.progress = (progressPercent: any) => {
              handleUpdateUploadProgress(progressPercent)
              // attachmentsListeners.progress(progressPercent, attachment.tid);
            }
            att.completion = (updatedAttachment: any, error: any) => {
              if (error) {
                console.log('fail to upload attachment ... ', error)
                store.dispatch({
                  type: UPLOAD_ATTACHMENT_COMPILATION,
                  payload: {
                    attachmentUploadingState: UPLOAD_STATE.FAIL,
                    attachmentId: attachment.tid
                  }
                })
              } else {
                const pendingAttachment = getPendingAttachment(attachment.tid)
                if (!attachment.cachedUrl) {
                  setDataToDB(
                    DB_NAMES.FILES_STORAGE,
                    DB_STORE_NAMES.ATTACHMENTS,
                    [{ ...updatedAttachment, checksum: pendingAttachment.checksum }],
                    'checksum'
                  )
                }
                store.dispatch({
                  type: REMOVE_UPLOAD_PROGRESS,
                  payload: {
                    attachmentId: attachment.tid
                  }
                })
                deletePendingAttachment(attachment.tid)
                store.dispatch({
                  type: UPLOAD_ATTACHMENT_COMPILATION,
                  payload: {
                    attachmentUploadingState: UPLOAD_STATE.SUCCESS,
                    attachmentId: attachment.tid
                  }
                })
              }
            }
          }
          // not for SDK, for displaying attachments and their progress
          att.tid = attachment.tid
          att.attachmentUrl = attachment.attachmentUrl
          return att
        })
        const messageBuilder = channel.createMessageBuilder()
        messageBuilder
          .setBody(message.body)
          .setBodyAttributes(message.bodyAttributes)
          .setAttachments(message.attachments)
          .setMentionUserIds(mentionedUserIds)
          .setType(message.type)
          .setDisplayCount(message.type === 'system' ? 0 : 1)
          .setSilent(message.type === 'system')
          .setMetadata(JSON.stringify(message.metadata))
        if (message.parentMessage) {
          messageBuilder.setParentMessageId(message.parentMessage ? message.parentMessage.id : null)
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
                    console.log('progress  ... ', loaded / total)
                  },
                  (updatedLink: string) => {
                    if (attachment.tid) {
                      receivedPaths++
                      attachmentsLocalPaths[attachment.tid] = updatedLink
                      if (receivedPaths === attachmentsToSend.length) {
                        const messageCopy = {
                          ...messageToSend,
                          attachments: message.attachments.map((att: any) => ({
                            tid: att.tid,
                            name: att.name,
                            data: {},
                            type: att.type,
                            attachmentUrl: attachmentsLocalPaths[attachment.tid!]
                          }))
                        }
                        // console.log('put  message for all attachment.... ... . ')
                        store.dispatch({
                          type: ADD_MESSAGE,
                          payload: {
                            message: JSON.parse(
                              JSON.stringify({
                                ...messageCopy,
                                createdAt: new Date(Date.now()),
                                parentMessage: message.parentMessage
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
                        thumbnail,
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
              tid: att.tid,
              name: att.name,
              data: {},
              type: att.type,
              attachmentUrl: att.attachmentUrl
            }))
          }
          /* yield put(
            addMessageAC(
              JSON.parse(
                JSON.stringify({
                  ...messageCopy,
                  createdAt: new Date(Date.now()),
                  parent: message.parent
                })
              )
            )
          ) */
          const hasNextMessages = yield select(messagesHasNextSelector)
          if (!getHasNextCached()) {
            if (hasNextMessages) {
              yield put(getMessagesAC(channel))
            } else {
              yield put(addMessageAC(JSON.parse(JSON.stringify(messageCopy))))
            }
          }
          addMessageToMap(channel.id, messageCopy)
          addAllMessages([messageCopy], MESSAGE_LOAD_DIRECTION.NEXT)

          const messagesToAdd = getFromAllMessagesByMessageId('', '', true)
          yield put(setMessagesAC(JSON.parse(JSON.stringify(messagesToAdd))))
          yield put(scrollToNewMessageAC(true))
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
            yield put(sendMessageAC(messageToSend, channel.id, 'Connected'))
            msgCount++
          } */
          let attachmentsToUpdate = []
          if (messageResponse.attachments && messageResponse.attachments.length > 0) {
            const currentAttachmentsMap = {}
            attachmentsToSend.forEach((attachment: IAttachment) => {
              currentAttachmentsMap[attachment.tid!] = attachment
            })
            attachmentsToUpdate = messageResponse.attachments.map((attachment: IAttachment) => {
              if (currentAttachmentsMap[attachment.tid!]) {
                console.log('set at')
                return { ...attachment, attachmentUrl: currentAttachmentsMap[attachment.tid!].attachmentUrl }
              }
              return attachment
            })
          }
          const messageUpdateData = {
            id: messageResponse.id,
            body: messageResponse.body,
            type: messageResponse.type,
            state: messageResponse.state,
            displayCount: messageResponse.displayCount,
            deliveryStatus: messageResponse.deliveryStatus,
            attachments: attachmentsToUpdate,
            mentionedUsers: messageResponse.mentionedUsers,
            bodyAttributes: messageResponse.bodyAttributes,
            metadata: messageResponse.metadata,
            parentMessage: messageResponse.parentMessage,
            repliedInThread: messageResponse.repliedInThread,
            createdAt: messageResponse.createdAt
          }
          yield put(updateMessageAC(messageToSend.tid, JSON.parse(JSON.stringify(messageUpdateData))))
          updateMessageOnMap(channel.id, {
            messageId: messageToSend.tid,
            params: messageUpdateData
          })
          updateMessageOnAllMessages(messageToSend.tid, messageUpdateData)
          const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
          updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
          const channelUpdateParam = {
            lastMessage: messageToUpdate,
            lastReactedMessage: null
          }
          if (channel.unread) {
            yield put(markChannelAsReadAC(channel.id))
          }
          yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
          updateChannelOnAllChannels(channel.id, channelUpdateParam)
        }
      }
    }

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
              attachmentId: att.tid,
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

// const msgCount = 1
function* sendTextMessage(action: IAction): any {
  // let messageForCatch = {}
  const { payload } = action
  const { message, connectionState, channelId } = payload
  yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
  let channel = yield call(getChannelFromMap, channelId)
  if (!channel) {
    channel = getChannelFromAllChannels(channelId)
    if (channel) {
      setChannelInMap(channel)
    }
  }

  let sendMessageTid
  try {
    if (channel.isMockChannel) {
      const SceytChatClient = getClient()
      removeChannelFromMap(channelId)
      const createChannelData = {
        type: channel.type,
        members: channel.members,
        metadata: ''
      }
      channel = yield call(SceytChatClient.Channel.create, createChannelData)
      yield put(switchChannelActionAC(JSON.parse(JSON.stringify(channel))))
      addChannelsToAllChannels(channel)
      setChannelInMap(channel)
    }
    yield put(addChannelAC(JSON.parse(JSON.stringify(channel))))
    const mentionedUserIds = message.mentionedMembers ? message.mentionedMembers.map((member: any) => member.id) : []
    let attachments = message.attachments
    if (message.attachments && message.attachments.length) {
      const attachmentBuilder = channel.createAttachmentBuilder(attachments[0].data, attachments[0].type)
      const att = attachmentBuilder.setName('').setUpload(attachments[0].upload).create()
      attachments = [att]
    }
    const messageBuilder = channel.createMessageBuilder()
    messageBuilder
      .setBody(message.body)
      .setBodyAttributes(message.bodyAttributes)
      .setAttachments(attachments)
      .setMentionUserIds(mentionedUserIds)
      .setType(message.type)
      .setDisplayCount(message.type === 'system' ? 0 : 1)
      .setSilent(message.type === 'system')
      .setMetadata(JSON.stringify(message.metadata))
    if (message.parentMessage) {
      messageBuilder.setParentMessageId(message.parentMessage ? message.parentMessage.id : null)
    }
    if (message.repliedInThread) {
      messageBuilder.setReplyInThread()
    }
    const messageToSend = messageBuilder.create()
    const pendingMessage = JSON.parse(
      JSON.stringify({
        ...messageToSend,
        createdAt: new Date(Date.now()),
        mentionedUsers: message.mentionedMembers,
        parentMessage: message.parentMessage
      })
    )
    sendMessageTid = messageToSend.tid
    if (pendingMessage.metadata) {
      pendingMessage.metadata = JSON.parse(pendingMessage.metadata)
    }
    // console.log('getHasNextCached .. . .', getHasNextCached())
    const hasNextMessages = yield select(messagesHasNextSelector)
    if (!getHasNextCached()) {
      if (hasNextMessages) {
        yield put(getMessagesAC(channel))
      } else {
        yield put(addMessageAC(JSON.parse(JSON.stringify(pendingMessage))))
      }
    }
    addMessageToMap(channel.id, pendingMessage)
    addAllMessages([pendingMessage], MESSAGE_LOAD_DIRECTION.NEXT)
    const messagesToAdd = getFromAllMessagesByMessageId('', '', true)
    yield put(setMessagesAC(JSON.parse(JSON.stringify(messagesToAdd))))
    if (connectionState === CONNECTION_STATUS.CONNECTED) {
      let messageResponse
      console.log('send message messageToSend ... ', messageToSend)
      if (sendMessageHandler) {
        messageResponse = yield call(sendMessageHandler, messageToSend, channel.id)
      } else {
        messageResponse = yield call(channel.sendMessage, messageToSend)
      }
      /* if (msgCount <= 200) {
        const messageToSend: any = {
          // metadata: mentionedMembersPositions,
          // body: `\n${msgCount}\n`,
          body: `text message ${msgCount}`,
          mentionedMembers: [],
          attachments: [],
          type: 'text'
        }
        yield put(sendTextMessageAC(messageToSend, channel.id, 'Connected'))
        msgCount++
      } */
      const messageUpdateData = {
        id: messageResponse.id,
        body: messageResponse.body,
        type: messageResponse.type,
        state: messageResponse.state,
        bodyAttributes: messageResponse.bodyAttributes,
        displayCount: messageResponse.displayCount,
        deliveryStatus: messageResponse.deliveryStatus,
        attachments: messageResponse.attachments,
        mentionedUsers: messageResponse.mentionedUsers,
        metadata: messageResponse.metadata,
        parentMessage: messageResponse.parentMessage,
        repliedInThread: messageResponse.repliedInThread,
        createdAt: messageResponse.createdAt
      }
      yield put(updateMessageAC(messageToSend.tid, JSON.parse(JSON.stringify(messageUpdateData))))
      updateMessageOnMap(channel.id, {
        messageId: messageToSend.tid,
        params: messageUpdateData
      })
      updateMessageOnAllMessages(messageToSend.tid, messageUpdateData)
      const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
      updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
      // yield put(updateChannelLastMessageAC(messageToUpdate, { id: channel.id } as IChannel))
      const channelUpdateParam = {
        lastMessage: messageToUpdate,
        lastReactedMessage: null
      }
      yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
      updateChannelOnAllChannels(channel.id, channelUpdateParam)
      if (channel.unread) {
        yield put(markChannelAsReadAC(channel.id))
      }
    } else {
      // eslint-disable-next-line
      throw new Error('Connection required to send message')
    }

    yield put(scrollToNewMessageAC(true))
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
    // messageForCatch = messageToSend
  } catch (e) {
    console.log('error on send text message ... ', e)
    updateMessageOnMap(channel.id, {
      messageId: sendMessageTid,
      params: { state: MESSAGE_STATUS.FAILED }
    })
    updateMessageOnAllMessages(sendMessageTid, { state: MESSAGE_STATUS.FAILED })
    yield put(updateMessageAC(sendMessageTid, { state: MESSAGE_STATUS.FAILED }))
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
    // yield put(setErrorNotification(`${e.message} ${e.code}`));
  }
}

function* forwardMessage(action: IAction): any {
  // let messageForCatch = {}
  try {
    const { payload } = action
    const { message, channelId, connectionState } = payload
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (!channel) {
        const SceytChatClient = getClient()
        channel = yield call(SceytChatClient.getChannel, channelId)
      }
      if (channel) {
        setChannelInMap(channel)
      }
    }
    yield put(addChannelAC(JSON.parse(JSON.stringify(channel))))
    const mentionedUserIds = message.mentionedMembers ? message.mentionedMembers.map((member: any) => member.id) : []
    let attachments = message.attachments
    if (
      !(
        (channel.type === CHANNEL_TYPE.BROADCAST || channel.type === CHANNEL_TYPE.PUBLIC) &&
        !(channel.userRole === 'admin' || channel.userRole === 'owner')
      )
    ) {
      if (message.attachments && message.attachments.length) {
        const attachmentBuilder = channel.createAttachmentBuilder(attachments[0].url, attachments[0].type)
        const att = attachmentBuilder
          .setName(attachments[0].name)
          .setMetadata(attachments[0].metadata)
          .setFileSize(attachments[0].size)
          .setUpload(false)
          .create()
        attachments = [att]
      }
      const messageBuilder = channel.createMessageBuilder()
      messageBuilder
        .setBody(message.body)
        .setBodyAttributes(message.bodyAttributes)
        .setAttachments(attachments)
        .setMentionUserIds(mentionedUserIds)
        .setType(message.type)
        .setMetadata(message.metadata ? JSON.stringify(message.metadata) : '')
        .setForwardingMessageId(message.forwardingDetails ? message.forwardingDetails.messageId : message.id)

      const messageToSend = messageBuilder.create()
      const pendingMessage = JSON.parse(
        JSON.stringify({
          ...messageToSend,
          createdAt: new Date(Date.now())
        })
      )
      if (message.forwardingDetails) {
        pendingMessage.forwardingDetails.user = message.forwardingDetails.user
        pendingMessage.forwardingDetails.channelId = message.forwardingDetails.channelId
      } else {
        pendingMessage.forwardingDetails.user = message.user
        pendingMessage.forwardingDetails.channelId = channelId
      }
      pendingMessage.forwardingDetails.hops = message.forwardingDetails ? message.forwardingDetails.hops : 1
      const activeChannelId = getActiveChannelId()
      const isCachedChannel = checkChannelExistsOnMessagesMap(channelId)
      if (channelId === activeChannelId) {
        const hasNextMessages = yield select(messagesHasNextSelector)
        if (!getHasNextCached()) {
          if (hasNextMessages) {
            yield put(getMessagesAC(channel))
          } else {
            yield put(addMessageAC(JSON.parse(JSON.stringify(pendingMessage))))
          }
        }
        addMessageToMap(channelId, pendingMessage)
        addAllMessages([pendingMessage], MESSAGE_LOAD_DIRECTION.NEXT)
        yield put(scrollToNewMessageAC(true, true))
      } else if (isCachedChannel) {
        addMessageToMap(channelId, pendingMessage)
      } else {
        addPendingMessageToMap(channelId, pendingMessage)
      }
      if (connectionState === CONNECTION_STATUS.CONNECTED) {
        const messageResponse = yield call(channel.sendMessage, messageToSend)
        const messageUpdateData = {
          id: messageResponse.id,
          type: messageResponse.type,
          state: messageResponse.state,
          displayCount: messageResponse.displayCount,
          deliveryStatus: messageResponse.deliveryStatus,
          attachments: messageResponse.attachments,
          mentionedUsers: messageResponse.mentionedUsers,
          metadata: messageResponse.metadata,
          parentMessage: messageResponse.parentMessage,
          repliedInThread: messageResponse.repliedInThread,
          createdAt: messageResponse.createdAt
        }
        if (channelId === activeChannelId) {
          yield put(updateMessageAC(messageToSend.tid, JSON.parse(JSON.stringify(messageUpdateData))))
          updateMessageOnMap(channel.id, {
            messageId: messageToSend.tid,
            params: messageUpdateData
          })
          updateMessageOnAllMessages(messageToSend.tid, messageUpdateData)
        } else if (isCachedChannel) {
          updateMessageOnMap(channel.id, {
            messageId: messageToSend.tid,
            params: messageUpdateData
          })
        } else {
          removePendingMessageFromMap(channelId, messageToSend.tid)
        }

        const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
        updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
        const channelUpdateParam = {
          lastMessage: messageToUpdate,
          lastReactedMessage: null
        }
        yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
        updateChannelOnAllChannels(channel.id, channelUpdateParam)
        if (channel.unread) {
          yield put(markChannelAsReadAC(channel.id))
        }
      }
    }
    // messageForCatch = messageToSend
  } catch (e) {
    console.log('error on forward message ... ', e)
    // yield put(setErrorNotification(`${e.message} ${e.code}`));
  }
  yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
}

function* resendMessage(action: IAction): any {
  const { payload } = action
  const { message, connectionState, channelId } = payload
  yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
  let channel = yield call(getChannelFromMap, channelId)
  try {
    console.log('resend message .... ', message)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (channel) {
        setChannelInMap(channel)
      }
    }
    yield put(addChannelAC(JSON.parse(JSON.stringify(channel))))
    // const mentionedUserIds = message.mentionedMembers.map((member: any) => member.id)
    // let attachmentsToSend: IAttachment[] = []
    const customUploader = getCustomUploader()

    yield put(updateMessageAC(message.tid, { state: MESSAGE_STATUS.UNMODIFIED }))
    updateMessageOnMap(channel.id, {
      messageId: message.tid,
      params: { state: MESSAGE_STATUS.UNMODIFIED }
    })
    updateMessageOnAllMessages(message.tid, { state: MESSAGE_STATUS.UNMODIFIED })

    if (message.attachments && message.attachments.length && message.state === MESSAGE_STATUS.FAILED) {
      const attachmentCompilation = yield select(attachmentCompilationStateSelector)
      // const attachmentsCopy = [...message.attachments]
      // if (isResend) {
      // }
      const messageAttachment = { ...message.attachments[0] }

      const messageCopy = {
        ...message,
        attachments: [messageAttachment]
      }
      console.log('attachmentCompilation. .. . .', attachmentCompilation)
      if (
        connectionState === CONNECTION_STATUS.CONNECTED &&
        attachmentCompilation[messageAttachment.tid] &&
        attachmentCompilation[messageAttachment.tid] === UPLOAD_STATE.FAIL
      ) {
        yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, messageAttachment.tid))
        if (customUploader) {
          const handleUploadProgress = ({ loaded, total }: IProgress) => {
            console.log('progress ... ', loaded / total)
          }

          let uri
          try {
            let filePath
            const handleUpdateLocalPath = (updatedLink: string) => {
              filePath = updatedLink
              thumbnailMetas = getVideoThumb(messageAttachment.tid)
              messageCopy.attachments[0] = { ...messageCopy.attachments[0], attachmentUrl: updatedLink }
              const updateAttachmentPath = {
                attachments: [{ ...messageCopy.attachments[0], attachmentUrl: updatedLink }]
              }
              store.dispatch({
                type: UPDATE_MESSAGE,
                payload: {
                  message: JSON.parse(
                    JSON.stringify({
                      ...updateAttachmentPath
                    })
                  )
                }
              })
            }
            const pendingAttachment = getPendingAttachment(message.attachments[0].tid)
            console.log('pendingAttachment ... ', pendingAttachment)
            if (messageAttachment.cachedUrl) {
              uri = pendingAttachment.file
            } else {
              messageAttachment.data = pendingAttachment.file
              messageAttachment.url = pendingAttachment.file
              uri = yield call(customUpload, messageAttachment, handleUploadProgress, handleUpdateLocalPath)
            }
            console.log('messageAttachment ... ', messageAttachment)

            yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.SUCCESS, messageAttachment.tid))

            delete messageCopy.createdAt
            let thumbnailMetas: IAttachmentMeta = {}
            let fileSize = messageAttachment.cachedUrl ? messageAttachment.size : pendingAttachment.file.size

            console.log('uri ... ', uri)
            if (!messageAttachment.cachedUrl && messageAttachment.url.type.split('/')[0] === 'image') {
              fileSize = yield call(getImageSize, filePath)
              thumbnailMetas = yield call(
                createImageThumbnail,
                null,
                filePath,
                messageAttachment.type === 'file' ? 50 : undefined,
                messageAttachment.type === 'file' ? 50 : undefined
              )
            }
            let attachmentMeta: string
            if (messageAttachment.cachedUrl) {
              attachmentMeta = messageAttachment.metadata
            } else {
              attachmentMeta = JSON.stringify({
                ...messageAttachment.metadata,
                ...(thumbnailMetas &&
                  thumbnailMetas.thumbnail && {
                    tmb: thumbnailMetas.thumbnail,
                    szw: thumbnailMetas.imageWidth,
                    szh: thumbnailMetas.imageHeight
                  })
              })
            }
            console.log('attachmentMeta ... ', attachmentMeta)
            const attachmentBuilder = channel.createAttachmentBuilder(uri, messageAttachment.type)

            /* const attachmentToSend = { ...messageAttachment, url: uri, upload: false } */
            const attachmentToSend = attachmentBuilder
              .setName(messageAttachment.name)
              .setMetadata(attachmentMeta)
              .setFileSize(fileSize)
              .setUpload(false)
              .create()
            console.log('attachmentToSend ... ', attachmentToSend)
            // not for SDK, for displaying attachments and their progress
            attachmentToSend.tid = messageAttachment.tid
            attachmentToSend.attachmentUrl = messageAttachment.attachmentUrl
            yield put(
              updateMessageAC(
                messageCopy.tid,
                JSON.parse(JSON.stringify({ ...messageCopy, attachments: [attachmentToSend] }))
              )
            )
            messageCopy.attachments = [attachmentToSend]

            if (connectionState === CONNECTION_STATUS.CONNECTED) {
              const messageResponse = yield call(channel.sendMessage, messageCopy)
              deletePendingAttachment(messageAttachment.tid)
              const messageUpdateData = {
                id: messageResponse.id,
                body: messageResponse.body,
                type: messageResponse.type,
                state: messageResponse.state,
                displayCount: messageResponse.displayCount,
                deliveryStatus: messageResponse.deliveryStatus,
                attachments: [
                  {
                    ...messageResponse.attachments[0],
                    attachmentUrl: attachmentToSend.attachmentUrl,
                    tid: attachmentToSend.tid
                  }
                ],
                mentionedUsers: messageResponse.mentionedUsers,
                metadata: messageResponse.metadata,
                parentMessage: messageResponse.parentMessage,
                repliedInThread: messageResponse.repliedInThread,
                bodyAttributes: messageResponse.bodyAttributes,
                createdAt: messageResponse.createdAt
              }
              removePendingMessageFromMap(channel.id, messageCopy.tid)
              yield put(updateMessageAC(messageCopy.tid, JSON.parse(JSON.stringify(messageUpdateData))))

              const fileType =
                messageAttachment.data && messageAttachment.data.type
                  ? messageAttachment.data.type.split('/')[0]
                  : messageAttachment.type
              if (fileType === 'video') {
                deleteVideoThumb(messageAttachment.tid)
              }
              updateMessageOnMap(channel.id, {
                messageId: messageCopy.tid,
                params: messageUpdateData
              })
              updateMessageOnAllMessages(messageCopy.tid, messageUpdateData)

              const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
              updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
              yield put(updateChannelLastMessageAC(messageToUpdate, { id: channel.id } as IChannel))
            }
          } catch (e) {
            console.log('fail upload attachment on resend message ... ', e)
            yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, messageAttachment.tid))

            updateMessageOnMap(channel.id, {
              messageId: messageCopy.tid,
              params: { state: MESSAGE_STATUS.FAILED }
            })
            updateMessageOnAllMessages(messageCopy.tid, { state: MESSAGE_STATUS.FAILED })
            yield put(updateMessageAC(messageCopy.tid, { state: MESSAGE_STATUS.FAILED }))
          }
        }
      }
    } else if (message.state === MESSAGE_STATUS.FAILED) {
      console.log('send failed message ...')
      const messageCopy = { ...message }
      delete messageCopy.createdAt

      if (connectionState === CONNECTION_STATUS.CONNECTED) {
        const messageResponse = yield call(channel.sendMessage, messageCopy)
        console.log('resend message response ... ', messageResponse)
        const messageUpdateData = {
          id: messageResponse.id,
          body: messageResponse.body,
          type: messageResponse.type,
          state: messageResponse.state,
          displayCount: messageResponse.displayCount,
          deliveryStatus: messageResponse.deliveryStatus,
          attachments: [],
          mentionedUsers: messageResponse.mentionedUsers,
          metadata: messageResponse.metadata,
          parentMessage: messageResponse.parentMessage,
          repliedInThread: messageResponse.repliedInThread,
          bodyAttributes: messageResponse.bodyAttributes,
          createdAt: messageResponse.createdAt
        }
        removePendingMessageFromMap(channel.id, messageCopy.tid)
        yield put(updateMessageAC(messageCopy.tid, messageUpdateData))

        updateMessageOnMap(channel.id, {
          messageId: messageCopy.tid,
          params: messageUpdateData
        })
        const activeChannelId = getActiveChannelId()
        if (channelId === activeChannelId) {
          yield put(updateMessageAC(messageCopy.tid, JSON.parse(JSON.stringify(messageResponse))))
          updateMessageOnMap(channel.id, {
            messageId: messageCopy.tid,
            params: messageUpdateData
          })
          updateMessageOnAllMessages(messageCopy.tid, messageUpdateData)
        }
        updateChannelOnAllChannels(channel.id, channel)
        const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
        updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
        yield put(updateChannelLastMessageAC(messageToUpdate, { id: channel.id } as IChannel))
      }
    }
    yield put(scrollToNewMessageAC(true))

    /* const messageToResend = { ...message }
    if (messageToResend.createdAt) {
      delete messageToResend.createdAt
    }
    const messageResponse = yield call(channel.reSendMessage, messageToResend)
    yield put(updateMessageAC(message.id || message.tid, messageResponse)) */
  } catch (e) {
    console.log('ERROR in resend message', e.message, 'channel.. . ', channel)

    yield put(updateMessageAC(message.tid, { state: MESSAGE_STATUS.FAILED }))

    updateMessageOnMap(channel.id, {
      messageId: message.tid,
      params: { state: MESSAGE_STATUS.FAILED }
    })
    updateMessageOnAllMessages(message.tid, { state: MESSAGE_STATUS.FAILED })

    // yield put(setErrorNotification(e.message))
  }
  yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
}

function* deleteMessage(action: IAction): any {
  try {
    const { payload } = action
    const { messageId, channelId, deleteOption } = payload
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (channel) {
        setChannelInMap(channel)
      }
    }

    const deletedMessage = yield call(channel.deleteMessageById, messageId, deleteOption === 'forMe')
    console.log('deletedMessage . .. . .', deletedMessage)
    yield put(updateMessageAC(deletedMessage.id, deletedMessage))
    updateMessageOnMap(channel.id, {
      messageId: deletedMessage.id,
      params: deletedMessage
    })

    updateMessageOnAllMessages(messageId, deletedMessage)

    const messageToUpdate = JSON.parse(JSON.stringify(deletedMessage))
    updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
    if (channel.lastMessage.id === messageId) {
      yield put(updateChannelLastMessageAC(messageToUpdate, channel))
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
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (channel) {
        setChannelInMap(channel)
      }
    }
    const editedMessage = yield call(channel.editMessage, {
      ...message,
      metadata: isJSON(message.metadata) ? message.metadata : JSON.stringify(message.metadata),
      attachments: message.attachments.map((att: IAttachment) => ({
        ...att,
        metadata: isJSON(att.metadata) ? att.metadata : JSON.stringify(att.metadata)
      }))
    })
    yield put(updateMessageAC(editedMessage.id, editedMessage))
    updateMessageOnMap(channel.id, {
      messageId: editedMessage.id,
      params: editedMessage
    })
    updateMessageOnAllMessages(message.id, editedMessage)
    if (channel.lastMessage.id === message.id) {
      const messageToUpdate = JSON.parse(JSON.stringify(editedMessage))
      updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
      yield put(updateChannelLastMessageAC(messageToUpdate, channel))
    }
  } catch (e) {
    console.log('ERROR in edit message', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* getMessagesQuery(action: IAction): any {
  try {
    const { channel, loadWithLastMessage, messageId, limit } = action.payload
    console.log('getMessagesQuery ... ', action.payload)
    if (channel.id && !channel.isMockChannel) {
      const SceytChatClient = getClient()
      /* const attachmentQueryBuilder = new (SceytChatClient.AttachmentListQueryBuilder as any)(channel.id)
      attachmentQueryBuilder.types(['image', 'video'])
      attachmentQueryBuilder.limit(10)
      const attachmentQuery = yield call(attachmentQueryBuilder.build)

      const attachmentResult = yield call(attachmentQuery.loadPrevious)
      console.log('attachmentResult ... ', attachmentResult) */
      const messageQueryBuilder = new (SceytChatClient.MessageListQueryBuilder as any)(channel.id)
      messageQueryBuilder.limit(limit || MESSAGES_MAX_LENGTH)
      messageQueryBuilder.reverse(true)
      const messageQuery = yield call(messageQueryBuilder.build)
      query.messageQuery = messageQuery
      yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
      const cachedMessages = getMessagesFromMap(channel.id)
      let result: { messages: IMessage[]; hasNext: boolean } = { messages: [], hasNext: false }
      if (loadWithLastMessage) {
        const allMessages = getAllMessages()
        const havLastMessage =
          allMessages &&
          allMessages.length &&
          channel.lastMessage &&
          allMessages[allMessages.length - 1] &&
          allMessages[allMessages.length - 1].id === channel.lastMessage.id
        if ((channel.newMessageCount && channel.newMessageCount > 0) || !havLastMessage) {
          // if (channel.newMessageCount && channel.newMessageCount > 0) {
          setHasPrevCached(false)
          setAllMessages([])
          // }
          result = yield call(messageQuery.loadPreviousMessageId, '0')
          if (result.messages.length === 50) {
            messageQuery.limit = 20
            const secondResult = yield call(messageQuery.loadPreviousMessageId, result.messages[0].id)
            result.messages = [...secondResult.messages, ...result.messages]
            result.hasNext = secondResult.hasNext
          }
          yield put(setMessagesAC(JSON.parse(JSON.stringify(result.messages))))
          // if (channel.newMessageCount && channel.newMessageCount > 0) {
          setMessagesToMap(channel.id, result.messages)
          setAllMessages([...result.messages])
          // }
          yield put(setMessagesHasPrevAC(true))
          yield put(markChannelAsReadAC(channel.id))
        } else {
          result.messages = getFromAllMessagesByMessageId('', '', true)
          yield put(setMessagesAC(JSON.parse(JSON.stringify(result.messages))))
          yield put(setMessagesHasPrevAC(true))
        }
        yield put(setMessagesHasNextAC(false))
        setHasNextCached(false)
      } else if (messageId) {
        const allMessages = getAllMessages()
        const messageIndex = allMessages.findIndex((msg) => msg.id === messageId)
        const maxLengthPart = MESSAGES_MAX_LENGTH / 2
        if (messageIndex >= maxLengthPart) {
          result.messages = allMessages.slice(messageIndex - maxLengthPart, messageIndex + maxLengthPart)
          yield put(setMessagesAC(JSON.parse(JSON.stringify(result.messages))))
          setHasPrevCached(messageIndex > maxLengthPart)
          setHasNextCached(allMessages.length > maxLengthPart)
        } else {
          messageQuery.limit = MESSAGES_MAX_LENGTH
          console.log('load by message id from server ...............', messageId)
          result = yield call(messageQuery.loadNearMessageId, messageId)
          if (result.messages.length === 50) {
            messageQuery.limit = (MESSAGES_MAX_LENGTH - 50) / 2
            const secondResult = yield call(messageQuery.loadPreviousMessageId, result.messages[0].id)
            messageQuery.reverse = false
            const thirdResult = yield call(
              messageQuery.loadNextMessageId,
              result.messages[result.messages.length - 1].id
            )
            result.messages = [...secondResult.messages, ...result.messages, ...thirdResult.messages]
            result.hasNext = secondResult.hasNext
            messageQuery.reverse = true
          }
          console.log('result from server ....... ', result)
          yield put(setMessagesHasNextAC(true))
          // TO DO - pending messages are repeated in the list, fix after uncommenting.
          const pendingMessages = getPendingMessages(channel.id)
          if (pendingMessages && pendingMessages.length) {
            const messagesMap = {}
            result.messages.forEach((msg) => {
              messagesMap[msg.tid || ''] = msg
            })
            const filteredPendingMessages = pendingMessages.filter((msg) => !messagesMap[msg.tid || ''])
            setPendingMessages(channel.id, filteredPendingMessages)
            result.messages = [...result.messages, ...filteredPendingMessages]
          }
          yield put(setMessagesAC(JSON.parse(JSON.stringify(result.messages))))
          // setAllMessages([...result.messages])

          setAllMessages([...result.messages])
          setHasPrevCached(false)
          setHasNextCached(false)
        }
        yield put(setScrollToMessagesAC(messageId))
      } else if (channel.newMessageCount && channel.lastDisplayedMsgId) {
        // dispatch(setMessagesPrevCompleteAC(true))
        setAllMessages([])
        messageQuery.limit = MESSAGES_MAX_LENGTH
        if (Number(channel.lastDisplayedMsgId)) {
          result = yield call(messageQuery.loadNearMessageId, channel.lastDisplayedMsgId)
          if (result.messages.length === 50) {
            messageQuery.limit =
              channel.newMessageCount > 25 ? (MESSAGES_MAX_LENGTH - 50) / 2 : MESSAGES_MAX_LENGTH - 50
            const secondResult = yield call(messageQuery.loadPreviousMessageId, result.messages[0].id)
            if (channel.newMessageCount > 25) {
              messageQuery.reverse = false
              const thirdResult = yield call(
                messageQuery.loadNextMessageId,
                result.messages[result.messages.length - 1].id
              )
              result.messages = [...secondResult.messages, ...result.messages, ...thirdResult.messages]
              messageQuery.reverse = true
            } else {
              result.messages = [...secondResult.messages, ...result.messages]
            }
          }
        } else {
          result = yield call(messageQuery.loadPrevious)
          if (result.messages.length === 50) {
            messageQuery.limit = MESSAGES_MAX_LENGTH - 50
            const secondResult = yield call(messageQuery.loadPreviousMessageId, result.messages[0].id)
            result.messages = [...secondResult.messages, ...result.messages]
            result.hasNext = secondResult.hasNext
          }
        }
        setMessagesToMap(channel.id, result.messages)
        // }

        yield put(setMessagesHasPrevAC(true))
        yield put(
          setMessagesHasNextAC(
            channel.lastMessage &&
              result.messages.length > 0 &&
              channel.lastMessage.id !== result.messages[result.messages.length - 1].id
          )
        )

        // TO DO - pending messages are repeated in the list, fix after uncommenting.
        const pendingMessages = getPendingMessages(channel.id)
        if (pendingMessages && pendingMessages.length) {
          const messagesMap = {}
          result.messages.forEach((msg) => {
            messagesMap[msg.tid || ''] = msg
          })
          const filteredPendingMessages = pendingMessages.filter((msg) => !messagesMap[msg.tid || ''])
          setPendingMessages(channel.id, filteredPendingMessages)
          result.messages = [...result.messages, ...filteredPendingMessages]
        }
        setAllMessages([...result.messages])
        yield put(setMessagesAC(JSON.parse(JSON.stringify(result.messages))))
        /*
        if (channel.lastDisplayedMessageId) {
          yield put(setMessagesNextCompleteAC(true))
          yield put(setMessagesPrevCompleteAC(true))
          messageQuery.limit = 30
          // result = yield call(messageQuery.loadPreviousMessageId, '0')
          result = yield call(messageQuery.loadNearMessageId, channel.lastDisplayedMsgId)
        } else {
          messageQuery.limit = 20
          result = yield call(messageQuery.loadNext)
        }
        yield put(setMessagesNextCompleteAC(true)) */
      } else {
        setAllMessages([])
        if (cachedMessages && cachedMessages.length) {
          setAllMessages([...cachedMessages])
          yield put(setMessagesAC(JSON.parse(JSON.stringify(cachedMessages))))
        }
        // yield put(setMessagesNextCompleteAC(false))
        console.log('load message from server')
        result = yield call(messageQuery.loadPrevious)
        if (result.messages.length === 50) {
          messageQuery.limit = MESSAGES_MAX_LENGTH - 50
          const secondResult = yield call(messageQuery.loadPreviousMessageId, result.messages[0].id)
          result.messages = [...secondResult.messages, ...result.messages]
          result.hasNext = secondResult.hasNext
        }
        result.messages.forEach((msg) => {
          updateMessageOnMap(channel.id, { messageId: msg.id, params: msg })
          updateMessageOnAllMessages(msg.id, msg)
        })
        // setMessagesToMap(channel.id, result.messages)
        // setAllMessages([...result.messages])
        yield put(setMessagesHasPrevAC(result.hasNext))
        yield put(setMessagesHasNextAC(false))
      }
      if (!(cachedMessages && cachedMessages.length)) {
        // TO DO - pending messages are repeated in the list, fix after uncommenting.
        const pendingMessages = getPendingMessages(channel.id)
        if (pendingMessages && pendingMessages.length) {
          const messagesMap = {}
          result.messages.forEach((msg) => {
            messagesMap[msg.tid || ''] = msg
          })
          const filteredPendingMessages = pendingMessages.filter((msg) => !messagesMap[msg.tid || ''])
          setPendingMessages(channel.id, filteredPendingMessages)
          result.messages = [...result.messages, ...filteredPendingMessages]
        }

        yield put(setMessagesAC(JSON.parse(JSON.stringify(result.messages))))
        setMessagesToMap(channel.id, result.messages)

        setAllMessages([...result.messages])
      }

      // yield put(addMessagesAC(result.messages, 1, channel.newMessageCount));
      yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
    } else if (channel.isMockChannel) {
      yield put(setMessagesAC([]))
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
    console.log('loadMoreMessages .. .. ', payload)
    const SceytChatClient = getClient()
    const messageQueryBuilder = new (SceytChatClient.MessageListQueryBuilder as any)(channelId)
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
          // console.log('add to all messages result.messages', result.messages)
          addAllMessages(result.messages, MESSAGE_LOAD_DIRECTION.PREV)
        }
        yield put(setMessagesHasPrevAC(result.hasNext))
      }
    } else {
      // console.log('load next saga ,,,,  getHasNextCached() , , , ', getHasNextCached())
      if (getHasNextCached()) {
        result.messages = getFromAllMessagesByMessageId(messageId, MESSAGE_LOAD_DIRECTION.NEXT)
        // console.log('res. next cached messages ... ', result.messages)
      } else if (hasNext) {
        console.log('saga load next from server ... ', messageId)
        messageQuery.reverse = false
        result = yield call(messageQuery.loadNextMessageId, messageId)
        console.log('result from server next ... ', result)
        if (result.messages.length) {
          // console.log('add to all messages result.messages', result.messages)
          addAllMessages(result.messages, MESSAGE_LOAD_DIRECTION.NEXT)
        }
        yield put(setMessagesHasNextAC(result.hasNext))
      }
      yield put(setMessagesHasPrevAC(true))
    }
    /*   if (result.messages[result.messages.length - 1].id === messageId) {
      result.messages.pop()
    } */
    if (result.messages && result.messages.length && result.messages.length > 0) {
      yield put(addMessagesAC(JSON.parse(JSON.stringify(result.messages)), direction))
    } else {
      yield put(addMessagesAC([], direction))
    }
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log('error in load more messages', e)
    /* if (e.code !== 10008) {
      yield put(setErrorNotification(e.message));
    } */
  }
}

function* addReaction(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, messageId, key, score, reason, enforceUnique } = payload
    const user = getClient().user
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (channel) {
        setChannelInMap(channel)
      }
    }
    const { message, reaction } = yield call(channel.addReaction, messageId, key, score, reason, enforceUnique)
    if (user.id === message.user.id) {
      const channelUpdateParam = {
        userMessageReactions: [reaction],
        lastReactedMessage: message,
        newReactions: [reaction]
      }
      yield put(updateChannelDataAC(channel.id, channelUpdateParam))
      updateChannelOnAllChannels(channel.id, channelUpdateParam)
    }
    yield put(addChannelAC(JSON.parse(JSON.stringify(channel))))

    yield put(addReactionToListAC(reaction))
    yield put(addReactionToMessageAC(message, reaction, true))
    addReactionToMessageOnMap(channelId, message, reaction, true)
    addReactionOnAllMessages(message, reaction, true)
  } catch (e) {
    console.log('ERROR in add reaction', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* deleteReaction(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, messageId, key, isLastReaction } = payload
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (channel) {
        setChannelInMap(channel)
      }
    }
    const { message, reaction } = yield call(channel.deleteReaction, messageId, key)
    if (isLastReaction) {
      const channelUpdateParam = {
        userMessageReactions: [],
        lastReactedMessage: null
      }
      yield put(updateChannelDataAC(channel.id, channelUpdateParam))
      updateChannelOnAllChannels(channel.id, channelUpdateParam)
    }
    console.log('message received. ... ', message)
    yield put(deleteReactionFromListAC(reaction))
    yield put(deleteReactionFromMessageAC(message, reaction, true))
    removeReactionToMessageOnMap(channelId, message, reaction, true)
    removeReactionOnAllMessages(message, reaction, true)
  } catch (e) {
    console.log('ERROR in delete reaction', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* getReactions(action: IAction): any {
  try {
    const { payload } = action
    const { messageId, key, limit } = payload
    const SceytChatClient = getClient()
    yield put(setReactionsLoadingStateAC(LOADING_STATE.LOADING))
    const reactionQueryBuilder = new (SceytChatClient.ReactionListQueryBuilder as any)(messageId)
    reactionQueryBuilder.limit(limit || 10)
    if (key) {
      reactionQueryBuilder.setKey(key)
    }
    const reactionQuery = yield call(reactionQueryBuilder.build)

    const result = yield call(reactionQuery.loadNext)
    query.ReactionsQuery = reactionQuery
    yield put(setReactionsListAC(result.reactions, result.hasNext))
    yield put(setReactionsLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log('ERROR in get reactions', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* loadMoreReactions(action: IAction): any {
  try {
    const { payload } = action
    const { limit } = payload
    yield put(setReactionsLoadingStateAC(LOADING_STATE.LOADING))
    const ReactionQuery = query.ReactionsQuery
    if (limit) {
      ReactionQuery.limit = limit
    }
    const result = yield call(ReactionQuery.loadNext)
    yield put(addReactionsToListAC(result.reactions, result.hasNext))
    yield put(setReactionsLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log('ERROR in load more reactions', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* getMessageAttachments(action: IAction): any {
  try {
    const { channelId, attachmentType, limit, direction, attachmentId, forPopup } = action.payload
    const SceytChatClient = getClient()
    let typeList = [
      attachmentTypes.video,
      attachmentTypes.image,
      attachmentTypes.file,
      attachmentTypes.link,
      attachmentTypes.voice
    ]
    if (attachmentType === channelDetailsTabs.media) {
      typeList = [attachmentTypes.video, attachmentTypes.image]
    } else if (attachmentType === channelDetailsTabs.file) {
      typeList = [attachmentTypes.file]
    } else if (attachmentType === channelDetailsTabs.link) {
      typeList = [attachmentTypes.link]
    } else if (attachmentType === channelDetailsTabs.voice) {
      typeList = [attachmentTypes.voice]
    }
    const AttachmentByTypeQueryBuilder = new (SceytChatClient.AttachmentListQueryBuilder as any)(channelId, typeList)
    AttachmentByTypeQueryBuilder.limit(limit || 34)
    const AttachmentByTypeQuery = yield call(AttachmentByTypeQueryBuilder.build)
    if (forPopup) {
      AttachmentByTypeQuery.reverse = true
    }

    let result: { attachments: any; hasNext: boolean }
    if (direction === queryDirection.NEXT) {
      result = yield call(AttachmentByTypeQuery.loadPrevious)
    } else if (direction === queryDirection.NEAR) {
      result = yield call(AttachmentByTypeQuery.loadNearMessageId, attachmentId)
    } else {
      result = yield call(AttachmentByTypeQuery.loadPrevious)
    }
    if (forPopup) {
      query.AttachmentByTypeQueryForPopup = AttachmentByTypeQuery
      yield put(setAttachmentsForPopupAC(JSON.parse(JSON.stringify(result.attachments))))
      yield put(setAttachmentsCompleteForPopupAC(result.hasNext))
    } else {
      query.AttachmentByTypeQuery = AttachmentByTypeQuery
      yield put(setAttachmentsCompleteAC(result.hasNext))
      // yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
      yield put(setAttachmentsAC(JSON.parse(JSON.stringify(result.attachments))))
    }
  } catch (e) {
    console.log('error in message attachment query')
    // yield put(setErrorNotification(e.message))
  }
}

function* loadMoreMessageAttachments(action: any) {
  try {
    const { limit, direction, forPopup } = action.payload
    let AttachmentQuery
    if (forPopup) {
      AttachmentQuery = query.AttachmentByTypeQueryForPopup
    } else {
      AttachmentQuery = query.AttachmentByTypeQuery
    }
    yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADING))
    AttachmentQuery.limit = limit
    const { attachments, hasNext } = yield call(AttachmentQuery.loadPrevious)
    if (forPopup) {
      yield put(addAttachmentsForPopupAC(attachments, direction))
    } else {
      yield put(setAttachmentsCompleteAC(hasNext))
      yield put(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
      yield put(addAttachmentsAC(attachments))
    }
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
        yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, attachmentId))
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
        yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, attachmentId))
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
  yield takeEvery(FORWARD_MESSAGE, forwardMessage)
  yield takeEvery(RESEND_MESSAGE, resendMessage)
  yield takeLatest(EDIT_MESSAGE, editMessage)
  yield takeEvery(DELETE_MESSAGE, deleteMessage)
  yield takeLatest(GET_MESSAGES, getMessagesQuery)
  yield takeLatest(GET_MESSAGES_ATTACHMENTS, getMessageAttachments)
  yield takeLatest(LOAD_MORE_MESSAGES_ATTACHMENTS, loadMoreMessageAttachments)
  yield takeLatest(ADD_REACTION, addReaction)
  yield takeLatest(DELETE_REACTION, deleteReaction)
  yield takeEvery(LOAD_MORE_MESSAGES, loadMoreMessages)
  yield takeEvery(GET_REACTIONS, getReactions)
  yield takeEvery(LOAD_MORE_REACTIONS, loadMoreReactions)
  yield takeEvery(PAUSE_ATTACHMENT_UPLOADING, pauseAttachmentUploading)
  yield takeEvery(RESUME_ATTACHMENT_UPLOADING, resumeAttachmentUploading)
}
