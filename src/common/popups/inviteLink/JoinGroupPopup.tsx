import React, { useMemo } from 'react'
import styled from 'styled-components'
import { Popup, CloseIcon, PopupBody, Button } from 'UIHelper'
import PopupContainer from 'common/popups/popupContainer'
import { THEME_COLORS } from 'UIHelper/constants'
import { useColor } from 'hooks'
import Avatar from 'components/Avatar'
import { IChannel, IContactsMap, IUser } from 'types'
import { makeUsername } from 'helpers/message'
import { contactsMapSelector } from 'store/user/selector'
import { shallowEqual } from 'react-redux'
import { useSelector } from 'store/hooks'

interface IProps {
  onClose: () => void
  onJoin: () => void
  channel: IChannel & { membersTotalCount: number }
}

export default function JoinGroupPopup({ onClose, onJoin, channel }: IProps) {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary
  } = useColor()
  const contactsMap: IContactsMap = useSelector(contactsMapSelector, shallowEqual)

  const members = useMemo(
    () =>
      channel.members.map((m) => ({
        avatarUrl: (m as any)?.user?.profile?.avatar || '',
        firstName: (m as any)?.user?.profile?.firstName || '',
        lastName: (m as any)?.user?.profile?.lastName || '',
        id: (m as any)?.user?.profile?.id || '',
        role: (m as any)?.role || ''
      })),
    [channel]
  )

  const firstMembers = members.slice(0, channel.membersTotalCount > 3 ? 2 : channel.membersTotalCount)
  const extraCount = Math.max(members.length - firstMembers.length, 0)

  const membersLine = useMemo(() => {
    const names = firstMembers.map((m) => makeUsername(contactsMap[m.id], m as unknown as IUser, false, true))
    const base = names.join(', ')
    return extraCount > 0 ? `${base} and ${extraCount} others` : base
  }, [firstMembers, extraCount])

  return (
    <PopupContainer>
      <Popup maxWidth='400px' width='400px' height='383px' padding='0' backgroundColor={background}>
        <PopupBody paddingH='32px' paddingV='28px'>
          <CloseIcon onClick={onClose} color={iconPrimary} height='12px' width='12px' />

          <TopAvatar>
            <Avatar
              name={channel.subject || ''}
              image={channel.avatarUrl || ''}
              size={90}
              textSize={24}
              setDefaultAvatar
            />
          </TopAvatar>

          <Title color={textPrimary}>{channel.subject}</Title>
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
