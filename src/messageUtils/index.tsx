import React from 'react'
import styled from 'styled-components'
import { colors } from '../UIHelper/constants'
import { MESSAGE_DELIVERY_STATUS } from '../helpers/constants'

import { ReactComponent as ReadIcon } from '../assets/svg/ticks_read.svg'
import { ReactComponent as DeliveredIcon } from '../assets/svg/ticks_delivered.svg'
import { ReactComponent as SentIcon } from '../assets/svg/ticks_sent.svg'
import { ReactComponent as PendingIcon } from '../assets/svg/pending_icon.svg'
import { IContactsMap } from '../types'
import LinkifyIt from 'linkify-it'
import { getClient } from '../common/client'
import { StyledText } from '../UIHelper'
import { combineMessageAttributes, makeUsername } from '../helpers/message'

const StatusText = styled.span<{ color?: string; fontSize?: string }>`
  color: ${(props) => props.color || colors.textColor2};
  font-weight: 400;
  font-size: ${(props) => props.fontSize || '12px'};
`
const ReadIconWrapper = styled(ReadIcon)`
  width: ${(props) => props.width}!important;
  height: ${(props) => props.height}!important;
  color: ${(props) => props.color || colors.primary};
`
const DeliveredIconWrapper = styled(DeliveredIcon)`
  width: ${(props) => props.width}!important;
  height: ${(props) => props.height}!important;
  color: ${(props) => props.color || colors.textColor2};
`
const SentIconWrapper = styled(SentIcon)`
  width: ${(props) => props.width}!important;
  height: ${(props) => props.height}!important;
  color: ${(props) => props.color || colors.textColor2};
`
const PendingIconWrapper = styled(PendingIcon)`
  width: ${(props) => props.width}!important;
  height: ${(props) => props.height}!important;
  color: ${(props) => props.color || colors.textColor2};
`

const MessageStatusIcon = ({
  messageStatus,
  messageStatusDisplayingType,
  iconColor,
  readIconColor,
  size
}: {
  messageStatus: string
  messageStatusDisplayingType: string
  size?: string
  iconColor?: string
  readIconColor?: string
}) => {
  switch (messageStatus) {
    case MESSAGE_DELIVERY_STATUS.READ:
      return messageStatusDisplayingType === 'ticks' ? (
        <ReadIconWrapper width={size} height={size} color={readIconColor || colors.primary} />
      ) : (
        <StatusText fontSize={size} color={iconColor}>
          • Seen
        </StatusText>
      )
    case MESSAGE_DELIVERY_STATUS.DELIVERED:
      return messageStatusDisplayingType === 'ticks' ? (
        <DeliveredIconWrapper width={size} height={size} color={iconColor} />
      ) : (
        <StatusText fontSize={size} color={iconColor}>
          • Not seen yet
        </StatusText>
      )
    case MESSAGE_DELIVERY_STATUS.SENT:
      return messageStatusDisplayingType === 'ticks' ? (
        <SentIconWrapper color={iconColor} width={size} height={size} />
      ) : (
        <StatusText fontSize={size} color={iconColor}>
          • Not seen yet
        </StatusText>
      )
    default:
      return <PendingIconWrapper color={iconColor} />
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

const MessageTextFormat = ({
  text,
  message,
  contactsMap,
  getFromContacts,
  isLastMessage,
  asSampleText
}: {
  text: string
  message: any
  contactsMap?: IContactsMap
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
              user.id === mentionDisplay.id ? mentionDisplay : contactsMap && contactsMap[mentionDisplay.id],
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

export { MessageStatusIcon, MessageTextFormat }
