import React from 'react'
import styled from 'styled-components'
import { ReactComponent as ReadIcon } from '../assets/svg/ticks_read.svg'
import { ReactComponent as DeliveredIcon } from '../assets/svg/ticks_delivered.svg'
import { ReactComponent as SentIcon } from '../assets/svg/ticks_sent.svg'
import { ReactComponent as PendingIcon } from '../assets/svg/pending_icon.svg'
import { channelDetailsTabs, attachmentTypes, MESSAGE_DELIVERY_STATUS } from './constants'
import { MentionedUser } from '../UIHelper'
import { IAttachment, IContact, IContactsMap, IMessage, IUser } from '../types'
import FileSaver from 'file-saver'
import moment from 'moment'
import { colors } from '../UIHelper/constants'
import { getCustomDownloader } from './customUploader'
import { getClient } from '../common/client'
import LinkifyIt from 'linkify-it'

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

export const getFileExtension = (filename: string) => {
  const ext = filename.split('.').pop()
  if (ext === filename) return ''
  return ext
}

export const MessageTextFormatForEdit = ({ text, message }: { text: string; message: any }) => {
  const messageText = [text]
  if (message.mentionedUsers && message.mentionedUsers.length > 0) {
    const mentionsPositions: any = Object.entries(message.metadata)
      .sort(([, a]: any, [, b]: any) => b - a)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {})

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const mentionMemberId in mentionsPositions) {
      const textPart = messageText.shift()
      const mentionDisplay = message.mentionedUsers.find((men: any) => men.id === mentionMemberId)
      if (mentionDisplay) {
        messageText.unshift(
          `${textPart?.substring(0, mentionsPositions[mentionMemberId].loc)}`,
          `@${mentionDisplay.firstName} ${mentionDisplay.lastName}`,
          `${textPart?.substring(mentionsPositions[mentionMemberId].loc + mentionsPositions[mentionMemberId].len)}`
        )
      }
    }
  }
  return messageText.length > 1 ? messageText.join('') : text
}

// eslint-disable-next-line
export const urlRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi

export const MessageTextFormat = ({
  text,
  message,
  contactsMap,
  getFromContacts
}: {
  text: string
  message: any
  contactsMap: IContactsMap
  getFromContacts: boolean
}) => {
  let messageText: any = [text]
  if (message.mentionedUsers && message.mentionedUsers.length > 0) {
    const mentionsPositions: any = Object.entries(message.metadata)
      .sort(([, a]: any, [, b]: any) => b.loc - a.loc)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {})
    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const mentionMemberId in mentionsPositions) {
      const textPart = messageText.shift()
      const mentionDisplay = message.mentionedUsers.find((men: any) => men.id === mentionMemberId)
      if (mentionDisplay) {
        const user = getClient().chatClient.user
        messageText.unshift(
          `${textPart?.substring(0, mentionsPositions[mentionMemberId].loc)}`,
          // @ts-ignore
          <MentionedUser key={`${mentionMemberId}`}>
            {`@${makeUserName(
              user.id === mentionDisplay.id ? mentionDisplay : contactsMap[mentionDisplay.id],
              mentionDisplay,
              getFromContacts
            ).trim()}`}
          </MentionedUser>,
          `${textPart?.substring(mentionsPositions[mentionMemberId].loc + mentionsPositions[mentionMemberId].len)}`
        )
      }
    }
  }
  const linkify = new LinkifyIt()
  const match = linkify.match(text)
  if (match) {
    let newMessageText: any
    match.forEach((matchItem, index) => {
      if (index === 0) {
        newMessageText = [
          text.split(matchItem.text)[0],
          <a
            draggable={false}
            key={index}
            href={matchItem.url}
            target='_blank'
            rel='noreferrer'
          >{`${matchItem.text} `}</a>,
          text.split(matchItem.text)[1]
        ]
      } else {
        const msgArr = [
          newMessageText[index * 2].split(matchItem.text)[0],
          <a
            draggable={false}
            key={index}
            href={matchItem.url}
            target='_blank'
            rel='noreferrer'
          >{`${matchItem.text} `}</a>,
          newMessageText[index * 2].split(matchItem.text)[1]
        ]
        newMessageText.splice(index * 2, 1, ...msgArr)
      }
    })
    messageText = newMessageText
    // console.log('newMessageText ... . ', newMessageText)
  }
  /* messageText.forEach((textPart, index) => {
    // if (urlRegex.test(textPart)) {
     messageText.forEach((textPart, index) => {
    if (urlRegex.test(textPart)) {
      const textArray = textPart.split(urlRegex)
      const urlArray = textArray.map((part) => {
        if (urlRegex.test(part)) {
          return <a key={part} href={part} target='_blank' rel='noreferrer'>{`${part} `}</a>
        }
        return `${part} `
      }) *!/
      // @ts-ignore
      messageText.splice(index, 1, ...urlArray)
    }
  }) */
  return messageText.length > 1 ? messageText : text
}

export const bytesToSize = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

export const setMessageTypeByAttachment = (attachmentType: string) => {
  switch (attachmentType) {
    case attachmentTypes.image:
    case attachmentTypes.video:
      return 'media'
    default:
      return 'file'
  }
}

export const getAttachmentType = (dataName: string) => {
  const ext = getFileExtension(dataName)
  switch (ext) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'tiff':
      return attachmentTypes.image
    case 'avi':
    case 'mp4':
    case 'wmv':
    case 'mov':
    case 'flv':
      return attachmentTypes.video
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'wma':
      return attachmentTypes.audio
    default:
      return attachmentTypes.file
  }
}

export const doesTextHasLink = (text: string) => {
  const links: any[] = []
  const strArray = text.split(' ')
  strArray.forEach((item) => {
    if (/(https?:\/\/[^\s]+)/.test(item)) {
      links.push(item)
    }
  })
  return links
}

export const makeUserName = (contact?: IContact, user?: IUser, fromContact?: boolean) => {
  if (user && isAlphanumeric(user.id)) {
    return user.id.charAt(0).toUpperCase() + user.id.slice(1)
  }
  return fromContact
    ? contact
      ? contact.firstName
        ? `${contact.firstName} ${contact.lastName}`
        : contact.id
      : user
      ? user.id || 'Deleted user'
      : ''
    : user
    ? user.firstName
      ? `${user.firstName} ${user.lastName}`
      : user.id || 'Deleted user'
    : ''
}

export const systemMessageUserName = (contact: IContact, userId: string) => {
  return contact ? (contact.firstName ? contact.firstName.split(' ')[0] : contact.id) : userId || 'Deleted user'
}

export const getLinkTitle = (link: string) => {
  const string = link.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('.')[0]
  return string.charAt(0).toUpperCase() + string.slice(1)
}

// TODO delete after attachments query is created
export const getAttachmentsAndLinksFromMessages = (messages: IMessage[], messageType: string) => {
  let activeTabAttachments: any[] = []
  if (messageType === channelDetailsTabs.link) {
    messages.forEach((mes, i) => {
      const { id } = mes
      const links = doesTextHasLink(mes.body)
      links.forEach((link: string, linkIndex: number) => {
        // fetch(link).then((res) => console.log('res -- ', res))
        activeTabAttachments.push({ id: `${linkIndex + 1}${i + 1}${id}`, url: link, title: getLinkTitle(link) })
      })
    })
  } else {
    messages.forEach((mes) => {
      const { updatedAt } = mes
      const { user } = mes
      const attachments = (mes.attachments as any[]).map((att) => ({ ...att, updatedAt, user }))
      activeTabAttachments = [...activeTabAttachments, ...attachments]
    })
  }
  return activeTabAttachments
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

export const lastMessageDateFormat = (date: Date) => {
  // check for current day
  const currentTime = moment()
  const startOfDay = currentTime.startOf('day')
  const isToday = moment(date).diff(startOfDay) >= 0
  if (isToday) {
    return moment(date).format('HH:mm')
  }

  // check for last week
  const isInLastWeek = moment().diff(moment(date), 'weeks') < 1
  if (isInLastWeek) {
    return moment(date).format('dddd')
  }

  // return formatted date
  return moment(date).format('DD.MM.YY')
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

export const getCaretPosition1 = (element: any) => {
  let caretOffset = 0
  const doc = element.ownerDocument || element.document
  const win = doc.defaultView || doc.parentWindow
  let sel
  if (typeof win.getSelection !== 'undefined') {
    sel = win.getSelection()
    if (sel.rangeCount > 0) {
      const range = win.getSelection().getRangeAt(0)
      const preCaretRange = range.cloneRange()
      preCaretRange.selectNodeContents(element)
      preCaretRange.setEnd(range.endContainer, range.endOffset)
      caretOffset = preCaretRange.toString().length
    }
  } else if ((sel = doc.selection) && sel.type !== 'Control') {
    const textRange = sel.createRange()
    const preCaretTextRange = doc.body.createTextRange()
    preCaretTextRange.moveToElementText(element)
    preCaretTextRange.setEndPoint('EndToEnd', textRange)
    caretOffset = preCaretTextRange.text.length
  }
  return caretOffset
}
export const getCaretPosition = (editableDiv: any) => {
  // return caretOffset

  // console.log('cursorPosition -=-=-= -- -= -=-=-= - - * * * ** ', caretOffset)

  // @ts-ignore
  /* if (window.getSelection && window.getSelection().getRangeAt) {
    const range = window.getSelection().getRangeAt(0)
    const selectedObj = window.getSelection()
    let rangeCount = 0
    const childNodes = selectedObj.anchorNode.parentNode.childNodes
    for (let i = 0; i < childNodes.length; i++) {
      if (childNodes[i] == selectedObj.anchorNode) {
        break
      }
      if (childNodes[i].outerHTML) rangeCount += childNodes[i].outerHTML.length
      else if (childNodes[i].nodeType == 3) {
        rangeCount += childNodes[i].textContent.length
      }
    }
    return range.startOffset + rangeCount
  }
  return -1 */
  // @ts-ignore
  let caretPos = 0
  let sel
  let range: any
  if (window.getSelection) {
    sel = window.getSelection()
    if (sel!.rangeCount) {
      range = sel!.getRangeAt(0)
      if (range.commonAncestorContainer.parentNode === editableDiv) {
        // console.log('range.endOffset. ..  ', range.endOffset)
        /* let lines = 0
        editableDiv.childNodes.forEach((node: any) => {
          // editableDiv.insertBefore(tempEl, node)
          // console.log('node.textContent.length .. . .', node.textContent.length)
          // const tempRange = range.duplicate()
          // tempRange.moveToElementText(tempEl)
          // tempRange.setEndPoint('EndToEnd', range)
          lines++
          // console.log('lines  . . ..  .. . . . ', lines)
          // console.log('node.textContent.length  . . ..  .. . . . ', node.textContent.length)
          caretPos += node.textContent.length + lines
        }) */
        caretPos = range.endOffset
      }
    }
  } else {
    // @ts-ignore
    if (document.selection && document.selection.createRange) {
      // @ts-ignore
      range = document.selection.createRange()
      // @ts-ignore
      if (range.parentElement() === editableDiv) {
        // console.log('editableDiv.childNodes ... . .', editableDiv.childNodes)
        const tempEl = document.createElement('span')
        editableDiv.childNodes.forEach((node: any) => {
          editableDiv.insertBefore(tempEl, node)
          // console.log('node.textContent.length .. . .', node.textContent.length)
          // const tempRange = range.duplicate()
          // tempRange.moveToElementText(tempEl)
          // tempRange.setEndPoint('EndToEnd', range)
          caretPos += node.textContent.length
        })
      }
    }
  }
  return caretPos
}

/* export const setCursorPosition = (element: any, position: number) => {
  const range = document.createRange()
  const sel = window.getSelection()
  range.setStart(element.childNodes[0], position)
  range.collapse(true)
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(range)
  }
  element.focus()
} */
export const setCursorPosition = (element: any, position: number) => {
  const range = document.createRange()
  const sel = window.getSelection()
  let node = element.childNodes[0]
  let offset = 0

  for (let i = 0; i < element.childNodes.length; i++) {
    if (offset + element.childNodes[i].textContent.length >= position) {
      node = element.childNodes[i]
      offset = position - offset
      break
    }
    offset += element.childNodes[i].textContent.length
  }

  range.setStart(node, offset)
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
