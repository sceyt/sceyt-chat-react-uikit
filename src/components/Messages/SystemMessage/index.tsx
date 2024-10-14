import styled from 'styled-components'
import React, { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
// Store
import { markMessagesAsReadAC } from '../../../store/channel/actions'
import { CONNECTION_STATUS } from '../../../store/user/constants'
// Hooks
import { useColor, useDidUpdate, useOnScreen } from '../../../hooks'
// Helpers
import { isJSON, makeUsername } from '../../../helpers/message'
import { systemMessageUserName } from '../../../helpers'
import { IChannel, IMessage } from '../../../types'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { MESSAGE_DELIVERY_STATUS } from '../../../helpers/constants'
import { THEME_COLOR_NAMES } from '../../../UIHelper/constants'
import { getClient } from '../../../common/client'

interface ISystemMessageProps {
  channel: IChannel
  message: IMessage
  nextMessage: IMessage
  connectionStatus: string
  contactsMap: { [key: string]: any }
  differentUserMessageSpacing?: string
  fontSize?: string
  textColor?: string
  border?: string
  backgroundColor?: string
  borderRadius?: string
  tabIsActive?: boolean
}

const Message = ({
  message,
  nextMessage,
  connectionStatus,
  channel,
  tabIsActive,
  differentUserMessageSpacing,
  fontSize,
  textColor,
  border,
  backgroundColor,
  borderRadius,
  contactsMap
}: ISystemMessageProps) => {
  const { [THEME_COLOR_NAMES.TEXT_PRIMARY]: textPrimary, [THEME_COLOR_NAMES.SECTION_BACKGROUND]: sectionBackground } =
    useColor()

  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()
  const messageItemRef = useRef<any>()
  const isVisible = useOnScreen(messageItemRef)
  const messageMetas = isJSON(message.metadata) ? JSON.parse(message.metadata) : message.metadata

  const handleSendReadMarker = () => {
    if (
      isVisible &&
      message.incoming &&
      !(
        message.userMarkers &&
        message.userMarkers.length &&
        message.userMarkers.find((marker) => marker.name === MESSAGE_DELIVERY_STATUS.READ)
      ) &&
      connectionStatus === CONNECTION_STATUS.CONNECTED
    ) {
      dispatch(markMessagesAsReadAC(channel.id, [message.id]))
    }
  }

  useEffect(() => {
    if (isVisible) {
      handleSendReadMarker()
    }
  }, [isVisible])

  useDidUpdate(() => {
    if (tabIsActive) {
      handleSendReadMarker()
    }
  }, [tabIsActive])

  useDidUpdate(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      handleSendReadMarker()
    }
  }, [connectionStatus])

  return (
    <Container
      ref={messageItemRef}
      marginTop={differentUserMessageSpacing || '16px'}
      marginBottom={nextMessage && nextMessage.type !== 'system' ? differentUserMessageSpacing || '16px' : ''}
      fontSize={fontSize}
      textColor={textColor || textPrimary}
      border={border}
      backgroundColor={backgroundColor || sectionBackground}
      borderRadius={borderRadius}
    >
      <span>
        {message.incoming
          ? makeUsername(message.user && contactsMap[message.user.id], message.user, getFromContacts)
          : 'You'}
        {message.body === 'CC'
          ? ' created this channel '
          : message.body === 'CG'
            ? ' created this group'
            : message.body === 'AM'
              ? ` added ${
                  !!(messageMetas && messageMetas.m) &&
                  messageMetas.m
                    .slice(0, 5)
                    .map((mem: string) =>
                      mem === user.id
                        ? 'You'
                        : ` ${systemMessageUserName(mem, contactsMap[mem], message.mentionedUsers)}`
                    )
                } ${
                  messageMetas && messageMetas.m && messageMetas.m.length > 5
                    ? `and ${messageMetas.m.length - 5} more`
                    : ''
                }`
              : message.body === 'RM'
                ? ` removed ${
                    messageMetas &&
                    messageMetas.m &&
                    messageMetas.m
                      .slice(0, 5)
                      .map((mem: string) =>
                        mem === user.id
                          ? 'You'
                          : ` ${systemMessageUserName(mem, contactsMap[mem], message.mentionedUsers)}`
                      )
                  } ${
                    messageMetas && messageMetas.m && messageMetas.m.length > 5
                      ? `and ${messageMetas.m.length - 5} more`
                      : ''
                  }`
                : message.body === 'LG'
                  ? ' left the group'
                  : ''}
      </span>
    </Container>
  )
}

export default React.memo(Message, (prevProps, nextProps) => {
  return (
    prevProps.message.deliveryStatus === nextProps.message.deliveryStatus &&
    prevProps.message.state === nextProps.message.state &&
    prevProps.message.userMarkers === nextProps.message.userMarkers &&
    prevProps.nextMessage === nextProps.nextMessage &&
    prevProps.connectionStatus === nextProps.connectionStatus &&
    prevProps.tabIsActive === nextProps.tabIsActive
  )
})

export const Container = styled.div<{
  topOffset?: number
  marginTop?: string
  marginBottom?: string
  visible?: boolean
  textColor: string
  backgroundColor?: string
  borderRadius?: string
  fontSize?: string
  border?: string
}>`
  display: inline-flex;
  justify-content: center;
  width: 100%;
  margin-top: ${(props) => props.marginTop};
  margin-bottom: ${(props) => props.marginBottom};
  text-align: center;
  z-index: 10;
  background: transparent;
  transition: all 0.2s ease-in-out;
  span {
    display: inline-block;
    max-width: 380px;
    font-style: normal;
    font-weight: normal;
    font-size: ${(props) => props.fontSize || '14px'};
    color: ${(props) => props.textColor};
    background: ${(props) => props.backgroundColor || '#ffffff'};
    box-sizing: border-box;
    border: ${(props) => props.border};
    border-radius: ${(props) => props.borderRadius || '14px'};
    padding: 5px 16px;
    box-shadow:
      0 0 2px rgba(0, 0, 0, 0.08),
      0 2px 24px rgba(0, 0, 0, 0.08);
    text-overflow: ellipsis;
    overflow: hidden;
  }
`
