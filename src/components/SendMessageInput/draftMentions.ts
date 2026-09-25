type DraftMentionSegment = {
  text: string
  mentionId?: string
  mentionedUser?: any
}

/** Splits a serialized draft into plain text and mention ranges for editor restoration. */
export const getDraftMentionSegments = (
  text: string,
  bodyAttributes: any[] = [],
  mentionedUsers: any[] = []
): DraftMentionSegment[] => {
  const mentionAttributes = bodyAttributes
    .filter((attribute) => attribute?.type?.includes('mention'))
    .sort((a, b) => a.offset - b.offset)
  const segments: DraftMentionSegment[] = []
  let cursor = 0

  mentionAttributes.forEach((attribute) => {
    const start = Math.max(0, attribute.offset)
    const end = Math.min(text.length, start + attribute.length)
    if (start < cursor || end <= start) return

    if (start > cursor) segments.push({ text: text.slice(cursor, start) })

    const mentionedUser = mentionedUsers.find((user) => user?.id === attribute.metadata)
    segments.push({ text: text.slice(start, end), mentionId: attribute.metadata, mentionedUser })
    cursor = end
  })

  if (cursor < text.length) segments.push({ text: text.slice(cursor) })
  return segments
}
