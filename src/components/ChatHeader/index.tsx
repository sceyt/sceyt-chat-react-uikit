import styled from 'styled-components'
import React, { useEffect, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { ReactComponent as InfoIcon } from '../../assets/svg/info.svg'
import { CHANNEL_TYPE, USER_PRESENCE_STATUS } from '../../helpers/constants'
import {
  activeChannelSelector,
  channelInfoIsOpenSelector,
  channelListHiddenSelector
} from '../../store/channel/selector'
import Avatar from '../Avatar'
import { SectionHeader, SubTitle } from '../../UIHelper'
import { switchChannelInfoAC } from '../../store/channel/actions'
import { AvatarWrapper, UserStatus } from '../Channel'
import { userLastActiveDateFormat } from '../../helpers'
import { makeUsername } from '../../helpers/message'
import { colors } from '../../UIHelper/constants'
import { IContactsMap, IMember } from '../../types'
import { contactsMapSelector } from '../../store/user/selector'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { hideUserPresence } from '../../helpers/userHelper'
import { getClient } from '../../common/client'
import { getChannelTypesMemberDisplayTextMap } from '../../helpers/channelHalper'
import { themeSelector } from '../../store/theme/selector'

const Container = styled.div<{ background?: string; borderColor?: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  height: 64px;
  box-sizing: border-box;
  border-bottom: 1px solid ${(props) => props.borderColor || colors.backgroundColor};
  background-color: ${(props) => props.background};
`

const ChannelInfo = styled.div<{ clickable?: boolean; onClick: any }>`
  display: flex;
  align-items: center;
  width: 650px;
  max-width: calc(100% - 70px);
  cursor: ${(props) => props.clickable && 'pointer'};

  & ${UserStatus} {
    width: 10px;
    height: 10px;
  }
`

const ChannelName = styled.div`
  margin-left: 7px;
  width: 100%;

  & > ${SectionHeader} {
    max-width: calc(100% - 8px);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
`

const ChanelInfo = styled.span<{ infoIconColor?: string }>`
  cursor: pointer;

  > svg {
    color: ${(props) => props.infoIconColor};
  }
`

interface IProps {
  backgroundColor?: string
  titleColor?: string
  memberInfoTextColor?: string
  showMemberInfo?: boolean
  infoIcon?: JSX.Element
}

export default function ChatHeader({
  infoIcon,
  backgroundColor,
  titleColor,
  memberInfoTextColor,
  showMemberInfo = true
}: IProps) {
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()
  const [infoButtonVisible, setInfoButtonVisible] = useState(false)
  const activeChannel = useSelector(activeChannelSelector)
  const theme = useSelector(themeSelector)
  const channelListHidden = useSelector(channelListHiddenSelector)
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)
  const isDirectChannel = activeChannel.type === CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && activeChannel.members.find((member: IMember) => member.id !== user.id)
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const displayMemberText =
    memberDisplayText && memberDisplayText[activeChannel.type]
      ? activeChannel.memberCount > 1
        ? `${memberDisplayText[activeChannel.type]}s`
        : memberDisplayText[activeChannel.type]
      : activeChannel.type === CHANNEL_TYPE.BROADCAST || activeChannel.type === CHANNEL_TYPE.PUBLIC
      ? activeChannel.memberCount > 1
        ? 'subscribers'
        : 'subscriber'
      : activeChannel.memberCount > 1
      ? 'members'
      : 'member'
  const channelDetailsOnOpen = () => {
    dispatch(switchChannelInfoAC(!channelDetailsIsOpen))
  }
  const channelDetailsOpen = false

  useEffect(() => {
    if (!channelDetailsOpen) {
      setTimeout(() => {
        setInfoButtonVisible(!channelDetailsOpen)
      }, 90)
    } else {
      setInfoButtonVisible(!channelDetailsOpen)
    }
  }, [channelDetailsOpen])

  return (
    <Container background={backgroundColor} borderColor={colors.backgroundColor}>
      <ChannelInfo onClick={!channelListHidden && channelDetailsOnOpen} clickable={!channelListHidden}>
        <AvatarWrapper>
          {(activeChannel.subject || (isDirectChannel && directChannelUser)) && (
            <Avatar
              name={
                activeChannel.subject ||
                (isDirectChannel && directChannelUser ? directChannelUser.firstName || directChannelUser.id : '')
              }
              image={
                activeChannel.avatarUrl || (isDirectChannel && directChannelUser ? directChannelUser.avatarUrl : '')
              }
              size={36}
              textSize={13}
              setDefaultAvatar={isDirectChannel}
            />
          )}
          {/* {isDirectChannel && directChannelUser.presence.state === PRESENCE_STATUS.ONLINE && <UserStatus />} */}
        </AvatarWrapper>
        <ChannelName>
          <SectionHeader color={titleColor || colors.textColor1} theme={theme}>
            {activeChannel.subject ||
              (isDirectChannel && directChannelUser
                ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
                : '')}
          </SectionHeader>
          {showMemberInfo &&
            (isDirectChannel && directChannelUser ? (
              <SubTitle color={memberInfoTextColor}>
                {hideUserPresence && hideUserPresence(directChannelUser)
                  ? ''
                  : directChannelUser.presence &&
                    (directChannelUser.presence.state === USER_PRESENCE_STATUS.ONLINE
                      ? 'Online'
                      : directChannelUser.presence.lastActiveAt &&
                        userLastActiveDateFormat(directChannelUser.presence.lastActiveAt))}
              </SubTitle>
            ) : (
              <SubTitle color={memberInfoTextColor}>
                {!activeChannel.subject && !isDirectChannel ? '' : `${activeChannel.memberCount} ${displayMemberText} `}
              </SubTitle>
            ))}
        </ChannelName>
      </ChannelInfo>
      {!channelListHidden && (
        <ChanelInfo
          onClick={() => channelDetailsOnOpen()}
          infoIconColor={channelDetailsIsOpen ? colors.primary : colors.textColor2}
        >
          {infoButtonVisible && (infoIcon || <InfoIcon />)}
        </ChanelInfo>
      )}
    </Container>
  )
}
