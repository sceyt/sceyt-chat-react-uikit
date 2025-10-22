import React, { useMemo } from 'react'
import styled from 'styled-components'
import { Popup, CloseIcon, PopupBody, Button } from 'UIHelper'
import PopupContainer from 'common/popups/popupContainer'
import { THEME_COLORS } from 'UIHelper/constants'
import { useColor } from 'hooks'
import Avatar from 'components/Avatar'
import { IMember } from 'types'

interface IProps {
  onClose: () => void
  onJoin: () => void
  channelName: string
  channelAvatarUrl?: string
  members: IMember[]
}

export default function JoinGroupPopup({ onClose, onJoin, channelName, channelAvatarUrl, members }: IProps) {
  const {
    // [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary
  } = useColor()

  const firstMembers = members.slice(0, 3)
  const extraCount = Math.max(members.length - firstMembers.length, 0)

  const membersLine = useMemo(() => {
    const names = members.slice(0, 3).map((m) => m.firstName || m.id)
    const base = names.join(', ')
    return extraCount > 0 ? `${base} and ${extraCount} others` : base
  }, [members, extraCount])

  return (
    <PopupContainer>
      <Popup maxWidth='400px' width='400px' height='383px' padding='0' backgroundColor={background}>
        <PopupBody paddingH='32px' paddingV='28px'>
          <CloseIcon onClick={onClose} color={iconPrimary} height='12px' width='12px' />

          <TopAvatar>
            <Avatar name={channelName} image={channelAvatarUrl} size={90} textSize={24} setDefaultAvatar />
          </TopAvatar>

          <Title color={textPrimary}>{channelName}</Title>
          <Subtitle color={textPrimary}>Group chat invite</Subtitle>

          <MembersRow>
            {firstMembers.map((m, idx) => (
              <MemberAvatar key={m.id} index={idx}>
                <Avatar name={m.firstName || m.id} image={m.avatarUrl} size={40} textSize={12} setDefaultAvatar />
              </MemberAvatar>
            ))}
            {extraCount > 0 && (
              <ExtraBadge backgroundColor={surface1} color={textPrimary}>{`+${extraCount}`}</ExtraBadge>
            )}
          </MembersRow>
          {membersLine && <MembersText color={textSecondary}>{membersLine}</MembersText>}

          <Center>
            <Button type='button' color={'#fff'} backgroundColor={'#0DBD8B'} borderRadius='8px' onClick={onJoin}>
              Join Group
            </Button>
          </Center>
        </PopupBody>
      </Popup>
    </PopupContainer>
  )
}

const TopAvatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
`

const Title = styled.h3<{ color: string }>`
  // margin-top: 32px;
  text-align: center;
  line-height: 24px;
  color: ${(p) => p.color};
  font-weight: 500;
  font-style: Medium;
  font-size: 20px;
  line-height: 120%;
  letter-spacing: 0%;
`

const Subtitle = styled.div<{ color: string }>`
  text-align: center;
  color: ${(p) => p.color};
  margin-bottom: 16px;
  font-weight: 500;
  font-style: Medium;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: 0px;
`

const MembersRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
`

const MemberAvatar = styled.div<{ index: number }>`
  margin-left: ${(p) => (p.index === 0 ? '0' : '-8px')};
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 2px #fff;
`

const ExtraBadge = styled.span<{ backgroundColor: string; color: string }>`
  margin-left: 8px;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: ${(p) => p.backgroundColor};
  color: ${(p) => p.color};
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 0 0 2px #fff;
`

const MembersText = styled.div<{ color: string }>`
  text-align: center;
  margin-top: 8px;
  font-size: 14px;
  line-height: 18px;
  color: ${(p) => p.color};
`

const Center = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 18px;
`
