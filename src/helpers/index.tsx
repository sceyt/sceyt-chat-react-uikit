import React from 'react'
import styled from 'styled-components'
import { ReactComponent as ReadIcon } from '../assets/svg/ticks_read.svg'
import { ReactComponent as DeliveredIcon } from '../assets/svg/ticks_delivered.svg'
import { ReactComponent as SentIcon } from '../assets/svg/ticks_sent.svg'
import { ReactComponent as PendingIcon } from '../assets/svg/pending_icon.svg'
import { channelDetailsTabs, attachmentTypes, MESSAGE_DELIVERY_STATUS } from './constants'
import { MentionedUser } from '../UIHelper'
import { IAttachment, IContact, IMessage, IUser } from '../types'
import FileSaver from 'file-saver'
import moment from 'moment'
import { colors } from '../UIHelper/constants'

const ReadIconWrapper = styled(ReadIcon)`
  color: ${(props) => props.color || colors.green1};
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
const urlRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi

export const MessageTextFormat = ({ text, message }: { text: string; message: any }) => {
  const messageText = [text]
  if (message.mentionedUsers && message.mentionedUsers.length > 0) {
    const mentionsPositions: any = Object.entries(message.metadata)
      .sort(([, a]: any, [, b]: any) => b.loc - a.loc)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {})
    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const mentionMemberId in mentionsPositions) {
      const textPart = messageText.shift()
      const mentionDisplay = message.mentionedUsers.find((men: any) => men.id === mentionMemberId)
      if (mentionDisplay) {
        messageText.unshift(
          `${textPart?.substring(0, mentionsPositions[mentionMemberId].loc)}`,
          // @ts-ignore
          <MentionedUser key={`${mentionMemberId}`}>
            {`@${mentionDisplay.firstName}${mentionDisplay.lastName !== '' ? ` ${mentionDisplay.lastName}` : ''}`}
          </MentionedUser>,
          `${textPart?.substring(mentionsPositions[mentionMemberId].loc + mentionsPositions[mentionMemberId].len)}`
        )
      }
    }
  }
  messageText.forEach((textPart, index) => {
    if (urlRegex.test(textPart)) {
      const textArray = textPart.split(urlRegex)
      const urlArray = textArray.map((part) => {
        if (urlRegex.test(part)) {
          return <a key={part} href={part} target='_blank' rel='noreferrer'>{`${part} `}</a>
        }
        return `${part} `
      })
      // @ts-ignore
      messageText.splice(index, 1, ...urlArray)
    }
  })
  return messageText.length > 1 ? messageText : text
}

export const bytesToSize = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
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

export const makeUserName = (contact?: IContact, user?: IUser) => {
  return contact
    ? contact.firstName
      ? `${contact.firstName} ${contact.lastName}`
      : contact.id
    : user
    ? user.id
    : 'Deleted user'
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
  const response = await fetch(attachment.url)
  const data = await response.blob()
  FileSaver.saveAs(data, attachment.name)
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

  for (var i = 0, l = arr1.length; i < l; i++) {
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
