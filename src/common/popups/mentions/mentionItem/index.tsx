import React from 'react'
import styled from 'styled-components'
import { USER_PRESENCE_STATUS } from '../../../../helpers/constants'
import { colors, THEME_COLORS } from '../../../../UIHelper/constants'
import { AvatarWrapper, UserStatus } from '../../../../components/Channel'
import { Avatar } from '../../../../components'
import { userLastActiveDateFormat } from '../../../../helpers'
import { SubTitle } from '../../../../UIHelper'
import { useColor } from '../../../../hooks'

interface IMentionsPopupProps {
  mention: any
  isFocused: boolean
  onMouseUp: (e: any) => void
  selectMention: (mention: any) => void
}

export default function MentionMember({ mention, isFocused, ...parentProps }: IMentionsPopupProps) {
  const { [THEME_COLORS.TEXT_PRIMARY]: textPrimary, [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()
  return (
    <MemberItem
      key={mention.id}
      isActiveItem={isFocused}
      activeBackgroundColor={colors.hoverBackgroundColor}
      {...parentProps}
    >
      <AvatarWrapper>
        <Avatar name={mention.name} image={mention.avatar} size={32} textSize={14} setDefaultAvatar />
      </AvatarWrapper>
      <UserNamePresence>
        <MemberName color={textPrimary}>{mention.name}</MemberName>
        <SubTitle color={textSecondary}>
          {mention.presence && mention.presence.state === USER_PRESENCE_STATUS.ONLINE
            ? 'Online'
            : mention.presence &&
              mention.presence.lastActiveAt &&
              userLastActiveDateFormat(mention.presence.lastActiveAt)}
        </SubTitle>
      </UserNamePresence>
    </MemberItem>
  )
}

const UserNamePresence = styled.div`
  width: 100%;
  margin-left: 12px;
`

const MemberName = styled.h3<{ color?: string }>`
  margin: 0;
  max-width: calc(100% - 1px);
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  color: ${(props) => props.color};
`

const EditMemberIcon = styled.span`
  margin-left: auto;
  cursor: pointer;
  padding: 2px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
`

const MemberItem = styled.div<{ isActiveItem?: boolean; activeBackgroundColor?: string }>`
  display: flex;
  align-items: center;
  font-size: 15px;
  padding: 6px 16px;
  transition: all 0.2s;
  cursor: pointer;
  background-color: ${(props) => props.isActiveItem && (props.activeBackgroundColor || colors.hoverBackgroundColor)};

  &:hover ${EditMemberIcon} {
    opacity: 1;
    visibility: visible;
  }

  & .dropdown-wrapper {
    margin-left: auto;
  }

  & .dropdown-body {
    bottom: -100px;
    right: 0;
  }

  & ${UserStatus} {
    width: 10px;
    height: 10px;
  }
`
