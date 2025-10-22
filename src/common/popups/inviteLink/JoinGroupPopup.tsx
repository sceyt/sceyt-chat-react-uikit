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
  channel: IChannel & { membersTotalCount: number; avatar: string }
}

export default function JoinGroupPopup({ onClose, onJoin, channel }: IProps) {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.SURFACE_1]: surface1
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
        <PopupBody paddingH='32px' paddingV='31px'>
          <CloseIcon onClick={onClose} color={iconPrimary} height='12px' width='12px' />

          <TopAvatar>
            <Avatar
              name={channel.subject || ''}
              image={channel.avatar || ''}
              size={90}
              textSize={24}
              setDefaultAvatar={false}
            />
          </TopAvatar>

          <Title color={textPrimary}>{channel.subject}</Title>
          <Subtitle color={textPrimary}>Group chat invite</Subtitle>

          <MembersRow>
            {firstMembers.map((m, idx) => (
              <MemberAvatar key={m.id} index={idx} borderColor={background}>
                <Avatar name={m.firstName || m.id} image={m.avatarUrl} size={40} textSize={12} setDefaultAvatar />
              </MemberAvatar>
            ))}
            {extraCount > 0 && (
              <ExtraBadge
                borderColor={background}
                backgroundColor={surface1}
                color={textPrimary}
              >{`+${extraCount}`}</ExtraBadge>
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
  margin-top: 8px;
`

const Title = styled.h3<{ color: string }>`
  text-align: center;
  color: ${(p) => p.color};
  font-weight: 500;
  font-style: Medium;
  font-size: 20px;
  line-height: 24px;
  letter-spacing: 0%;
  margin-bottom: 4px;
  margin-top: 24px;
`

const Subtitle = styled.div<{ color: string }>`
  text-align: center;
  color: ${(p) => p.color};
  font-weight: 500;
  font-style: Medium;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: 0px;
  margin-bottom: 24px;
`

const MembersRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  gap: 4px;
`

const MemberAvatar = styled.div<{ index: number; borderColor?: string }>`
  margin-left: ${(p) => (p.index === 0 ? '0' : '-12px')};
  border-radius: 50%;
  overflow: hidden;
  width: 40px;
  height: 40px;
  border: 2px solid ${(p) => p.borderColor || '#fff'};
`

const ExtraBadge = styled.span<{ borderColor?: string; backgroundColor?: string; color: string }>`
  margin-left: -12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${(p) => p.color};
  font-size: 16px;
  font-weight: 600;
  border: 2px solid ${(p) => p.borderColor || '#fff'};
  background-color: ${(p) => p.backgroundColor || '#fff'};
`

const MembersText = styled.div<{ color: string }>`
  text-align: center;
  margin-top: 8px;
  color: ${(p) => p.color};
  font-weight: 500;
  font-style: Medium;
  font-size: 14px;
  line-height: 17.78px;
  letter-spacing: -0.1px;
  margin-top: 10px;
`

const Center = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
`
