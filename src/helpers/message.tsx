import React from 'react'
import { attachmentTypes } from './constants'
import { MentionedUser } from '../UIHelper'
import { IContact, IContactsMap, IUser } from '../types'
import moment from 'moment'
import { colors } from '../UIHelper/constants'
import { getClient } from '../common/client'
import LinkifyIt from 'linkify-it'
import { isAlphanumeric } from './index'

export const typingTextFormat = ({
  text,
  mentionedMembers,
  currentMentionEnd
}: {
  text: string
  mentionedMembers: any
  currentMentionEnd?: number
  setEmoji?: any
}) => {
  // const messageText: any = [text]
  let messageText: any = ''
  if (mentionedMembers.length > 0) {
    const mentionsPositions: any = Array.isArray(mentionedMembers)
      ? [...mentionedMembers].sort((a: any, b: any) => a.start - b.start)
      : []

    let prevEnd = 0
    // const currentLine = 0
    const separateLines = text.split(/\r?\n|\r|\n/g)
    // let textLine = separateLines[currentLine]
    let addedMembers = 0
    let textLengthInCurrentIteration = 0
    for (let i = 0; i < separateLines.length; i++) {
      let nextTextPart = ''
      const currentLine = separateLines[i]
      let lastFoundIndexOnTheLine = 0
      textLengthInCurrentIteration += currentLine.length + 1
      if (mentionsPositions.length > addedMembers) {
        for (let j = addedMembers; j < mentionsPositions.length; j++) {
          const mention = mentionsPositions[j]

          if (mention.start >= textLengthInCurrentIteration) {
            const addPart = (nextTextPart || currentLine.substring(prevEnd)).trimStart()
            messageText = `${messageText} ${addPart}`
            prevEnd = 0
            break
          }
          if (!nextTextPart || nextTextPart === '') {
            const mentionStartInCurrentLine = currentLine.indexOf(mention.displayName, lastFoundIndexOnTheLine)
            lastFoundIndexOnTheLine = mentionStartInCurrentLine + mention.displayName.length

            nextTextPart = currentLine.substring(mentionStartInCurrentLine + mention.displayName.length)
            const setSpaceToEnd =
              (currentMentionEnd && currentMentionEnd === mention.end) ||
              (!nextTextPart.trim() && !separateLines[i + 1])

            messageText += `${currentLine.substring(
              0,
              mentionStartInCurrentLine
              // mention.start - (textLengthInCurrentIteration - 1 - currentLine.length) - prevEnd
            )}<span class='mention_user'>${mention.displayName}</span>${setSpaceToEnd ? '&nbsp;' : ''}`

            prevEnd = currentMentionEnd === mention.end ? mention.end + 1 : mention.end
          } else {
            const mentionStartInCurrentLine = nextTextPart.indexOf(mention.displayName)

            lastFoundIndexOnTheLine = mentionStartInCurrentLine + mention.displayName.length
            // prevEnd = mentionStartInCurrentLine + mention.displayName.length

            const nextPart = nextTextPart.substring(mentionStartInCurrentLine + mention.displayName.length)
            const setSpaceToEnd =
              (currentMentionEnd && currentMentionEnd === mention.end) || (!nextPart.trim() && !separateLines[i + 1])

            messageText += `${nextTextPart.substring(0, mentionStartInCurrentLine)}<span class="mention_user">${
              mention.displayName
            }</span>${setSpaceToEnd ? '&nbsp;' : ''}`

            nextTextPart = nextPart
            prevEnd = currentMentionEnd === mention.end ? mention.end + 1 : mention.end
          }
          addedMembers++
          if (addedMembers === mentionsPositions.length && nextTextPart.trim()) {
            messageText += nextTextPart
          }
        }
      } else {
        messageText += `${currentLine}`
      }
      if (separateLines.length > i + 1) {
        messageText += '<br/>'
      }
    }
  }
  return messageText.length > 1 ? messageText : text
}

export const makeUsername = (contact?: IContact, user?: IUser, fromContact?: boolean) => {
  if (user && isAlphanumeric(user.id)) {
    return user.id.charAt(0).toUpperCase() + user.id.slice(1)
  }
  return fromContact
    ? contact
      ? contact.firstName
        ? `${contact.firstName.trim()} ${contact.lastName?.trim()}`
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

export const isJSON = (str: any) => {
  try {
    return JSON.parse(str) && !!str
  } catch (e) {
    return false
  }
}

const linkifyTextPart = (textPart: string, match: any) => {
  let newMessageText: any
  let prevMatchEnd = 0
  let lastFoundIndex = 0
  match.forEach((matchItem: any, index: number) => {
    const matchIndex = textPart.indexOf(matchItem.text, lastFoundIndex)
    lastFoundIndex = matchIndex + matchItem.text.length
    if (index === 0) {
      newMessageText = [
        textPart.substring(0, matchIndex),
        <a
          draggable={false}
          key={index}
          href={matchItem.url}
          target='_blank'
          rel='noreferrer'
        >{`${matchItem.text} `}</a>
      ]
    } else {
      newMessageText.push(
        textPart.substring(prevMatchEnd, matchIndex),
        <a
          draggable={false}
          key={index}
          href={matchItem.url}
          target='_blank'
          rel='noreferrer'
        >{`${matchItem.text} `}</a>
      )
    }

    prevMatchEnd = matchIndex + matchItem.text.length
    if (index === match.length - 1) {
      newMessageText.push(textPart.substring(prevMatchEnd))
    }
  })
  return newMessageText || textPart
}

export const MessageTextFormat = ({
  text,
  message,
  contactsMap,
  getFromContacts,
  isLastMessage,
  asSampleText
}: {
  text: string
  message: any
  contactsMap: IContactsMap
  getFromContacts: boolean
  isLastMessage?: boolean
  asSampleText?: boolean
}) => {
  let messageText: any = []
  const linkify = new LinkifyIt()
  if (message.body && message.mentionedUsers && message.mentionedUsers.length > 0) {
    const messageMetadata = isJSON(message.metadata) ? JSON.parse(message.metadata) : message.metadata
    const mentionsPositions: any = Array.isArray(messageMetadata)
      ? [...messageMetadata].sort((a: any, b: any) => a.loc - b.loc)
      : []

    const textPart = text
    let nextPartIndex: any
    mentionsPositions.forEach((mention: any, index: number) => {
      try {
        const mentionDisplay = message.mentionedUsers.find((men: any) => men.id === mention.id)
        let firstPart = `${textPart ? textPart?.substring(nextPartIndex || 0, mention.loc) : ''}`
        nextPartIndex = mention.loc + mention.len
        const firstPartMatch = linkify.match(firstPart)

        if (!isLastMessage && !asSampleText && firstPartMatch) {
          firstPart = linkifyTextPart(firstPart, firstPartMatch)
        }
        let secondPart = `${textPart ? textPart?.substring(mention.loc + mention.len) : ''}`
        const secondPartMatch = linkify.match(secondPart)
        if (!isLastMessage && !asSampleText && secondPartMatch) {
          secondPart = linkifyTextPart(secondPart, secondPartMatch)
        }

        if (mentionDisplay) {
          const user = getClient().user
          messageText.push(
            firstPart,
            // @ts-ignore
            asSampleText ? (
              `@${makeUsername(
                user.id === mentionDisplay.id ? mentionDisplay : contactsMap[mentionDisplay.id],
                mentionDisplay,
                getFromContacts
              ).trim()}`
            ) : (
              <MentionedUser isLastMessage={isLastMessage} color={colors.primary} key={`${mention.loc}`}>
                {`@${makeUsername(
                  user.id === mentionDisplay.id ? mentionDisplay : contactsMap[mentionDisplay.id],
                  mentionDisplay,
                  getFromContacts
                ).trim()}`}
              </MentionedUser>
            ),
            index === mentionsPositions.length - 1 ? secondPart : ''
          )
        }
      } catch (e) {
        console.log('Error on format message text, message: ', message, 'error: ', e)
      }
    })
  } else {
    const match = linkify.match(text)
    if (!isLastMessage && !asSampleText && match) {
      // console.log('newMessageText ... . ', newMessageText)
      messageText = linkifyTextPart(text, match)
    }
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
  return messageText.length > 1 ? (asSampleText ? messageText.join('') : messageText) : text
}

export const bytesToSize = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1000
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

export const getFileExtension = (filename: string) => {
  const ext = filename.split('.').pop()
  if (ext === filename) return ''
  return ext
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

export const getDuplicateMentionsFromMeta = (mentionsMetas: any[], mentionedMembers: any[]) => {
  const mentionsList: any[] = []
  mentionsMetas.forEach((mentionMeta: any) => {
    const editingMention = mentionedMembers.find((menMem: any) => menMem.id === mentionMeta.id)
    if (editingMention) {
      mentionsList.push(editingMention)
    }
  })
  return mentionsList
}
