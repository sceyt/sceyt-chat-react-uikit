const READ_MESSAGE_LOG_KEY_ALIASES: Record<string, string> = {
  source: 's',
  channelId: 'ch',
  readAll: 'ra',
  messageIds: 'mi',
  messageId: 'm',
  connectionStatus: 'cs',
  attempts: 'at',
  retryDelayMs: 'rd',
  requestedMessageIds: 'rq',
  confirmedMessageIds: 'cf',
  isVisible: 'iv',
  alreadyRead: 'ar',
  disableAutoReadTracking: 'da',
  isTabActive: 'ta',
  newMessageCount: 'nm',
  queued: 'q',
  localRef: 'lr',
  visibleCandidateIds: 'vc',
  unreadScrollTo: 'us',
  pendingFrameScheduled: 'pf'
}

export const compactReadMessageLogData = (data: Record<string, unknown>) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(data).map(([key, value]) => [READ_MESSAGE_LOG_KEY_ALIASES[key] || key.slice(0, 2), value])
    )
  )
