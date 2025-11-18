import { useMemo } from 'react'
import { IAttachment } from '../../../../types'
import { formatMonthHeader, getMonthKey } from '../../../../helpers'
import { GroupedAttachment } from './types'

/**
 * Custom hook to group attachments by month
 * @returns Grouped attachments sorted by month (newest first)
 */
export const useGroupedAttachments = (attachments: IAttachment[]): GroupedAttachment[] => {
  return useMemo(() => {
    if (!attachments || attachments.length === 0) {
      return []
    }

    const groups: { [key: string]: IAttachment[] } = {}

    attachments.forEach((file: IAttachment) => {
      const monthKey = getMonthKey(file.createdAt)
      if (!monthKey) return

      if (!groups[monthKey]) {
        groups[monthKey] = []
      }
      groups[monthKey].push(file)
    })

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((monthKey) => ({
        monthKey,
        monthHeader: formatMonthHeader(groups[monthKey][0].createdAt),
        files: groups[monthKey]
      }))
  }, [attachments])
}
