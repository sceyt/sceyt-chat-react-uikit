import styled from 'styled-components'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ReactComponent as InfoIcon } from '../../assets/svg/info.svg'
import { ReactComponent as DefaultAvatar } from '../../assets/svg/devaultAvatar36.svg'
import { CHANNEL_TYPE, PRESENCE_STATUS } from '../../helpers/constants'
import { activeChannelSelector } from '../../store/channel/selector'
import Avatar from '../Avatar'
import { SectionHeader, SubTitle } from '../../UIHelper'
import { switchChannelInfoAC } from '../../store/channel/actions'
import { AvatarWrapper, UserStatus } from '../Channel'
import { makeUserName, userLastActiveDateFormat } from '../../helpers'
import { colors } from '../../UIHelper/constants'
import { IContactsMap } from '../../types'
import { contactsMapSelector } from '../../store/user/selector'

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  height: 69px;
  box-sizing: border-box;
  border-bottom: 1px solid ${colors.gray1};
`

const ChannelInfo = styled.div`
  display: flex;
  align-items: center;

  & ${UserStatus} {
    width: 10px;
    height: 10px;
  }
`

const ChannelName = styled.div`
  margin-left: 7px;
`

const ChanelInfo = styled.span`
  cursor: pointer;
`

interface IProps {
  infoIcon?: JSX.Element
}

export default function ChatHeader({ infoIcon }: IProps) {
  const dispatch = useDispatch()
  const [infoButtonVisible, setInfoButtonVisible] = useState(false)
  const activeChannel = useSelector(activeChannelSelector)
  const isDirectChannel = activeChannel.type === CHANNEL_TYPE.DIRECT
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)

  const channelDetailsOnOpen = () => {
    dispatch(switchChannelInfoAC(true))
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
    <Container>
      <ChannelInfo>
        <AvatarWrapper>
          <Avatar
            name={
              activeChannel.subject || (isDirectChannel ? activeChannel.peer.firstName || activeChannel.peer.id : '')
            }
            image={activeChannel.avatarUrl || (isDirectChannel ? activeChannel.peer.avatarUrl : '')}
            size={36}
            textSize={13}
            setDefaultAvatar={isDirectChannel}
            defaultAvatarIcon={<DefaultAvatar />}
          />
          {/* {isDirectChannel && activeChannel.peer.presence.state === PRESENCE_STATUS.ONLINE && <UserStatus />} */}
        </AvatarWrapper>
        <ChannelName>
          <SectionHeader>
            {activeChannel.subject ||
              (isDirectChannel ? makeUserName(contactsMap[activeChannel.peer.id], activeChannel.peer) : '')}
          </SectionHeader>
          {isDirectChannel ? (
            <SubTitle>
              {activeChannel.peer.presence &&
                (activeChannel.peer.presence.state === PRESENCE_STATUS.ONLINE
                  ? 'Online'
                  : activeChannel.peer.presence.lastActiveAt &&
                    userLastActiveDateFormat(activeChannel.peer.presence.lastActiveAt))}
            </SubTitle>
          ) : (
            <SubTitle>
              {!activeChannel.subject && !isDirectChannel ? '' : `${activeChannel.memberCount} Members `}
            </SubTitle>
          )}
        </ChannelName>
      </ChannelInfo>
      <ChanelInfo onClick={() => channelDetailsOnOpen()}>{infoButtonVisible && (infoIcon || <InfoIcon />)}</ChanelInfo>
    </Container>
  )
}
