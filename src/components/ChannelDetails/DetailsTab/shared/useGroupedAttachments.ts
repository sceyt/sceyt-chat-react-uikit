import { useMemo } from 'react'
import { IAttachment } from '../../../../types'
import { formatMonthHeader, getMonthKey } from '../../../../helpers'
import { GroupedAttachment } from './types'

export const useGroupedAttachments = (attachments: IAttachment[]): GroupedAttachment[] => {
  return useMemo(() => {
    const length = attachments?.length
    if (!length) {
      return []
    }
    const groupsMap = new Map<string, { files: IAttachment[]; firstFile: IAttachment }>()

    for (let i = 0; i < length; i++) {
      const file = attachments[i]
      const monthKey = getMonthKey(file.createdAt)

      if (!monthKey) continue

      const existing = groupsMap.get(monthKey)
      if (existing) {
        existing.files.push(file)
      } else {
        groupsMap.set(monthKey, {
          files: [file],
          firstFile: file
        })
      }
    }

    const groupCount = groupsMap.size
    if (groupCount === 0) {
      return []
    }

    const entries = Array.from(groupsMap.entries())

    entries.sort(([keyA], [keyB]) => {
      return keyA > keyB ? -1 : keyA < keyB ? 1 : 0
    })

    const result: GroupedAttachment[] = new Array(groupCount)

    for (let i = 0; i < groupCount; i++) {
      const [monthKey, { files, firstFile }] = entries[i]
      result[i] = {
        monthKey,
        monthHeader: formatMonthHeader(firstFile.createdAt),
        files
      }
    }

    return result
  }, [attachments])
}
