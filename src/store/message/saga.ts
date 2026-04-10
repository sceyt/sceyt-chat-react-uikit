import { put, call, delay, spawn, takeLatest, takeEvery } from 'redux-saga/effects'
import { v4 as uuidv4 } from 'uuid'
import {
  ADD_REACTION,
  DELETE_MESSAGE,
  DELETE_REACTION,
  EDIT_MESSAGE,
  FORWARD_MESSAGE,
  GET_MESSAGE,
  LOAD_LATEST_MESSAGES,
  LOAD_AROUND_MESSAGE,
  REFRESH_CACHE_AROUND_MESSAGE,
  LOAD_NEAR_UNREAD,
  LOAD_DEFAULT_MESSAGES,
  RELOAD_ACTIVE_CHANNEL_AFTER_RECONNECT,
  GET_MESSAGES_ATTACHMENTS,
  GET_REACTIONS,
  LOAD_MORE_MESSAGES,
  LOAD_MORE_MESSAGES_ATTACHMENTS,
  LOAD_MORE_REACTIONS,
  PAUSE_ATTACHMENT_UPLOADING,
  queryDirection,
  RESEND_MESSAGE,
  RESUME_ATTACHMENT_UPLOADING,
  SEND_MESSAGE,
  SEND_TEXT_MESSAGE,
  GET_MESSAGE_MARKERS,
  ADD_POLL_VOTE,
  DELETE_POLL_VOTE,
  CLOSE_POLL,
  RETRACT_POLL_VOTE,
  GET_POLL_VOTES,
  LOAD_MORE_POLL_VOTES,
  RESEND_PENDING_POLL_ACTIONS,
  LOAD_OG_METADATA_FOR_LINK,
  FETCH_OG_METADATA
} from './constants'

import { IAction, IAttachment, IChannel, IMarker, IMessage, IPollOption, IPollVote } from '../../types'
import { getClient } from '../../common/client'
import {
  addChannelToAllChannels,
  getActiveChannelId,
  getChannelFromAllChannels,
  getChannelFromAllChannelsMap,
  getChannelFromMap,
  getDisableFrowardMentionsCount,
  getShowOwnMessageForward,
  query,
  removeChannelFromMap,
  setChannelInMap,
  updateChannelLastMessageOnAllChannels,
  updateChannelOnAllChannels
} from '../../helpers/channelHalper'
import {
  addAttachmentsAC,
  addAttachmentsForPopupAC,
  addMessagesAC,
  addReactionsToListAC,
  addReactionToListAC,
  addReactionToMessageAC,
  deleteReactionFromListAC,
  deleteReactionFromMessageAC,
  removeAttachmentProgressAC,
  scrollToNewMessageAC,
  setAttachmentsAC,
  setAttachmentsCompleteAC,
  setAttachmentsCompleteForPopupAC,
  setAttachmentsForPopupAC,
  setMessagesAC,
  setMessagesHasNextAC,
  setMessagesHasPrevAC,
  setLoadingNextMessagesStateAC,
  setLoadingPrevMessagesStateAC,
  setReactionsListAC,
  setReactionsLoadingStateAC,
  setScrollToMessagesAC,
  setMessageMarkersAC,
  updateAttachmentUploadingProgressAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC,
  patchMessagesAC,
  setMessagesMarkersLoadingStateAC,
  setPollVotesListAC,
  addPollVotesToListAC,
  setPollVotesLoadingStateAC,
  addPollVoteAC,
  deletePollVoteAC,
  closePollAC,
  retractPollVoteAC,
  deletePollVotesFromListAC,
  loadLatestMessagesAC,
  loadNearUnreadAC,
  removePendingPollActionAC,
  resendPendingPollActionsAC,
  updatePendingPollActionAC,
  setUnreadScrollToAC,
  setAttachmentsLoadingStateAC,
  setUpdateMessageAttachmentAC,
  setOGMetadataAC,
  fetchOGMetadataForLinkAC,
  setUnreadMessageIdAC
} from './actions'
import {
  attachmentTypes,
  DEFAULT_CHANNEL_TYPE,
  channelDetailsTabs,
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
  compareMessagesForList,
  compareMessageIds,
  setMessagesToMap,
  updateMessageOnMap,
  MESSAGES_MAX_LENGTH,
  MESSAGE_LOAD_DIRECTION,
  deletePendingAttachment,
  setPendingAttachment,
  removeReactionToMessageOnMap,
  sendMessageHandler,
  setPendingPollAction,
  checkPendingPollActionConflict,
  addMessageToMap,
  appendMessageToLatestSegment,
  getAllPendingFromMap,
  getFirstConfirmedMessageId,
  getMessageFromMap,
  getMessagesFromMap,
  getLatestMessagesFromMap,
  getLastConfirmedMessageId,
  getPendingMessagesFromMap,
  MESSAGES_MAX_PAGE_COUNT,
  messagesShareReference,
  getCenterTwoMessages,
  shouldReplaceLastMessage,
  setActiveSegment,
  extendActiveSegment,
  getActiveSegment,
  getContiguousPrevMessages,
  getContiguousNextMessages,
  hasPrevContiguousInMap,
  hasNextContiguousInMap,
  getCachedNearMessages,
  LOAD_MAX_MESSAGE_COUNT_PREFETCH,
  removeMessageFromMap
} from '../../helpers/messagesHalper'
import { navigateToLatest } from '../../helpers/messageListNavigator'
import { CONNECTION_STATUS } from '../user/constants'
import {
  customUpload,
  getCustomUploader,
  getSendAttachmentsAsSeparateMessages,
  pauseUpload,
  resumeUpload
} from '../../helpers/customUploader'
import { resizeImageWithPica } from '../../helpers/resizeImage'
import { setAttachmentToCache } from '../../helpers/attachmentsCache'
import store from '../index'
import { IProgress } from '../../components/ChatContainer'
import { canBeViewOnce, isJSON } from '../../helpers/message'
import { getMetadata, storeMetadata } from '../../services/indexedDB/metadataService'
import log from 'loglevel'
import { getVideoFirstFrame } from 'helpers/getVideoFrame'
import { MESSAGE_TYPE } from 'types/enum'
import { setWaitToSendPendingMessagesAC } from 'store/user/actions'
import { isResendableError } from 'helpers/error'
import { calculateRenderedImageWidth } from 'helpers'

const loadMoreMessagesInFlight = new Set<string>()
const prefetchInFlight = new Set<string>()
const queuedPrefetchRequests = new Map<string, { fromMessageId: string; pages: number }>()
const prefetchCompletionWaiters = new Map<string, Array<() => void>>()
const ACTIVE_CHANNEL_RECONNECT_REFRESH_TIMEOUT_MS = 1500
const MESSAGE_LIST_DEBUG_FLAG = '__SCEYT_DEBUG_MESSAGE_LIST__'

type ActivePaginationIntent = {
  channelId: string
  direction: 'prev' | 'next'
  requestId: string
  anchorId: string
} | null

type MessageListLoadScope = 'previous' | 'next' | 'both'

const getLoadMoreInFlightKey = (channelId: string, direction: string) => `${channelId}:${direction}`

const getActivePaginationIntent = (): ActivePaginationIntent =>
  store.getState().MessageReducer.activePaginationIntent || null

const isCurrentPaginationIntent = (channelId: string, direction: string, requestId?: string) => {
  if (!requestId) {
    return true
  }

  const activePaginationIntent = getActivePaginationIntent()
  if (!activePaginationIntent) {
    return false
  }

  return (
    activePaginationIntent.channelId === channelId &&
    activePaginationIntent.direction === direction &&
    activePaginationIntent.requestId === requestId
  )
}

function* setMessageListLoading(scope: MessageListLoadScope, state: number | null): any {
  if (scope === 'previous' || scope === 'both') {
    yield put(setLoadingPrevMessagesStateAC(state))
  }

  if (scope === 'next' || scope === 'both') {
    yield put(setLoadingNextMessagesStateAC(state))
  }
}

const shouldAdvancePrefetchAnchor = (direction: string, currentId: string, nextId: string) => {
  try {
    return direction === MESSAGE_LOAD_DIRECTION.PREV
      ? BigInt(nextId) < BigInt(currentId)
      : BigInt(nextId) > BigInt(currentId)
  } catch (_error) {
    return nextId !== currentId
  }
}

const queuePrefetchRequest = (key: string, direction: string, fromMessageId: string, pages: number) => {
  const existingRequest = queuedPrefetchRequests.get(key)
  if (!existingRequest) {
    queuedPrefetchRequests.set(key, { fromMessageId, pages })
    return
  }

  queuedPrefetchRequests.set(key, {
    fromMessageId: shouldAdvancePrefetchAnchor(direction, existingRequest.fromMessageId, fromMessageId)
      ? fromMessageId
      : existingRequest.fromMessageId,
    pages: Math.max(existingRequest.pages, pages)
  })
}

const waitForPrefetchCompletion = (key: string) =>
  new Promise<void>((resolve) => {
    const currentWaiters = prefetchCompletionWaiters.get(key) || []
    currentWaiters.push(resolve)
    prefetchCompletionWaiters.set(key, currentWaiters)
  })

const notifyPrefetchCompletion = (key: string) => {
  const waiters = prefetchCompletionWaiters.get(key)
  if (!waiters?.length) {
    return
  }

  prefetchCompletionWaiters.delete(key)
  waiters.forEach((resolve) => resolve())
}

const isChannelStillActive = (channelId: string) => {
  const activeChannelId = getActiveChannelId()
  return !activeChannelId || activeChannelId === channelId
}

const getReconnectReloadAction = (
  channel: IChannel,
  visibleAnchorId: string,
  wasViewingLatest: boolean,
  applyVisibleWindow: boolean
) => {
  if (visibleAnchorId) {
    return wasViewingLatest
      ? loadLatestMessagesAC(channel, undefined, false, 'instant', false, true, applyVisibleWindow)
      : {
          type: REFRESH_CACHE_AROUND_MESSAGE,
          payload: { channelId: channel.id, messageId: visibleAnchorId, applyVisibleWindow }
        }
  }

  if (wasViewingLatest) {
    return loadLatestMessagesAC(channel, undefined, false, 'instant', false, true, applyVisibleWindow)
  }

  if (channel.newMessageCount && channel.lastDisplayedMessageId) {
    return loadNearUnreadAC(channel)
  }

  return loadLatestMessagesAC(channel)
}

const getReconnectChannelSnapshot = (channelId: string): IChannel | null => {
  const mappedChannel = getChannelFromMap(channelId)
  if (mappedChannel?.id) {
    return mappedChannel
  }

  const allMappedChannel = getChannelFromAllChannelsMap(channelId)
  if (allMappedChannel?.id) {
    return allMappedChannel
  }

  const activeChannel = store.getState().ChannelReducer?.activeChannel
  if (activeChannel?.id === channelId) {
    return activeChannel
  }

  return null
}

const getReconnectChannelSignature = (channel: Partial<IChannel> | null | undefined) =>
  [
    channel?.id || '',
    channel?.newMessageCount ?? '',
    channel?.lastDisplayedMessageId || '',
    channel?.lastMessage?.id || '',
    channel?.lastMessage?.tid || '',
    channel?.lastMessage?.state || ''
  ].join('|')

const isMessageListDebugEnabled = () =>
  typeof globalThis !== 'undefined' && Boolean((globalThis as Record<string, unknown>)[MESSAGE_LIST_DEBUG_FLAG])

const getMessageWindowDebugSummary = (messages: IMessage[]) => ({
  count: messages.length,
  confirmedCount: messages.filter((message) => !!message.id).length,
  firstConfirmedId: getFirstConfirmedMessageId(messages) || '',
  lastConfirmedId: getLastConfirmedMessageId(messages) || '',
  firstId: messages[0]?.id || messages[0]?.tid || '',
  lastId: messages[messages.length - 1]?.id || messages[messages.length - 1]?.tid || ''
})

const debugMessageListSaga = (scope: string, payload: Record<string, unknown>) => {
  if (!isMessageListDebugEnabled()) {
    return
  }

  console.log(`[MessageListDebug][saga] ${scope}`, JSON.stringify(payload))
}

export const handleUploadAttachments = async (attachments: IAttachment[], message: IMessage, channel: IChannel) => {
  return await Promise.all(
    attachments.map(async (attachment) => {
      const handleUploadProgress = ({ loaded, total }: IProgress) => {
        store.dispatch(updateAttachmentUploadingProgressAC(loaded, total, attachment.tid))
      }
      const fileType = attachment.url.type.split('/')[0]
      let fileSize = attachment.size
      let filePath: any
      let uriLocal
      const handleUpdateLocalPath = (updatedLink: string) => {
        if (fileType === 'video') {
          filePath = updatedLink
        }
      }
      let blobLocal: Blob | null = null
      if (attachment.cachedUrl) {
        uriLocal = attachment.cachedUrl
        const dataSize = attachment.data?.size || 0
        store.dispatch(updateAttachmentUploadingProgressAC(dataSize, dataSize, attachment.tid))
      } else {
        const { uri, blob } = await customUpload(attachment, handleUploadProgress, message.type, handleUpdateLocalPath)
        uriLocal = uri
        blobLocal = blob
        if (blobLocal) {
          fileSize = blobLocal.size
          filePath = URL.createObjectURL(blobLocal)
        } else {
          log.warn('Upload returned null blob for attachment:', attachment.name)
        }
      }
      if (!attachment.cachedUrl && attachment.url.type.split('/')[0] === 'image') {
        try {
          if (blobLocal && blobLocal.type.startsWith('image/')) {
            // Use the original file for pica resize — blobLocal is already AWS-resized, re-resizing it degrades quality
            const file =
              attachment.url instanceof File
                ? attachment.url
                : new File([attachment.url], attachment.name || 'image', {
                    type: (attachment.url as File).type || blobLocal.type
                  })

            // Resize with Pica (high-quality resizing)
            const [newWidth, newHeight] = calculateRenderedImageWidth(
              attachment?.metadata.szw || 1280,
              attachment?.metadata.szh || 1080
            )
            const { blob: resizedBlob } = await resizeImageWithPica(file, newWidth, newHeight, 1)
            if (resizedBlob) {
              // Cache the resized image using the uploaded URI as the cache key
              const resizedResponse = new Response(resizedBlob, {
                headers: {
                  'Content-Type': resizedBlob.type || blobLocal.type
                }
              })
              await setAttachmentToCache(uriLocal, resizedResponse)
              filePath = URL.createObjectURL(resizedBlob)
              store.dispatch(setUpdateMessageAttachmentAC(uriLocal, filePath))
              message.attachments[0] = { ...message.attachments[0], attachmentUrl: filePath }
              setAttachmentToCache(
                uriLocal + `_original_image_url`,
                new Response(blobLocal, {
                  headers: {
                    'Content-Type': blobLocal.type
                  }
                })
              )
              const originalImageUrl = URL.createObjectURL(blobLocal)
              store.dispatch(setUpdateMessageAttachmentAC(uriLocal + `_original_image_url`, originalImageUrl))
            }
          }
        } catch (error) {
          log.error('Error resizing and caching image during upload:', error)
          // Continue even if caching fails
        }
      } else if (!attachment.cachedUrl && attachment.url.type.split('/')[0] === 'video') {
        if (blobLocal) {
          const [newWidth, newHeight] = calculateRenderedImageWidth(
            attachment?.metadata.szw || 1280,
            attachment?.metadata.szh || 1080
          )
          const result = await getVideoFirstFrame(blobLocal, newWidth, newHeight, 0.8)
          if (result) {
            const { frameBlobUrl, blob } = result
            if (frameBlobUrl && blob) {
              const response = new Response(blob, {
                headers: {
                  'Content-Type': blob.type
                }
              })
              if (blobLocal) {
                await setAttachmentToCache(
                  uriLocal + `_original_video_url`,
                  new Response(blobLocal, {
                    headers: {
                      'Content-Type': blobLocal.type
                    }
                  })
                )
                const originalVideoUrl = URL.createObjectURL(blobLocal)
                store.dispatch(setUpdateMessageAttachmentAC(uriLocal + `_original_video_url`, originalVideoUrl))
              }
              await setAttachmentToCache(uriLocal, response)
              store.dispatch(setUpdateMessageAttachmentAC(uriLocal, frameBlobUrl))
              message.attachments[0] = { ...message.attachments[0], attachmentUrl: frameBlobUrl }
            }
          }
        }
      }
      store.dispatch(updateAttachmentUploadingStateAC(UPLOAD_STATE.SUCCESS, attachment.tid))

      const parsedAttachmentMeta = (() => {
        if (!attachment.metadata) return {}
        try {
          const parsed = typeof attachment.metadata === 'string' ? JSON.parse(attachment.metadata) : attachment.metadata
          // Guard against double-stringified JSON (JSON.parse returning a string instead of object)
          return typeof parsed === 'string' ? JSON.parse(parsed) : parsed || {}
        } catch {
          return {}
        }
      })()
      const attachmentMeta = attachment.cachedUrl
        ? attachment.metadata
        : JSON.stringify({
            ...parsedAttachmentMeta
          })
      const attachmentBuilder = channel.createAttachmentBuilder(uriLocal, attachment.type)
      const attachmentToSend = attachmentBuilder
        .setName(attachment.name)
        .setMetadata(attachmentMeta)
        .setFileSize(fileSize || attachment.size)
        .setUpload(false)
        .create()
      // Preserve the original tid so currentAttachmentsMap lookup works after sendMessage
      if (attachment.tid) {
        attachmentToSend.tid = attachment.tid
      }
      return attachmentToSend
    })
  )
}

const addPendingMessage = (message: any, messageCopy: IMessage, channelId: string) => {
  const messageToAdd = {
    ...messageCopy,
    createdAt: new Date(Date.now()),
    mentionedUsers: message.mentionedUsers,
    parentMessage: message.parentMessage
  }
  addMessageToMap(channelId, messageToAdd)
}

const addConfirmedMessageToCache = (channelId: string, message: IMessage) => {
  addMessageToMap(channelId, message)
  appendMessageToLatestSegment(channelId, message.id)
}

const getStoredChannel = (channelId: string): IChannel | null =>
  getChannelFromMap(channelId) ||
  getChannelFromAllChannels(channelId) ||
  getChannelFromAllChannelsMap(channelId) ||
  null

const shouldReplaceChannelLastMessage = (
  channelId: string,
  nextLastMessage: IMessage,
  sourceMessage?: IMessage | null
) => {
  return shouldReplaceLastMessage(getStoredChannel(channelId)?.lastMessage, nextLastMessage, sourceMessage)
}

const getResolvedChannelLastMessage = (
  channelId: string,
  nextLastMessage: IMessage,
  sourceMessage?: IMessage | null
) => {
  const currentLastMessage = getStoredChannel(channelId)?.lastMessage
  if (!nextLastMessage?.id) {
    return currentLastMessage?.id ? currentLastMessage : null
  }

  if (shouldReplaceChannelLastMessage(channelId, nextLastMessage, sourceMessage)) {
    return nextLastMessage
  }

  return currentLastMessage?.id ? currentLastMessage : null
}

const getResolvedChannelUpdateData = (channelId: string, channelUpdateData: Partial<IChannel>) => {
  if (!channelUpdateData.lastMessage) {
    return channelUpdateData
  }

  const { lastMessage, ...restChannelUpdateData } = channelUpdateData
  const resolvedLastMessage = getResolvedChannelLastMessage(channelId, lastMessage, lastMessage)

  if (!lastMessageNeedsUpdate(getStoredChannel(channelId)?.lastMessage, resolvedLastMessage)) {
    return restChannelUpdateData
  }

  return {
    ...restChannelUpdateData,
    lastMessage: resolvedLastMessage
  }
}

const lastMessageNeedsUpdate = (
  currentLastMessage: IMessage | null | undefined,
  nextLastMessage: IMessage | null | undefined
) => {
  if (!nextLastMessage) {
    return false
  }

  if (!currentLastMessage) {
    return true
  }

  return !(
    messagesShareReference(currentLastMessage, nextLastMessage) &&
    currentLastMessage.id === nextLastMessage.id &&
    currentLastMessage.tid === nextLastMessage.tid &&
    currentLastMessage.state === nextLastMessage.state &&
    currentLastMessage.deliveryStatus === nextLastMessage.deliveryStatus
  )
}

const updateMessage = function* (
  actionType: string,
  pending: IMessage,
  channelId: string,
  scrollToNewMessage: boolean = true,
  message: IMessage,
  _isNotShowOwnMessageForward: boolean = false
): any {
  if (actionType !== RESEND_MESSAGE) {
    addPendingMessage(message, pending, channelId)
    if (getActiveChannelId() === channelId) {
      yield put(setUnreadMessageIdAC(''))
    }
    if (scrollToNewMessage) {
      navigateToLatest(true)
    }
  }
}

const syncFailedMessageState = function* (
  channel: IChannel,
  messageId: string,
  message: IMessage,
  shouldKeepInMap: boolean
): any {
  if (shouldKeepInMap) {
    updateMessageOnMap(channel.id, {
      messageId,
      params: { state: MESSAGE_STATUS.FAILED }
    })
  } else {
    removeMessageFromMap(channel.id, messageId)
  }

  const activeChannelId = getActiveChannelId()
  if (activeChannelId === channel.id) {
    yield put(updateMessageAC(messageId, { state: MESSAGE_STATUS.FAILED }))
  }

  const failedMessage = {
    ...message,
    state: MESSAGE_STATUS.FAILED
  }
  const resolvedLastMessage = getResolvedChannelLastMessage(channel.id, failedMessage, message)
  if (lastMessageNeedsUpdate(getStoredChannel(channel.id)?.lastMessage, resolvedLastMessage)) {
    updateChannelLastMessageOnAllChannels(channel.id, resolvedLastMessage!)
    const channelUpdateParam = {
      lastMessage: resolvedLastMessage,
      lastReactedMessage: null
    }
    yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
    updateChannelOnAllChannels(channel.id, channelUpdateParam)
  }
}

function* sendMessage(action: IAction): any {
  // let messageForCatch = {}
  const { payload } = action
  const { message, connectionState, channelId, sendAttachmentsAsSeparateMessage } = payload
  const pendingMessages: IMessage[] = []
  try {
    let channel: IChannel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)!
      if (channel) {
        setChannelInMap(channel)
      }
      if (!channel) {
        channel = getChannelFromAllChannelsMap(channelId)!
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
      addChannelToAllChannels(channel)
      setChannelInMap(channel)
    }
    yield put(addChannelAC(JSON.parse(JSON.stringify(channel))))
    const mentionedUserIds = message.mentionedUsers ? message.mentionedUsers.map((member: any) => member.id) : []
    // let attachmentsToSend: IAttachment[] = []
    const customUploader = getCustomUploader()

    if (message.attachments && message.attachments.length) {
      let linkAttachment = null
      const attachmentsToSend: any = []
      const messagesToSend: IMessage[] = []

      linkAttachment = message.attachments.find((a: IAttachment) => a.type === attachmentTypes.link)

      const mediaAttachments = message.attachments.filter((att: IAttachment) => att.type !== attachmentTypes.link)
      if (mediaAttachments && mediaAttachments.length) {
        for (let i = 0; i < mediaAttachments.length; i++) {
          let attachment = mediaAttachments[i]

          let uri
          if (attachment.cachedUrl) {
            uri = attachment.cachedUrl
          }
          const attachmentBuilder = channel.createAttachmentBuilder(uri || attachment.data, attachment.type)

          const messageAttachment = attachmentBuilder
            .setName(attachment.name)
            .setMetadata(attachment.metadata)
            .setUpload(customUploader ? false : attachment.upload)
            .setFileSize(attachment.size)
            .create()

          if (!customUploader) {
            const handleUpdateUploadProgress = (percent: number) => {
              store.dispatch(
                updateAttachmentUploadingProgressAC(attachment.size * (percent / 100), attachment.size, attachment.tid)
              )
            }
            if (attachment.upload) {
              store.dispatch(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, attachment.tid))
            }
            messageAttachment.progress = (progressPercent: any) => {
              handleUpdateUploadProgress(progressPercent)
              // attachmentsListeners.progress(progressPercent, attachment.tid);
            }
            messageAttachment.completion = (updatedAttachment: any, error: any) => {
              if (error) {
                log.info('fail to upload attachment ... ', error)
                store.dispatch(updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, attachment.tid))
              } else {
                const uriLocal = updatedAttachment.url
                const fileType = attachment.data?.type?.split('/')[0]

                const updateImage = async () => {
                  if (!attachment.cachedUrl && fileType === 'image' && attachment.data) {
                    try {
                      const parsedMetadata = isJSON(attachment.metadata)
                        ? JSON.parse(attachment.metadata)
                        : attachment.metadata
                      const [newWidth, newHeight] = calculateRenderedImageWidth(
                        parsedMetadata?.szw || 1280,
                        parsedMetadata?.szh || 1080
                      )
                      const file =
                        attachment.data instanceof File
                          ? attachment.data
                          : new File([attachment.data], attachment.name || 'image', { type: attachment.data.type })
                      const { blob: resizedBlob } = await resizeImageWithPica(file, newWidth, newHeight, 1)
                      if (resizedBlob) {
                        await setAttachmentToCache(
                          uriLocal,
                          new Response(resizedBlob, { headers: { 'Content-Type': resizedBlob.type || file.type } })
                        )
                        const resizedUrl = URL.createObjectURL(resizedBlob)
                        store.dispatch(setUpdateMessageAttachmentAC(uriLocal, resizedUrl))
                        setAttachmentToCache(
                          uriLocal + '_original_image_url',
                          new Response(file, { headers: { 'Content-Type': file.type } })
                        )
                        store.dispatch(
                          setUpdateMessageAttachmentAC(uriLocal + '_original_image_url', URL.createObjectURL(file))
                        )
                      }
                    } catch (err) {
                      log.error('Error caching resized image on upload completion:', err)
                    }
                  } else if (!attachment.cachedUrl && fileType === 'video' && attachment.data) {
                    try {
                      const parsedMetadata = isJSON(attachment.metadata)
                        ? JSON.parse(attachment.metadata)
                        : attachment.metadata
                      const [newWidth, newHeight] = calculateRenderedImageWidth(
                        parsedMetadata?.szw || 1280,
                        parsedMetadata?.szh || 1080
                      )
                      const result = await getVideoFirstFrame(attachment.data, newWidth, newHeight, 0.8)
                      if (result) {
                        const { frameBlobUrl, blob } = result
                        await setAttachmentToCache(
                          uriLocal,
                          new Response(blob, { headers: { 'Content-Type': blob.type } })
                        )
                        store.dispatch(setUpdateMessageAttachmentAC(uriLocal, frameBlobUrl))
                        if (attachment.data) {
                          await setAttachmentToCache(
                            uriLocal + '_original_video_url',
                            new Response(attachment.data, {
                              headers: { 'Content-Type': attachment.data.type || 'video/mp4' }
                            })
                          )
                          store.dispatch(setUpdateMessageAttachmentAC(uriLocal + '_original_video_url', uriLocal))
                        }
                      }
                    } catch (err) {
                      log.error('Error caching video frame on upload completion:', err)
                    }
                  }
                }
                updateImage()

                store.dispatch(removeAttachmentProgressAC(attachment.tid))
                deletePendingAttachment(attachment.tid)
                store.dispatch(updateAttachmentUploadingStateAC(UPLOAD_STATE.SUCCESS, attachment.tid))
              }
            }
          } else if (customUploader && attachment) {
            attachment = {
              ...attachment,
              url: attachment.data
            }
          }

          // not for SDK, for displaying attachments and their progress
          messageAttachment.tid = attachment.tid

          if (customUploader) {
            messageAttachment.url = attachment.data
          }

          if (sendAttachmentsAsSeparateMessage) {
            const messageBuilder = channel.createMessageBuilder()
            messageBuilder
              .setBody(i === 0 ? message.body : '')
              .setAttachments([])
              .setBodyAttributes(i === 0 ? message.bodyAttributes : {})
              .setMentionUserIds(i === 0 ? mentionedUserIds : [])
              .setType(message.type)
              .setDisplayCount(message.type === MESSAGE_TYPE.SYSTEM ? 0 : 1)
              .setSilent(message.type === MESSAGE_TYPE.SYSTEM)
              .setMetadata(i === 0 ? JSON.stringify(message.metadata) : '')
            if (message.parentMessage) {
              messageBuilder.setParentMessageId(message.parentMessage ? message.parentMessage.id : null)
            }
            if (message.repliedInThread) {
              messageBuilder.setReplyInThread()
            }
            // Set view-once only for first message with exactly 1 image/video/voice attachment
            if (i === 0 && canBeViewOnce(message)) {
              messageBuilder.setViewOnce(true)
              messageBuilder.setType(MESSAGE_TYPE.VIEW_ONCE)
            }
            const messageToSend = action.type === RESEND_MESSAGE ? action.payload.message : messageBuilder.create()
            setPendingAttachment(messageAttachment.tid as string, {
              ...messageAttachment.data,
              messageTid: messageToSend.tid,
              channelId: channel.id
            })
            const messageForSend = {
              ...messageToSend,
              attachments: [messageAttachment],
              createdAt: new Date(Date.now())
            }

            messagesToSend.push(messageForSend)
            const pending = {
              ...messageForSend,
              attachments: [attachment],
              createdAt: new Date(Date.now()),
              mentionedUsers: message.mentionedUsers,
              parentMessage: message.parentMessage || null
            }
            pendingMessages.push(pending)
            if (action.type !== RESEND_MESSAGE) {
              yield call(loadOGMetadataForLinkMessages, [pending], true, false, false)
              yield call(updateMessage, action.type, pending, channel.id, true, message)
            }
          } else {
            attachmentsToSend.push(messageAttachment)
          }
          if (!messageAttachment.cachedUrl && customUploader) {
            yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, messageAttachment.tid))
          }
        }

        if (!sendAttachmentsAsSeparateMessage) {
          const messageBuilder = channel.createMessageBuilder()
          messageBuilder
            .setBody(message.body)
            .setBodyAttributes(message.bodyAttributes)
            .setAttachments(message.attachments)
            .setMentionUserIds(mentionedUserIds)
            .setType(message.type)
            .setDisplayCount(message.type === MESSAGE_TYPE.SYSTEM ? 0 : 1)
            .setSilent(message.type === MESSAGE_TYPE.SYSTEM)
            .setMetadata(JSON.stringify(message.metadata))

          if (message.parentMessage) {
            messageBuilder.setParentMessageId(message.parentMessage ? message.parentMessage.id : null)
          }

          if (message.repliedInThread) {
            messageBuilder.setReplyInThread()
          }

          // Set view-once if message has viewOnce flag and exactly 1 image/video/voice attachment
          if (canBeViewOnce(message)) {
            messageBuilder.setViewOnce(true)
            messageBuilder.setType(MESSAGE_TYPE.VIEW_ONCE)
          }

          let messageToSend = action.type === RESEND_MESSAGE ? action.payload.message : messageBuilder.create()
          const pending = {
            ...messageToSend,
            attachments: message.attachments,
            createdAt: new Date(Date.now()),
            mentionedUsers: message.mentionedUsers,
            parentMessage: message.parentMessage || null
          }
          pendingMessages.push(pending)
          if (action.type !== RESEND_MESSAGE) {
            yield call(loadOGMetadataForLinkMessages, [pending], true, false, false)
            yield call(updateMessage, action.type, pending, channel.id, true, message)
          }

          messageToSend = { ...messageToSend, attachments: attachmentsToSend }
          messagesToSend.push(messageToSend)
        }
      }

      for (let i = 0; i < messagesToSend.length; i++) {
        const messageAttachment = messagesToSend[i].attachments
        let messageToSend = messagesToSend[i]

        if (action.type === RESEND_MESSAGE) {
          // Clear the failed state while re-uploading so the UI shows uploading progress
          const pendingState = { state: MESSAGE_STATUS.UNMODIFIED }
          updateMessageOnMap(channel.id, { messageId: messageToSend.tid!, params: pendingState })
          yield put(updateMessageAC(messageToSend.tid!, pendingState))
          // Also clear it on the local variable so the SDK doesn't echo "failed" back in the response
          messageToSend = { ...messageToSend, ...pendingState }
        }

        try {
          const messageCopy = JSON.parse(JSON.stringify(messagesToSend[i]))
          if (connectionState === CONNECTION_STATUS.CONNECTED) {
            let attachmentsToSend = messageAttachment
            if (customUploader) {
              attachmentsToSend = yield call(handleUploadAttachments, messageAttachment || [], messageCopy, channel)
            }
            let linkAttachmentToSend: IAttachment | null = null
            if (i === 0 && linkAttachment) {
              const linkAttachmentBuilder = channel.createAttachmentBuilder(linkAttachment.data, linkAttachment.type)
              linkAttachmentToSend = linkAttachmentBuilder
                .setName(linkAttachment.name)
                .setUpload(linkAttachment.upload)
                .create()
            }
            if (linkAttachmentToSend) {
              messageToSend = { ...messageToSend, attachments: [...attachmentsToSend, linkAttachmentToSend] }
            } else {
              messageToSend = { ...messageToSend, attachments: [...attachmentsToSend] }
            }

            const messageResponse = yield call(channel.sendMessage, messageToSend)
            if (customUploader) {
              for (let k = 0; k < messageAttachment.length; k++) {
                messageResponse.attachments[k] = {
                  ...messageResponse.attachments[k],
                  user: JSON.parse(JSON.stringify(messageResponse.user)),
                  tid: messageAttachment[k].tid as string
                }
                yield put(removeAttachmentProgressAC(messageAttachment[k].tid))
                deletePendingAttachment(messageAttachment[k].tid!)
              }
            }
            let attachmentsToUpdate = []
            if (messageResponse.attachments && messageResponse.attachments.length > 0) {
              const currentAttachmentsMap: { [key: string]: IAttachment } = {}
              attachmentsToSend.forEach((attachment: IAttachment) => {
                currentAttachmentsMap[attachment.tid!] = attachment
              })
              attachmentsToUpdate = messageResponse.attachments.map((attachment: IAttachment) => {
                const localAttachment = currentAttachmentsMap[attachment.tid!]

                // Preserve local metadata (especially size) when the server response
                // does not yet contain it or reports it as 0. This avoids showing
                // "0 Bytes" in the UI until the backend has finalized attachment size.
                if (localAttachment && attachment.type !== attachmentTypes.voice) {
                  const merged: IAttachment = {
                    ...attachment
                  }

                  if (!+merged.size && localAttachment.size) {
                    merged.size = localAttachment.size
                  }

                  return merged
                } else if (attachment.type === attachmentTypes.voice) {
                  return { ...attachment }
                }
                return attachment
              })
            }
            const messageUpdateData = {
              ...messageResponse,
              attachments: attachmentsToUpdate,
              channelId: channel.id
            }
            const activeChannelId = getActiveChannelId()
            if (activeChannelId === channel.id) {
              yield put(updateMessageAC(messageToSend.tid as string, messageUpdateData, true))
            }
            const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
            addConfirmedMessageToCache(channel.id, messageToUpdate)
            if (channel.unread) {
              yield put(markChannelAsReadAC(channel.id))
            }
            const resolvedLastMessage = getResolvedChannelLastMessage(channel.id, messageToUpdate, messageToSend)
            if (lastMessageNeedsUpdate(getStoredChannel(channel.id)?.lastMessage, resolvedLastMessage)) {
              updateChannelLastMessageOnAllChannels(channel.id, resolvedLastMessage!)
              const channelUpdateParam = {
                lastMessage: resolvedLastMessage,
                lastReactedMessage: null
              }
              yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
              updateChannelOnAllChannels(channel.id, channelUpdateParam)
            }
          } else {
            throw new Error('Connection required to send message')
          }
        } catch (e) {
          const isErrorResendable = isResendableError(e?.type)
          if (channel?.id && messageToSend?.tid) {
            log.error('Error on uploading attachment', messageToSend.tid, e)
            if (messageToSend.attachments?.length) {
              for (const att of messageToSend.attachments) {
                if (att.tid) yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, att.tid))
              }
            }
            yield call(
              syncFailedMessageState,
              channel,
              messageToSend.tid!,
              pendingMessages[i] || messageToSend,
              isErrorResendable
            )
          }
        }
      }
    }
  } catch (e) {
    log.error('error on send message ... ', e)
    // yield put(setErrorNotification(`${e.message} ${e.code}`));
  }
}

// const msgCount = 1
function* sendTextMessage(action: IAction): any {
  // let messageForCatch = {}
  const { payload } = action
  const { message, connectionState, channelId } = payload
  let channel: IChannel = yield call(getChannelFromMap, channelId)
  if (!channel) {
    channel = getChannelFromAllChannels(channelId)!
    if (channel) {
      setChannelInMap(channel)
    }
    if (!channel) {
      channel = getChannelFromAllChannelsMap(channelId)!
    }
  }

  let sendMessageTid: string | null = null
  let pendingMessage: IMessage | null = null

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
      addChannelToAllChannels(channel)
      setChannelInMap(channel)
    }
    yield put(addChannelAC(JSON.parse(JSON.stringify(channel))))
    const mentionedUserIds = message.mentionedUsers ? message.mentionedUsers.map((member: any) => member.id) : []
    let attachments = message.attachments
    if (message.attachments && message.attachments.length) {
      const attachmentBuilder = channel.createAttachmentBuilder(attachments[0].data, attachments[0].type)
      attachmentBuilder.setMetadata(JSON.stringify(attachments[0].metadata))
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
      .setDisplayCount(
        message?.displayCount !== undefined ? message.displayCount : message.type === MESSAGE_TYPE.SYSTEM ? 0 : 1
      )
      .setSilent(message?.silent !== undefined ? message.silent : message.type === MESSAGE_TYPE.SYSTEM)
      .setMetadata(JSON.stringify(message.metadata))
      .setPollDetails(message.pollDetails ? message.pollDetails : null)
    if (message.parentMessage) {
      messageBuilder.setParentMessageId(message.parentMessage ? message.parentMessage.id : null)
    }
    if (message.repliedInThread) {
      messageBuilder.setReplyInThread()
    }
    const createdMessage = action.type === RESEND_MESSAGE ? action.payload.message : messageBuilder.create()
    const messageToSend = {
      ...createdMessage,
      ...(action.type === RESEND_MESSAGE ? { attachments: message?.attachments, state: MESSAGE_STATUS.UNMODIFIED } : {})
    }
    pendingMessage = {
      ...messageToSend,
      createdAt: new Date(Date.now()),
      mentionedUsers: message.mentionedUsers,
      parentMessage: message.parentMessage
    }
    sendMessageTid = messageToSend.tid
    if (pendingMessage && pendingMessage.metadata) {
      pendingMessage.metadata = JSON.parse(pendingMessage.metadata)
    }
    if (pendingMessage) {
      if (action.type !== RESEND_MESSAGE) {
        yield call(loadOGMetadataForLinkMessages, [pendingMessage], true, true, false)
        yield call(updateMessage, action.type, pendingMessage, channel.id, true, message)
      }
    }
    if (connectionState === CONNECTION_STATUS.CONNECTED) {
      let messageResponse
      if (sendMessageHandler) {
        messageResponse = yield call(sendMessageHandler, messageToSend, channel.id)
      } else {
        messageResponse = yield call(channel.sendMessage, messageToSend)
      }
      const messageUpdateData = {
        ...messageResponse,
        channelId: channel.id
      }
      const activeChannelId = getActiveChannelId()
      if (activeChannelId === channel.id) {
        yield put(updateMessageAC(messageToSend.tid, messageUpdateData, true))
      }
      const stringifiedMessageUpdateData = JSON.parse(JSON.stringify(messageUpdateData))
      yield put(updatePendingPollActionAC(messageToSend.tid as string, stringifiedMessageUpdateData))
      addConfirmedMessageToCache(channel.id, stringifiedMessageUpdateData)
      const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
      if (channel.unread) {
        yield put(markChannelAsReadAC(channel.id))
      }
      const resolvedLastMessage = getResolvedChannelLastMessage(channel.id, messageToUpdate, messageToSend)
      if (lastMessageNeedsUpdate(getStoredChannel(channel.id)?.lastMessage, resolvedLastMessage)) {
        updateChannelLastMessageOnAllChannels(channel.id, resolvedLastMessage!)
        // yield put(updateChannelLastMessageAC(messageToUpdate, { id: channel.id } as IChannel))
        const channelUpdateParam = {
          lastMessage: resolvedLastMessage,
          lastReactedMessage: null
        }
        yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
        updateChannelOnAllChannels(channel.id, channelUpdateParam)
        channel.lastMessage = resolvedLastMessage!
      }
    } else {
      // eslint-disable-next-line
      throw new Error('Connection required to send message')
    }

    // messageForCatch = messageToSend
  } catch (e) {
    log.error('error on send text message ... ', e?.type, e)
    const isErrorResendable = isResendableError(e?.type)
    if (channel?.id && sendMessageTid) {
      yield call(
        syncFailedMessageState,
        channel,
        sendMessageTid,
        pendingMessage || {
          ...message,
          tid: sendMessageTid
        },
        isErrorResendable
      )
    }
    // yield put(setErrorNotification(`${e.message} ${e.code}`));
  }
}

function* forwardMessage(action: IAction): any {
  const { payload } = action
  const { message, channelId, connectionState, isForward } = payload
  const showOwnMessageForward = getShowOwnMessageForward()
  const SceytChatClient = getClient()
  const isNotShowOwnMessageForward = message?.user?.id === SceytChatClient.user.id && !showOwnMessageForward
  let pendingMessage: IMessage | null = null
  let channel: IChannel | null = null
  const activeChannelId = getActiveChannelId()
  let messageTid: string | null = null
  try {
    channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId) || null
      if (!channel) {
        const SceytChatClient = getClient()
        channel = yield call(SceytChatClient.getChannel, channelId)
      }
      if (channel) {
        setChannelInMap(channel)
      }
      if (!channel) {
        channel = getChannelFromAllChannelsMap(channelId)!
      }
    }
    if (!channel) {
      throw new Error('Channel not found')
    }
    const mentionedUserIds = message.mentionedUsers ? message.mentionedUsers.map((member: any) => member.id) : []
    let attachments = message.attachments
    if (
      !(
        (channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC) &&
        !(channel.userRole === 'admin' || channel.userRole === 'owner')
      )
    ) {
      if (message.attachments && message.attachments.length && action.type !== RESEND_MESSAGE) {
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
      let pollDetails = null
      if (message.pollDetails) {
        // should make empty and new ids poll details
        pollDetails = {
          id: uuidv4(),
          name: message.pollDetails.name,
          description: message.pollDetails.description || '',
          options: message.pollDetails.options.map((option: IPollOption) => ({
            id: uuidv4(),
            name: option.name
          })),
          anonymous: message.pollDetails.anonymous,
          allowMultipleVotes: message.pollDetails.allowMultipleVotes,
          allowVoteRetract: message.pollDetails.allowVoteRetract
        }
      }
      if (action.type !== RESEND_MESSAGE) {
        messageBuilder
          .setBody(message.body)
          .setBodyAttributes(message.bodyAttributes)
          .setAttachments(attachments)
          .setMentionUserIds(mentionedUserIds)
          .setType(message.type)
          .setDisableMentionsCount(getDisableFrowardMentionsCount())
          .setMetadata(
            message.metadata ? (isJSON(message.metadata) ? message.metadata : JSON.stringify(message.metadata)) : ''
          )
          .setForwardingMessageId(message.forwardingDetails ? message.forwardingDetails.messageId : message.id)
          .setPollDetails(pollDetails)
      }
      const messageToSend =
        action.type === RESEND_MESSAGE
          ? { ...action.payload.message, attachments: message.attachments }
          : messageBuilder.create()
      messageTid = messageToSend.tid
      pendingMessage = {
        ...messageToSend,
        createdAt: new Date(Date.now()),
        user: message.user
      }
      if (isForward && pendingMessage && action.type !== RESEND_MESSAGE) {
        if (message.forwardingDetails) {
          pendingMessage.forwardingDetails!.user = message.forwardingDetails.user
          pendingMessage.forwardingDetails!.channelId = message.forwardingDetails.channelId
        } else {
          pendingMessage.forwardingDetails!.user = message.user
          pendingMessage.forwardingDetails!.channelId = channelId
        }
        pendingMessage.forwardingDetails!.hops = message.forwardingDetails ? message.forwardingDetails.hops : 1
      }

      if (pendingMessage) {
        if (action.type !== RESEND_MESSAGE) {
          yield call(loadOGMetadataForLinkMessages, [pendingMessage], true, false, false)
          yield call(
            updateMessage,
            action.type,
            pendingMessage,
            channel.id,
            channelId === activeChannelId,
            message,
            isNotShowOwnMessageForward
          )
        }
      }
      if (connectionState === CONNECTION_STATUS.CONNECTED) {
        const messageResponse = yield call(channel.sendMessage, {
          ...messageToSend,
          ...(isNotShowOwnMessageForward ? { forwardingDetails: null } : {})
        })
        const messageUpdateData = {
          ...messageResponse,
          channelId: channel.id
        }
        if (channelId === activeChannelId) {
          yield put(updateMessageAC(messageToSend.tid, JSON.parse(JSON.stringify(messageUpdateData)), true))
        }
        addConfirmedMessageToCache(channel.id, JSON.parse(JSON.stringify(messageUpdateData)))
        const messageToUpdate = JSON.parse(JSON.stringify(messageResponse))
        if (channel.unread) {
          yield put(markChannelAsReadAC(channel.id))
        }
        const resolvedLastMessage = getResolvedChannelLastMessage(channel.id, messageToUpdate, messageToSend)
        if (lastMessageNeedsUpdate(getStoredChannel(channel.id)?.lastMessage, resolvedLastMessage)) {
          updateChannelLastMessageOnAllChannels(channel.id, resolvedLastMessage!)
          const channelUpdateParam = {
            lastMessage: resolvedLastMessage,
            lastReactedMessage: null
          }
          yield put(updateChannelDataAC(channel.id, channelUpdateParam, true))
          updateChannelOnAllChannels(channel.id, channelUpdateParam)
        }
      } else {
        throw new Error('Connection required to forward message')
      }
    }
  } catch (e) {
    const isErrorResendable = isResendableError(e?.type)
    if (channel?.id && messageTid) {
      yield call(
        syncFailedMessageState,
        channel,
        messageTid,
        pendingMessage || {
          ...message,
          tid: messageTid
        },
        isErrorResendable
      )
    }
    log.error('error on forward message ... ', e)
  }
}

function* resendMessage(action: IAction): any {
  const { payload } = action
  const { message, connectionState, channelId } = payload
  const attachments = message?.attachments?.filter((att: IAttachment) => att?.type !== attachmentTypes.link)

  if (message.forwardingDetails) {
    yield call(forwardMessage, {
      type: RESEND_MESSAGE,
      payload: { message, connectionState, channelId, isForward: false }
    })
  } else if (attachments && attachments.length) {
    const sendAttachmentsAsSeparateMessage = getSendAttachmentsAsSeparateMessages()
    const isVoiceMessage = message.attachments[0].type === attachmentTypes.voice
    yield call(sendMessage, {
      type: RESEND_MESSAGE,
      payload: {
        message,
        connectionState,
        channelId,
        sendAttachmentsAsSeparateMessage: isVoiceMessage ? false : sendAttachmentsAsSeparateMessage
      }
    })
  } else {
    yield call(sendTextMessage, {
      type: RESEND_MESSAGE,
      payload: { message, connectionState, channelId }
    })
  }
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
    yield put(updateMessageAC(deletedMessage.id, deletedMessage))
    updateMessageOnMap(channel.id, {
      messageId: deletedMessage.id,
      params: deletedMessage
    })

    const messageToUpdate = JSON.parse(JSON.stringify(deletedMessage))
    if (channel.lastMessage.id === messageId) {
      updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
      yield put(updateChannelLastMessageAC(messageToUpdate, channel))
    }
  } catch (e) {
    log.error('ERROR in delete message', e.message)
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
    if (message.attachments.length > 0) {
      const linkAttachments = message.attachments.filter((att: IAttachment) => att.type === attachmentTypes.link)
      const anotherAttachments = message.attachments.filter((att: IAttachment) => att.type !== attachmentTypes.link)
      const linkAttachmentsToSend: IAttachment[] = []
      linkAttachments.forEach((linkAttachment: IAttachment) => {
        const linkAttachmentBuilder = channel.createAttachmentBuilder(linkAttachment.data, linkAttachment.type)
        const linkAttachmentToSend = linkAttachmentBuilder
          .setName(linkAttachment.name)
          .setUpload(linkAttachment.upload)
          .create()
        linkAttachmentsToSend.push(linkAttachmentToSend)
      })
      message.attachments = [...anotherAttachments, ...linkAttachmentsToSend]
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
    if (channel.lastMessage.id === message.id) {
      const messageToUpdate = JSON.parse(JSON.stringify(editedMessage))
      updateChannelLastMessageOnAllChannels(channel.id, messageToUpdate)
      yield put(updateChannelLastMessageAC(messageToUpdate, channel))
    }
  } catch (e) {
    log.error('ERROR in edit message', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

const sendPendingMessages = function* (connectionState: string) {
  const pendingMessagesMap = getAllPendingFromMap()
  for (const channelId in pendingMessagesMap) {
    for (const msg of pendingMessagesMap[channelId]) {
      const attachments = msg?.attachments?.filter((att: IAttachment) => att?.type !== attachmentTypes.link)

      try {
        if (msg?.forwardingDetails) {
          yield call(forwardMessage, {
            type: RESEND_MESSAGE,
            payload: { message: msg, connectionState, channelId, isForward: true }
          })
        } else if (attachments && attachments.length > 0) {
          yield call(sendMessage, {
            type: RESEND_MESSAGE,
            payload: {
              message: msg,
              connectionState,
              channelId,
              sendAttachmentsAsSeparateMessage: false
            }
          })
        } else {
          yield call(sendTextMessage, {
            type: RESEND_MESSAGE,
            payload: { message: msg, connectionState, channelId }
          })
        }
      } catch (error) {
        log.error(`Failed to send pending message ${msg.tid || msg.id}:`, error)
        // Continue with next message even if this one fails
      }
    }
  }

  const pendingPollActionsMap = store.getState().MessageReducer.pendingPollActions
  if (pendingPollActionsMap && Object.keys(pendingPollActionsMap).length > 0) {
    yield put(resendPendingPollActionsAC(connectionState))
  }
}

const shouldAppendPendingMessages = (
  channelOrId: IChannel | string | null | undefined,
  messages: IMessage[],
  options?: { isLatestWindow?: boolean; hasNext?: boolean }
) => {
  const channelId = typeof channelOrId === 'string' ? channelOrId : channelOrId?.id
  if (!channelId) {
    return false
  }

  if (options?.isLatestWindow) {
    return true
  }

  if (options && options.hasNext === false) {
    return true
  }

  const lastConfirmedMessageId = getLastConfirmedMessageId(messages)
  const latestConfirmedMessageId =
    typeof channelOrId === 'string' ? getStoredChannel(channelOrId)?.lastMessage?.id : channelOrId?.lastMessage?.id

  return !!lastConfirmedMessageId && !!latestConfirmedMessageId && lastConfirmedMessageId === latestConfirmedMessageId
}

const getFilteredPendingMessages = (
  channelOrId: IChannel | string | null | undefined,
  messages: IMessage[],
  options?: { isLatestWindow?: boolean; hasNext?: boolean }
) => {
  let filteredPendingMessages: IMessage[] = []
  const channelId = typeof channelOrId === 'string' ? channelOrId : channelOrId?.id
  if (!channelId || !shouldAppendPendingMessages(channelOrId, messages, options)) {
    return filteredPendingMessages
  }

  const pendingMessages = JSON.parse(JSON.stringify(getPendingMessagesFromMap(channelId)))
  if (pendingMessages && pendingMessages.length) {
    const messagesMap: { [key: string]: IMessage } = {}
    messages.forEach((msg) => {
      messagesMap[msg.tid || ''] = msg
    })
    filteredPendingMessages = pendingMessages.filter((msg: IMessage) => !messagesMap[msg.tid || ''])
  }
  return filteredPendingMessages
}

const confirmedWindowIds = (messages: IMessage[]) =>
  messages.filter((message) => !!message.id).map((message) => message.id)

const sameConfirmedWindow = (leftMessages: IMessage[], rightMessages: IMessage[]) => {
  const leftIds = confirmedWindowIds(leftMessages)
  const rightIds = confirmedWindowIds(rightMessages)

  if (leftIds.length !== rightIds.length) {
    return false
  }

  return leftIds.every((id, index) => id === rightIds[index])
}

const getChangedActiveMessages = (currentMessages: IMessage[], nextMessages: IMessage[]) => {
  const currentById = new Map(currentMessages.filter((message) => !!message.id).map((message) => [message.id, message]))

  return nextMessages.filter((message) => {
    if (!message.id) return false
    const currentMessage = currentById.get(message.id)
    if (!currentMessage) return false

    return JSON.stringify(currentMessage) !== JSON.stringify(message)
  })
}

const getCachedMessagesInRange = (channelId: string, startId: string, endId: string) => {
  const channelMessages = getMessagesFromMap(channelId)
  if (!channelMessages) {
    return []
  }

  return Object.values(channelMessages)
    .filter(
      (message): message is IMessage =>
        !!message.id && compareMessageIds(message.id, startId) >= 0 && compareMessageIds(message.id, endId) <= 0
    )
    .sort(compareMessagesForList)
}

const getCachedMessagesForResult = (channelId: string, messages: IMessage[]) => {
  const firstConfirmedMessageId = getFirstConfirmedMessageId(messages)
  const lastConfirmedMessageId = getLastConfirmedMessageId(messages)

  if (!firstConfirmedMessageId || !lastConfirmedMessageId) {
    return messages
  }

  const cachedMessages = getCachedMessagesInRange(channelId, firstConfirmedMessageId, lastConfirmedMessageId)
  return cachedMessages.length > 0 ? cachedMessages : messages
}

function* patchActiveMessagesFromCacheRange(channelId: string, startId: string, endId: string): any {
  if (getActiveChannelId() !== channelId) {
    return
  }

  const activeMessages: IMessage[] = store.getState().MessageReducer.activeChannelMessages || []
  const activeConfirmedMessages = activeMessages.filter((message) => !!message.id)
  if (!activeConfirmedMessages.length) {
    return
  }

  const activeStartId = getFirstConfirmedMessageId(activeConfirmedMessages)
  const activeEndId = getLastConfirmedMessageId(activeConfirmedMessages)
  if (!activeStartId || !activeEndId) {
    return
  }

  if (compareMessageIds(endId, activeStartId) < 0 || compareMessageIds(startId, activeEndId) > 0) {
    return
  }

  const overlapStartId = compareMessageIds(startId, activeStartId) > 0 ? startId : activeStartId
  const overlapEndId = compareMessageIds(endId, activeEndId) < 0 ? endId : activeEndId
  const cachedMessages = getCachedMessagesInRange(channelId, overlapStartId, overlapEndId)
  if (!cachedMessages.length) {
    return
  }

  const changedMessages = getChangedActiveMessages(activeConfirmedMessages, cachedMessages)
  if (changedMessages.length > 0) {
    yield put(patchMessagesAC(changedMessages))
  }
}

function* loadFromMetadata(firstAttachment: IAttachment) {
  if (firstAttachment?.metadata && isJSON(firstAttachment.metadata)) {
    const compactMeta = JSON.parse(firstAttachment.metadata)
    // Convert compact format to full OG format
    const fullMetadata: any = {
      og: {
        title: compactMeta.ttl,
        description: compactMeta.dsc,
        image: compactMeta.iur ? [{ url: compactMeta.iur }] : undefined,
        favicon: compactMeta.tur ? { url: compactMeta.tur } : undefined
      },
      imageWidth: compactMeta.szw,
      imageHeight: compactMeta.szh
    }
    yield put(setOGMetadataAC(firstAttachment.url, fullMetadata))
  }
}

function* loadOGMetadataForLinkMessages(
  messages: IMessage[],
  setStore = true,
  sendMessage?: boolean,
  getFromServer = true
): any {
  if (!messages || messages.length === 0) return
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (message?.attachments?.length) {
      let isOnlyLinkAttachments = true
      let firstAttachment
      for (let j = 0; j < message.attachments.length; j++) {
        const attachment = message.attachments[j]
        if (attachment.type === attachmentTypes.link) {
          if (!firstAttachment) {
            firstAttachment = attachment
          }
        } else {
          isOnlyLinkAttachments = false
          break
        }
      }
      if (isOnlyLinkAttachments && firstAttachment) {
        if (firstAttachment?.metadata) {
          const metadata = isJSON(firstAttachment?.metadata)
            ? JSON.parse(firstAttachment?.metadata)
            : firstAttachment?.metadata
          if (metadata?.hld) {
            continue
          }
        }
        // Fallback to Redux state
        const storedData = store.getState().MessageReducer.oGMetadata?.[firstAttachment.url]
        if (storedData) {
          if (sendMessage) {
            if (setStore) yield call(storeMetadata, firstAttachment.url, storedData)
          }
          continue
        }
        try {
          const cachedMetadata: any = yield call(getMetadata, firstAttachment.url)
          if (cachedMetadata) {
            yield put(setOGMetadataAC(firstAttachment.url, cachedMetadata))
          } else {
            yield call(loadFromMetadata, firstAttachment)
          }
        } catch (e) {
          yield call(loadFromMetadata, firstAttachment)
        }
        // Fetch metadata from API
        if (getFromServer) {
          store.dispatch(fetchOGMetadataForLinkAC(firstAttachment.url, setStore))
        }
      }
    }
  }
}

function* fetchOGMetadata(action: IAction): any {
  const { url, setStore } = action.payload
  const client = getClient()
  if (client && client.connectionState === CONNECTION_STATUS.CONNECTED) {
    try {
      const queryBuilder = new client.MessageLinkOGQueryBuilder(url)
      const query = yield call([queryBuilder, queryBuilder.build])
      const metadata = yield call([query, query.loadOGData])

      // Load image to get dimensions
      const imageUrl = metadata?.og?.image?.[0]?.url
      if (imageUrl) {
        try {
          let metadataWithImage
          if (setStore) {
            const imageDimensions: any = yield call(loadImage, imageUrl)
            metadataWithImage = {
              ...metadata,
              imageWidth: imageDimensions.width,
              imageHeight: imageDimensions.height
            }
          } else {
            metadataWithImage = metadata
          }
          yield put(setOGMetadataAC(url, metadataWithImage))
          if (setStore) yield call(storeMetadata, url, metadataWithImage)
        } catch (imageError) {
          // Image failed to load, try favicon
          const faviconUrl = metadata?.og?.favicon?.url
          if (faviconUrl) {
            try {
              yield call(loadImage, faviconUrl)
              const metadataWithFavicon = { ...metadata, faviconLoaded: true }
              yield put(setOGMetadataAC(url, metadataWithFavicon))
              if (setStore) yield call(storeMetadata, url, metadataWithFavicon)
            } catch (faviconError) {
              const metadataWithFavicon = { ...metadata, faviconLoaded: false }
              yield put(setOGMetadataAC(url, metadataWithFavicon))
              if (setStore) yield call(storeMetadata, url, metadataWithFavicon)
            }
          }
        }
      } else {
        const faviconUrl = metadata?.og?.favicon?.url
        if (faviconUrl) {
          try {
            yield call(loadImage, faviconUrl)
            const metadataWithFavicon = { ...metadata, faviconLoaded: true }
            yield put(setOGMetadataAC(url, metadataWithFavicon))
            if (setStore) yield call(storeMetadata, url, metadataWithFavicon)
          } catch (faviconError) {
            const metadataWithFavicon = { ...metadata, faviconLoaded: false }
            yield put(setOGMetadataAC(url, metadataWithFavicon))
            if (setStore) yield call(storeMetadata, url, metadataWithFavicon)
          }
        } else {
          yield put(setOGMetadataAC(url, metadata))
          if (setStore) yield call(storeMetadata, url, metadata)
        }
      }
    } catch (error) {
      console.log('Failed to fetch OG metadata', url)
    }
  }
}

function loadImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')

    img.setAttribute('fetchpriority', 'high')
    img.style.display = 'none'

    img.onload = () => {
      const sizes = {
        width: img.naturalWidth,
        height: img.naturalHeight
      }
      img.remove()
      resolve(sizes)
    }

    img.onerror = reject

    document.body.appendChild(img)
    img.src = src
  })
}

function* loadOGMetadataForLinkSaga(action: IAction): any {
  const { messages, setStore } = action.payload
  yield call(loadOGMetadataForLinkMessages, messages, setStore)
}

function* reloadActiveChannelAfterReconnect(action: IAction): any {
  try {
    const { channel, visibleAnchorId = '', wasViewingLatest = false, applyVisibleWindow = true } = action.payload

    if (!channel?.id || channel?.isMockChannel || !isChannelStillActive(channel.id)) {
      return
    }

    let reconnectChannel = channel
    const initialSignature = getReconnectChannelSignature(channel)
    let sawChannelsLoading = store.getState().ChannelReducer?.channelsLoadingState === LOADING_STATE.LOADING
    let elapsed = 0

    while (elapsed < ACTIVE_CHANNEL_RECONNECT_REFRESH_TIMEOUT_MS) {
      if (!isChannelStillActive(channel.id)) {
        return
      }

      const snapshot = getReconnectChannelSnapshot(channel.id)
      if (snapshot?.id) {
        const snapshotSignature = getReconnectChannelSignature(snapshot)
        if (snapshotSignature !== initialSignature) {
          const resolvedChannelUpdateData = getResolvedChannelUpdateData(channel.id, { ...snapshot })
          reconnectChannel = {
            ...channel,
            ...snapshot,
            ...resolvedChannelUpdateData
          }
          break
        }
      }

      const channelsLoadingState = store.getState().ChannelReducer?.channelsLoadingState
      if (channelsLoadingState === LOADING_STATE.LOADING) {
        sawChannelsLoading = true
      }

      if (sawChannelsLoading && channelsLoadingState === LOADING_STATE.LOADED) {
        if (snapshot?.id) {
          const resolvedChannelUpdateData = getResolvedChannelUpdateData(channel.id, { ...snapshot })
          reconnectChannel = {
            ...channel,
            ...snapshot,
            ...resolvedChannelUpdateData
          }
        }
        break
      }

      yield delay(50)
      elapsed += 50
    }

    if (!isChannelStillActive(channel.id)) {
      return
    }

    if (reconnectChannel === channel) {
      const latestSnapshot = getReconnectChannelSnapshot(channel.id)
      if (latestSnapshot?.id) {
        const resolvedChannelUpdateData = getResolvedChannelUpdateData(channel.id, { ...latestSnapshot })
        reconnectChannel = {
          ...channel,
          ...latestSnapshot,
          ...resolvedChannelUpdateData
        }
      }
    }

    const reloadAction = getReconnectReloadAction(
      reconnectChannel,
      visibleAnchorId,
      wasViewingLatest,
      applyVisibleWindow
    )

    if (reconnectChannel?.newMessageCount) {
      yield put(setUnreadMessageIdAC(reconnectChannel.lastDisplayedMessageId))
    }

    yield put(reloadAction)
  } catch (e) {
    log.error('error in reload active channel after reconnect', e)
  }
}

function* loadAroundMessageWorker(action: IAction): any {
  try {
    yield call(setMessageListLoading, 'both', LOADING_STATE.LOADING)
    const { channel, messageId, networkChanged } = action.payload
    const connectionState = store.getState().UserReducer.connectionStatus
    const messages = store.getState().MessageReducer.activeChannelMessages
    debugMessageListSaga('loadAround:start', {
      channelId: channel?.id,
      messageId,
      networkChanged,
      connectionState,
      window: getMessageWindowDebugSummary(messages)
    })

    if (channel?.id && !channel?.isMockChannel) {
      const SceytChatClient = getClient()
      const messageQueryBuilder = new (SceytChatClient.MessageListQueryBuilder as any)(channel.id)
      messageQueryBuilder.limit(MESSAGES_MAX_LENGTH)
      messageQueryBuilder.reverse(true)
      const messageQuery =
        connectionState === CONNECTION_STATUS.CONNECTED ? yield call(messageQueryBuilder.build) : null
      query.messageQuery = messageQuery

      let loadNextMessageId = ''
      let loadPreviousMessageId = ''
      let nextLoadLimit = MESSAGES_MAX_PAGE_COUNT / 2
      let previousLoadLimit = MESSAGES_MAX_PAGE_COUNT / 2
      if (messageId) {
        loadPreviousMessageId = messageId
      } else if (networkChanged) {
        const centerMessageIndex = getCenterTwoMessages(messages)
        loadPreviousMessageId = centerMessageIndex.mid2.messageId
        loadNextMessageId = centerMessageIndex.mid1.messageId
        previousLoadLimit = centerMessageIndex.mid2.index
        nextLoadLimit = messages.length - centerMessageIndex.mid1.index - 1
      }
      messageQuery.limit = previousLoadLimit
      const firstResult =
        loadPreviousMessageId && connectionState === CONNECTION_STATUS.CONNECTED
          ? yield call(messageQuery.loadPreviousMessageId, loadPreviousMessageId)
          : { messages: [], hasNext: false }
      if (!loadNextMessageId && firstResult.messages.length > 0) {
        loadNextMessageId = getLastConfirmedMessageId(firstResult.messages)
      } else if (!networkChanged && !loadNextMessageId && !firstResult.messages.length) {
        loadNextMessageId = '0'
      }
      messageQuery.reverse = false
      messageQuery.limit = nextLoadLimit
      const secondResult =
        loadNextMessageId && connectionState === CONNECTION_STATUS.CONNECTED
          ? yield call(messageQuery.loadNextMessageId, loadNextMessageId)
          : { messages: [], hasNext: false }
      const resultMessages =
        networkChanged && !firstResult.messages.length && !secondResult.messages.length
          ? messages
          : [...firstResult.messages, ...secondResult.messages]
      const result = {
        messages: resultMessages,
        hasNext: true
      }
      const firstConfirmedMessageId = getFirstConfirmedMessageId(result.messages)
      const lastConfirmedMessageId = getLastConfirmedMessageId(result.messages)
      if (firstConfirmedMessageId && lastConfirmedMessageId) {
        setMessagesToMap(channel.id, result.messages, firstConfirmedMessageId, lastConfirmedMessageId)
        setActiveSegment(channel.id, firstConfirmedMessageId, lastConfirmedMessageId)
        yield spawn(prefetchMessages, channel.id, firstConfirmedMessageId, MESSAGE_LOAD_DIRECTION.PREV, 2)
        yield spawn(prefetchMessages, channel.id, lastConfirmedMessageId, MESSAGE_LOAD_DIRECTION.NEXT, 2)
      }
      const appliedMessages = getCachedMessagesForResult(channel.id, result.messages)
      yield call(loadOGMetadataForLinkMessages, appliedMessages, true, false, false)
      yield put(setMessagesAC(JSON.parse(JSON.stringify(appliedMessages)), channel.id))
      yield put(setMessagesHasNextAC(true))

      const filteredPendingMessages = getFilteredPendingMessages(channel, appliedMessages)
      yield put(addMessagesAC(filteredPendingMessages, MESSAGE_LOAD_DIRECTION.NEXT))
      yield call(loadOGMetadataForLinkMessages, filteredPendingMessages, true, false, false)
      const waitToSendPendingMessages = store.getState().UserReducer.waitToSendPendingMessages
      if (connectionState === CONNECTION_STATUS.CONNECTED && waitToSendPendingMessages) {
        yield put(setWaitToSendPendingMessagesAC(false))
        yield spawn(sendPendingMessages, connectionState)
      }
      const updatedChannel = yield call(SceytChatClient.getChannel, channel.id, true)
      if (updatedChannel?.lastMessage && shouldReplaceChannelLastMessage(channel.id, updatedChannel.lastMessage)) {
        yield put(updateChannelLastMessageAC(updatedChannel.lastMessage, updatedChannel))
        updateChannelLastMessageOnAllChannels(channel.id, updatedChannel.lastMessage)
      }
    }
  } catch (e) {
    log.error('error in loadAroundMessage', e)
  } finally {
    yield call(setMessageListLoading, 'both', LOADING_STATE.LOADED)
  }
}

function* loadNearUnread(action: IAction): any {
  try {
    const { channel } = action.payload
    const connectionState = store.getState().UserReducer.connectionStatus

    if (channel?.id && !channel?.isMockChannel) {
      const cachedNearWindow = getCachedNearMessages(channel.id, channel.lastDisplayedMessageId, MESSAGES_MAX_LENGTH)
      const cacheWasShown = cachedNearWindow.hasEnoughCache && cachedNearWindow.messages.length > 0
      const cachedLastConfirmedMessageId = getLastConfirmedMessageId(cachedNearWindow.messages)
      const cachedHasPrevMessages = !!channel.lastDisplayedMessageId || cachedNearWindow.hasPrevMessages
      const cachedHasNextMessages =
        cachedNearWindow.hasNextMessages ||
        (!!channel.lastMessage?.id &&
          !!cachedLastConfirmedMessageId &&
          compareMessageIds(channel.lastMessage.id, cachedLastConfirmedMessageId) > 0)

      if (cacheWasShown) {
        yield put(setUnreadMessageIdAC(channel.lastDisplayedMessageId))
        yield put(setMessagesHasPrevAC(cachedHasPrevMessages))
        yield put(setMessagesHasNextAC(cachedHasNextMessages))
        yield call(loadOGMetadataForLinkMessages, cachedNearWindow.messages, true, false, false)
        yield put(setMessagesAC(cachedNearWindow.messages, channel.id))
        yield put(scrollToNewMessageAC(false))
        yield put(setUnreadScrollToAC(true))

        const filteredPendingMessages = getFilteredPendingMessages(channel, cachedNearWindow.messages, {
          hasNext: cachedHasNextMessages
        })
        yield put(addMessagesAC(filteredPendingMessages, MESSAGE_LOAD_DIRECTION.NEXT))
        yield call(loadOGMetadataForLinkMessages, filteredPendingMessages, true, false, false)
      } else {
        yield call(setMessageListLoading, 'both', LOADING_STATE.LOADING)
      }

      if (connectionState !== CONNECTION_STATUS.CONNECTED) {
        return
      }

      const SceytChatClient = getClient()
      const messageQueryBuilder = new (SceytChatClient.MessageListQueryBuilder as any)(channel.id)
      messageQueryBuilder.limit(MESSAGES_MAX_LENGTH)
      messageQueryBuilder.reverse(true)
      const messageQuery = yield call(messageQueryBuilder.build)
      query.messageQuery = messageQuery

      messageQuery.limit = MESSAGES_MAX_LENGTH
      let result: { messages: IMessage[]; hasNext: boolean }
      if (Number(channel.lastDisplayedMessageId)) {
        result = yield call(messageQuery.loadNearMessageId, channel.lastDisplayedMessageId)
      } else {
        result = yield call(messageQuery.loadPrevious)
      }
      const firstConfirmedMessageId = getFirstConfirmedMessageId(result.messages)
      const lastConfirmedMessageId = getLastConfirmedMessageId(result.messages)
      if (firstConfirmedMessageId && lastConfirmedMessageId) {
        setMessagesToMap(channel.id, result.messages, firstConfirmedMessageId, lastConfirmedMessageId)
        setActiveSegment(channel.id, firstConfirmedMessageId, lastConfirmedMessageId)
      }

      const refreshedCachedNearWindow = getCachedNearMessages(
        channel.id,
        channel.lastDisplayedMessageId,
        MESSAGES_MAX_LENGTH
      )
      const lastAppliedWindow =
        cacheWasShown && cachedNearWindow.messages.length
          ? cachedNearWindow.messages
          : store.getState().MessageReducer.activeChannelMessages.filter((message: IMessage) => !!message.id)
      const appliedMessages =
        refreshedCachedNearWindow.hasEnoughCache && refreshedCachedNearWindow.messages.length
          ? refreshedCachedNearWindow.messages
          : getCachedMessagesForResult(channel.id, result.messages)
      const hasPrevMessages =
        refreshedCachedNearWindow.hasEnoughCache && refreshedCachedNearWindow.messages.length
          ? !!channel.lastDisplayedMessageId || refreshedCachedNearWindow.hasPrevMessages
          : true
      const refreshedLastConfirmedMessageId = getLastConfirmedMessageId(appliedMessages)
      const hasNextMessages =
        refreshedCachedNearWindow.hasEnoughCache && refreshedCachedNearWindow.messages.length
          ? refreshedCachedNearWindow.hasNextMessages ||
            (!!channel.lastMessage?.id &&
              !!refreshedLastConfirmedMessageId &&
              compareMessageIds(channel.lastMessage.id, refreshedLastConfirmedMessageId) > 0)
          : !!channel.lastMessage?.id &&
            !!refreshedLastConfirmedMessageId &&
            compareMessageIds(channel.lastMessage.id, refreshedLastConfirmedMessageId) > 0

      yield put(setMessagesHasPrevAC(hasPrevMessages))
      yield put(setMessagesHasNextAC(hasNextMessages))
      yield put(setUnreadMessageIdAC(channel.lastDisplayedMessageId))
      yield call(loadOGMetadataForLinkMessages, appliedMessages, true, false, false)

      if (cacheWasShown && sameConfirmedWindow(lastAppliedWindow, appliedMessages)) {
        const changedMessages = getChangedActiveMessages(lastAppliedWindow, appliedMessages)
        if (changedMessages.length > 0) {
          yield put(patchMessagesAC(changedMessages))
        }
      } else {
        yield put(setMessagesAC(appliedMessages, channel.id))
        yield put(scrollToNewMessageAC(false))
        yield put(setUnreadScrollToAC(true))

        const filteredPendingMessages = getFilteredPendingMessages(channel, appliedMessages, {
          hasNext: hasNextMessages
        })
        yield put(addMessagesAC(filteredPendingMessages, MESSAGE_LOAD_DIRECTION.NEXT))
        yield call(loadOGMetadataForLinkMessages, filteredPendingMessages, true, false, false)
      }

      const waitToSendPendingMessages = store.getState().UserReducer.waitToSendPendingMessages
      if (waitToSendPendingMessages) {
        yield put(setWaitToSendPendingMessagesAC(false))
        yield spawn(sendPendingMessages, connectionState)
      }
      const updatedChannel = yield call(SceytChatClient.getChannel, channel.id, true)
      if (updatedChannel?.lastMessage && shouldReplaceChannelLastMessage(channel.id, updatedChannel.lastMessage)) {
        yield put(updateChannelLastMessageAC(updatedChannel.lastMessage, updatedChannel))
        updateChannelLastMessageOnAllChannels(channel.id, updatedChannel.lastMessage)
      }
    }
  } catch (e) {
    log.error('error in loadNearUnread', e)
  } finally {
    yield call(setMessageListLoading, 'both', LOADING_STATE.LOADED)
  }
}

function* loadDefaultMessages(action: IAction): any {
  try {
    const { channel } = action.payload
    const connectionState = store.getState().UserReducer.connectionStatus

    if (channel?.id && !channel?.isMockChannel) {
      const SceytChatClient = getClient()
      const messageQueryBuilder = new (SceytChatClient.MessageListQueryBuilder as any)(channel.id)
      messageQueryBuilder.limit(MESSAGES_MAX_LENGTH)
      messageQueryBuilder.reverse(true)
      const messageQuery =
        connectionState === CONNECTION_STATUS.CONNECTED ? yield call(messageQueryBuilder.build) : null
      query.messageQuery = messageQuery
      const cachedMessages = getLatestMessagesFromMap(channel.id, MESSAGES_MAX_PAGE_COUNT)

      if (cachedMessages && cachedMessages.length) {
        // Cache available — show it immediately without a loading state
        const messages = cachedMessages
        yield call(loadOGMetadataForLinkMessages, messages, true, false, false)
        yield put(setMessagesAC(messages, channel.id))
        const filteredPendingMessages = getFilteredPendingMessages(channel, messages, {
          isLatestWindow: true
        })
        yield put(addMessagesAC(filteredPendingMessages, MESSAGE_LOAD_DIRECTION.NEXT))
        yield call(loadOGMetadataForLinkMessages, filteredPendingMessages, true, false, false)
      } else {
        // No cache — show loading spinner while we wait for the server
        yield call(setMessageListLoading, 'both', LOADING_STATE.LOADING)
      }

      let result: { messages: IMessage[]; hasNext: boolean } = { messages: [], hasNext: false }
      if (compareMessageIds(channel?.lastDisplayedMessageId, channel?.lastMessage?.id) > 0) {
        result =
          connectionState === CONNECTION_STATUS.CONNECTED
            ? yield call(messageQuery.loadPreviousMessageId, channel?.lastDisplayedMessageId)
            : { messages: [], hasNext: false }
      } else {
        result =
          connectionState === CONNECTION_STATUS.CONNECTED
            ? yield call(messageQuery.loadPrevious)
            : { messages: [], hasNext: false }
      }
      const updatedMessages: IMessage[] = []
      result.messages.forEach((msg) => {
        const updatedMessage = updateMessageOnMap(channel.id, { messageId: msg.id, params: msg })
        updatedMessages.push(updatedMessage || msg)
      })
      let appliedMessages = updatedMessages

      const messageIdForLoad =
        compareMessageIds(channel?.lastDisplayedMessageId, channel?.lastMessage?.id) > 0
          ? channel?.lastDisplayedMessageId || '0'
          : channel?.lastMessage?.id || '0'
      if (updatedMessages.length) {
        const firstConfirmedMessageId = getFirstConfirmedMessageId(updatedMessages)
        const lastConfirmedMessageId = getLastConfirmedMessageId(updatedMessages)
        setMessagesToMap(channel.id, updatedMessages, firstConfirmedMessageId || '0', messageIdForLoad)
        if (firstConfirmedMessageId && lastConfirmedMessageId) {
          setActiveSegment(channel.id, firstConfirmedMessageId, lastConfirmedMessageId)
          yield spawn(prefetchMessages, channel.id, firstConfirmedMessageId, MESSAGE_LOAD_DIRECTION.PREV, 2)
        }
        appliedMessages = getCachedMessagesForResult(channel.id, updatedMessages)
        yield call(loadOGMetadataForLinkMessages, appliedMessages, true, false, false)
        yield put(setMessagesHasPrevAC(true))
        yield put(setMessagesHasNextAC(false))
        if (cachedMessages?.length && sameConfirmedWindow(cachedMessages, appliedMessages)) {
          // Cache was already shown — only dispatch updates for messages that changed
          const changedMessages = getChangedActiveMessages(cachedMessages, appliedMessages)
          for (const message of changedMessages) {
            yield put(updateMessageAC(message.id, message))
          }
        } else {
          // No cache was shown — do a full replace
          yield put(setMessagesAC(JSON.parse(JSON.stringify(appliedMessages))))
        }
      } else if (!cachedMessages?.length && !result.messages?.length) {
        yield put(setMessagesAC([]))
      }

      const filteredPendingMessages = getFilteredPendingMessages(channel, appliedMessages, {
        isLatestWindow: true
      })
      yield put(addMessagesAC(filteredPendingMessages, MESSAGE_LOAD_DIRECTION.NEXT))
      // Load OG metadata for link-only messages from cache
      yield call(loadOGMetadataForLinkMessages, filteredPendingMessages, true, false, false)
      const waitToSendPendingMessages = store.getState().UserReducer.waitToSendPendingMessages
      if (connectionState === CONNECTION_STATUS.CONNECTED && waitToSendPendingMessages) {
        yield put(setWaitToSendPendingMessagesAC(false))
        yield spawn(sendPendingMessages, connectionState)
      }
      const updatedChannel = yield call(SceytChatClient.getChannel, channel.id, true)
      if (updatedChannel?.lastMessage && shouldReplaceChannelLastMessage(channel.id, updatedChannel.lastMessage)) {
        yield put(updateChannelLastMessageAC(updatedChannel.lastMessage, updatedChannel))
        updateChannelLastMessageOnAllChannels(channel.id, updatedChannel.lastMessage)
      }
    }
  } catch (e) {
    log.error('error in loadDefaultMessages', e)
  } finally {
    yield call(setMessageListLoading, 'both', LOADING_STATE.LOADED)
  }
}

function* getMessagesQueryWorker(action: IAction): any {
  try {
    yield call(setMessageListLoading, 'both', LOADING_STATE.LOADING)
    const { channel, limit, networkChanged, applyVisibleWindow = true } = action.payload
    const channelNewMessageCount = channel?.newMessageCount || 0
    const connectionState = store.getState().UserReducer.connectionStatus
    if (channel?.id && !channel?.isMockChannel) {
      const SceytChatClient = getClient()
      if (networkChanged) {
        if (channel.newMessageCount) {
          yield put(setUnreadMessageIdAC(channel.lastDisplayedMessageId))
        }
      }

      const messageQueryBuilder = new (SceytChatClient.MessageListQueryBuilder as any)(channel.id)
      messageQueryBuilder.limit(limit || MESSAGES_MAX_LENGTH)
      messageQueryBuilder.reverse(true)
      const messageQuery =
        connectionState === CONNECTION_STATUS.CONNECTED ? yield call(messageQueryBuilder.build) : null
      query.messageQuery = messageQuery
      let result: { messages: IMessage[]; hasNext: boolean } = { messages: [], hasNext: false }
      let appliedMessages: IMessage[] = []
      if (!networkChanged && channelNewMessageCount && channelNewMessageCount > 0) {
        messageQuery.limit = MESSAGES_MAX_LENGTH
        if (Number(channel.lastDisplayedMessageId)) {
          result =
            connectionState === CONNECTION_STATUS.CONNECTED
              ? yield call(messageQuery.loadNearMessageId, channel.lastDisplayedMessageId)
              : { messages: [], hasNext: false }
        } else {
          result =
            connectionState === CONNECTION_STATUS.CONNECTED
              ? yield call(messageQuery.loadPrevious)
              : { messages: [], hasNext: false }
        }
        yield call(loadOGMetadataForLinkMessages, result.messages, true, false, false)
        yield put(setMessagesAC(JSON.parse(JSON.stringify(result.messages)), channel.id))
        const firstConfirmedMessageId = getFirstConfirmedMessageId(result.messages)
        const lastConfirmedMessageId = getLastConfirmedMessageId(result.messages)
        if (firstConfirmedMessageId && lastConfirmedMessageId) {
          setMessagesToMap(channel.id, result.messages, firstConfirmedMessageId, lastConfirmedMessageId)
          setActiveSegment(channel.id, firstConfirmedMessageId, lastConfirmedMessageId)
        }
        appliedMessages = getCachedMessagesForResult(channel.id, result.messages)
        yield put(setMessagesHasPrevAC(true))
      } else {
        const cachedMessages = getLatestMessagesFromMap(channel.id, MESSAGES_MAX_PAGE_COUNT)
        const cacheIsCurrent =
          cachedMessages.length > 0 && getLastConfirmedMessageId(cachedMessages) === channel.lastMessage?.id

        if (cacheIsCurrent) {
          result.messages = cachedMessages
        } else if (connectionState === CONNECTION_STATUS.CONNECTED) {
          messageQuery.limit = MESSAGES_MAX_LENGTH
          result = yield call(messageQuery.loadPrevious)
          if (result.messages.length) {
            const firstConfirmedMessageId = getFirstConfirmedMessageId(result.messages)
            const lastConfirmedMessageId = getLastConfirmedMessageId(result.messages)
            if (firstConfirmedMessageId && lastConfirmedMessageId) {
              setMessagesToMap(channel.id, result.messages, firstConfirmedMessageId, lastConfirmedMessageId)
              setActiveSegment(channel.id, firstConfirmedMessageId, lastConfirmedMessageId)
            }
          }
        } else {
          result.messages = cachedMessages
        }
        appliedMessages =
          connectionState === CONNECTION_STATUS.CONNECTED
            ? getCachedMessagesForResult(channel.id, result.messages)
            : result.messages
        yield put(setMessagesHasPrevAC(true))
      }
      if (!appliedMessages.length) {
        appliedMessages = result.messages
      }
      yield call(loadOGMetadataForLinkMessages, appliedMessages, true, false, false)
      const activeMessages: IMessage[] = store.getState().MessageReducer.activeChannelMessages || []
      const activeConfirmedMessages = activeMessages.filter((message: IMessage) => !!message.id)
      const sameVisibleWindow = sameConfirmedWindow(activeConfirmedMessages, appliedMessages)

      if (applyVisibleWindow) {
        yield put(setMessagesAC(appliedMessages, channel.id))
        yield put(setMessagesHasNextAC(false))
        const filteredPendingMessages = getFilteredPendingMessages(channel, appliedMessages, {
          hasNext: false
        })
        yield put(addMessagesAC(filteredPendingMessages, MESSAGE_LOAD_DIRECTION.NEXT))
        yield call(loadOGMetadataForLinkMessages, filteredPendingMessages, true, false, false)
      } else if (sameVisibleWindow) {
        const activeById = new Map(activeConfirmedMessages.map((currentMessage) => [currentMessage.id, currentMessage]))
        const changedMessages = appliedMessages.filter((loadedMessage) => {
          if (!loadedMessage.id) {
            return false
          }
          const existingMessage = activeById.get(loadedMessage.id)
          if (!existingMessage) {
            return false
          }
          return JSON.stringify(existingMessage) !== JSON.stringify(loadedMessage)
        })

        if (changedMessages.length > 0) {
          yield put(patchMessagesAC(changedMessages))
        }
        yield put(setMessagesHasNextAC(false))
      }

      const waitToSendPendingMessages = store.getState().UserReducer.waitToSendPendingMessages
      if (connectionState === CONNECTION_STATUS.CONNECTED && waitToSendPendingMessages) {
        yield put(setWaitToSendPendingMessagesAC(false))
        yield spawn(sendPendingMessages, connectionState)
      }
    } else if (channel?.isMockChannel) {
      yield put(setMessagesAC([]))
    }
  } catch (e) {
    log.error('error in message query', e)
    /* if (e.code !== 10008) {
      yield put(setErrorNotification(e.message));
    } */
  } finally {
    yield call(setMessageListLoading, 'both', LOADING_STATE.LOADED)
  }
}

function* getMessageQuery(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, messageId } = payload
    const channel = yield call(getChannelFromAllChannels, channelId)
    const connectionState = store.getState().UserReducer.connectionStatus
    if (!channel || connectionState !== CONNECTION_STATUS.CONNECTED) {
      return
    }
    const messages = yield call(channel.getMessagesById, [messageId])
    const fetchedMessage = messages && messages[0] ? JSON.parse(JSON.stringify(messages[0])) : null
    if (fetchedMessage) {
      yield put(updateMessageAC(messageId, fetchedMessage))
      updateMessageOnMap(channel.id, {
        messageId,
        params: fetchedMessage
      })
      if (channel.lastMessage && channel.lastMessage.id === messageId) {
        updateChannelLastMessageOnAllChannels(channel.id, fetchedMessage)
        yield put(updateChannelLastMessageAC(fetchedMessage, channel))
      }
    }
  } catch (e) {
    log.error('error in message query', e)
  }
}

function* prefetchMessages(channelId: string, fromMessageId: string, direction: string, pages: number): any {
  const key = `${channelId}:${direction}`
  if (prefetchInFlight.has(key)) {
    debugMessageListSaga('prefetch:queued', {
      channelId,
      direction,
      fromMessageId,
      pages
    })
    queuePrefetchRequest(key, direction, fromMessageId, pages)
    return
  }
  prefetchInFlight.add(key)
  debugMessageListSaga('prefetch:start', {
    channelId,
    direction,
    fromMessageId,
    pages,
    activeSegment: getActiveSegment()
  })
  try {
    const SceytChatClient = getClient()
    let request: { fromMessageId: string; pages: number } | null = { fromMessageId, pages }

    while (request) {
      let currentFromId = request.fromMessageId
      for (let i = 0; i < request.pages; i++) {
        if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
          if (hasPrevContiguousInMap(channelId, currentFromId)) {
            const cached = getContiguousPrevMessages(channelId, currentFromId, LOAD_MAX_MESSAGE_COUNT_PREFETCH)
            if (cached.length > 0) {
              debugMessageListSaga('prefetch:cache-hit', {
                channelId,
                direction,
                fromMessageId: currentFromId,
                result: getMessageWindowDebugSummary(cached)
              })
              currentFromId = cached[0].id
              continue
            }
          }
          const mqb = new (SceytChatClient.MessageListQueryBuilder as any)(channelId)
          mqb.limit(LOAD_MAX_MESSAGE_COUNT_PREFETCH)
          mqb.reverse(true)
          const mq = yield call(mqb.build)
          const result = yield call(mq.loadPreviousMessageId, currentFromId)
          if (!result.messages.length) break
          debugMessageListSaga('prefetch:network-hit', {
            channelId,
            direction,
            fromMessageId: currentFromId,
            result: getMessageWindowDebugSummary(result.messages),
            hasNext: result.hasNext
          })
          setMessagesToMap(
            channelId,
            result.messages,
            result.messages[0].id,
            result.messages[result.messages.length - 1].id
          )
          extendActiveSegment(
            channelId,
            result.messages[0].id,
            result.messages[result.messages.length - 1].id,
            MESSAGE_LOAD_DIRECTION.PREV
          )
          yield call(
            patchActiveMessagesFromCacheRange,
            channelId,
            result.messages[0].id,
            result.messages[result.messages.length - 1].id
          )
          currentFromId = result.messages[0].id
          if (!result.hasNext) break
        } else {
          if (hasNextContiguousInMap(channelId, currentFromId)) {
            const cached = getContiguousNextMessages(channelId, currentFromId, LOAD_MAX_MESSAGE_COUNT_PREFETCH)
            if (cached.length > 0) {
              debugMessageListSaga('prefetch:cache-hit', {
                channelId,
                direction,
                fromMessageId: currentFromId,
                result: getMessageWindowDebugSummary(cached)
              })
              currentFromId = cached[cached.length - 1].id
              continue
            }
          }
          const mqb = new (SceytChatClient.MessageListQueryBuilder as any)(channelId)
          mqb.limit(LOAD_MAX_MESSAGE_COUNT_PREFETCH)
          mqb.reverse(false)
          const mq = yield call(mqb.build)
          const result = yield call(mq.loadNextMessageId, currentFromId)
          if (!result.messages.length) break
          debugMessageListSaga('prefetch:network-hit', {
            channelId,
            direction,
            fromMessageId: currentFromId,
            result: getMessageWindowDebugSummary(result.messages),
            hasNext: result.hasNext
          })
          setMessagesToMap(
            channelId,
            result.messages,
            result.messages[0].id,
            result.messages[result.messages.length - 1].id
          )
          extendActiveSegment(
            channelId,
            result.messages[0].id,
            result.messages[result.messages.length - 1].id,
            MESSAGE_LOAD_DIRECTION.NEXT
          )
          yield call(
            patchActiveMessagesFromCacheRange,
            channelId,
            result.messages[0].id,
            result.messages[result.messages.length - 1].id
          )
          currentFromId = result.messages[result.messages.length - 1].id
          if (!result.hasNext) break
        }
      }

      request = queuedPrefetchRequests.get(key) || null
      if (request) {
        queuedPrefetchRequests.delete(key)
      }
    }
  } catch (e) {
    log.error('[PREFETCH] prefetchMessages error:', e)
  } finally {
    debugMessageListSaga('prefetch:finish', {
      channelId,
      direction,
      activeSegment: getActiveSegment()
    })
    queuedPrefetchRequests.delete(key)
    prefetchInFlight.delete(key)
    notifyPrefetchCompletion(key)
  }
}

function* loadMoreMessages(action: IAction): any {
  let acquiredLock = false
  let loadingScope: MessageListLoadScope = 'both'
  try {
    const { payload } = action
    const { limit, direction, channelId, messageId, hasNext, requestId } = payload
    const inFlightKey = getLoadMoreInFlightKey(channelId, direction)
    if (loadMoreMessagesInFlight.has(inFlightKey)) {
      return
    }
    loadMoreMessagesInFlight.add(inFlightKey)
    acquiredLock = true

    const SceytChatClient = getClient()
    const messageQueryBuilder = new (SceytChatClient.MessageListQueryBuilder as any)(channelId)
    messageQueryBuilder.reverse(true)
    const messageQuery = yield call(messageQueryBuilder.build)
    messageQuery.limit = 20
    loadingScope = direction === MESSAGE_LOAD_DIRECTION.PREV ? 'previous' : 'next'
    yield call(setMessageListLoading, loadingScope, LOADING_STATE.LOADING)
    const connectionState = store.getState().UserReducer.connectionStatus
    let result: { messages: IMessage[]; hasNext: boolean } = { messages: [], hasNext: false }
    let reachedLatestConfirmedEdge = false
    let nextHasPrevState: boolean | undefined
    let nextHasNextState: boolean | undefined
    const currentConfirmedMessages = store
      .getState()
      .MessageReducer.activeChannelMessages.filter((message: IMessage) => !!message.id)
    const prefetchKey = `${channelId}:${direction}`
    let resultSource = 'none'

    debugMessageListSaga('loadMore:start', {
      channelId,
      direction,
      messageId,
      limit,
      hasNext,
      connectionState,
      activeSegment: getActiveSegment(),
      currentWindow: getMessageWindowDebugSummary(currentConfirmedMessages)
    })

    if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
      // Segment-map cache: check if the map has contiguous messages before messageId
      let mapCached = getContiguousPrevMessages(channelId, messageId, limit || 30)
      if (!mapCached.length && hasNext && prefetchInFlight.has(prefetchKey)) {
        yield call(waitForPrefetchCompletion, prefetchKey)
        mapCached = getContiguousPrevMessages(channelId, messageId, limit || 30)
      }
      if (mapCached.length > 0) {
        resultSource = 'cache-prev'
        result.messages = mapCached
        const aheadCached = getContiguousPrevMessages(channelId, mapCached[0].id, LOAD_MAX_MESSAGE_COUNT_PREFETCH * 2)
        nextHasPrevState = aheadCached.length > 0 || hasNext
        const pagesToFetch = 2 - Math.floor(aheadCached.length / LOAD_MAX_MESSAGE_COUNT_PREFETCH)
        if (pagesToFetch > 0 && hasNext) {
          const fromId = aheadCached.length > 0 ? aheadCached[0].id : mapCached[0].id
          yield spawn(prefetchMessages, channelId, fromId, MESSAGE_LOAD_DIRECTION.PREV, pagesToFetch)
        }
      } else if (hasNext) {
        resultSource = 'network-prev'
        result = yield call(messageQuery.loadPreviousMessageId, messageId)
        if (result.messages.length) {
          setMessagesToMap(
            channelId,
            result.messages,
            result.messages[0]?.id,
            result.messages[result.messages.length - 1]?.id
          )
          extendActiveSegment(
            channelId,
            result.messages[0].id,
            result.messages[result.messages.length - 1].id,
            MESSAGE_LOAD_DIRECTION.PREV
          )
          yield spawn(prefetchMessages, channelId, result.messages[0].id, MESSAGE_LOAD_DIRECTION.PREV, 2)
          result.messages = getContiguousPrevMessages(channelId, messageId, limit || 30)
        }
        nextHasPrevState = result.hasNext
      }

      const nextWindowConfirmedCount =
        currentConfirmedMessages.length + result.messages.filter((message) => !!message.id).length
      if (nextWindowConfirmedCount > MESSAGES_MAX_PAGE_COUNT) {
        nextHasNextState = true
      }
    } else {
      // Segment-map cache: check if the map has contiguous messages after messageId
      let mapCached = getContiguousNextMessages(channelId, messageId, limit || 30)
      if (!mapCached.length && hasNext && prefetchInFlight.has(prefetchKey)) {
        yield call(waitForPrefetchCompletion, prefetchKey)
        mapCached = getContiguousNextMessages(channelId, messageId, limit || 30)
      }
      if (mapCached.length > 0) {
        resultSource = 'cache-next'
        result.messages = mapCached
        const lastConfirmedId = [...mapCached].reverse().find((m) => !!m.id)?.id
        const aheadCached = lastConfirmedId
          ? getContiguousNextMessages(channelId, lastConfirmedId, LOAD_MAX_MESSAGE_COUNT_PREFETCH * 2)
          : []
        const confirmedAheadCount = aheadCached.filter((m) => !!m.id).length
        const hasCachedNext = confirmedAheadCount > 0
        const canLoadServerNext = connectionState === CONNECTION_STATUS.CONNECTED && hasNext
        reachedLatestConfirmedEdge = !hasCachedNext && !canLoadServerNext
        nextHasNextState = hasCachedNext || canLoadServerNext
        const pagesToFetch = 2 - Math.floor(confirmedAheadCount / LOAD_MAX_MESSAGE_COUNT_PREFETCH)
        if (pagesToFetch > 0 && hasNext) {
          const lastAheadConfirmedId = [...aheadCached].reverse().find((m) => !!m.id)?.id
          const fromId = lastAheadConfirmedId || lastConfirmedId
          if (fromId) {
            yield spawn(prefetchMessages, channelId, fromId, MESSAGE_LOAD_DIRECTION.NEXT, pagesToFetch)
          }
        }
      } else if (hasNext) {
        resultSource = 'network-next'
        messageQuery.reverse = false
        result = yield call(messageQuery.loadNextMessageId, messageId)
        if (result.messages.length) {
          setMessagesToMap(
            channelId,
            result.messages,
            result.messages[0]?.id,
            result.messages[result.messages.length - 1]?.id
          )
          extendActiveSegment(
            channelId,
            result.messages[0].id,
            result.messages[result.messages.length - 1].id,
            MESSAGE_LOAD_DIRECTION.NEXT
          )
          yield spawn(
            prefetchMessages,
            channelId,
            result.messages[result.messages.length - 1].id,
            MESSAGE_LOAD_DIRECTION.NEXT,
            2
          )
          result.messages = getContiguousNextMessages(channelId, messageId, limit || 30)
        }
        reachedLatestConfirmedEdge = !result.hasNext
        nextHasNextState = result.hasNext
      } else {
        resultSource = 'latest-edge'
        reachedLatestConfirmedEdge = true
        nextHasNextState = false
      }
      nextHasPrevState = true
    }

    const shouldApplyVisibleResult = isCurrentPaginationIntent(
      channelId,
      direction === MESSAGE_LOAD_DIRECTION.PREV ? 'prev' : 'next',
      requestId
    )

    if (shouldApplyVisibleResult && nextHasPrevState !== undefined) {
      yield put(setMessagesHasPrevAC(nextHasPrevState))
    }

    if (shouldApplyVisibleResult && nextHasNextState !== undefined) {
      yield put(setMessagesHasNextAC(nextHasNextState))
    }

    if (shouldApplyVisibleResult && result.messages && result.messages.length && result.messages.length > 0) {
      debugMessageListSaga('loadMore:apply', {
        channelId,
        direction,
        resultSource,
        reachedLatestConfirmedEdge,
        requestId: requestId || null,
        applyMode: 'visible',
        resultWindow: getMessageWindowDebugSummary(result.messages),
        activeSegment: getActiveSegment()
      })
      yield call(loadOGMetadataForLinkMessages, result.messages, true, false, false)
      yield put(addMessagesAC(JSON.parse(JSON.stringify(result.messages)), direction))
    } else if (shouldApplyVisibleResult) {
      debugMessageListSaga('loadMore:apply', {
        channelId,
        direction,
        resultSource,
        reachedLatestConfirmedEdge,
        requestId: requestId || null,
        applyMode: 'visible',
        resultWindow: getMessageWindowDebugSummary(result.messages),
        activeSegment: getActiveSegment()
      })
      yield put(addMessagesAC([], direction))
    } else {
      debugMessageListSaga('loadMore:apply', {
        channelId,
        direction,
        resultSource,
        reachedLatestConfirmedEdge,
        requestId: requestId || null,
        applyMode: 'cache-only',
        resultWindow: getMessageWindowDebugSummary(result.messages),
        activeSegment: getActiveSegment()
      })
    }

    if (shouldApplyVisibleResult && direction === MESSAGE_LOAD_DIRECTION.NEXT && reachedLatestConfirmedEdge) {
      const filteredPendingMessages = getFilteredPendingMessages(channelId, result.messages, {
        hasNext: false
      })
      if (filteredPendingMessages.length) {
        yield put(addMessagesAC(filteredPendingMessages, MESSAGE_LOAD_DIRECTION.NEXT))
        yield call(loadOGMetadataForLinkMessages, filteredPendingMessages, true, false, false)
      }
    }
  } catch (e) {
    log.error('[MESSAGE_LIST] loadMoreMessages ERROR:', e)
  } finally {
    if (acquiredLock) {
      loadMoreMessagesInFlight.delete(getLoadMoreInFlightKey(action.payload.channelId, action.payload.direction))
      // Always release loading state — even on error — so pagination guards never get stuck
      if (loadingScope === 'previous') {
        store.dispatch(setLoadingPrevMessagesStateAC(LOADING_STATE.LOADED))
      } else if (loadingScope === 'next') {
        store.dispatch(setLoadingNextMessagesStateAC(LOADING_STATE.LOADED))
      }
    }
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
  } catch (e) {
    log.error('ERROR in add reaction', e.message)
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
    yield put(deleteReactionFromListAC(reaction))
    yield put(deleteReactionFromMessageAC(message, reaction, true))
    removeReactionToMessageOnMap(channelId, message, reaction, true)
  } catch (e) {
    log.error('ERROR in delete reaction', e.message)
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
    log.error('ERROR in get reactions', e.message)
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
    log.error('ERROR in load more reactions', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* getMessageAttachments(action: IAction): any {
  const { channelId, attachmentType, limit, direction, attachmentId, forPopup } = action.payload
  try {
    yield put(setAttachmentsLoadingStateAC(LOADING_STATE.LOADING, forPopup))
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
    const attachments = result.attachments.sort((a: IAttachment, b: IAttachment) =>
      forPopup ? Number(a.id || 0) - Number(b.id || 0) : Number(b.id || 0) - Number(a.id || 0)
    )
    if (forPopup) {
      query.AttachmentByTypeQueryForPopup = AttachmentByTypeQuery
      yield put(setAttachmentsForPopupAC(JSON.parse(JSON.stringify(attachments))))
      const attachmentIndex = attachments.findIndex((attachment: IAttachment) => attachment.id === attachmentId)
      let hasPrev = false
      if (attachmentIndex >= limit / 2 && result.hasNext && limit === attachments.length) {
        hasPrev = true
      } else {
        hasPrev = false
      }
      let hasNext = false
      if (attachmentIndex <= limit / 2 - 1 && result.hasNext && limit === attachments.length) {
        hasNext = true
      } else {
        hasNext = false
      }
      yield put(setAttachmentsCompleteForPopupAC(hasPrev, hasNext))
    } else {
      query.AttachmentByTypeQuery = AttachmentByTypeQuery
      yield put(setAttachmentsCompleteAC(result.hasNext))
      yield put(setAttachmentsAC(JSON.parse(JSON.stringify(attachments))))
    }
  } catch (e) {
    log.error('error in message attachment query', e)
    // yield put(setErrorNotification(e.message))
  } finally {
    yield put(setAttachmentsLoadingStateAC(LOADING_STATE.LOADED, forPopup))
  }
}

function* loadMoreMessageAttachments(action: any) {
  const { limit, direction, forPopup, attachmentId } = action.payload
  try {
    let AttachmentQuery
    if (forPopup) {
      AttachmentQuery = query.AttachmentByTypeQueryForPopup
    } else {
      AttachmentQuery = query.AttachmentByTypeQuery
    }
    if (!AttachmentQuery) {
      return
    }
    yield put(setAttachmentsLoadingStateAC(LOADING_STATE.LOADING, forPopup))
    AttachmentQuery.limit = limit
    let result = { attachments: [], hasNext: false }
    if (attachmentId) {
      if (direction === queryDirection.NEXT) {
        result = yield call(AttachmentQuery.loadNextAttachmentId, attachmentId)
      } else {
        result = yield call(AttachmentQuery.loadPreviousAttachmentId, attachmentId)
      }
    } else {
      if (direction === queryDirection.NEXT) {
        result = yield call(AttachmentQuery.loadNext)
      } else {
        result = yield call(AttachmentQuery.loadPrevious)
      }
    }
    const { attachments, hasNext } = result
    if (forPopup) {
      yield put(addAttachmentsForPopupAC(attachments, direction))
      if (attachmentId && direction === queryDirection.NEXT) {
        yield put(setAttachmentsCompleteForPopupAC(undefined, result.hasNext))
      } else if (attachmentId && direction === queryDirection.PREV) {
        yield put(setAttachmentsCompleteForPopupAC(result.hasNext, undefined))
      }
    } else {
      yield put(setAttachmentsCompleteAC(hasNext))
      yield put(setAttachmentsLoadingStateAC(LOADING_STATE.LOADED, forPopup))
      yield put(addAttachmentsAC(attachments))
    }
  } catch (e) {
    log.error('error in message attachment query', e)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  } finally {
    yield put(setAttachmentsLoadingStateAC(LOADING_STATE.LOADED, forPopup))
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
    log.error('error in pause attachment uploading', e)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}

function* resumeAttachmentUploading(action: any) {
  try {
    const { attachmentId } = action.payload
    log.info('resume for attachment ... ', attachmentId)
    if (getCustomUploader()) {
      const isResumed = resumeUpload(attachmentId)
      if (isResumed) {
        yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, attachmentId))
      }
    }
  } catch (e) {
    log.error('error in resume attachment uploading', e)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}

function* getMessageMarkers(action: IAction): any {
  try {
    yield put(setMessagesMarkersLoadingStateAC(LOADING_STATE.LOADING))
    const { messageId, channelId, deliveryStatuses } = action.payload
    const sceytChatClient = getClient()
    if (sceytChatClient) {
      const deliveryStatusesArray = deliveryStatuses.split(',')
      const messageMarkers: { [key: string]: IMarker[] } = {}
      for (const deliveryStatus of deliveryStatusesArray) {
        const messageMarkerListQueryBuilder = new sceytChatClient.MessageMarkerListQueryBuilder(
          channelId,
          String(messageId),
          deliveryStatus
        )
        const messageMarkerListQuery = yield call(messageMarkerListQueryBuilder.build)
        const messageMarkersResult = yield call(messageMarkerListQuery.loadNext)
        messageMarkers[deliveryStatus] = messageMarkersResult.markers
      }
      if (Object.keys(messageMarkers).length > 0) {
        yield put(setMessageMarkersAC(channelId, messageId, messageMarkers, deliveryStatusesArray))
      }
    }
  } catch (e) {
    log.error('error in get message markers', e)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  } finally {
    yield put(setMessagesMarkersLoadingStateAC(LOADING_STATE.LOADED))
  }
}

function* executeAddPollVote(channelId: string, pollId: string, optionId: string, message: IMessage): any {
  const channel = yield call(getChannelFromMap, channelId)
  if (!message.pollDetails) return
  if (channel && message.id) {
    yield call(channel.addVote, message.id, pollId, [optionId])
    yield put(removePendingPollActionAC(message.id, 'ADD_POLL_VOTE', optionId))
  }
}

function* updateMessageOptimisticallyForAddPollVote(channelId: string, message: IMessage, vote: IPollVote): any {
  const channel = yield call(getChannelFromMap, channelId)
  if (!channel) return
  if (!message.pollDetails) return
  const objs = []
  if (!message.pollDetails?.allowMultipleVotes && message.pollDetails?.voteDetails?.ownVotes?.length > 0) {
    objs.push({
      type: 'deleteOwn' as const,
      vote: message.pollDetails?.voteDetails?.ownVotes?.[0]
    })
  }
  objs.push({
    type: 'addOwn' as const,
    vote
  })

  for (const obj of objs) {
    updateMessageOnMap(channel.id, { messageId: message.id, params: {} }, obj)
    yield put(updateMessageAC(message.id, {}, undefined, obj))
  }
}

function* addPollVote(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, pollId, optionId, message, isResend } = payload
    const sceytChatClient = getClient()
    if (sceytChatClient) {
      const user = sceytChatClient.user
      const vote: IPollVote = {
        optionId,
        createdAt: new Date().getTime(),
        user: {
          id: user.id,
          presence: {
            status: user.presence?.status || 'online'
          },
          profile: {
            avatar: user.avatarUrl || '',
            firstName: user.firstName,
            lastName: user.lastName,
            metadata: user.metadata || '',
            metadataMap: user.metadataMap || {},
            updatedAt: new Date().getTime(),
            username: user.username || '',
            createdAt: new Date().getTime()
          },
          createdAt: new Date().getTime()
        }
      }
      const pendingAction = {
        type: 'ADD_POLL_VOTE' as const,
        channelId,
        pollId,
        optionId,
        message
      }
      const conflictCheck = checkPendingPollActionConflict(pendingAction)

      // If there's a conflicting pending delete, we need to revert its optimistic update
      if (conflictCheck.hasConflict && !conflictCheck.shouldSkip) {
        // Remove the conflicting pending delete action (which had an optimistic update)
        // The optimistic update for delete needs to be reverted, then we apply the add
        // Since delete was already applied optimistically, we need to revert it by applying add
        const channel = yield call(getChannelFromMap, channelId)
        if (channel) {
          // Get the current message state (which has the delete applied)
          const currentMessage = getMessageFromMap(channelId, message.id) || message
          // Apply add on top (which effectively reverts the delete)

          const hasNext = store.getState().MessageReducer.pollVotesHasMore?.[pollId] || false
          yield put(
            addPollVotesToListAC(
              pollId,
              optionId,
              [currentMessage.pollDetails?.voteDetails?.ownVotes?.[0]],
              hasNext,
              message.id
            )
          )
          const obj: { type: 'addOwn'; vote: IPollVote } = {
            type: 'addOwn' as const,
            vote
          }
          updateMessageOnMap(channel.id, { messageId: message.id, params: {} }, obj)
          yield put(updateMessageAC(message.id, {}, undefined, obj))
        }
      } else if (!conflictCheck.shouldSkip) {
        // No conflict, update message optimistically so user sees their vote immediately
        yield call(updateMessageOptimisticallyForAddPollVote, channelId, message, vote)
      }

      // Store as pending action to send when connected (if not skipped)
      if (!conflictCheck.shouldSkip && !isResend) {
        setPendingPollAction(pendingAction)
      }

      // Execute immediately if connected
      yield call(executeAddPollVote, channelId, pollId, optionId, message)
    }
  } catch (e) {
    log.error('error in add poll vote', e)
  }
}

function* executeDeletePollVote(channelId: string, pollId: string, optionId: string, message: IMessage): any {
  const channel = yield call(getChannelFromMap, channelId)
  if (!message.pollDetails) return
  const vote = message.pollDetails?.voteDetails?.ownVotes?.find((vote: IPollVote) => vote.optionId === optionId)
  if (!vote) return

  if (channel && message.id) {
    yield call(channel.deleteVote, message.id, pollId, [optionId])
    yield put(removePendingPollActionAC(message.id, 'DELETE_POLL_VOTE', optionId))
  }
}

function* updateMessageOptimisticallyForDeletePollVote(channelId: string, message: IMessage, vote: IPollVote): any {
  const channel = yield call(getChannelFromMap, channelId)
  if (!channel) return
  if (!message.pollDetails) return
  const obj: { type: 'deleteOwn'; vote: IPollVote } = {
    type: 'deleteOwn' as const,
    vote
  }
  updateMessageOnMap(channel.id, { messageId: message.id, params: {} }, obj)
  yield put(updateMessageAC(message.id, {}, undefined, obj))
}

function* deletePollVote(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, pollId, optionId, message, isResend } = payload
    const sceytChatClient = getClient()
    if (sceytChatClient) {
      const vote = message.pollDetails?.voteDetails?.ownVotes?.find((vote: IPollVote) => vote.optionId === optionId)
      if (!vote) return
      const pendingAction = {
        type: 'DELETE_POLL_VOTE' as const,
        channelId,
        pollId,
        optionId,
        message
      }
      const conflictCheck = checkPendingPollActionConflict(pendingAction)

      // If there's a conflicting pending add and we should skip both, revert the add's optimistic update
      if (conflictCheck.hasConflict && conflictCheck.shouldSkip) {
        // Revert the optimistic update from the pending addPollVote
        const channel = yield call(getChannelFromMap, channelId)
        if (channel) {
          // Get the current message state (which has the add applied optimistically)
          const currentMessage = getMessageFromMap(channelId, message.id) || message
          // Revert by applying delete (which removes the vote that was added optimistically)

          yield put(
            deletePollVotesFromListAC(
              pollId,
              optionId,
              [currentMessage.pollDetails?.voteDetails?.ownVotes?.[0]],
              message.id
            )
          )
          const obj: { type: 'deleteOwn'; vote: IPollVote } = {
            type: 'deleteOwn' as const,
            vote
          }
          updateMessageOnMap(channel.id, { messageId: message.id, params: {} }, obj)
          yield put(updateMessageAC(message.id, {}, undefined, obj))
        }
      } else if (!conflictCheck.shouldSkip) {
        // No conflict or conflict that doesn't skip, update message optimistically so user sees vote removed immediately
        yield call(updateMessageOptimisticallyForDeletePollVote, channelId, message, vote)
      }

      // Store as pending action (conflict resolution is handled in setPendingPollAction)
      if (!conflictCheck.shouldSkip && !isResend) {
        setPendingPollAction(pendingAction)
      }

      // Execute immediately if connected
      yield call(executeDeletePollVote, channelId, pollId, optionId, message)
    }
  } catch (e) {
    log.error('error in delete poll vote', e)
  }
}

function* executeClosePoll(channelId: string, pollId: string, message: IMessage): any {
  const channel = yield call(getChannelFromMap, channelId)
  // should update the poll details on the message
  const obj: { type: 'close' } = {
    type: 'close' as const
  }
  updateMessageOnMap(channel.id, { messageId: message.id, params: {} }, obj)
  yield put(updateMessageAC(message.id, {}, undefined, obj))
  if (channel && message.id) {
    yield call(channel.closePoll, message.id, pollId)
    yield put(removePendingPollActionAC(message.id, 'CLOSE_POLL'))
  }
}

function* updateMessageOptimisticallyForClosePoll(channelId: string, message: IMessage): any {
  const channel = yield call(getChannelFromMap, channelId)
  if (!channel) return

  const pollDetails = JSON.parse(JSON.stringify(message.pollDetails))
  pollDetails.closed = true
  pollDetails.closedAt = new Date().getTime()

  updateMessageOnMap(channelId, {
    messageId: message.id,
    params: { pollDetails }
  })
  yield put(updateMessageAC(message.id, { pollDetails }))
}

function* closePoll(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, pollId, message } = payload
    const sceytChatClient = getClient()
    if (sceytChatClient) {
      const connectionState = sceytChatClient.connectionState

      if (connectionState !== CONNECTION_STATUS.CONNECTED) {
        // Update message optimistically so user sees poll closed immediately
        yield call(updateMessageOptimisticallyForClosePoll, channelId, message)

        // Store as pending action
        setPendingPollAction({
          type: 'CLOSE_POLL',
          channelId,
          pollId,
          message
        })
        return
      }

      // Execute immediately if connected
      yield call(executeClosePoll, channelId, pollId, message)
    }
  } catch (e) {
    log.error('error in close poll', e)
  }
}

function* executeRetractPollVote(
  channelId: string,
  pollId: string,
  message: IMessage,
  objs: { type: 'addOwn' | 'deleteOwn'; vote: IPollVote }[],
  isResend?: boolean
): any {
  const channel = yield call(getChannelFromMap, channelId)

  if (!isResend) {
    for (const obj of objs) {
      updateMessageOnMap(
        channelId,
        {
          messageId: message.id,
          params: {}
        },
        obj
      )
      yield put(updateMessageAC(message.id, {}, undefined, obj))
    }
  }
  if (channel && message.id) {
    yield call(channel.retractVote, message.id, pollId)
    yield put(removePendingPollActionAC(message.id || '', 'RETRACT_POLL_VOTE'))
  }
}

function* updateMessageOptimisticallyForRetractPollVote(
  channelId: string,
  message: IMessage,
  objs: { type: 'addOwn' | 'deleteOwn'; vote: IPollVote }[]
): any {
  const channel = yield call(getChannelFromMap, channelId)
  if (!channel) return
  for (const obj of objs) {
    updateMessageOnMap(channelId, {
      messageId: message.id,
      params: {}
    })
    yield put(updateMessageAC(message.id, {}, undefined, obj))
  }
}

function* retractPollVote(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, pollId, message, isResend } = payload
    const sceytChatClient = getClient()
    if (sceytChatClient) {
      const connectionState = sceytChatClient.connectionState
      const objs: { type: 'addOwn' | 'deleteOwn'; vote: IPollVote }[] = []
      for (const vote of message.pollDetails?.voteDetails?.ownVotes || []) {
        objs.push({
          type: 'deleteOwn' as const,
          vote
        })
      }
      if (connectionState !== CONNECTION_STATUS.CONNECTED) {
        // Update message optimistically so user sees votes retracted immediately
        yield call(updateMessageOptimisticallyForRetractPollVote, channelId, message, objs)

        // Store as pending action
        setPendingPollAction({
          type: 'RETRACT_POLL_VOTE',
          channelId,
          pollId,
          message
        })
        return
      }

      // Execute immediately if connected
      yield call(executeRetractPollVote, channelId, pollId, message, objs, isResend)
    }
  } catch (e) {
    log.error('error in retract poll vote', e)
  }
}

function* resendPendingPollActions(action: IAction): any {
  try {
    const { payload } = action
    const { connectionState } = payload
    const sceytChatClient = getClient()

    if (!sceytChatClient || connectionState !== CONNECTION_STATUS.CONNECTED) {
      return
    }

    const pendingPollActionsMap = store.getState().MessageReducer.pendingPollActions
    const pendingPollActionsMapCopy = JSON.parse(JSON.stringify(pendingPollActionsMap))

    // Use a small delay similar to the message resend pattern

    Object.keys(pendingPollActionsMapCopy).forEach((messageId: string) => {
      pendingPollActionsMapCopy[messageId].forEach((pendingAction: any) => {
        const { type, channelId, pollId, optionId, message } = pendingAction

        switch (type) {
          case 'ADD_POLL_VOTE':
            if (optionId) {
              store.dispatch(addPollVoteAC(channelId, pollId, optionId, message, true))
            }
            break
          case 'DELETE_POLL_VOTE':
            if (optionId) {
              store.dispatch(deletePollVoteAC(channelId, pollId, optionId, message, true))
            }
            break
          case 'CLOSE_POLL':
            store.dispatch(closePollAC(channelId, pollId, message))
            break
          case 'RETRACT_POLL_VOTE':
            store.dispatch(retractPollVoteAC(channelId, pollId, message, true))
            break
          default:
            log.warn('Unknown pending poll action type:', type)
        }
      })
    })
  } catch (e) {
    log.error('error in resend pending poll actions', e)
  }
}

function* getPollVotes(action: IAction): any {
  try {
    const { payload } = action
    const { messageId, pollId, optionId, limit } = payload
    const key = `${pollId}_${optionId}`

    yield put(setPollVotesLoadingStateAC(pollId, optionId, LOADING_STATE.LOADING))

    const SceytChatClient = getClient()
    if (!SceytChatClient || !SceytChatClient.PollVotesQueryBuilder) {
      throw new Error('SceytChatClient or PollVotesQueryBuilder not available')
    }

    const queryBuilder = new SceytChatClient.PollVotesQueryBuilder(messageId, pollId)
    queryBuilder.setOptionId(optionId)
    queryBuilder.limit(limit || 20)
    const pollVotesQuery = yield call(queryBuilder.build)

    const result = yield call(pollVotesQuery.loadNext)

    // Store query for later use
    if (!query.PollVotesQueries) {
      query.PollVotesQueries = {}
    }
    query.PollVotesQueries[key] = pollVotesQuery

    // Format votes to IPollVote format
    const formattedVotes: IPollVote[] = (result.votes || []).map((vote: any) => ({
      optionId: vote.optionId || optionId,
      createdAt: vote.createdAt || new Date().getTime(),
      user: vote.user || {
        id: '',
        presence: { status: 'offline' },
        profile: {
          avatar: '',
          firstName: '',
          lastName: '',
          metadata: '',
          metadataMap: {},
          updatedAt: 0,
          username: '',
          createdAt: 0
        },
        createdAt: 0
      }
    }))

    yield put(setPollVotesListAC(pollId, optionId, formattedVotes, result.hasNext || false))

    yield put(setPollVotesLoadingStateAC(pollId, optionId, LOADING_STATE.LOADED))
  } catch (e) {
    log.error('ERROR in get poll votes', e)
    yield put(setPollVotesLoadingStateAC(action.payload.pollId, action.payload.optionId, LOADING_STATE.LOADED))
  }
}

function* loadMorePollVotes(action: IAction): any {
  try {
    const { payload } = action
    const { pollId, optionId, limit } = payload
    const key = `${pollId}_${optionId}`

    yield put(setPollVotesLoadingStateAC(pollId, optionId, LOADING_STATE.LOADING))

    if (!query.PollVotesQueries || !query.PollVotesQueries[key]) {
      throw new Error('Poll votes query not found')
    }

    const pollVotesQuery = query.PollVotesQueries[key]
    if (limit && pollVotesQuery.limit < limit) {
      pollVotesQuery.limit = limit
    }

    const result = yield call(pollVotesQuery.loadNext)

    // Format votes to IPollVote format
    const formattedVotes: IPollVote[] = (result.votes || []).map((vote: any) => ({
      optionId: vote.optionId || optionId,
      createdAt: vote.createdAt || new Date().getTime(),
      user: vote.user || {
        id: '',
        presence: { status: 'offline' },
        profile: {
          avatar: '',
          firstName: '',
          lastName: '',
          metadata: '',
          metadataMap: {},
          updatedAt: 0,
          username: '',
          createdAt: 0
        },
        createdAt: 0
      }
    }))

    yield put(addPollVotesToListAC(pollId, optionId, formattedVotes, result.hasNext || false))

    yield put(setPollVotesLoadingStateAC(pollId, optionId, LOADING_STATE.LOADED))
  } catch (e) {
    log.error('ERROR in load more poll votes', e)
    yield put(setPollVotesLoadingStateAC(action.payload.pollId, action.payload.optionId, LOADING_STATE.LOADED))
  }
}

export const __messageSagaTestables = {
  getReconnectReloadAction,
  sendMessage,
  sendTextMessage,
  forwardMessage,
  resendMessage,
  editMessage,
  sendPendingMessages,
  reloadActiveChannelAfterReconnect,
  loadNearUnread,
  loadDefaultMessages,
  loadMoreMessages,
  loadAroundMessage,
  getMessagesQuery,
  prefetchMessages,
  refreshCacheAroundMessage
}

export const __resetMessageSagaTestState = () => {
  loadMoreMessagesInFlight.clear()
  prefetchInFlight.clear()
  queuedPrefetchRequests.clear()
  prefetchCompletionWaiters.clear()
}

const REFRESH_WINDOW_HALF = 30

function* refreshCacheAroundMessage(action: IAction): any {
  try {
    const { channelId, messageId, applyVisibleWindow = true } = action.payload
    const connectionState = store.getState().UserReducer.connectionStatus
    if (connectionState !== CONNECTION_STATUS.CONNECTED) return

    const activeChannelId = getActiveChannelId()
    if (activeChannelId !== channelId) return

    const activeMessages: IMessage[] = store.getState().MessageReducer.activeChannelMessages || []
    const activeConfirmedMessages = activeMessages.filter((message) => !!message.id)
    if (!activeConfirmedMessages.length) return

    const centerMessageIndex = getCenterTwoMessages(activeConfirmedMessages)
    const refreshAnchorId = centerMessageIndex.mid2.messageId || messageId
    if (!refreshAnchorId) return

    const previousLimit =
      activeConfirmedMessages.length === 1 ? 1 : Math.min(REFRESH_WINDOW_HALF, centerMessageIndex.mid2.index)
    const nextLimit = Math.min(
      REFRESH_WINDOW_HALF,
      Math.max(0, activeConfirmedMessages.length - centerMessageIndex.mid1.index - 1)
    )

    const SceytChatClient = getClient()
    const messageQueryBuilder = new (SceytChatClient.MessageListQueryBuilder as any)(channelId)
    messageQueryBuilder.limit(REFRESH_WINDOW_HALF)
    messageQueryBuilder.reverse(true)
    const messageQuery = yield call(messageQueryBuilder.build)
    debugMessageListSaga('refreshAround:start', {
      channelId,
      requestedAnchorId: messageId,
      refreshAnchorId,
      previousLimit,
      nextLimit,
      activeWindow: getMessageWindowDebugSummary(activeConfirmedMessages),
      activeSegment: getActiveSegment()
    })
    messageQuery.limit = previousLimit
    const prevResult: { messages: IMessage[]; hasNext: boolean } =
      previousLimit > 0
        ? yield call(messageQuery.loadPreviousMessageId, refreshAnchorId)
        : { messages: [], hasNext: false }

    const pivotId = prevResult.messages.length > 0 ? getLastConfirmedMessageId(prevResult.messages) : refreshAnchorId
    messageQuery.reverse = false
    messageQuery.limit = nextLimit
    const nextResult: { messages: IMessage[]; hasNext: boolean } =
      nextLimit > 0 && pivotId ? yield call(messageQuery.loadNextMessageId, pivotId) : { messages: [], hasNext: false }

    const loadedMessages: IMessage[] = [...prevResult.messages, ...nextResult.messages]
    if (loadedMessages.length === 0) return
    debugMessageListSaga('refreshAround:loaded', {
      channelId,
      refreshAnchorId,
      loadedWindow: getMessageWindowDebugSummary(loadedMessages)
    })

    const firstId = getFirstConfirmedMessageId(loadedMessages)
    const lastId = getLastConfirmedMessageId(loadedMessages)
    if (firstId && lastId) {
      setMessagesToMap(channelId, loadedMessages, firstId, lastId)
      setActiveSegment(channelId, firstId, lastId)
    }

    yield call(loadOGMetadataForLinkMessages, loadedMessages, true, false, false)

    if (sameConfirmedWindow(activeConfirmedMessages, loadedMessages)) {
      const activeById = new Map(activeConfirmedMessages.map((currentMessage) => [currentMessage.id, currentMessage]))
      const changed = loadedMessages.filter((loaded) => {
        if (!loaded.id) return false
        const existing = activeById.get(loaded.id)
        if (!existing) return false
        return JSON.stringify(existing) !== JSON.stringify(loaded)
      })

      if (changed.length > 0) {
        yield put(patchMessagesAC(changed))
      }
      return
    }

    if (!applyVisibleWindow) {
      return
    }

    yield put(setMessagesAC(JSON.parse(JSON.stringify(loadedMessages)), channelId))

    const filteredPendingMessages = getFilteredPendingMessages(channelId, loadedMessages)
    if (filteredPendingMessages.length > 0) {
      yield put(addMessagesAC(filteredPendingMessages, MESSAGE_LOAD_DIRECTION.NEXT))
      yield call(loadOGMetadataForLinkMessages, filteredPendingMessages, true, false, false)
    }
  } catch (e) {
    log.error('error in refreshCacheAroundMessage', e)
  }
}

export default function* MessageSaga() {
  yield takeEvery(SEND_MESSAGE, sendMessage)
  yield takeEvery(SEND_TEXT_MESSAGE, sendTextMessage)
  yield takeEvery(FORWARD_MESSAGE, forwardMessage)
  yield takeEvery(RESEND_MESSAGE, resendMessage)
  yield takeLatest(EDIT_MESSAGE, editMessage)
  yield takeEvery(DELETE_MESSAGE, deleteMessage)
  yield takeLatest(RELOAD_ACTIVE_CHANNEL_AFTER_RECONNECT, reloadActiveChannelAfterReconnect)
  yield takeLatest(LOAD_LATEST_MESSAGES, getMessagesQuery)
  yield takeLatest(LOAD_AROUND_MESSAGE, loadAroundMessage)
  yield takeLatest(REFRESH_CACHE_AROUND_MESSAGE, refreshCacheAroundMessage)
  yield takeLatest(LOAD_NEAR_UNREAD, loadNearUnread)
  yield takeLatest(LOAD_DEFAULT_MESSAGES, loadDefaultMessages)
  yield takeEvery(GET_MESSAGE, getMessageQuery)
  yield takeLatest(GET_MESSAGE_MARKERS, getMessageMarkers)
  yield takeLatest(GET_MESSAGES_ATTACHMENTS, getMessageAttachments)
  yield takeLatest(LOAD_MORE_MESSAGES_ATTACHMENTS, loadMoreMessageAttachments)
  yield takeLatest(ADD_REACTION, addReaction)
  yield takeLatest(DELETE_REACTION, deleteReaction)
  yield takeEvery(LOAD_MORE_MESSAGES, loadMoreMessages)
  yield takeEvery(GET_REACTIONS, getReactions)
  yield takeEvery(LOAD_MORE_REACTIONS, loadMoreReactions)
  yield takeEvery(PAUSE_ATTACHMENT_UPLOADING, pauseAttachmentUploading)
  yield takeEvery(RESUME_ATTACHMENT_UPLOADING, resumeAttachmentUploading)
  yield takeEvery(ADD_POLL_VOTE, addPollVote)
  yield takeEvery(DELETE_POLL_VOTE, deletePollVote)
  yield takeEvery(CLOSE_POLL, closePoll)
  yield takeEvery(RETRACT_POLL_VOTE, retractPollVote)
  yield takeEvery(GET_POLL_VOTES, getPollVotes)
  yield takeEvery(LOAD_MORE_POLL_VOTES, loadMorePollVotes)
  yield takeEvery(RESEND_PENDING_POLL_ACTIONS, resendPendingPollActions)
  yield takeEvery(LOAD_OG_METADATA_FOR_LINK, loadOGMetadataForLinkSaga)
  yield takeEvery(FETCH_OG_METADATA, fetchOGMetadata)
}
