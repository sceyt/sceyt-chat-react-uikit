// Characters that can follow a mention in text: whitespace and punctuation.
const MENTION_END = /[\s.,!?;:'"()[\]{}<>…\-–—/\\*&%#+=~|^]/

export interface MentionMatch<T> {
  start: number
  end: number
  pattern: string
  member: T
}

/**
 * Finds the mentions (`@Full Name` of the given members) in pasted text. A mention starts the text
 * or follows whitespace, and can be followed by punctuation ("@Anna, hi") but not by more of a name
 * ("@Annabel"). The longest name wins where names overlap.
 */
export const findMentionsInText = <T>(text: string, candidates: Array<{ pattern: string; member: T }>) => {
  const matches: Array<MentionMatch<T>> = []
  const sortedCandidates = [...candidates].sort((a, b) => b.pattern.length - a.pattern.length)

  sortedCandidates.forEach(({ pattern, member }) => {
    let searchIndex = 0
    while (true) {
      const index = text.indexOf(pattern, searchIndex)
      if (index === -1) break

      const end = index + pattern.length
      const isOverlapping = matches.some((match) => index < match.end && end > match.start)
      const charBefore = index > 0 ? text[index - 1] : undefined
      const isValidStart = charBefore === undefined || /\s/.test(charBefore)
      const charAfter = text[end]
      const isValidEnd = charAfter === undefined || MENTION_END.test(charAfter)

      if (!isOverlapping && isValidStart && isValidEnd) {
        matches.push({ start: index, end, pattern, member })
      }
      searchIndex = index + 1
    }
  })

  return matches.sort((a, b) => a.start - b.start)
}
