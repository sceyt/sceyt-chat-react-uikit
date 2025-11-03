import { IAttachment, IMessage, IPollVote, IReaction } from '../../types'
import { checkArraysEqual } from '../index'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../constants'
import { cancelUpload, getCustomUploader } from '../customUploader'
import { deleteVotesFromPollDetails } from '../message'
export const MESSAGES_MAX_LENGTH = 80
export const LOAD_MAX_MESSAGE_COUNT = 30
export const MESSAGE_LOAD_DIRECTION = {
  PREV: 'prev',
  NEXT: 'next'
}
export type IAttachmentMeta = {
  thumbnail?: string
  imageWidth?: number
  imageHeight?: number
  duration?: number
}

type draftMessagesMap = {
  [key: string]: { text: string; mentionedUsers: any; messageForReply?: IMessage; bodyAttributes?: any }
}
type audioRecordingMap = { [key: string]: any }
type visibleMessagesMap = { [key: string]: { id: string } }

type pendingMessagesMap = {
  [key: string]: IMessage[]
}

type messagesMap = {
  [key: string]: IMessage[]
}

// eslint-disable-next-line no-unused-vars
export let sendMessageHandler: (message: IMessage, channelId: string) => Promise<IMessage>

// eslint-disable-next-line no-unused-vars
export const setSendMessageHandler = (handler: (message: IMessage, channelId: string) => Promise<IMessage>) => {
  sendMessageHandler = handler
}

const pendingAttachments: { [key: string]: { file: File; checksum: string; messageTid?: string; channelId: string } } =
  {}
let messagesMap: messagesMap = {}
const pendingMessagesMap: pendingMessagesMap = {}
let activeChannelAllMessages: IMessage[] = []
let prevCached: boolean = false
let nextCached = false

export const setAllMessages = (messages: IMessage[]) => {
  activeChannelAllMessages = messages
}
export const addAllMessages = (messages: IMessage[], direction: string) => {
  if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
    activeChannelAllMessages = [...messages, ...activeChannelAllMessages]
    if (activeChannelAllMessages.length > MESSAGES_MAX_LENGTH) {
      setHasNextCached(true)
    }
  } else {
    activeChannelAllMessages = [...activeChannelAllMessages, ...messages]
    if (activeChannelAllMessages.length > MESSAGES_MAX_LENGTH) {
      setHasPrevCached(true)
    }
  }
}

export const updateMessageOnAllMessages = (
  messageId: string,
  updatedParams: any,
  voteDetails?: {
    votes?: IPollVote[]
    deletedVotes?: IPollVote[]
    votesPerOption?: { [key: string]: number }
    closed?: boolean
    multipleVotes?: boolean
  }
) => {
  activeChannelAllMessages = activeChannelAllMessages.map((message) => {
    if (message.tid === messageId || message.id === messageId) {
      if (updatedParams.state === MESSAGE_STATUS.DELETE) {
        return { ...updatedParams }
      }
      if (voteDetails && voteDetails?.votes?.length && !voteDetails.multipleVotes && message.pollDetails) {
        message.pollDetails.votes = [
          ...(message.pollDetails.votes || []).filter(
            (vote: IPollVote) => vote.user.id !== voteDetails?.votes?.[0]?.user?.id
          )
        ]
      }
      let updatedMessage = {
        ...message,
        ...updatedParams,
        ...(voteDetails && voteDetails.votes && voteDetails.votesPerOption && message.pollDetails
          ? {
              pollDetails: {
                ...message.pollDetails,
                votes: [...(message.pollDetails?.votes || []), ...voteDetails.votes],
                votesPerOption: voteDetails.votesPerOption
              }
            }
          : {})
      }
      if (voteDetails && voteDetails.deletedVotes && updatedMessage.pollDetails) {
        updatedMessage = {
          ...updatedMessage,
          pollDetails: {
            ...updatedMessage.pollDetails,
            votes: deleteVotesFromPollDetails(updatedMessage.pollDetails.votes, voteDetails.deletedVotes),
            votesPerOption: voteDetails.votesPerOption
          }
        }
      }
      if (voteDetails && voteDetails.closed && updatedMessage.pollDetails) {
        updatedMessage = {
          ...updatedMessage,
          pollDetails: {
            ...updatedMessage.pollDetails,
            closed: voteDetails.closed
          }
        }
      }
      return updatedMessage
    }
    return message
  })
}

export const removeMessageFromAllMessages = (messageId: string) => {
  activeChannelAllMessages = [...activeChannelAllMessages].filter(
    (msg) => !(msg.id === messageId || msg.tid === messageId)
  )
}

export const updateMarkersOnAllMessages = (markersMap: any, name: string) => {
  activeChannelAllMessages = activeChannelAllMessages.map((message) => {
    if (
      markersMap[message.id] &&
      (message.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT || name === MESSAGE_DELIVERY_STATUS.READ)
    ) {
      return { ...message, deliveryStatus: name }
    }
    return message
  })
}

export const getAllMessages = () => activeChannelAllMessages

export const removeAllMessages = () => {
  activeChannelAllMessages = []
  setHasPrevCached(false)
  setHasNextCached(false)
}

export const setHasPrevCached = (state: boolean) => {
  prevCached = state
}
export const getHasPrevCached = () => prevCached

export const setHasNextCached = (state: boolean) => (nextCached = state)
export const getHasNextCached = () => nextCached

export const getFromAllMessagesByMessageId = (messageId: string, direction: string, getWithLastMessage?: boolean) => {
  let messagesForAdd: IMessage[] = []
  if (getWithLastMessage) {
    messagesForAdd = [...activeChannelAllMessages.slice(-MESSAGES_MAX_LENGTH)]
    setHasPrevCached(activeChannelAllMessages.length > MESSAGES_MAX_LENGTH)
    setHasNextCached(false)
  } else {
    const fromMessageIndex = activeChannelAllMessages.findIndex((mes) => mes.id === messageId)
    if (fromMessageIndex !== 0) {
      if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
        const sliceFromIndex =
          fromMessageIndex <= LOAD_MAX_MESSAGE_COUNT ? 0 : fromMessageIndex - (LOAD_MAX_MESSAGE_COUNT + 1)
        messagesForAdd = activeChannelAllMessages.slice(sliceFromIndex, fromMessageIndex)
        setHasPrevCached(!(messagesForAdd.length < LOAD_MAX_MESSAGE_COUNT || sliceFromIndex === 0))
        setHasNextCached(true)
      } else {
        const toMessage = fromMessageIndex + LOAD_MAX_MESSAGE_COUNT + 1
        messagesForAdd = activeChannelAllMessages.slice(fromMessageIndex + 1, toMessage)
        if (toMessage > activeChannelAllMessages.length - 1) {
          setHasNextCached(false)
        } else {
          setHasNextCached(!(messagesForAdd.length < LOAD_MAX_MESSAGE_COUNT))
        }
        setHasPrevCached(true)
      }
    } else {
      setHasPrevCached(false)
    }
  }

  return messagesForAdd
}

export function setMessagesToMap(channelId: string, messages: IMessage[]) {
  messagesMap[channelId] = messages
}

export function addMessageToMap(channelId: string, message: IMessage) {
  if (messagesMap[channelId] && messagesMap[channelId].length >= MESSAGES_MAX_LENGTH) {
    messagesMap[channelId].shift()
  }
  if (messagesMap[channelId]) {
    messagesMap[channelId].push(message)
  } else {
    messagesMap[channelId] = [message]
  }

  if (message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
    setPendingMessage(channelId, message)
  }
}

export function updateMessageOnMap(
  channelId: string,
  updatedMessage: { messageId: string; params: any },
  voteDetails?: {
    votes?: IPollVote[]
    deletedVotes?: IPollVote[]
    votesPerOption?: { [key: string]: number }
    closed?: boolean
    multipleVotes?: boolean
  }
) {
  if (updatedMessage.params.deliveryStatus !== MESSAGE_DELIVERY_STATUS.PENDING && pendingMessagesMap[channelId]) {
    if (
      updatedMessage.params.state === MESSAGE_STATUS.FAILED ||
      updatedMessage.params.state === MESSAGE_STATUS.UNMODIFIED
    ) {
      pendingMessagesMap[channelId] = pendingMessagesMap[channelId].map((msg) => {
        if (msg.tid === updatedMessage.messageId) {
          return { ...msg, ...updatedMessage.params }
        }
        return msg
      })
    } else {
      const filteredMessages = pendingMessagesMap[channelId].filter((msg) => msg.tid !== updatedMessage.messageId)
      if (filteredMessages && filteredMessages.length && filteredMessages.length > 0) {
        pendingMessagesMap[channelId] = filteredMessages
      } else {
        delete pendingMessagesMap[channelId]
      }
    }
  }
  let updatedMessageData = null
  if (messagesMap[channelId]) {
    const messagesList: IMessage[] = []
    for (const mes of messagesMap[channelId]) {
      if (mes.tid === updatedMessage.messageId || mes.id === updatedMessage.messageId) {
        if (updatedMessage.params.state === MESSAGE_STATUS.DELETE) {
          updatedMessageData = { ...updatedMessage.params }
          messagesList.push({ ...mes, ...updatedMessageData })
          continue
        } else {
          updatedMessageData = {
            ...mes,
            ...updatedMessage.params,
            ...(voteDetails && voteDetails.votes && voteDetails.votesPerOption && mes.pollDetails
              ? {
                  pollDetails: {
                    ...mes.pollDetails,
                    votes: [...(mes.pollDetails?.votes || []), ...voteDetails.votes],
                    votesPerOption: voteDetails.votesPerOption
                  }
                }
              : {})
          }
          if (
            voteDetails &&
            voteDetails?.votes?.length &&
            !voteDetails.multipleVotes &&
            updatedMessageData.pollDetails
          ) {
            updatedMessageData.pollDetails.votes = [
              ...(updatedMessageData.pollDetails.votes || []).filter(
                (vote: IPollVote) => vote.user.id !== voteDetails?.votes?.[0]?.user?.id
              )
            ]
          }
          if (voteDetails && voteDetails.deletedVotes && updatedMessageData.pollDetails) {
            updatedMessageData = {
              ...updatedMessageData,
              pollDetails: {
                ...updatedMessageData.pollDetails,
                votes: deleteVotesFromPollDetails(updatedMessageData.pollDetails.votes, voteDetails.deletedVotes),
                votesPerOption: voteDetails.votesPerOption
              }
            }
          }
          if (voteDetails && voteDetails.closed && updatedMessageData.pollDetails) {
            updatedMessageData = {
              ...updatedMessageData,
              pollDetails: {
                ...updatedMessageData.pollDetails,
                closed: voteDetails.closed
              }
            }
          }
          messagesList.push({ ...mes, ...updatedMessageData })
          continue
        }
      }
      messagesList.push(mes)
    }
    messagesMap[channelId] = messagesList
  }

  return updatedMessageData
}

export function addReactionToMessageOnMap(channelId: string, message: IMessage, reaction: IReaction, isSelf: boolean) {
  if (messagesMap[channelId]) {
    messagesMap[channelId] = messagesMap[channelId].map((msg) => {
      if (msg.id === message.id) {
        let slfReactions = [...msg.userReactions]
        if (isSelf) {
          if (slfReactions) {
            slfReactions.push(reaction)
          } else {
            slfReactions = [reaction]
          }
        }
        return {
          ...msg,
          userReactions: slfReactions,
          reactionTotals: message.reactionTotals
        }
      }
      return msg
    })
  }
}

export const addReactionOnAllMessages = (message: IMessage, reaction: IReaction, isSelf: boolean) => {
  activeChannelAllMessages = activeChannelAllMessages.map((msg) => {
    if (msg.id === message.id) {
      let slfReactions = [...msg.userReactions]
      if (isSelf) {
        if (slfReactions) {
          slfReactions.push(reaction)
        } else {
          slfReactions = [reaction]
        }
      }
      return {
        ...msg,
        userReactions: slfReactions,
        reactionTotals: message.reactionTotals
      }
    }
    return msg
  })
}

export function removeReactionToMessageOnMap(
  channelId: string,
  message: IMessage,
  reaction: IReaction,
  isSelf: boolean
) {
  if (messagesMap[channelId]) {
    messagesMap[channelId] = messagesMap[channelId].map((msg) => {
      if (msg.id === message.id) {
        let { userReactions } = msg
        if (isSelf) {
          userReactions = msg.userReactions.filter((selfReaction: IReaction) => selfReaction.key !== reaction.key)
        }
        return {
          ...msg,
          reactionTotals: message.reactionTotals,
          userReactions
        }
      }
      return msg
    })
  }
}

export const removeReactionOnAllMessages = (message: IMessage, reaction: IReaction, isSelf: boolean) => {
  activeChannelAllMessages = activeChannelAllMessages.map((msg) => {
    if (msg.id === message.id) {
      let { userReactions } = msg
      if (isSelf) {
        userReactions = msg.userReactions.filter((selfReaction: IReaction) => selfReaction.key !== reaction.key)
      }
      return {
        ...msg,
        reactionTotals: message.reactionTotals,
        userReactions
      }
    }
    return msg
  })
}

export function updateMessageStatusOnMap(channelId: string, newMarkers: { name: string; markersMap: any }) {
  if (messagesMap[channelId] && newMarkers && newMarkers.markersMap) {
    messagesMap[channelId] = messagesMap[channelId].map((mes) => {
      const { name } = newMarkers
      const { markersMap } = newMarkers
      if (
        markersMap[mes.id] &&
        (mes.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT || name === MESSAGE_DELIVERY_STATUS.READ)
      ) {
        return { ...mes, deliveryStatus: name }
      }
      return mes
    })
  }
}

export function getMessagesFromMap(channelId: string) {
  return messagesMap[channelId]
}

export function removeMessagesFromMap(channelId: string) {
  delete messagesMap[channelId]
}

export function removeMessageFromMap(channelId: string, messageId: string) {
  messagesMap[channelId] = [...messagesMap[channelId]].filter((msg) => !(msg.id === messageId || msg.tid === messageId))

  pendingMessagesMap[channelId] = [...pendingMessagesMap[channelId]].filter(
    (msg) => !(msg.id === messageId || msg.tid === messageId)
  )
}
export function removePendingMessageFromMap(channelId: string, messageId: string) {
  if (pendingMessagesMap[channelId]) {
    pendingMessagesMap[channelId] = [...pendingMessagesMap[channelId]].filter(
      (msg) => !(msg.id === messageId || msg.tid === messageId)
    )
  }
}

export function updatePendingMessageOnMap(channelId: string, messageId: string, updatedMessage: Partial<IMessage>) {
  if (pendingMessagesMap[channelId]) {
    pendingMessagesMap[channelId] = pendingMessagesMap[channelId].map((msg) => {
      if (msg.id === messageId || msg.tid === messageId) {
        return { ...msg, ...updatedMessage }
      }
      return msg
    })
  }
}

export function getMessageFromPendingMessagesMap(channelId: string, messageId: string) {
  if (pendingMessagesMap[channelId]) {
    return pendingMessagesMap[channelId].find((msg) => msg.id === messageId || msg.tid === messageId)
  }
  return null
}

export function clearMessagesMap() {
  messagesMap = {}
}

export function checkChannelExistsOnMessagesMap(channelId: string) {
  return !!messagesMap[channelId]
}

export function destroyChannelsMap() {
  messagesMap = {}
}

export const messagesDiff = (message: IMessage, updatedMessage: IMessage) =>
  message.deliveryStatus !== updatedMessage.deliveryStatus ||
  message.body !== updatedMessage.body ||
  message.state !== updatedMessage.state ||
  !checkArraysEqual(message.markerTotals, updatedMessage.markerTotals) ||
  !checkArraysEqual(message.mentionedUsers, updatedMessage.mentionedUsers) ||
  !checkArraysEqual(message.userReactions, updatedMessage.userReactions)

const pendingVideoAttachmentsThumbs: { [key: string]: IAttachmentMeta } = {}

export const setVideoThumb = (attachmentId: string, thumb: IAttachmentMeta) => {
  pendingVideoAttachmentsThumbs[attachmentId] = thumb
}

export const getVideoThumb = (attachmentId: string): IAttachmentMeta => {
  return pendingVideoAttachmentsThumbs[attachmentId]
}

export const deleteVideoThumb = (attachmentId: string) => {
  delete pendingVideoAttachmentsThumbs[attachmentId]
}

export const setPendingAttachment = (attachmentId: string, data: { file?: File; checksum?: string }) => {
  pendingAttachments[attachmentId] = { ...pendingAttachments[attachmentId], ...data }
}

export const getPendingAttachment = (attachmentId: string) => pendingAttachments[attachmentId]

export const deletePendingAttachment = (attachmentId: string) => delete pendingAttachments[attachmentId]

export const deletePendingMessage = (channelId: string, message: IMessage) => {
  if (message.attachments && message.attachments.length) {
    const customUploader = getCustomUploader()
    message.attachments.forEach((att: IAttachment) => {
      if (customUploader) {
        cancelUpload(att.tid!)
        deletePendingAttachment(att.tid!)
      }
    })
  }
  removeMessageFromMap(channelId, message.id || message.tid!)
  removeMessageFromAllMessages(message.id || message.tid!)
}

export const getPendingMessages = (channelId: string) => pendingMessagesMap[channelId]

export const setPendingMessage = (channelId: string, pendingMessage: IMessage) => {
  const pendingMessages = getPendingMessages(channelId)
  if (pendingMessages && pendingMessages?.length) {
    if (!pendingMessages?.find((msg: IMessage) => msg.tid === pendingMessage.tid)) {
      pendingMessages.push(pendingMessage)
    }
  } else {
    pendingMessagesMap[channelId] = [pendingMessage]
  }
}

export const getPendingMessagesMap = () => pendingMessagesMap

export const clearPendingMessagesMap = () => {
  Object.keys(pendingMessagesMap).forEach((channelId) => {
    delete pendingMessagesMap[channelId]
  })
}

export const draftMessagesMap: draftMessagesMap = {}
export const audioRecordingMap: audioRecordingMap = {}
export const getDraftMessageFromMap = (channelId: string) => draftMessagesMap[channelId]
export const getAudioRecordingFromMap = (channelId: string) => audioRecordingMap[channelId]

export const checkDraftMessagesIsEmpty = () => Object.keys(draftMessagesMap).length === 0

export const setAudioRecordingToMap = (channelId: string, audioRecording: any) => {
  audioRecordingMap[channelId] = audioRecording
}

export const removeDraftMessageFromMap = (channelId: string) => {
  delete draftMessagesMap[channelId]
}

export const removeAudioRecordingFromMap = (channelId: string) => {
  delete audioRecordingMap[channelId]
}

export const setDraftMessageToMap = (
  channelId: string,
  draftMessage: {
    text: string
    mentionedUsers: any
    messageForReply?: IMessage
    editorState?: any
    bodyAttributes?: any
  }
) => {
  draftMessagesMap[channelId] = draftMessage
}

let visibleMessagesMap: visibleMessagesMap = {}

export const getVisibleMessagesMap = () => visibleMessagesMap

export const clearVisibleMessagesMap = () => {
  visibleMessagesMap = {}
}

export const setMessageToVisibleMessagesMap = (message: IMessage) => {
  visibleMessagesMap[message.id] = { id: message.id }
}

export const removeMessageFromVisibleMessagesMap = (message: IMessage) => {
  delete visibleMessagesMap[message.id]
}

type PendingPollAction = {
  type: 'ADD_POLL_VOTE' | 'DELETE_POLL_VOTE' | 'CLOSE_POLL' | 'RETRACT_POLL_VOTE'
  channelId: string
  pollId: string
  optionId?: string
  message: IMessage
}

type pendingPollActionsMap = {
  [messageId: string]: PendingPollAction[]
}

const pendingPollActionsMap: pendingPollActionsMap = {}

export const checkPendingPollActionConflict = (
  action: PendingPollAction
): { hasConflict: boolean; shouldSkip: boolean } => {
  const messageId = action.message.id || action.message.tid
  if (!messageId) return { hasConflict: false, shouldSkip: false }

  if (!pendingPollActionsMap[messageId]) {
    return { hasConflict: false, shouldSkip: false }
  }

  // Check if deletePollVote comes and there's a pending addPollVote for same option - should skip both
  if (action.type === 'DELETE_POLL_VOTE' && action.optionId) {
    const hasPendingAdd = pendingPollActionsMap[messageId].some(
      (pendingAction) => pendingAction.type === 'ADD_POLL_VOTE' && pendingAction.optionId === action.optionId
    )
    if (hasPendingAdd && pendingPollActionsMap[messageId].length === 1) {
      return { hasConflict: true, shouldSkip: true }
    }
  }

  // Check if addPollVote comes and there's a pending deletePollVote for same option - should remove pending delete
  if (action.type === 'ADD_POLL_VOTE' && action.optionId) {
    const hasPendingDelete = pendingPollActionsMap[messageId].some(
      (pendingAction) => pendingAction.type === 'DELETE_POLL_VOTE' && pendingAction.optionId === action.optionId
    )
    if (hasPendingDelete) {
      return { hasConflict: true, shouldSkip: false }
    }
  }

  return { hasConflict: false, shouldSkip: false }
}

export const setPendingPollAction = (action: PendingPollAction) => {
  const messageId = action.message.id || action.message.tid
  if (!messageId) return

  if (!pendingPollActionsMap[messageId]) {
    pendingPollActionsMap[messageId] = []
  }

  // Handle conflict resolution: if addPollVote is pending and deletePollVote comes, remove the pending addPollVote
  if (action.type === 'DELETE_POLL_VOTE' && action.optionId) {
    pendingPollActionsMap[messageId] = pendingPollActionsMap[messageId].filter(
      (pendingAction) => !(pendingAction.type === 'ADD_POLL_VOTE' && pendingAction.optionId === action.optionId)
    )
    // If after filtering there are no more actions, skip adding this delete action
    if (pendingPollActionsMap[messageId].length === 0) {
      delete pendingPollActionsMap[messageId]
      return
    }
  }

  // Handle conflict: if deletePollVote is pending and addPollVote comes, remove the pending deletePollVote
  if (action.type === 'ADD_POLL_VOTE' && action.optionId) {
    pendingPollActionsMap[messageId] = pendingPollActionsMap[messageId].filter(
      (pendingAction) => !(pendingAction.type === 'DELETE_POLL_VOTE' && pendingAction.optionId === action.optionId)
    )
  }

  pendingPollActionsMap[messageId].push(action)
}

export const getPendingPollActionsMap = () => pendingPollActionsMap

export const clearPendingPollActionsMap = () => {
  Object.keys(pendingPollActionsMap).forEach((messageId) => {
    delete pendingPollActionsMap[messageId]
  })
}

export const removePendingPollAction = (messageId: string, actionType: string, optionId?: string) => {
  if (!pendingPollActionsMap[messageId]) return

  pendingPollActionsMap[messageId] = pendingPollActionsMap[messageId].filter(
    (action) => !(action.type === actionType && (!optionId || action.optionId === optionId))
  )

  if (pendingPollActionsMap[messageId].length === 0) {
    delete pendingPollActionsMap[messageId]
  }
}
