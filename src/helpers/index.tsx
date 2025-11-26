import { IAttachment, IContact, IUser } from '../types'
import FileSaver from 'file-saver'
import moment from 'moment'
import { getCustomDownloader, getCustomUploader } from './customUploader'
import log from 'loglevel'

// eslint-disable-next-line
export const urlRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi

export const bytesToSize = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1000
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

export const systemMessageUserName = (userId: string, contact?: IContact, mentionedUsers?: IUser[]) => {
  let user
  if (!contact && mentionedUsers && mentionedUsers.length) {
    user = mentionedUsers.find((menUser) => menUser.id === userId)
  }
  return contact
    ? contact.firstName
      ? contact.firstName.split(' ')[0]
      : contact.id
    : userId
      ? user
        ? `~${user.firstName.split(' ')[0]}`
        : userId
      : 'Deleted user'
}

const filesPromisesOnDownload: { [key: string]: any } = {}

export const setDownloadFilePromise = (attachmentId: string, promise: any) => {
  filesPromisesOnDownload[attachmentId] = promise
}
export const downloadFile = async (
  attachment: IAttachment,
  download: boolean,
  // eslint-disable-next-line no-unused-vars
  done?: (attachmentId: string, failed?: boolean) => void,
  // eslint-disable-next-line no-unused-vars
  progressCallback?: (progress: { loaded: number; total: number }) => void,
  messageType?: string | null | undefined
) => {
  try {
    const customDownloader = getCustomDownloader()
    let response
    if (customDownloader) {
      const urlPromise = customDownloader(
        attachment.url,
        download,
        (progress) => {
          if (progressCallback) {
            progressCallback(progress)
          }
        },
        messageType
      )
      filesPromisesOnDownload[attachment.id!] = urlPromise
      const result = await urlPromise
      /* response = await fetch(result)
      const data = await response.blob()
      if (done) {
        delete filesPromisesOnDownload[attachment.id!]
        done(attachment.id || '')
      } */
      FileSaver.saveAs(result.Body, attachment.name)
      if (done) {
        done(attachment.id || '')
      }
      delete filesPromisesOnDownload[attachment.id!]
      /* urlPromise.then(async (url) => {
        response = await fetch(url)
        const data = await response.blob()
        if (done) {
          delete filesPromisesOnDownload[attachment.id!]
          done(attachment.id || '')
        }
        FileSaver.saveAs(data, attachment.name)
      }) */
      /*  customDownloader(attachment.url, (progress) => {
        if (progressCallback) {
          progressCallback(progress)
        }
      }).then(async (url) => {
        response = await fetch(url)
        const data = await response.blob()
        if (done) {
          done(attachment.id || '')
        }
        FileSaver.saveAs(data, attachment.name)
      }) */
    } else {
      response = await fetch(attachment.url)
      const data = await response.blob()
      if (done) {
        done(attachment.id || '')
      }
      FileSaver.saveAs(data, attachment.name)
    }
  } catch (e) {
    log.error('error on download... ', e)
    if (done) {
      done(attachment.id || '', true)
    }
  }
}

export const cancelDownloadFile = (attachmentId: string) => {
  const promise = filesPromisesOnDownload[attachmentId]
  if (promise) {
    const customUploader = getCustomUploader()
    if (customUploader) {
      customUploader.cancelRequest(promise)
    }
  }
}

export const calculateRenderedImageWidth = (width: number, height: number, maxWidth?: number, maxHeight?: number) => {
  const maxWdt = maxWidth || 420
  const maxHg = maxHeight || 400
  const minWidth = 165
  const aspectRatio = width / height
  if (aspectRatio >= maxWdt / maxHg) {
    return [Math.max(minWidth, Math.min(maxWdt, width)), Math.min(maxHg, height, maxWdt / aspectRatio) + 2]
  } else {
    if (maxHg <= height) {
      return [Math.min(maxWdt, maxHg * aspectRatio), Math.min(maxHg, height)]
    } else {
      return [Math.min(maxWdt, height * aspectRatio), Math.min(maxHg, height)]
    }
  }
}

/**
 * Format: DD.MM.YY, HH:mm (e.g., "25.09.16, 22:00")
 * Supports localization based on user's browser locale and timezone
 * Uses the exact sent/uploaded time from createdAt
 * @param date - Date object, timestamp, or date string
 * @returns Formatted date string localized according to browser settings
 */
export const formatChannelDetailsDate = (date: Date | number | string): string => {
  if (!date) return ''
  const momentDate = moment(date)
  return momentDate.isValid() ? momentDate.format('DD.MM.YY, HH:mm') : ''
}

export const userLastActiveDateFormat = (date: Date) => {
  // check for the last hour
  const formattingDate = moment(date).format()
  const currentTime = moment()
  const minutesDiff = currentTime.diff(formattingDate, 'minutes')
  if (minutesDiff <= 59) {
    return `Last seen ${minutesDiff === 0 ? 1 : minutesDiff} ${minutesDiff > 1 ? ' minutes ago' : ' minute ago'}`
  }

  // check for current day
  const startOfDay = moment().startOf('day')
  const isToday = moment(date).diff(startOfDay) >= 0
  if (isToday) {
    return `Last seen ${moment(date).format('HH:mm')}`
  }

  // check for yesterday
  const yesterday = moment().subtract(1, 'day').startOf('day')
  const isInYesterday = moment(date).diff(yesterday) >= 0
  if (isInYesterday) {
    return `Last seen Yesterday at ${moment(date).format('HH:mm')}`
  }

  // check for last week
  const isInLastWeek = moment().diff(moment(date), 'weeks') < 1
  if (isInLastWeek) {
    return `Last seen ${moment(date).format('dddd')} at ${moment(date).format('HH:mm')}`
  }

  // return formatted date
  return `Last seen ${moment(date).format('DD.MM.YY')}`
}

export const checkArraysEqual = (arr1: any[], arr2: any[]) => {
  // if the other array is a falsy value, return
  if (!arr2) return false
  // if the argument is the same array, we can be sure the contents are same as well
  if (arr1 === arr2) return true
  // compare lengths - can save a lot of time
  if (arr1.length !== arr2.length) return false

  for (let i = 0, l = arr1.length; i < l; i++) {
    // Check if we have nested arrays
    if (arr1[i] instanceof Array && arr2[i] instanceof Array) {
      // recurse into the nested arrays
      if (!arr1[i].equals(arr2[i])) return false
    } else if (arr1[i] !== arr2[i]) {
      // Warning - two different object instances will never be equal: {x:20} != {x:20}
      return false
    }
  }
  return true
}

export const getMetadataFromUrl = (url: string): Promise<any> => {
  return fetch(url)
    .then((response) => response.text())
    .then((data) => {
      // Extract metadata from the HTML
      const parser = new DOMParser()
      const doc = parser.parseFromString(data, 'text/html')
      // @ts-ignore
      const title = doc.querySelector('title').innerText

      // Extract the description
      // @ts-ignore
      const description = (
        doc.querySelector("meta[name='twitter:description']") ||
        doc.querySelector("meta[property='og:description']") ||
        doc.querySelector("meta[name='description']")
      ).getAttribute('content')
      let image
      // Extract the image
      // @ts-ignore
      const imageSrc = (
        doc.querySelector("meta[name='twitter:image']") || doc.querySelector("meta[property='og:image']")
      ).getAttribute('content')
      if (!(imageSrc && imageSrc.startsWith('http'))) {
        image = `${url.slice(0, -1)}${imageSrc}`
      } else {
        image = imageSrc
      }
      return { title, description, image }
    })
    .catch((error) => log.error(error))
}

export const formatAudioVideoTime = (currentTime: number) => {
  const minutes = Math.floor(currentTime / 60)
  const seconds = Math.floor(currentTime % 60)
  return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`
}

// export const formatLargeText = (text: string, maxWidth: number, container: any) => {
export const formatLargeText = (text: string, maxLength: number): any => {
  if (text.length > maxLength) {
    const firstHalf = text.slice(0, maxLength / 2 - 1)
    const secondHalf = text.slice(-(maxLength / 2))
    if (firstHalf.length + secondHalf.length > maxLength) {
      return formatLargeText(firstHalf + secondHalf, maxLength)
    } else {
      return firstHalf + '...' + secondHalf
    }
  } else {
    return text
  }
  /*  const containerWidth = maxWidth
  const textWidth = container && container.querySelector('span').getBoundingClientRect().width
  log.info('text width . ', textWidth)
  log.info('containerWidth . ', containerWidth)
  if (textWidth > containerWidth) {
    const diff = containerWidth / textWidth
    const symbolsRes = text.length * diff
    log.info('text.length ... ', text.length)
    log.info('symbolsRes ... ', symbolsRes)
    const firstHalf = text.slice(0, text.length / 2 - 3)
    const secondHalf = text.slice(-(symbolsRes / 2))
    log.info('result .... ', firstHalf + '...' + secondHalf)
    return firstHalf + '...' + secondHalf
  }
  return text */
}

export const getLastTwoChars = (element: any) => {
  const doc = element.ownerDocument || element.document
  const win = doc.defaultView || doc.parentWindow
  const selection = win.getSelection()
  const focusOffset = selection.focusOffset
  const focusNode = selection.focusNode
  if (focusNode.nodeName !== 'SPAN') {
    return focusNode.textContent?.slice(focusOffset - 2, focusOffset)
  }
  return ''
}
export const getCaretPosition = (element: any) => {
  let caretOffset = 0
  // const textNodes = 0
  const doc = element.ownerDocument || element.document
  const win = doc.defaultView || doc.parentWindow
  const selection = win.getSelection()
  // log.info('get pos .>>> >> >selection', selection)
  const focusOffset = selection.focusOffset
  const focusNode = selection.focusNode
  // const text = element.innerText
  // log.info('focusOffset. . . . .', focusOffset)
  // log.info('focusNode. . . . .', focusNode)
  // const separateLines = text.split(/\r?\n|\r|\n/g)
  // log.info('setperate lines .... ', separateLines)
  // let textNodesAdded = false
  // log.info('element.childNodes. . . ', element.childNodes)
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i]
    if (node.nodeType === Node.TEXT_NODE) {
      if (node === focusNode) {
        // textNodesAdded = true
        // caretOffset += focusOffset + textNodes
        caretOffset += focusOffset
        break
      } else {
        caretOffset += node.nodeValue.length
      }
    } else if (node.nodeName === 'SPAN') {
      if (node.contains(focusNode)) {
        // textNodesAdded = true
        caretOffset += focusOffset
        // caretOffset += focusOffset + textNodes
        break
      } else {
        caretOffset += node.innerText.length
      }
    } else {
      const browser = detectBrowser()
      if (browser === 'Safari' && node.innerText && node.innerText.length) {
        caretOffset += node.innerText.length + 1
      }
      // textNodes += 1
    }
    if (element.childNodes[i + 1] && element.childNodes[i + 1].nodeName === 'BR') {
      // log.info('add line. ...   1 .. ', 1)
      caretOffset += 1
    }
    /* if (element.childNodes.length === i + 1 && !textNodesAdded) {
      caretOffset += textNodes
    } */
  }
  return caretOffset
}

export const setCursorPosition = (
  element: any,
  position: number,
  isAddMention?: boolean,
  attempt: number | undefined = 0
) => {
  try {
    log.info('set pos ... ', position)
    const range = document.createRange()
    const sel = window.getSelection()
    let currentNode = element.childNodes[0]
    let caretOffset = 0
    // let textNodes = 0
    let textNodesAdded = false
    let currentNodeIsFind = false
    // log.info('element.childNodes. . . .', element.childNodes)
    element.childNodes.forEach((node: any, index: number) => {
      if (!currentNodeIsFind && node.nodeType === Node.TEXT_NODE) {
        currentNode = node
        const textLength = node.nodeValue.length
        // log.info('currentNode .. .. . 1 .. ', currentNode)
        // log.info('node.nodeValue .. .. . 1 .. ', node.nodeValue)
        // log.info('textLength .. .. . 1 .. ', textLength)
        // log.info('caretOffset + textLength .. .. . 1 .. caretOffset ', caretOffset)
        // log.info('caretOffset + textLength .. .. . 1 .. textLength ', textLength)
        // log.info('caretOffset + textLength .. .. . 1 .. res ', caretOffset + textLength)
        caretOffset = caretOffset + textLength
        // log.info('caretOffset .. .. . 1 .. ', caretOffset)
        if (element.childNodes.length === index + 1) {
          textNodesAdded = true
          // log.info('add text nodes. ...   1 .. ', textNodes)
          // caretOffset += textNodes
        }
        if (caretOffset >= position) {
          currentNodeIsFind = true
          currentNode = node
          if (!textNodesAdded) {
            // log.info('add text nodes. ...   2 .. ', textNodes)
            // caretOffset += textNodes
          }
          // log.info('position - (caretOffset - textLength) .. .. . 2 .. caretOffset ', caretOffset)
          // log.info('position - (caretOffset - textLength) .. .. . 2 .. textLength ', textLength)
          // log.info('position - (caretOffset - textLength) .. .. . 2 .. res ', position - (caretOffset - textLength))
          caretOffset = position - (caretOffset - textLength)
          return
        }
        // caretOffset += 1
      } else if (!currentNodeIsFind) {
        if (node.nodeName === 'SPAN') {
          caretOffset += node.innerText.length

          // log.info('caretOffset +. 2  - 1 .. caretOffset ', caretOffset)
          // log.info('node.innerText.length +. 2  - 1 ..  ', node.innerText.length)
          // log.info('caretOffset +innerText.length. 2  - 1 .. caretOffset ', caretOffset + node.innerText.length)
          if (caretOffset >= position) {
            currentNodeIsFind = true
            currentNode = element.childNodes[index + 1]
            /* if (!mentionFound && isAddMention) {
              log.info('!mentionFound && isAddMention . . . . . . .', !mentionFound && isAddMention)
              caretOffset += 1
            } */
            // log.info('set current node .... ', currentNode)
            // log.info('caretOffset .... ', caretOffset)
            // caretOffset = position - (caretOffset - node.innerText.length)
            if (isAddMention) {
              caretOffset = 1
            } else {
              caretOffset = position - caretOffset
            }
            // log.info('set caretOffset 2  - 1 .... ', caretOffset)
            return
          }
        } else {
          // textNodes += 1
        }
      }
      if (element.childNodes[index + 1] && !currentNodeIsFind && element.childNodes[index + 1].nodeName === 'BR') {
        // log.info('add line. ...   1 .. ', 1)
        caretOffset += 1
      }
      if (element.childNodes.length === index + 1 && !currentNodeIsFind) {
        if (!textNodesAdded) {
          // log.info('add text nodes. ...   3 .. ', textNodes)
          // caretOffset += textNodes
        }
        currentNodeIsFind = true
        if (position > caretOffset) {
          // log.info('add line. ...   2 .. ', 1)
          caretOffset++
        }
        currentNode = node
        // log.info('caretOffset - position .. .. . 3 .. caretOffset ', caretOffset)
        // log.info('caretOffset - position .. .. . 3 .. position ', position)
        // log.info('caretOffset - position .. .. . 3 .. res ', caretOffset - position)
        caretOffset = caretOffset - position
      }
    })

    // log.info('caretOffset. . . . .', caretOffset)
    // log.info('currentNode. . . . .', currentNode)
    range.setStart(currentNode, caretOffset)
    range.collapse(true)
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  } catch (e) {
    // log.info('position not exist attempt', attempt, 'e.', e)
    if (attempt <= 5) {
      setCursorPosition(element, position - 1, isAddMention, ++attempt)
    }
  }
}

export const setSelectionRange = (element: any, start: number, end: number, attempt: number | undefined = 0) => {
  try {
    const range = document.createRange()
    const sel = window.getSelection()
    let currentNodeStart = element.childNodes[0]
    let currentNodeEnd = element.childNodes[0]
    let caretOffsetStart = 0
    let caretOffsetEnd = 0
    let currentNodeStartIsFind = false
    let currentNodeEndIsFind = false
    element.childNodes.forEach((node: any, index: number) => {
      if (!currentNodeStartIsFind && node.nodeType === Node.TEXT_NODE) {
        currentNodeStart = node
        const textLength = node.nodeValue.length
        caretOffsetStart = caretOffsetStart + textLength

        if (caretOffsetStart >= start) {
          currentNodeStartIsFind = true
          currentNodeStart = node

          caretOffsetStart = start - (caretOffsetStart - textLength)
        } else if (caretOffsetEnd >= end) {
          currentNodeEnd = node
        }
        // caretOffset += 1
      } else if (!currentNodeStartIsFind) {
        if (node.nodeName === 'SPAN') {
          caretOffsetStart += node.innerText.length

          if (caretOffsetStart >= start) {
            currentNodeStartIsFind = true
            currentNodeStart = node
            caretOffsetStart = start - caretOffsetStart
          }
        } else {
          // textNodes += 1
        }
      }
      if (!currentNodeEndIsFind && node.nodeType === Node.TEXT_NODE) {
        currentNodeEnd = node
        const textLength = node.nodeValue.length
        caretOffsetEnd = caretOffsetEnd + textLength

        if (caretOffsetEnd >= end) {
          currentNodeEndIsFind = true
          currentNodeEnd = node
          caretOffsetEnd = end - (caretOffsetEnd - textLength)
          return
        }
        // caretOffset += 1
      } else if (!currentNodeEndIsFind) {
        if (node.nodeName === 'SPAN') {
          caretOffsetEnd += node.innerText.length

          if (caretOffsetEnd >= end) {
            currentNodeEndIsFind = true
            currentNodeEnd = node
            caretOffsetEnd = 1
            return
          }
        } else {
          // textNodes += 1
        }
      }
      if (element.childNodes[index + 1] && element.childNodes[index + 1].nodeName === 'BR') {
        if (!currentNodeStartIsFind) {
          log.info('start +=1')
          caretOffsetStart += 1
        }
        if (!currentNodeEndIsFind) {
          log.info('+=1')
          caretOffsetEnd += 1
        }
      }
      if (element.childNodes.length === index + 1) {
        if (!currentNodeStartIsFind) {
          currentNodeStartIsFind = true
          if (start > caretOffsetStart) {
            caretOffsetStart++
          }
          currentNodeStart = node
          caretOffsetStart = caretOffsetStart - start
        }
        if (!currentNodeEndIsFind) {
          currentNodeEndIsFind = true
          currentNodeEnd = node
          caretOffsetEnd = caretOffsetEnd - end
        }
      }
    })
    range.setStart(currentNodeStart, caretOffsetStart)
    range.setEnd(currentNodeEnd, caretOffsetEnd)
    // range.collapse(true)
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  } catch (e) {
    log.error('position not exist attempt', attempt, 'e.', e)
    if (attempt <= 5) {
      setSelectionRange(element, start - 1, end - 1, ++attempt)
    }
  }
}

export const placeCaretAtEnd = (el: any) => {
  el.focus()
  if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel!.removeAllRanges()
    sel!.addRange(range)
  } else {
    // @ts-ignore
    if (typeof document.body.createTextRange !== 'undefined') {
      // @ts-ignore
      const textRange = document.body.createTextRange()
      textRange.moveToElementText(el)
      textRange.collapse(false)
      textRange.select()
    }
  }
}
export const detectOS = () => {
  const userAgent = window.navigator.userAgent
  const platform = window.navigator.platform
  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K']
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE']
  const iosPlatforms = ['iPhone', 'iPad', 'iPod']
  let os = null

  if (macosPlatforms.includes(platform)) {
    os = 'Mac OS'
  } else if (iosPlatforms.includes(platform)) {
    os = 'iOS'
  } else if (windowsPlatforms.includes(platform)) {
    os = 'Windows'
  } else if (/Android/.test(userAgent)) {
    os = 'Android'
  } else if (/Linux/.test(platform)) {
    os = 'Linux'
  }

  return os
}
export const detectBrowser = () => {
  let browser = ''
  if (window && window.navigator) {
    const userAgent = window.navigator.userAgent

    if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      browser = 'Opera'
    } else if (userAgent.includes('Edge')) {
      browser = 'Edge'
    } else if (userAgent.includes('Chrome')) {
      browser = 'Chrome'
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari'
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox'
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
      browser = 'Internet Explorer'
    }
  }
  return browser
}

export const getEmojisCategoryTitle = (categoryKey: string) => {
  let category

  switch (categoryKey) {
    case 'People':
      category = 'Smileys & People'
      break
    case 'Animals':
      category = 'Animals & Nature'
      break
    case 'Food':
      category = 'Food & Drink'
      break
    case 'Travel':
      category = 'Travel & Places'
      break
    case 'Objects':
      category = 'Objects'
      break
    case 'Symbols':
      category = 'Symbols'
      break
    case 'Flags':
      category = 'Flags'
      break
    default:
      category = ''
      break
  }
  return category
}

export const hashString = async (str: string) => {
  const encoder = new TextEncoder()
  const encodedData = encoder.encode(str)
  let hashBuffer: any
  try {
    hashBuffer = await crypto.subtle.digest('SHA-256', encodedData)
  } catch (e) {
    // const crypto = await import('crypto')
    // hashBuffer = await crypto.subtle.digest('SHA-256', encodedData)
    return ''
  }
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Formats disappearing message period from milliseconds to human-readable string
 * @param periodInMilliseconds - Period in milliseconds (or 0/null for "Off")
 * @returns Formatted string like "1 hour", "1 week", "2 days", etc., or "Off"
 */
export const formatDisappearingMessageTime = (periodInMilliseconds: number | null | undefined): string => {
  if (!periodInMilliseconds) {
    return 'Off'
  }

  // Convert milliseconds to seconds
  const periodInSeconds = periodInMilliseconds / 1000

  // Fixed timer options (in seconds)
  const FIXED_TIMER_OPTIONS: Record<string, number> = {
    '1day': 60 * 60 * 24,
    '1week': 60 * 60 * 24 * 7,
    '1month': 60 * 60 * 24 * 30
  }

  // Custom options (in seconds)
  const CUSTOM_OPTIONS = [
    { label: '1 day', seconds: 60 * 60 * 24 },
    { label: '2 days', seconds: 60 * 60 * 24 * 2 },
    { label: '3 days', seconds: 60 * 60 * 24 * 3 },
    { label: '4 days', seconds: 60 * 60 * 24 * 4 },
    { label: '5 days', seconds: 60 * 60 * 24 * 5 },
    { label: '1 week', seconds: 60 * 60 * 24 * 7 },
    { label: '2 weeks', seconds: 60 * 60 * 24 * 14 },
    { label: '1 month', seconds: 60 * 60 * 24 * 30 }
  ]

  // Check fixed options first
  if (periodInSeconds === FIXED_TIMER_OPTIONS['1day']) {
    return '1 day'
  }
  if (periodInSeconds === FIXED_TIMER_OPTIONS['1week']) {
    return '1 week'
  }
  if (periodInSeconds === FIXED_TIMER_OPTIONS['1month']) {
    return '1 month'
  }

  // Check custom options
  const customMatch = CUSTOM_OPTIONS.find((option) => option.seconds === periodInSeconds)
  if (customMatch) {
    return customMatch.label
  }

  // Fallback: calculate and format dynamically
  const days = Math.floor(periodInSeconds / (60 * 60 * 24))
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const hours = Math.floor(periodInSeconds / (60 * 60))

  if (months > 0) {
    return `${months} ${months === 1 ? 'month' : 'months'}`
  }
  if (weeks > 0) {
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
  }
  if (days > 0) {
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }

  const minutes = Math.floor(periodInSeconds / 60)
  if (minutes > 0) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  }

  return `${periodInSeconds} ${periodInSeconds === 1 ? 'second' : 'seconds'}`
}
