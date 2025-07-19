import React from 'react'
import styled from 'styled-components'
import { makeUsername } from '../../../helpers/message'
import { USER_PRESENCE_STATUS } from '../../../helpers/constants'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { hideUserPresence } from '../../../helpers/userHelper'
import { IContact } from '../../../types'
import Avatar from '../../Avatar'
import { useColor } from '../../../hooks'

interface IChannelProps {
  contact: IContact
  showAvatar?: boolean
  avatarBorderRadius?: string
  theme?: string
  notificationsIsMutedIcon?: JSX.Element
  notificationsIsMutedIconColor?: string
  selectedChannelLeftBorder?: string
  selectedChannelBackground?: string
  contactsMap: { [key: string]: IContact }
  selectedChannelBorderRadius?: string
  selectedChannelPaddings?: string
  channelsPaddings?: string
  channelsMargin?: string
  channelHoverBackground?: string
  channelSubjectFontSize?: string
  channelSubjectLineHeight?: string
  channelSubjectColor?: string
  channelAvatarSize?: number
  channelAvatarTextSize?: number
  // eslint-disable-next-line no-unused-vars
  createChatWithContact: (contact: IContact) => void
}

const ContactItem: React.FC<IChannelProps> = ({
  contact,
  createChatWithContact,
  theme,
  showAvatar = true,
  avatarBorderRadius,
  channelsPaddings,
  channelsMargin,
  channelHoverBackground,
  channelSubjectFontSize,
  channelSubjectLineHeight,
  channelSubjectColor,
  channelAvatarSize,
  channelAvatarTextSize
}) => {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.ONLINE_STATUS]: online,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered
  } = useColor()

  const getFromContacts = getShowOnlyContactUsers()

  const contactUserName = makeUsername(contact, undefined, getFromContacts)
  return (
    <Container
      // ref={channelItemRef}
      theme={theme}
      channelsPaddings={channelsPaddings}
      channelsMargin={channelsMargin}
      onClick={() => createChatWithContact(contact)}
      hoverBackground={channelHoverBackground || backgroundHovered}
    >
      {showAvatar && (
        <AvatarWrapper>
          <Avatar
            // customAvatarColors={userAvatarColors}
            name={contactUserName}
            borderRadius={avatarBorderRadius}
            image={contact.user.avatarUrl}
            size={channelAvatarSize || 50}
            textSize={channelAvatarTextSize || 16}
            setDefaultAvatar
          />
          {hideUserPresence &&
            (hideUserPresence(contact.user)
              ? ''
              : contact.user.presence && contact.user.presence.state === USER_PRESENCE_STATUS.ONLINE) && (
              <UserStatus backgroundColor={online} />
            )}
        </AvatarWrapper>
      )}
      <ChannelInfo
        theme={theme}
        avatar={showAvatar}
        subjectFontSize={channelSubjectFontSize}
        subjectLineHeight={channelSubjectLineHeight}
        subjectColor={channelSubjectColor}
        textColor={textPrimary}
      >
        <h3>{contactUserName}</h3>
      </ChannelInfo>
    </Container>
  )
}

export default ContactItem

const Container = styled.div<{
  selectedBackgroundColor?: string
  channelsPaddings?: string
  selectedChannelPaddings?: string
  channelsMargin?: string
  theme?: string
  hoverBackground?: string
}>`
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: ${(props) => props.channelsPaddings || '8px'};
  margin: ${(props) => props.channelsMargin || '0 8px'};
  &:hover {
    background-color: ${(props) => props.hoverBackground};
  }
`

export const ChannelInfo = styled.div<{
  textColor: string
  avatar?: boolean
  theme?: string
  subjectFontSize?: string
  subjectLineHeight?: string
  subjectColor?: string
}>`
  text-align: left;
  margin-left: ${(props) => props.avatar && '12px'};
  width: 100%;
  max-width: calc(100% - 62px);

  h3 {
    display: inline-block;
    margin: 0;
    font-size: ${(props) => props.subjectFontSize || '15px'};
    font-weight: 500;
    text-overflow: ellipsis;
    line-height: ${(props) => props.subjectLineHeight || '18px'};
    letter-spacing: -0.2px;%;
    max-width: calc(100% - 2px);
    overflow: hidden;
    white-space: nowrap;
    color: ${(props) => props.subjectColor || props.textColor};
  }
`

export const AvatarWrapper = styled.div`
  display: flex;
  align-items: center;
  position: relative;
`

export const UserStatus = styled.span<{ backgroundColor?: string }>`
  position: absolute;
  width: 14px;
  height: 14px;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  background-color: ${(props) => props.backgroundColor || '#56E464'};
  border: 2.5px solid #ffffff;
  box-sizing: border-box;
`
