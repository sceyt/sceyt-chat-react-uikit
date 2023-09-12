import styled from 'styled-components'
import React, { useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { ReactComponent as InfoIcon } from '../../assets/svg/info.svg'
import { ReactComponent as ForwardIcon } from '../../assets/svg/forward.svg'
import { ReactComponent as ArrowLeftIcon } from '../../assets/svg/arrowLeft.svg'
import { ReactComponent as CloseIcon } from '../../assets/svg/close.svg'
import { ReactComponent as DeleteIcon } from '../../assets/svg/deleteIcon.svg'
import { CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS, USER_PRESENCE_STATUS } from '../../helpers/constants'
import {
  activeChannelSelector,
  channelInfoIsOpenSelector,
  channelListHiddenSelector
} from '../../store/channel/selector'
import Avatar from '../Avatar'
import { SectionHeader, SubTitle } from '../../UIHelper'
import { switchChannelActionAC, switchChannelInfoAC } from '../../store/channel/actions'
import { AvatarWrapper, UserStatus } from '../Channel'
import { userLastActiveDateFormat } from '../../helpers'
import { getAllowEditDeleteIncomingMessage, makeUsername } from '../../helpers/message'
import { colors } from '../../UIHelper/constants'
import { IAttachment, IContactsMap, IMember, IMessage } from '../../types'
import { connectionStatusSelector, contactsMapSelector } from '../../store/user/selector'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { hideUserPresence } from '../../helpers/userHelper'
import { getClient } from '../../common/client'
import { getChannelTypesMemberDisplayTextMap } from '../../helpers/channelHalper'
import { themeSelector } from '../../store/theme/selector'
import { selectedMessagesMapSelector } from '../../store/message/selector'
import ForwardMessagePopup from '../../common/popups/forwardMessage'
import {
  clearSelectedMessagesAC,
  deleteMessageAC,
  deleteMessageFromListAC,
  forwardMessageAC
} from '../../store/message/actions'
import ConfirmPopup from '../../common/popups/delete'
import { cancelUpload, getCustomUploader } from '../../helpers/customUploader'
import {
  deletePendingAttachment,
  removeMessageFromAllMessages,
  removeMessageFromMap
} from '../../helpers/messagesHalper'

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
  margin-right: auto;

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
const BackButtonWrapper = styled.span`
  display: inline-flex;
  cursor: pointer;
  margin-right: 16px;
`

const SelectedMessagesWrapper = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0 16px;
`

const CloseIconWrapper = styled.span`
  display: inline-flex;
  cursor: pointer;
  margin-left: auto;
  padding: 10px;
`

const CustomButton = styled.span<{ color?: string; backgroundColor?: string; marginLeft?: string }>`
  color: ${(props) => props.color || colors.textColor1};
  padding: 8px 16px;
  background-color: ${(props) => props.backgroundColor || colors.primaryLight};
  margin-left: ${(props) => props.marginLeft || '8px'};
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: Inter, sans-serif;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  > svg {
    width: 20px;
    height: 20px;
    margin-right: 8px;
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
  // const [infoButtonVisible, setInfoButtonVisible] = useState(false)
  const activeChannel = useSelector(activeChannelSelector)
  const theme = useSelector(themeSelector)
  const connectionStatus = useSelector(connectionStatusSelector)
  const channelListHidden = useSelector(channelListHiddenSelector)
  const selectedMessagesMap = useSelector(selectedMessagesMapSelector)
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)
  const [forwardPopupOpen, setForwardPopupOpen] = useState(false)
  const [deletePopupOpen, setDeletePopupOpen] = useState(false)
  const [isIncomingMessage, setIsIncomingMessage] = useState(false)
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
  const handleSwitchChannel = () => {
    if (activeChannel.linkedFrom) {
      dispatch(switchChannelActionAC({ ...activeChannel.linkedFrom, backToLinkedChannel: true }))
    }
  }
  const handleToggleForwardMessagePopup = () => {
    setForwardPopupOpen(!forwardPopupOpen)
  }

  const handleForwardMessage = (channelIds: string[]) => {
    if (channelIds && channelIds.length) {
      channelIds.forEach((channelId) => {
        for (const message of selectedMessagesMap.values()) {
          dispatch(forwardMessageAC(message, channelId, connectionStatus))
        }
      })
    }
    dispatch(clearSelectedMessagesAC())
  }
  const handleDeletePendingMessage = (message: IMessage) => {
    if (message.attachments && message.attachments.length) {
      const customUploader = getCustomUploader()
      message.attachments.forEach((att: IAttachment) => {
        if (customUploader) {
          cancelUpload(att.tid!)
          deletePendingAttachment(att.tid!)
        }
      })
    }
    removeMessageFromMap(activeChannel.id, message.id || message.tid!)
    removeMessageFromAllMessages(message.id || message.tid!)
    dispatch(deleteMessageFromListAC(message.id || message.tid!))
  }

  const handleToggleDeleteMessagePopup = () => {
    if (!deletePopupOpen) {
      for (const message of selectedMessagesMap.values()) {
        if (message.incoming) {
          setIsIncomingMessage(true)
          break
        } else {
          setIsIncomingMessage(false)
        }
      }
    }
    setDeletePopupOpen(!deletePopupOpen)
  }
  const handleDeleteMessage = (deleteOption: 'forMe' | 'forEveryone') => {
    for (const message of selectedMessagesMap.values()) {
      if (!message.deliveryStatus || message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
        handleDeletePendingMessage(message)
      } else {
        dispatch(deleteMessageAC(activeChannel.id, message.id, deleteOption))
      }
    }
    dispatch(clearSelectedMessagesAC())
  }
  const handleCloseSelectMessages = () => {
    dispatch(clearSelectedMessagesAC())
  }
  /* const channelDetailsOpen = false

   useEffect(() => {
     if (!channelDetailsOpen) {
       setTimeout(() => {
         setInfoButtonVisible(!channelDetailsOpen)
       }, 90)
     } else {
       setInfoButtonVisible(!channelDetailsOpen)
     }
   }, [channelDetailsOpen]) */

  return (
    <Container background={backgroundColor} borderColor={colors.backgroundColor}>
      {selectedMessagesMap && selectedMessagesMap.size > 0 ? (
        <SelectedMessagesWrapper>
          {selectedMessagesMap.size} {selectedMessagesMap.size > 1 ? ' messages selected' : ' message selected'}
          <CustomButton
            onClick={handleToggleForwardMessagePopup}
            backgroundColor={colors.primaryLight}
            marginLeft='32px'
          >
            <ForwardIcon />
            Forward
          </CustomButton>
          <CustomButton
            onClick={handleToggleDeleteMessagePopup}
            color={colors.red1}
            backgroundColor={colors.primaryLight}
            marginLeft='16px'
          >
            <DeleteIcon />
            Delete
          </CustomButton>
          <CloseIconWrapper onClick={handleCloseSelectMessages}>
            <CloseIcon />
          </CloseIconWrapper>
        </SelectedMessagesWrapper>
      ) : (
        <React.Fragment>
          {activeChannel.isLinkedChannel && (
            <BackButtonWrapper onClick={handleSwitchChannel}>
              <ArrowLeftIcon />
            </BackButtonWrapper>
          )}
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
              <SectionHeader
                color={titleColor || colors.textColor1}
                theme={theme}
                uppercase={directChannelUser && hideUserPresence && hideUserPresence(directChannelUser)}
              >
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
                    {!activeChannel.subject && !isDirectChannel
                      ? ''
                      : `${activeChannel.memberCount} ${displayMemberText} `}
                  </SubTitle>
                ))}
            </ChannelName>
          </ChannelInfo>
          {!channelListHidden && (
            <ChanelInfo
              onClick={() => channelDetailsOnOpen()}
              infoIconColor={channelDetailsIsOpen ? colors.primary : colors.textColor2}
            >
              {infoIcon || <InfoIcon />}
            </ChanelInfo>
          )}
        </React.Fragment>
      )}
      {forwardPopupOpen && (
        <ForwardMessagePopup
          handleForward={handleForwardMessage}
          togglePopup={handleToggleForwardMessagePopup}
          buttonText='Forward'
          title='Forward message'
        />
      )}
      {deletePopupOpen && (
        <ConfirmPopup
          handleFunction={handleDeleteMessage}
          togglePopup={handleToggleDeleteMessagePopup}
          buttonText='Delete'
          description={`Who do you want to remove ${
            selectedMessagesMap.size > 1 ? 'these messages' : 'this message'
          } for?`}
          isDeleteMessage
          isIncomingMessage={isIncomingMessage}
          myRole={activeChannel.userRole}
          allowDeleteIncoming={getAllowEditDeleteIncomingMessage()}
          isDirectChannel={activeChannel.type === CHANNEL_TYPE.DIRECT}
          title={`Delete message${selectedMessagesMap.size > 1 ? 's' : ''}`}
        />
      )}
    </Container>
  )
}
