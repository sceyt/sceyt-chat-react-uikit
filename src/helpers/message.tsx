import React from 'react'
import { attachmentTypes } from './constants'
import { StyledText } from '../UIHelper'
import { IBodyAttribute, IContact, IContactsMap, IUser } from '../types'
import moment from 'moment'
import { colors } from '../UIHelper/constants'
import { getClient } from '../common/client'
import LinkifyIt from 'linkify-it'
import { hideUserPresence } from './userHelper'
import { EditorThemeClasses } from 'lexical'

export const typingTextFormat = ({
  text,
  formatAttributes,
  currentAttributeEnd
}: {
  text: string
  formatAttributes: any[]
  currentAttributeEnd?: number
}) => {
  // const messageText: any = [text]
  let messageText: any = ''
  // if (mentionedMembers.length > 0) {
  const attributesPositions: any = Array.isArray(formatAttributes)
    ? [...formatAttributes].sort((a: any, b: any) => a.start - b.start)
    : []

  let prevEnd = 0
  // const currentLine = 0
  const separateLines = text.split(/\r?\n|\r|\n/g)
  // let textLine = separateLines[currentLine]
  let addedMembers = 0
  let textLengthInCurrentIteration = 0
  // console.log('separateLines. . .. ', separateLines)
  for (let i = 0; i < separateLines.length; i++) {
    // console.log('i - - - ---- ', i)
    let nextTextPart = ''
    const currentLine = separateLines[i]
    let lastFoundIndexOnTheLine = 0
    textLengthInCurrentIteration += currentLine.length + 1
    if (attributesPositions.length > addedMembers) {
      for (let j = addedMembers; j < attributesPositions.length; j++) {
        const mention = attributesPositions[j]

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
            mention.type === 'mention' &&
            ((currentAttributeEnd && currentAttributeEnd === mention.end) ||
              (!nextTextPart.trim() && !separateLines[i + 1]))

          messageText += `${currentLine.substring(
            0,
            mentionStartInCurrentLine
            // mention.start - (textLengthInCurrentIteration - 1 - currentLine.length) - prevEnd
          )}<span class=${mention.type}>${mention.displayName}</span>${setSpaceToEnd ? '&nbsp;' : ''}`

          prevEnd = currentAttributeEnd === mention.end ? mention.end + 1 : mention.end
        } else {
          const mentionStartInCurrentLine = nextTextPart.indexOf(mention.displayName)

          lastFoundIndexOnTheLine = mentionStartInCurrentLine + mention.displayName.length
          // prevEnd = mentionStartInCurrentLine + mention.displayName.length

          const nextPart = nextTextPart.substring(mentionStartInCurrentLine + mention.displayName.length)
          const setSpaceToEnd =
            mention.type === 'mention' &&
            ((currentAttributeEnd && currentAttributeEnd === mention.end) ||
              (!nextPart.trim() && !separateLines[i + 1]))

          messageText += `${nextTextPart.substring(0, mentionStartInCurrentLine)}<span class=${mention.type}>${
            mention.displayName
          }</span>${setSpaceToEnd ? '&nbsp;' : ''}`

          nextTextPart = nextPart
          prevEnd = currentAttributeEnd === mention.end ? mention.end + 1 : mention.end
        }
        addedMembers++
        if (addedMembers === attributesPositions.length && nextTextPart.trim()) {
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
  // }
  return messageText.length > 1 ? messageText : text
}

export const makeUsername = (contact?: IContact, user?: IUser, fromContact?: boolean, getFirstNameOnly?: boolean) => {
  if (hideUserPresence && user && user.id && hideUserPresence(user)) {
    return user.id.toUpperCase()
  }
  return fromContact && contact
    ? contact.firstName
      ? getFirstNameOnly
        ? `${contact.firstName.split(' ')[0]}`
        : `${contact.firstName.trim()} ${contact.lastName?.trim()}`.trim()
      : contact.id
    : user
      ? user.firstName
        ? getFirstNameOnly
          ? `${fromContact ? '~' : ''}${user.firstName.split(' ')[0]}`
          : `${fromContact ? '~' : ''}${user.firstName.trim()} ${user.lastName.trim()}`.trim()
        : user.id || 'Deleted user'
      : 'Deleted user'
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
        <a draggable={false} key={index} href={matchItem.url} target='_blank' rel='noreferrer'>{`${matchItem.text}`}</a>
      ]
    } else {
      newMessageText.push(
        textPart.substring(prevMatchEnd, matchIndex),
        <a draggable={false} key={index} href={matchItem.url} target='_blank' rel='noreferrer'>{`${matchItem.text}`}</a>
      )
    }

    prevMatchEnd = matchIndex + matchItem.text.length
    if (index === match.length - 1) {
      newMessageText.push(textPart.substring(prevMatchEnd))
    }
  })
  return newMessageText || textPart
}

export const combineMessageAttributes = (attributes: IBodyAttribute[]): IBodyAttribute[] => {
  const sortedAttributes: any = attributes.sort((a: any, b: any) => a.offset - b.offset)
  const combinedAttributes = {}
  sortedAttributes.forEach((attribute: any) => {
    const offset = attribute.offset
    const typeValue = attribute.type

    // If offset exists in the combinedAttributes object, update the type value by adding a comma-separated string
    if (offset in combinedAttributes) {
      combinedAttributes[offset].type += ` ${typeValue}`
      const metadata = (combinedAttributes[offset].metadata += ` ${attribute.metadata}`)
      combinedAttributes[offset].metadata = metadata.trim()
    } else {
      // If offset does not exist, create a new entry in the combinedAttributes object
      combinedAttributes[offset] = {
        type: typeValue,
        metadata: attribute.metadata,
        offset,
        length: attribute.length
      }
    }
  })
  return Object.values(combinedAttributes)
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
  const messageBodyAttributes = JSON.parse(JSON.stringify(message.bodyAttributes))
  if (message.body && messageBodyAttributes && messageBodyAttributes.length > 0) {
    const combinedAttributesList = combineMessageAttributes(messageBodyAttributes)
    const textPart = text
    let nextPartIndex: any

    combinedAttributesList.forEach((attribute: any, index: number) => {
      const attributeOffset = attribute.offset

      try {
        let firstPart = `${textPart ? textPart?.substring(nextPartIndex || 0, attributeOffset) : ''}`

        const firstPartMatch = firstPart ? linkify.match(firstPart) : ''

        if (!isLastMessage && !asSampleText && firstPartMatch) {
          firstPart = linkifyTextPart(firstPart, firstPartMatch)
        }
        let secondPart = `${textPart ? textPart?.substring(attributeOffset + attribute.length) : ''}`
        const secondPartMatch = secondPart ? linkify.match(secondPart) : ''
        if (!isLastMessage && !asSampleText && secondPartMatch) {
          secondPart = linkifyTextPart(secondPart, secondPartMatch)
        }

        if (attribute.type.includes('mention')) {
          const mentionDisplay =
            message.mentionedUsers && message.mentionedUsers.find((men: any) => men.id === attribute.metadata)
          // const idLength = attribute.metadata.length

          const user = getClient().user
          let mentionDisplayName = text.slice(attributeOffset, attributeOffset + attribute.length)
          if (mentionDisplay) {
            mentionDisplayName = `@${makeUsername(
              user.id === mentionDisplay.id ? mentionDisplay : contactsMap[mentionDisplay.id],
              mentionDisplay,
              getFromContacts
            ).trim()}`
          }
          if (nextPartIndex > attributeOffset) {
            messageText = messageText.slice(0, -2)
            const prevAtt = combinedAttributesList[index - 1]
            const start = nextPartIndex - prevAtt.length
            const currentTextPart = `${textPart ? textPart?.substring(start || 0, start + prevAtt.length) : ''}`
            const currentMentionIndex = currentTextPart.indexOf(`@${attribute.metadata}`)
            const firsTextPart = `${currentTextPart.substring(0, currentMentionIndex)}`
            const secondTextPart = `${currentTextPart.substring(
              currentMentionIndex + attribute.length,
              prevAtt.length
            )}`
            secondPart = `${textPart ? textPart?.substring(prevAtt.offset + prevAtt.length) : ''}`
            nextPartIndex = prevAtt.offset + prevAtt.length
            messageText.push(
              // @ts-ignore
              asSampleText ? (
                currentTextPart
              ) : (
                <StyledText
                  className={`${combinedAttributesList[index - 1].type}`}
                  isLastMessage={isLastMessage}
                  key={attributeOffset + index}
                >
                  {firsTextPart}
                  <StyledText
                    className='mention'
                    isLastMessage={isLastMessage}
                    color={colors.primary}
                    key={attributeOffset + index}
                  >
                    {mentionDisplayName}
                  </StyledText>
                  {secondTextPart}
                </StyledText>
              ),
              index === combinedAttributesList.length - 1 ? secondPart : ''
            )
          } else {
            nextPartIndex = attribute.offset + attribute.length
            messageText.push(
              firstPart,
              // @ts-ignore
              asSampleText ? (
                mentionDisplayName
              ) : (
                <StyledText
                  className={attribute.type}
                  isLastMessage={isLastMessage}
                  color={colors.primary}
                  key={attributeOffset}
                >
                  {mentionDisplayName}
                </StyledText>
              ),
              index === combinedAttributesList.length - 1 ? secondPart : ''
            )
          }
        } else {
          nextPartIndex = attributeOffset + attribute.length

          messageText.push(
            firstPart,
            // @ts-ignore
            asSampleText ? (
              `${text.slice(attributeOffset, attributeOffset + attribute.length)}`
            ) : (
              <StyledText
                isLastMessage={isLastMessage}
                className={attribute.type}
                key={`${attributeOffset}-${attribute.type}`}
              >
                {`${text.slice(attributeOffset, attributeOffset + attribute.length)}`}
              </StyledText>
            ),
            index === combinedAttributesList.length - 1 ? secondPart : ''
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
export const lastMessageDateFormat = (date: Date | number) => {
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

let allowEditDeleteIncomingMessage = true
export const setAllowEditDeleteIncomingMessage = (allow: boolean) => {
  allowEditDeleteIncomingMessage = allow
}
export const getAllowEditDeleteIncomingMessage = () => allowEditDeleteIncomingMessage

export const compareMessageBodyAttributes = (attributes1: IBodyAttribute[], attributes2: IBodyAttribute[]) => {
  return JSON.stringify(attributes1) === JSON.stringify(attributes2)
}

export const bodyAttributesMapByType = {
  1: ['bold'],
  2: ['italic'],
  3: ['bold', 'italic'],
  4: ['strikethrough'],
  5: ['bold', 'strikethrough'],
  6: ['italic', 'strikethrough'],
  7: ['bold', 'italic', 'strikethrough'],
  8: ['underline'],
  9: ['bold', 'underline'],
  10: ['italic', 'underline'],
  11: ['bold', 'italic', 'underline'],
  12: ['strikethrough', 'underline'],
  13: ['bold', 'strikethrough', 'underline'],
  14: ['italic', 'strikethrough', 'underline'],
  15: ['bold', 'italic', 'strikethrough', 'underline'],
  16: ['monospace'],
  17: ['bold', 'monospace'],
  18: ['italic', 'monospace'],
  19: ['bold', 'italic', 'monospace'],
  20: ['strikethrough', 'monospace'],
  21: ['bold', 'strikethrough', 'monospace'],
  22: ['italic', 'strikethrough', 'monospace'],
  23: ['bold', 'italic', 'strikethrough', 'monospace'],
  24: ['underline', 'monospace'],
  25: ['bold', 'underline', 'monospace'],
  26: ['italic', 'underline', 'monospace'],
  27: ['bold', 'italic', 'underline', 'monospace'],
  28: ['strikethrough', 'underline', 'monospace'],
  29: ['bold', 'strikethrough', 'underline', 'monospace'],
  30: ['italic', 'strikethrough', 'underline', 'monospace'],
  31: ['bold', 'italic', 'strikethrough', 'underline', 'monospace']
}

export const EditorTheme: EditorThemeClasses = {
  paragraph: 'editor_paragraph',
  text: {
    bold: 'text_bold',
    code: 'text_monospace',
    italic: 'text_italic',
    strikethrough: 'text_strikethrough',
    subscript: 'text_subscript',
    superscript: 'text_superscript',
    underline: 'text_underline',
    underlineStrikethrough: 'text_underlineStrikethrough'
  }
}
