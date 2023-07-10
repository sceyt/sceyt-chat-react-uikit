import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
// import Info from './Info'
import Actions from './Actions'
import DetailsTab from './DetailsTab'
import { CloseIcon, SectionHeader, SubTitle } from '../../UIHelper'
import { CHANNEL_TYPE, channelDetailsTabs, LOADING_STATE, PRESENCE_STATUS } from '../../helpers/constants'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { activeChannelSelector, channelEditModeSelector } from '../../store/channel/selector'
import { switchChannelInfoAC, toggleEditChannelAC } from '../../store/channel/actions'
import { loadMoreMembersAC } from '../../store/member/actions'
import { membersLoadingStateSelector } from '../../store/member/selector'
import { ReactComponent as ArrowLeft } from '../../assets/svg/arrowLeft.svg'
import { ReactComponent as EditIcon } from '../../assets/svg/editIcon.svg'
// import * as ProfileSrc from '../../assets/img/profile.png'
import Avatar from '../Avatar'
import EditChannel from './EditChannel'
import { IDetailsProps } from '../ChannelDetailsContainer'
import { loadMoreAttachmentsAC } from '../../store/message/actions'
import { activeTabAttachmentsHasNextSelector, messagesLoadingState } from '../../store/message/selector'
import { userLastActiveDateFormat } from '../../helpers'
import { makeUsername } from '../../helpers/message'
import { colors } from '../../UIHelper/constants'
import { IContactsMap, IMember } from '../../types'
import { contactsMapSelector } from '../../store/user/selector'
import usePermissions from '../../hooks/usePermissions'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { hideUserPresence } from '../../helpers/userHelper'
import { getClient } from '../../common/client'
import { getChannelTypesMemberDisplayTextMap } from '../../helpers/channelHalper'
import { themeSelector } from '../../store/theme/selector'

const Details = ({
  showAboutChannel,
  avatarAndNameDirection,
  channelEditIcon,
  editChannelSaveButtonBackgroundColor,
  editChannelSaveButtonTextColor,
  editChannelCancelButtonBackgroundColor,
  editChannelCancelButtonTextColor,
  showMuteUnmuteNotifications,
  muteUnmuteNotificationsOrder,
  muteNotificationIcon,
  unmuteNotificationIcon,
  muteNotificationIconColor,
  unmuteNotificationIconColor,
  muteUnmuteNotificationSwitcherColor,
  muteUnmuteNotificationTextColor,
  timeOptionsToMuteNotifications,
  showStarredMessages,
  starredMessagesOrder,
  staredMessagesIcon,
  staredMessagesIconColor,
  staredMessagesTextColor,
  showPinChannel,
  pinChannelOrder,
  pinChannelIcon,
  pinChannelIconColor,
  pinChannelTextColor,
  showMarkAsReadUnread,
  markAsReadUnreadOrder,
  markAsReadIcon,
  markAsUnreadIcon,
  markAsReadIconColor,
  markAsUnreadIconColor,
  markAsReadUnreadTextColor,
  showLeaveChannel,
  leaveChannelOrder,
  leaveChannelIcon,
  leaveChannelIconColor,
  leaveChannelTextColor,
  showReportChannel,
  reportChannelIcon,
  reportChannelOrder,
  reportChannelIconColor,
  reportChannelTextColor,
  deleteChannelIcon,
  showDeleteChannel,
  deleteChannelIconColor,
  deleteChannelTextColor,
  deleteChannelOrder,
  showBlockAndLeaveChannel,
  showBlockUser,
  blockAndLeaveChannelIcon,
  blockAndLeaveChannelIconColor,
  blockAndLeaveChannelTextColor,
  unblockUserIcon,
  linkPreviewIcon,
  linkPreviewHoverIcon,
  linkPreviewTitleColor,
  linkPreviewColor,
  linkPreviewHoverBackgroundColor,
  voicePreviewPlayIcon,
  voicePreviewPlayHoverIcon,
  voicePreviewPauseIcon,
  voicePreviewPauseHoverIcon,
  voicePreviewTitleColor,
  voicePreviewDateAndTimeColor,
  voicePreviewHoverBackgroundColor,
  filePreviewIcon,
  filePreviewHoverIcon,
  filePreviewTitleColor,
  filePreviewSizeColor,
  filePreviewHoverBackgroundColor,
  filePreviewDownloadIcon,
  showClearHistory,
  clearHistoryOrder,
  clearHistoryIcon,
  clearHistoryTextColor,
  showDeleteAllMessages,
  deleteAllMessagesOrder,
  deleteAllMessagesIcon,
  deleteAllMessagesTextColor,
  showChangeMemberRole,
  showKickMember,
  showKickAndBlockMember,
  showMakeMemberAdmin
}: IDetailsProps) => {
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const theme = useSelector(themeSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('')
  const [channelDetailsHeight, setChannelDetailsHeight] = useState<number>(0)
  // const [tabFixed, setTabFixed] = useState(false)
  // const [editMode, setEditMode] = useState(false)
  const editMode = useSelector(channelEditModeSelector)
  const channel = useSelector(activeChannelSelector, shallowEqual)
  const [checkActionPermission] = usePermissions(channel.userRole)
  const membersLoading = useSelector(membersLoadingStateSelector)
  const messagesLoading = useSelector(messagesLoadingState)
  const attachmentsHasNex = useSelector(activeTabAttachmentsHasNextSelector)
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const detailsRef = useRef<any>(null)
  const openTimeOut = useRef<any>(null)
  // const tabsRef = useRef<any>(null)
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const displayMemberText =
    memberDisplayText && memberDisplayText[channel.type]
      ? channel.memberCount > 1
        ? `${memberDisplayText[channel.type]}s`
        : memberDisplayText[channel.type]
      : channel.type === CHANNEL_TYPE.BROADCAST
      ? channel.memberCount > 1
        ? 'subscribers'
        : 'subscriber'
      : channel.memberCount > 1
      ? 'members'
      : 'member'
  const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
  // const myPermissions: any = []
  const handleMembersListScroll = (event: any) => {
    // setCloseMenu(true)
    /* if (tabsRef.current.getBoundingClientRect().top <= detailsRef.current.offsetTop) {
      if (!tabFixed) {
        setTabFixed(true)
      }
    } else if (tabFixed) {
      setTabFixed(false)
    } */
    if (event.target.scrollTop >= event.target.scrollHeight - event.target.offsetHeight - 100) {
      if (activeTab === channelDetailsTabs.member) {
        if (membersLoading === LOADING_STATE.LOADED) {
          dispatch(loadMoreMembersAC(15))
        }
      } else if (messagesLoading === LOADING_STATE.LOADED && attachmentsHasNex) {
        dispatch(loadMoreAttachmentsAC(10))
      }
    }
  }

  const setEditMode = (state: boolean) => {
    dispatch(toggleEditChannelAC(state))
  }

  const handleDetailsClose = () => {
    clearTimeout(openTimeOut.current)
    setMounted(false)
    // setTimeout(() => {
    dispatch(switchChannelInfoAC(false))
    // }, 100)
  }

  useEffect(() => {
    setMounted(true)
    const detailsContainer = document.getElementById('channel_details_wrapper')
    if (detailsContainer) {
      setChannelDetailsHeight(detailsContainer.offsetHeight)
    }
  }, [])
  return (
    <Container mounted={mounted} theme={theme} borderColor={colors.backgroundColor}>
      <ChannelDetailsHeader borderColor={colors.backgroundColor}>
        {editMode ? (
          <React.Fragment>
            <ArrowLeft onClick={() => setEditMode(false)} />
            <SectionHeader margin='0 0 0 12px' color={colors.textColor1}>
              Edit details
            </SectionHeader>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <SectionHeader color={colors.textColor1}>Details</SectionHeader>{' '}
            <CloseIcon color={colors.textColor1} onClick={handleDetailsClose} />
          </React.Fragment>
        )}
      </ChannelDetailsHeader>

      {editMode && (
        <EditChannel
          theme={theme}
          channel={channel}
          handleToggleEditMode={setEditMode}
          editChannelSaveButtonBackgroundColor={editChannelSaveButtonBackgroundColor}
          editChannelSaveButtonTextColor={editChannelSaveButtonTextColor}
          editChannelCancelButtonBackgroundColor={editChannelCancelButtonBackgroundColor}
          editChannelCancelButtonTextColor={editChannelCancelButtonTextColor}
        />
      )}

      <ChatDetails
        onScroll={handleMembersListScroll}
        heightOffset={detailsRef && detailsRef.current && detailsRef.current.offsetTop}
        height={channelDetailsHeight}
        ref={detailsRef}
      >
        <DetailsHeader borderColor={colors.backgroundColor}>
          <ChannelAvatarAndName direction={avatarAndNameDirection}>
            <Avatar
              image={channel.avatarUrl || (directChannelUser && directChannelUser.avatarUrl)}
              name={channel.subject || (directChannelUser && (directChannelUser.firstName || directChannelUser.id))}
              size={72}
              textSize={26}
              setDefaultAvatar={isDirectChannel}
            />
            <ChannelInfo direction={avatarAndNameDirection}>
              <ChannelName isDirect={isDirectChannel}>
                {channel.subject ||
                  (isDirectChannel && directChannelUser
                    ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
                    : '')}
              </ChannelName>
              {isDirectChannel ? (
                <SubTitle>
                  {hideUserPresence && directChannelUser && hideUserPresence(directChannelUser)
                    ? ''
                    : directChannelUser &&
                      directChannelUser.presence &&
                      (directChannelUser.presence.state === PRESENCE_STATUS.ONLINE
                        ? 'Online'
                        : directChannelUser.presence.lastActiveAt &&
                          userLastActiveDateFormat(directChannelUser.presence.lastActiveAt))}
                </SubTitle>
              ) : (
                <SubTitle>
                  {channel.memberCount} {displayMemberText}
                </SubTitle>
              )}
              {!isDirectChannel && checkActionPermission('editChannel') && (
                <EditButton onClick={() => setEditMode(true)}>{channelEditIcon || <EditIcon />}</EditButton>
              )}
            </ChannelInfo>
          </ChannelAvatarAndName>

          {showAboutChannel && channel.metadata && channel.metadata.d && (
            <AboutChannel>
              <AboutChannelTitle>About</AboutChannelTitle>
              <AboutChannelText color={colors.textColor1}>
                {channel.metadata && channel.metadata.d ? channel.metadata.d : ''}
              </AboutChannelText>
            </AboutChannel>
          )}
          {/* <Info channel={channel} handleToggleEditMode={() => setEditMode(!editMode)} /> */}
        </DetailsHeader>
        {channel.userRole && (
          <Actions
            theme={theme}
            showMuteUnmuteNotifications={showMuteUnmuteNotifications}
            muteUnmuteNotificationsOrder={muteUnmuteNotificationsOrder}
            unmuteNotificationIcon={unmuteNotificationIcon}
            muteNotificationIconColor={muteNotificationIconColor}
            unmuteNotificationIconColor={unmuteNotificationIconColor}
            muteUnmuteNotificationSwitcherColor={muteUnmuteNotificationSwitcherColor}
            muteUnmuteNotificationTextColor={muteUnmuteNotificationTextColor}
            showStarredMessages={showStarredMessages}
            starredMessagesOrder={starredMessagesOrder}
            staredMessagesIcon={staredMessagesIcon}
            staredMessagesIconColor={staredMessagesIconColor}
            staredMessagesTextColor={staredMessagesTextColor}
            showClearHistory={showClearHistory}
            clearHistoryOrder={clearHistoryOrder}
            clearHistoryIcon={clearHistoryIcon}
            clearHistoryTextColor={clearHistoryTextColor}
            showDeleteAllMessages={showDeleteAllMessages}
            deleteAllMessagesOrder={deleteAllMessagesOrder}
            deleteAllMessagesIcon={deleteAllMessagesIcon}
            deleteAllMessagesTextColor={deleteAllMessagesTextColor}
            showPinChannel={showPinChannel}
            pinChannelOrder={pinChannelOrder}
            pinChannelIcon={pinChannelIcon}
            pinChannelIconColor={pinChannelIconColor}
            pinChannelTextColor={pinChannelTextColor}
            showMarkAsReadUnread={showMarkAsReadUnread}
            markAsReadUnreadOrder={markAsReadUnreadOrder}
            markAsReadIcon={markAsReadIcon}
            markAsUnreadIcon={markAsUnreadIcon}
            markAsReadIconColor={markAsReadIconColor}
            markAsUnreadIconColor={markAsUnreadIconColor}
            markAsReadUnreadTextColor={markAsReadUnreadTextColor}
            showLeaveChannel={showLeaveChannel}
            leaveChannelOrder={leaveChannelOrder}
            leaveChannelIcon={leaveChannelIcon}
            leaveChannelIconColor={leaveChannelIconColor}
            leaveChannelTextColor={leaveChannelTextColor}
            showReportChannel={showReportChannel}
            reportChannelIcon={reportChannelIcon}
            reportChannelOrder={reportChannelOrder}
            reportChannelIconColor={reportChannelIconColor}
            reportChannelTextColor={reportChannelTextColor}
            showDeleteChannel={showDeleteChannel && checkActionPermission('deleteChannel')}
            deleteChannelIcon={deleteChannelIcon}
            deleteChannelIconColor={deleteChannelIconColor}
            deleteChannelTextColor={deleteChannelTextColor}
            deleteChannelOrder={deleteChannelOrder}
            showBlockAndLeaveChannel={showBlockAndLeaveChannel}
            showBlockUser={showBlockUser}
            blockAndLeaveChannelIcon={blockAndLeaveChannelIcon}
            blockAndLeaveChannelIconColor={blockAndLeaveChannelIconColor}
            blockAndLeaveChannelTextColor={blockAndLeaveChannelTextColor}
            unblockUserIcon={unblockUserIcon}
            muteNotificationIcon={muteNotificationIcon}
            channel={channel}
            toggleable={false}
            timeOptionsToMuteNotifications={timeOptionsToMuteNotifications}
          />
        )}
        {/* <div ref={tabsRef}> */}
        <DetailsTab
          theme={theme}
          channel={channel}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          linkPreviewIcon={linkPreviewIcon}
          linkPreviewHoverIcon={linkPreviewHoverIcon}
          linkPreviewTitleColor={linkPreviewTitleColor}
          linkPreviewColor={linkPreviewColor}
          linkPreviewHoverBackgroundColor={linkPreviewHoverBackgroundColor}
          voicePreviewPlayHoverIcon={voicePreviewPlayIcon}
          voicePreviewPlayIcon={voicePreviewPlayHoverIcon}
          voicePreviewPauseIcon={voicePreviewPauseIcon}
          voicePreviewPauseHoverIcon={voicePreviewPauseHoverIcon}
          voicePreviewTitleColor={voicePreviewTitleColor}
          voicePreviewDateAndTimeColor={voicePreviewDateAndTimeColor}
          voicePreviewHoverBackgroundColor={voicePreviewHoverBackgroundColor}
          filePreviewIcon={filePreviewIcon}
          filePreviewHoverIcon={filePreviewHoverIcon}
          filePreviewTitleColor={filePreviewTitleColor}
          filePreviewSizeColor={filePreviewSizeColor}
          filePreviewHoverBackgroundColor={filePreviewHoverBackgroundColor}
          filePreviewDownloadIcon={filePreviewDownloadIcon}
          checkActionPermission={checkActionPermission}
          showChangeMemberRole={showChangeMemberRole}
          showKickMember={showKickMember}
          showKickAndBlockMember={showKickAndBlockMember}
          showMakeMemberAdmin={showMakeMemberAdmin}
        />
        {/* </div> */}
      </ChatDetails>
    </Container>
  )
}

export default Details

const Container = styled.div<{ mounted: boolean; theme?: string; borderColor?: string }>`
  flex: 0 0 auto;
  width: 0;
  border-left: 1px solid ${(props) => props.borderColor || colors.backgroundColor};
  //transition: all 0.1s;
  ${(props) => props.mounted && ' width: 400px'}
}
`

const ChannelDetailsHeader = styled.div<{ borderColor?: string }>`
  display: flex;
  align-items: center;
  padding: 16px;
  position: relative;
  height: 64px;
  box-sizing: border-box;
  border-bottom: 1px solid ${(props) => props.borderColor || colors.backgroundColor};

  & svg {
    cursor: pointer;
  }
`

const ChatDetails = styled.div<{ height: number; heightOffset?: number }>`
  position: relative;
  width: 400px;
  //height: ${(props) => (props.height ? `calc(100vh - ${props.heightOffset}px)` : '100vh')};
  height: ${(props) => props.height && `${props.height - (props.heightOffset ? props.heightOffset + 2 : 0)}px`};
  overflow-y: auto;
`
const AboutChannel = styled.div`
  margin-top: 20px;
`
const AboutChannelTitle = styled.h4`
  font-size: 12px;
  margin: 0;
  line-height: 16px;
  color: ${colors.textColor3};
`

const AboutChannelText = styled.h3`
  font-size: 16px;
  margin: 0;
  font-weight: 400;
  line-height: 22px;
  color: ${(props) => props.color};
`

/* const DetailsBody = styled.div`
  padding: 6.5px 0 0;
  height: 100%;
  border-top: 6px solid #f3f5f8;
` */

/* const ChannelAvatar = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
` */

const ChannelInfo = styled.div<{ direction?: 'column' | 'row' }>`
  position: relative;
  margin-left: ${(props) => (!props.direction || props.direction !== 'column') && '16px'};
  margin-top: ${(props) => props.direction && props.direction === 'column' && '16px'};
  text-align: ${(props) => props.direction && props.direction === 'column' && 'center'};
`

const DetailsHeader = styled.div<{ borderColor?: string }>`
  border-bottom: 6px solid ${(props) => props.borderColor || colors.backgroundColor};
  align-items: center;
  box-sizing: border-box;
  padding: 20px 16px;
`

const ChannelAvatarAndName = styled.div<{ direction?: string }>`
  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  flex-direction: ${(props) => props.direction};
`

const ChannelName = styled(SectionHeader)<any>`
  white-space: nowrap;
  max-width: ${(props) => (props.isDirect ? '200px' : '168px')};
  text-overflow: ellipsis;
  overflow: hidden;
`

const EditButton = styled.span`
  position: absolute;
  right: -28px;
  top: 8px;
  margin-left: 8px;
  cursor: pointer;
  color: #b2b6be;
`
