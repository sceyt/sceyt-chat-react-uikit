import React from 'react'
import styled from 'styled-components'
import { MESSAGE_DELIVERY_STATUS } from '../helpers/constants'

import { ReactComponent as ReadIcon } from '../assets/svg/ticks_read.svg'
import { ReactComponent as DeliveredIcon } from '../assets/svg/ticks_delivered.svg'
import { ReactComponent as SentIcon } from '../assets/svg/ticks_sent.svg'
import { ReactComponent as PendingIcon } from '../assets/svg/pending_icon.svg'
import { IContactsMap, IUser } from '../types'
import LinkifyIt from 'linkify-it'
import { getClient } from '../common/client'
import { StyledText } from '../UIHelper'
import { combineMessageAttributes, makeUsername } from '../helpers/message'
import log from 'loglevel'

const StatusText = styled.span<{ color: string; fontSize?: string }>`
  color: ${(props) => props.color};
  font-weight: 400;
  font-size: ${(props) => props.fontSize || '12px'};
`
const ReadIconWrapper = styled(ReadIcon)`
  width: ${(props) => props.width}!important;
  height: ${(props) => props.height}!important;
  color: ${(props) => props.color};
`
const DeliveredIconWrapper = styled(DeliveredIcon)`
  width: ${(props) => props.width}!important;
  height: ${(props) => props.height}!important;
  color: ${(props) => props.color};
`
const SentIconWrapper = styled(SentIcon)`
  width: ${(props) => props.width}!important;
  height: ${(props) => props.height}!important;
  color: ${(props) => props.color};
`
const PendingIconWrapper = styled(PendingIcon)`
  width: ${(props) => props.width}!important;
  height: ${(props) => props.height}!important;
  color: ${(props) => props.color};
`

const MessageStatusIcon = ({
  messageStatus,
  messageStatusDisplayingType,
  color,
  readIconColor,
  size,
  accentColor
}: {
  messageStatus: string
  messageStatusDisplayingType?: string
  size?: string
  color: string
  readIconColor?: string
  accentColor?: string
}) => {
  switch (messageStatus) {
    case MESSAGE_DELIVERY_STATUS.PLAYED:
      return messageStatusDisplayingType === 'ticks' ? (
        <ReadIconWrapper width={size} height={size} color={readIconColor || accentColor} />
      ) : (
        <StatusText fontSize={size} color={color}>
          • Seen
        </StatusText>
      )
    case MESSAGE_DELIVERY_STATUS.OPENED:
      return messageStatusDisplayingType === 'ticks' ? (
        <ReadIconWrapper width={size} height={size} color={readIconColor || accentColor} />
      ) : (
        <StatusText fontSize={size} color={color}>
          • Seen
        </StatusText>
      )
    case MESSAGE_DELIVERY_STATUS.READ:
      return messageStatusDisplayingType === 'ticks' ? (
        <ReadIconWrapper width={size} height={size} color={readIconColor || accentColor} />
      ) : (
        <StatusText fontSize={size} color={color}>
          • Seen
        </StatusText>
      )
    case MESSAGE_DELIVERY_STATUS.DELIVERED:
      return messageStatusDisplayingType === 'ticks' ? (
        <DeliveredIconWrapper width={size} height={size} color={color} />
      ) : (
        <StatusText fontSize={size} color={color}>
          • Not seen yet
        </StatusText>
      )
    case MESSAGE_DELIVERY_STATUS.SENT:
      return messageStatusDisplayingType === 'ticks' ? (
        <SentIconWrapper color={color} width={size} height={size} />
      ) : (
        <StatusText fontSize={size} color={color}>
          • Not seen yet
        </StatusText>
      )
    default:
      return <PendingIconWrapper color={color} />
  }
}

const linkifyTextPart = (
  textPart: string,
  match: any,
  target: string = '_blank',
  isInviteLink?: boolean,
  onInviteLinkClick?: (key: string) => void
) => {
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
          href={isInviteLink ? undefined : matchItem.url}
          target={target}
          rel='noreferrer'
          style={{ cursor: 'pointer' }}
          {...(isInviteLink
            ? {
                onClick: () => {
                  const splitedKey = matchItem.url.split('/')
                  const key = splitedKey[splitedKey.length - 1]
                  if (key) {
                    onInviteLinkClick?.(key)
                  }
                }
              }
            : {})}
        >{`${matchItem.text}`}</a>
      ]
    } else {
      newMessageText.push(
        textPart.substring(prevMatchEnd, matchIndex),
        <a
          draggable={false}
          key={index}
          href={isInviteLink ? undefined : matchItem.url}
          target={target}
          rel='noreferrer'
        >{`${matchItem.text}`}</a>
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
  asSampleText,
  accentColor,
  textSecondary,
  onMentionNameClick,
  shouldOpenUserProfileForMention,
  unsupportedMessage,
  target = '_blank',
  isInviteLink = false,
  onInviteLinkClick
}: {
  text: string
  message: any
  contactsMap?: IContactsMap
  getFromContacts: boolean
  isLastMessage?: boolean
  asSampleText?: boolean
  accentColor: string
  textSecondary: string
  onMentionNameClick?: (user: IUser) => void
  shouldOpenUserProfileForMention?: boolean
  unsupportedMessage?: boolean
  target?: string
  isInviteLink?: boolean
  onInviteLinkClick?: (key: string) => void
}) => {
  try {
    let messageText: any = []
    const linkify = new LinkifyIt()
    const messageBodyAttributes = message.bodyAttributes && JSON.parse(JSON.stringify(message.bodyAttributes))
    if (unsupportedMessage) {
      return 'This message is not supported. Update your app to view this message.'
    }
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
            firstPart = linkifyTextPart(firstPart, firstPartMatch, target, isInviteLink, onInviteLinkClick)
          }
          let secondPart = `${textPart ? textPart?.substring(attributeOffset + attribute.length) : ''}`
          const secondPartMatch = secondPart ? linkify.match(secondPart) : ''
          if (!isLastMessage && !asSampleText && secondPartMatch) {
            secondPart = linkifyTextPart(secondPart, secondPartMatch, target, isInviteLink, onInviteLinkClick)
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
                    color={isLastMessage ? textSecondary : accentColor}
                    shouldOpenUserProfileForMention={onMentionNameClick && shouldOpenUserProfileForMention}
                  >
                    {firsTextPart}
                    <StyledText
                      className='mention'
                      isLastMessage={isLastMessage}
                      color={isLastMessage ? textSecondary : accentColor}
                      key={attributeOffset + index}
                      data-mention={attribute.metadata}
                      onClick={() => {
                        if (onMentionNameClick && shouldOpenUserProfileForMention) {
                          onMentionNameClick(mentionDisplay)
                        }
                      }}
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
                    color={isLastMessage ? textSecondary : accentColor}
                    key={attributeOffset}
                    data-mention={attribute.metadata}
                    onClick={() => {
                      if (onMentionNameClick && shouldOpenUserProfileForMention) {
                        onMentionNameClick(mentionDisplay)
                      }
                    }}
                    shouldOpenUserProfileForMention={onMentionNameClick && shouldOpenUserProfileForMention}
                  >
                    {mentionDisplayName}
                  </StyledText>
                ),
                index === combinedAttributesList.length - 1 ? secondPart : ''
              )
            }
          } else {
            nextPartIndex = attributeOffset + attribute.length
            const textPart = `${text.slice(attributeOffset, attributeOffset + attribute.length)}`
            const match = linkify.match(textPart)
            let newTextPart = textPart
            if (!isLastMessage && !asSampleText && match) {
              newTextPart = linkifyTextPart(textPart, match, target, isInviteLink, onInviteLinkClick)
            }
            messageText.push(
              firstPart,
              // @ts-ignore
              asSampleText ? (
                newTextPart
              ) : (
                <StyledText
                  isLastMessage={isLastMessage}
                  className={attribute.type}
                  key={`${attributeOffset}-${attribute.type}`}
                  color={isLastMessage ? textSecondary : accentColor}
                >
                  {newTextPart}
                </StyledText>
              ),
              index === combinedAttributesList.length - 1 ? secondPart : ''
            )
          }
        } catch (e) {
          log.error('Error on format message text, message: ', message, 'error: ', e)
        }
      })
    } else {
      const match = linkify.match(text)
      if (!isLastMessage && !asSampleText && match) {
        // log.info('newMessageText ... . ', newMessageText)
        messageText = linkifyTextPart(text, match, target, isInviteLink, onInviteLinkClick)
      }
    }
    return messageText.length > 1 ? (asSampleText ? messageText.join('') : messageText) : text
  } catch (e) {
    log.error(' failed to format message .>>> ', e)
    return text
  }
}

const getNodeTextLength = (node: any): number => {
  if (!node) return 0
  if (typeof node === 'string') return node.length
  if (typeof node === 'number') return String(node).length
  if (Array.isArray(node)) {
    return node.reduce((sum, child) => sum + getNodeTextLength(child), 0)
  }
  if (node.props && node.props.children) {
    return getNodeTextLength(node.props.children)
  }
  return 0
}

const truncateNodeText = (node: any, maxLength: number): { node: any; usedLength: number } => {
  if (!node) return { node, usedLength: 0 }

  if (typeof node === 'string') {
    if (node.length > maxLength) {
      return { node: node.slice(0, maxLength), usedLength: maxLength }
    }
    return { node, usedLength: node.length }
  }

  if (typeof node === 'number') {
    const str = String(node)
    if (str.length > maxLength) {
      return { node: str.slice(0, maxLength), usedLength: maxLength }
    }
    return { node, usedLength: str.length }
  }

  if (Array.isArray(node)) {
    const result: any[] = []
    let remaining = maxLength
    for (const child of node) {
      if (remaining <= 0) break
      const { node: truncatedChild, usedLength } = truncateNodeText(child, remaining)
      result.push(truncatedChild)
      remaining -= usedLength
    }
    return { node: result, usedLength: maxLength - remaining }
  }

  if (node.props && node.props.children !== undefined) {
    const { node: truncatedChildren, usedLength } = truncateNodeText(node.props.children, maxLength)
    return {
      node: {
        ...node,
        props: {
          ...node.props,
          children: truncatedChildren
        }
      },
      usedLength
    }
  }

  return { node, usedLength: 0 }
}

const trimReactMessage = (parts: any[] | string, limit: number | undefined) => {
  if (typeof limit !== 'number' || limit < 0) {
    return { result: parts, truncated: false }
  }
  if (typeof parts === 'string') {
    if (parts.length > limit) {
      return { result: parts.slice(0, limit) + '...', truncated: true }
    }
    return { result: parts, truncated: false }
  }
  let remaining = limit
  let truncated = false
  const result = []

  for (const part of parts) {
    if (typeof part === 'string') {
      if (remaining <= 0) {
        truncated = true
        break
      }

      if (part.length > remaining) {
        result.push(part.slice(0, remaining))
        remaining = 0
        truncated = true
        break
      } else {
        result.push(part)
        remaining -= part.length
      }
    } else if (part && typeof part === 'object') {
      if (remaining <= 0) {
        truncated = true
        break
      }

      const nodeTextLength = getNodeTextLength(part)

      if (nodeTextLength > remaining) {
        const { node: truncatedNode } = truncateNodeText(part, remaining)
        result.push(truncatedNode)
        remaining = 0
        truncated = true
        break
      } else {
        result.push(part)
        remaining -= nodeTextLength
      }
    }
  }

  return { result, truncated }
}

export { MessageStatusIcon, MessageTextFormat, trimReactMessage }
