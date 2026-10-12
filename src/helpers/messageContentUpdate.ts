import { IMessage } from '../types'
import { MESSAGE_STATUS } from './constants'

// Optimistic edits, queued acknowledgements and rollback snapshots explicitly
// bypass this check: their clocks need not match server edit timestamps.
export const shouldSkipMessageContentUpdate = (known: IMessage | null | undefined, incoming: Partial<IMessage>) => {
  if (!known || incoming.state !== MESSAGE_STATUS.EDIT) return false
  if (known.state === MESSAGE_STATUS.DELETE) return true
  const time = (value?: Date) =>
    value == null ? NaN : new Date(value instanceof Date ? value.getTime() : value).getTime()
  const knownTime = time(known.updatedAt)
  const incomingTime = time(incoming.updatedAt)
  return Number.isFinite(knownTime) && Number.isFinite(incomingTime) && incomingTime < knownTime
}
