type MessageListAlignment = 'center' | 'start'

export const getMessageListScrollContainer = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null
  return document.getElementById('scrollableDiv') as HTMLElement | null
}

export const getMessageListScrollTop = (
  container: HTMLElement,
  element: HTMLElement,
  alignment: MessageListAlignment = 'center'
): number => {
  if (alignment === 'start') {
    return Math.max(0, element.offsetTop)
  }

  return Math.max(0, element.offsetTop - (container.offsetHeight - element.offsetHeight) / 2)
}

export const scrollMessageInList = (
  element: HTMLElement,
  options: {
    container?: HTMLElement | null
    behavior?: ScrollBehavior
    alignment?: MessageListAlignment
  } = {}
) => {
  const { container = getMessageListScrollContainer(), behavior = 'smooth', alignment = 'center' } = options

  if (!container) {
    element.scrollIntoView({ behavior, block: alignment === 'center' ? 'center' : 'start' })
    return
  }

  container.scrollTo({
    top: getMessageListScrollTop(container, element, alignment),
    behavior
  })
}
