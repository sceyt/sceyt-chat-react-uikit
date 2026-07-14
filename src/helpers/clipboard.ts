export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) {}

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textarea)
      return successful
    }
  } catch (e) {}
  return false
}

export async function copyRichTextToClipboard(html: string, plainText: string): Promise<boolean> {
  try {
    const clipboard = navigator.clipboard as any
    if (typeof navigator !== 'undefined' && clipboard && clipboard.write) {
      const htmlBlob = new Blob([html], { type: 'text/html' })
      const textBlob = new Blob([plainText], { type: 'text/plain' })
      const ClipboardItemCtor = (window as any).ClipboardItem
      const clipboardItem = new ClipboardItemCtor({
        'text/html': htmlBlob,
        'text/plain': textBlob
      })
      await clipboard.write([clipboardItem])
      return true
    }
  } catch (e) {}

  try {
    if (typeof document !== 'undefined') {
      const container = document.createElement('div')
      container.innerHTML = html
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.opacity = '0'
      document.body.appendChild(container)
      const range = document.createRange()
      range.selectNodeContents(container)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
        const successful = document.execCommand('copy')
        selection.removeAllRanges()
        document.body.removeChild(container)
        return successful
      }
      document.body.removeChild(container)
    }
  } catch (e) {}

  return copyToClipboard(plainText)
}
