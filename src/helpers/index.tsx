import React from 'react'
import styled from 'styled-components'
import { ReactComponent as ReadIcon } from '../assets/svg/ticks_read.svg'
import { ReactComponent as DeliveredIcon } from '../assets/svg/ticks_delivered.svg'
import { ReactComponent as SentIcon } from '../assets/svg/ticks_sent.svg'
import { ReactComponent as PendingIcon } from '../assets/svg/pending_icon.svg'
import { MESSAGE_DELIVERY_STATUS } from './constants'
import { IAttachment, IContact } from '../types'
import FileSaver from 'file-saver'
import moment from 'moment'
import { colors } from '../UIHelper/constants'
import { getCustomDownloader } from './customUploader'

const ReadIconWrapper = styled(ReadIcon)`
  color: ${(props) => props.color || colors.primary};
`
const DeliveredIconWrapper = styled(DeliveredIcon)`
  color: ${(props) => props.color || colors.gray4};
`
const SentIconWrapper = styled(SentIcon)`
  color: ${(props) => props.color || colors.gray4};
`
const PendingIconWrapper = styled(PendingIcon)`
  color: ${(props) => props.color || colors.gray4};
`

export const messageStatusIcon = (messageStatus: string, iconColor?: string, readIconColor?: string) => {
  switch (messageStatus) {
    case MESSAGE_DELIVERY_STATUS.READ:
      return <ReadIconWrapper color={readIconColor} />
    case MESSAGE_DELIVERY_STATUS.DELIVERED:
      return <DeliveredIconWrapper color={iconColor} />
    case MESSAGE_DELIVERY_STATUS.SENT:
      return <SentIconWrapper color={iconColor} />
    default:
      return <PendingIconWrapper color={iconColor} />
  }
}

export const isAlphanumeric = (str: string) => /[a-z]/i.test(str)

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

export const systemMessageUserName = (contact: IContact, userId: string) => {
  return contact ? (contact.firstName ? contact.firstName.split(' ')[0] : contact.id) : userId || 'Deleted user'
}

export const downloadFile = async (attachment: IAttachment) => {
  const customDownloader = getCustomDownloader()
  let response
  if (customDownloader) {
    customDownloader(attachment.url).then(async (url) => {
      response = await fetch(url)
      const data = await response.blob()
      FileSaver.saveAs(data, attachment.name)
    })
  } else {
    response = await fetch(attachment.url)
    const data = await response.blob()
    FileSaver.saveAs(data, attachment.name)
  }
}

export const calculateRenderedImageWidth = (width: number, height: number) => {
  const maxWidth = 420
  const maxHeight = 400
  const minWidth = 130
  const aspectRatio = width / height
  if (aspectRatio >= maxWidth / maxHeight) {
    return [Math.max(minWidth, Math.min(maxWidth, width)), Math.min(maxHeight, maxWidth / aspectRatio) + 2]
  } else {
    if (maxHeight <= height) {
      return [Math.min(maxWidth, maxHeight * aspectRatio), Math.min(maxHeight, height)]
    } else {
      return [Math.min(maxWidth, height * aspectRatio), Math.min(maxHeight, height)]
    }
  }
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
      let image = ''
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
    .catch((error) => console.log(error))
}

export const formatAudioVideoTime = (duration: number, currentTime: number) => {
  const minutes = Math.floor((duration - currentTime) / 60)
  const seconds = Math.floor((duration - currentTime) % 60)
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
  console.log('text width . ', textWidth)
  console.log('containerWidth . ', containerWidth)
  if (textWidth > containerWidth) {
    const diff = containerWidth / textWidth
    const symbolsRes = text.length * diff
    console.log('text.length ... ', text.length)
    console.log('symbolsRes ... ', symbolsRes)
    const firstHalf = text.slice(0, text.length / 2 - 3)
    const secondHalf = text.slice(-(symbolsRes / 2))
    console.log('result .... ', firstHalf + '...' + secondHalf)
    return firstHalf + '...' + secondHalf
  }
  return text */
}

/* export const getCaretPosition1 = (element: any) => {
  let caretOffset = 0
  let textNodes = 0
  const doc = element.ownerDocument || element.document
  const win = doc.defaultView || doc.parentWindow
  const focusOffset = win.getSelection().focusOffset
  const focusNode = win.getSelection().focusNode
  let textNodesAdded = false
  element.childNodes.forEach((node: any, index: number) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node === focusNode) {
        textNodesAdded = true
        caretOffset += focusOffset + textNodes
        return
      } else {
        caretOffset += node.nodeValue.length
      }
    } else {
      textNodes += 1
    }
    if (element.childNodes.length === index + 1 && !textNodesAdded) {
      caretOffset += textNodes
    }
  })
  /!* const doc = element.ownerDocument || element.document
  const win = doc.defaultView || doc.parentWindow
  let sel
  if (typeof win.getSelection !== 'undefined') {
    sel = win.getSelection()
    if (sel.rangeCount > 0) {
      const range = win.getSelection().getRangeAt(0)
      const rangeCount = win.getSelection().rangeCount
      const anchorOffset = win.getSelection().anchorOffset
      const anchorNode = win.getSelection().anchorNode
      const focusOffset = win.getSelection().focusOffset
      const focusNode = win.getSelection().focusNode
      console.log('ranges. . . . . .', rangeCount)
      console.log('anchorOffset. . . . . .', anchorOffset)
      console.log('anchorNode. . . . . .', anchorNode)
      console.log('focusOffset. . . . . .', focusOffset)
      console.log('focusNode. . . . . .', focusNode)
      console.log('range. . . . . .', range)
      const preCaretRange = range.cloneRange()
      preCaretRange.selectNodeContents(element)
      preCaretRange.setEnd(range.endContainer, range.endOffset)
      console.log('preCaretRange. . . . . .', preCaretRange)
      console.log('preCaretRange.toString(). . . . . .', preCaretRange.toString())
      caretOffset = preCaretRange.toString().length

      console.log(' 1 caretOffset -=-=-= -- -= -=-=-= - - * * * ** ', caretOffset)
    }
  } else if ((sel = doc.selection) && sel.type !== 'Control') {
    const textRange = sel.createRange()
    const preCaretTextRange = doc.body.createTextRange()
    preCaretTextRange.moveToElementText(element)
    preCaretTextRange.setEndPoint('EndToEnd', textRange)
    caretOffset = preCaretTextRange.text.length
    console.log(' 2 caretOffset -=-=-= -- -= -=-=-= - - * * * ** ', caretOffset)
  } *!/
  return caretOffset
} */

export const getCaretPosition = (element: any) => {
  let caretOffset = 0
  let textNodes = 0
  const doc = element.ownerDocument || element.document
  const win = doc.defaultView || doc.parentWindow
  const focusOffset = win.getSelection().focusOffset
  const focusNode = win.getSelection().focusNode
  let textNodesAdded = false
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i]
    if (node.nodeType === Node.TEXT_NODE) {
      if (node === focusNode) {
        textNodesAdded = true
        caretOffset += focusOffset + textNodes
        break
      } else {
        caretOffset += node.nodeValue.length
      }
    } else if (node.nodeName === 'SPAN') {
      if (node.contains(focusNode)) {
        textNodesAdded = true
        caretOffset += focusOffset + textNodes
        break
      } else {
        caretOffset += node.innerText.length
      }
    } else {
      textNodes += 1
    }
    if (element.childNodes.length === i + 1 && !textNodesAdded) {
      caretOffset += textNodes
    }
  }
  return caretOffset
}

export const setCursorPosition = (element: any, position: number) => {
  const range = document.createRange()
  const sel = window.getSelection()
  let currentNode = element.childNodes[0]
  let caretOffset = 0
  let textNodes = 0
  let textNodesAdded = false
  let currentNodeIsFind = false
  element.childNodes.forEach((node: any, index: number) => {
    if (!currentNodeIsFind && node.nodeType === Node.TEXT_NODE) {
      currentNode = node
      const textLength = node.nodeValue.length
      caretOffset = caretOffset + textLength
      if (element.childNodes.length === index + 1) {
        textNodesAdded = true
        caretOffset += textNodes
      }
      if (caretOffset >= position) {
        currentNodeIsFind = true
        currentNode = node
        caretOffset = position - (caretOffset - textLength)
        return
      }
    } else if (!currentNodeIsFind) {
      if (node.nodeName === 'SPAN') {
        caretOffset += node.innerText.length
        if (caretOffset >= position) {
          currentNodeIsFind = true
          currentNode = node
          caretOffset = position - (caretOffset - node.innerText.length)
          return
        }
        if (element.childNodes[index + 1] && element.childNodes[index + 1].nodeName === 'BR') {
          caretOffset += 1
        }
      } else {
        textNodes += 1
      }
    }
    if (element.childNodes.length === index + 1 && !currentNodeIsFind) {
      if (!textNodesAdded) {
        caretOffset += textNodes
      }
      currentNodeIsFind = true
      if (position > caretOffset) {
        caretOffset++
      }
      caretOffset = caretOffset - position
    }
  })
  range.setStart(currentNode, caretOffset)
  range.collapse(true)
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(range)
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
  } else if (!os && /Linux/.test(platform)) {
    os = 'Linux'
  }

  return os
}
export const detectBrowser = () => {
  const userAgent = window.navigator.userAgent
  let browser

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
  return browser
}

export const getEmojisCategoryTitle = (categoryKey: string) => {
  let category = ''

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
