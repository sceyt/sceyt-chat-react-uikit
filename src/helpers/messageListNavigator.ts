/**
 * Module-level registry that lets MessagesSearch call jumpToItem
 * from MessageList without requiring prop drilling or a shared parent.
 * MessageList registers its jumpToItem on mount and unregisters on unmount.
 */

let jumpFn: ((itemId: string) => void) | null = null

export function registerMessageListNavigator(fn: (itemId: string) => void): void {
  jumpFn = fn
}

export function unregisterMessageListNavigator(): void {
  jumpFn = null
}

export function navigateToMessage(itemId: string): void {
  jumpFn?.(itemId)
}

/**
 * Registry for jumpToLatest — lets the saga scroll the message list to the
 * bottom (loading latest messages if needed) without Redux round-trips.
 */

let jumpToLatestFn: ((smooth?: boolean) => Promise<void>) | null = null

export function registerJumpToLatest(fn: (smooth?: boolean) => Promise<void>): void {
  jumpToLatestFn = fn
}

export function unregisterJumpToLatest(): void {
  jumpToLatestFn = null
}

export function navigateToLatest(smooth = true): void {
  jumpToLatestFn?.(smooth)
}
