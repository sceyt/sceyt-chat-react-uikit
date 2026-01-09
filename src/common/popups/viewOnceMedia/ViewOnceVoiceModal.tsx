import React, { useEffect, useMemo } from 'react'
import styled from 'styled-components'
import { useDispatch, useSelector } from 'store/hooks'
import { useColor } from '../../../hooks'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { IAttachment, IContactsMap, IMember, IMessage } from '../../../types'
import AudioPlayer from '../../../components/AudioPlayer'
import PopupContainer from '../popupContainer'
import { ReactComponent as CloseIcon } from '../../../assets/svg/cancel.svg'
import { markMessageAsOpenedAC } from '../../../store/channel/actions'
import { activeChannelSelector } from 'store/channel/selector'
import { DEFAULT_CHANNEL_TYPE } from 'helpers/constants'
import { contactsMapSelector, userSelector } from 'store/user/selector'
import { makeUsername } from 'helpers/message'
import { getShowOnlyContactUsers } from 'helpers/contacts'
import MessageStatusAndTime from 'components/Message/MessageStatusAndTime'
import { activeChannelMessagesSelector } from 'store/message/selector'
import { shallowEqual } from 'react-redux'

interface ViewOnceVoiceModalProps {
  url: string
  file: IAttachment
  messagePlayed: boolean
  channelId: string
  incoming: boolean
  isOpen: boolean
  onClose: () => void
}

const ViewOnceVoiceModal: React.FC<ViewOnceVoiceModalProps> = ({
  url,
  file,
  messagePlayed,
  channelId,
  incoming,
  isOpen,
  onClose
}) => {
  const {
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.OVERLAY_BACKGROUND]: overlayBackground,
    [THEME_COLORS.BACKGROUND_FOCUSED]: backgroundFocused,
    [THEME_COLORS.OVERLAY_BACKGROUND_2]: overlayBackground2,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary
  } = useColor()
  const messages = useSelector(activeChannelMessagesSelector, shallowEqual) || []
  const dispatch = useDispatch()

  useEffect(() => {
    if (isOpen && incoming) {
      dispatch(markMessageAsOpenedAC(channelId, [file.messageId], false))
    }
  }, [isOpen, incoming, dispatch])

  const user = useSelector(userSelector)
  const activeChannel = useSelector(activeChannelSelector)
  const isDirectChannel = activeChannel && activeChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT

  const member = useMemo(() => {
    return isDirectChannel ? activeChannel?.members.find((member: IMember) => member.id !== user.id) : null
  }, [isDirectChannel, activeChannel?.members])
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const getFromContacts = getShowOnlyContactUsers()

  const message = useMemo(() => {
    return messages.find((message: IMessage) => message.id === file.messageId)
  }, [file])

  if (!isOpen) return null

  return (
    <PopupContainer bgColor={'transparent'}>
      <ModalContainer backgroundColor={`${overlayBackground}CC`}>
        <Header backgroundColor={overlayBackground2}>
          <HeaderTitle color={textOnPrimary}>Self-destructing voice message</HeaderTitle>
          <HeaderDescription color={textSecondary}>
            {incoming
              ? 'This message will be destructed after you play it once'
              : isDirectChannel
                ? `This message will be destructed after ${makeUsername(
                    contactsMap[member?.id],
                    member,
                    getFromContacts
                  )} plays it`
                : 'This message will be destructed after play by someone else'}
          </HeaderDescription>
          <CloseButton onClick={onClose} iconColor={iconPrimary}>
            <CloseIcon />
          </CloseButton>
        </Header>
        <AudioPlayerWrapper>
          <AudioPlayer
            url={url}
            file={file}
            messagePlayed={messagePlayed}
            channelId={channelId}
            incoming={incoming}
            viewOnce={true}
            bgColor={backgroundFocused}
            borderRadius={'16px 16px 0 16px'}
            onClose={onClose}
          />
          <MessageStatusAndTimeContainer>
            <MessageStatusAndTime
              message={message}
              messageStatusDisplayingType={'ticks'}
              messageStatusVisible={true}
              leftMargin
              messageTimeColorOnAttachment={textSecondary}
              messageTimeVisible={true}
            />
          </MessageStatusAndTimeContainer>
        </AudioPlayerWrapper>
      </ModalContainer>
    </PopupContainer>
  )
}

export default ViewOnceVoiceModal

const ModalContainer = styled.div<{ backgroundColor: string }>`
  position: relative;
  border-radius: 16px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(14px);
`

const CloseButton = styled.div<{ iconColor: string }>`
  position: absolute;
  top: 13px;
  right: 18px;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  > svg {
    width: 28px;
    height: 28px;
    color: ${(props) => props.iconColor};
  }
`

const AudioPlayerWrapper = styled.div`
  width: max-content;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
`

const MessageStatusAndTimeContainer = styled.div`
  position: absolute;
  bottom: 10px;
  right: 10px;
`

const Header = styled.div<{ backgroundColor: string }>`
  display: flex;
  justify-content: space-between;
  background-color: ${(props) => props.backgroundColor};
  padding: 16px 24px;
  box-sizing: border-box;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`

const HeaderTitle = styled.div<{ color: string }>`
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
`

const HeaderDescription = styled.div<{ color: string }>`
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.08px;
  color: ${(props) => props.color};
`
