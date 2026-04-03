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
