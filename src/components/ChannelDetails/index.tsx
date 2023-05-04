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
import { ReactComponent as EditIcon } from '../../assets/svg/edit.svg'
// import * as ProfileSrc from '../../assets/img/profile.png'
import Avatar from '../Avatar'
import EditChannel from './EditChannel'
import { IDetailsProps } from '../ChannelDetailsContainer'
import { loadMoreAttachmentsAC } from '../../store/message/actions'
import { activeTabAttachmentsHasNextSelector, messagesLoadingState } from '../../store/message/selector'
import { userLastActiveDateFormat } from '../../helpers'
import { makeUserName } from '../../helpers/message'
import { colors } from '../../UIHelper/constants'
import { IContactsMap } from '../../types'
import { contactsMapSelector } from '../../store/user/selector'
import usePermissions from '../../hooks/usePermissions'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { hideUserPresence } from '../../helpers/userHelper'

const Details = ({
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
  blockUserWarningText,
  blockAndLeavePublicChannelWarningText,
  blockAndLeavePrivateChannelWarningText,
  leavePublicChannelWarningText,
  leavePrivateChannelWarningText,
  deletePublicChannelWarningText,
  deletePrivateChannelWarningText,
  deleteDirectChannelWarningText,
  clearHistoryPublicChannelWarningText,
  clearHistoryPrivateChannelWarningText,
  clearHistoryDirectChannelWarningText,
  showClearHistoryForDirectChannel,
  showClearHistoryForPrivateChannel,
  showClearHistoryForPublicChannel,
  clearHistoryOrder,
  clearHistoryIcon,
  clearHistoryTextColor,
  showDeleteAllMessagesForDirectChannel,
  showDeleteAllMessagesForPrivateChannel,
  showDeleteAllMessagesForPublicChannel,
  deleteAllMessagesOrder,
  deleteAllMessagesIcon,
  deleteAllMessagesTextColor,
  showChangeMemberRole,
  showKickMember,
  showKickAndBlockMember,
  showMakeMemberAdmin,
  publicChannelDeleteMemberPopupDescription,
  privateChannelDeleteMemberPopupDescription,
  publicChannelRevokeAdminPopupDescription,
  privateChannelRevokeAdminPopupDescription,
  publicChannelMakeAdminPopupDescription,
  privateChannelMakeAdminPopupDescription
}: IDetailsProps) => {
  const dispatch = useDispatch()
  const getFromContacts = getShowOnlyContactUsers()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('')
  // const [tabFixed, setTabFixed] = useState(false)
  // const [editMode, setEditMode] = useState(false)
  const editMode = useSelector(channelEditModeSelector)
  const channel = useSelector(activeChannelSelector, shallowEqual)
  const [checkActionPermission] = usePermissions(channel.role)
  const membersLoading = useSelector(membersLoadingStateSelector)
  const messagesLoading = useSelector(messagesLoadingState)
  const attachmentsHasNex = useSelector(activeTabAttachmentsHasNextSelector)
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  // const tabsRef = useRef<any>(null)
  const detailsRef = useRef<any>(null)
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
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
    setMounted(false)
    // setTimeout(() => {
    dispatch(switchChannelInfoAC(false))
    // }, 100)
  }

  useEffect(() => {
    setMounted(true)
  }, [])
  return (
    <Container mounted={mounted}>
      <ChannelDetailsHeader>
        {editMode ? (
          <React.Fragment>
            <ArrowLeft onClick={() => setEditMode(false)} />
            <SectionHeader margin='0 0 0 12px'> Edit details </SectionHeader>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <SectionHeader>Details</SectionHeader> <CloseIcon onClick={handleDetailsClose} />
          </React.Fragment>
        )}
      </ChannelDetailsHeader>

      {editMode && (
        <EditChannel
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
        ref={detailsRef}
      >
        <DetailsHeader>
          <Avatar
            image={channel.avatarUrl || (channel.peer && channel.peer.avatarUrl)}
            name={channel.subject || (channel.peer && (channel.peer.firstName || channel.peer.id))}
            size={72}
            textSize={26}
            setDefaultAvatar={isDirectChannel}
          />
          <ChannelInfo>
            <ChannelName isDirect={isDirectChannel}>
              {channel.subject ||
                (isDirectChannel ? makeUserName(contactsMap[channel.peer.id], channel.peer, getFromContacts) : '')}
            </ChannelName>
            {isDirectChannel ? (
              <SubTitle>
                {hideUserPresence(channel.peer)
                  ? ''
                  : channel.peer.presence &&
                    (channel.peer.presence.state === PRESENCE_STATUS.ONLINE
                      ? 'Online'
                      : channel.peer.presence.lastActiveAt &&
                        userLastActiveDateFormat(channel.peer.presence.lastActiveAt))}
              </SubTitle>
            ) : (
              <SubTitle>
                {channel.memberCount}{' '}
                {channel.type === CHANNEL_TYPE.PUBLIC
                  ? channel.memberCount > 1
                    ? 'subscribers'
                    : 'subscriber'
                  : channel.memberCount > 1
                  ? 'members'
                  : 'member'}
              </SubTitle>
            )}
          </ChannelInfo>
          {!isDirectChannel && checkActionPermission('editChannel') && (
            <EditButton onClick={() => setEditMode(true)}>{channelEditIcon || <EditIcon />}</EditButton>
          )}
          {/* <Info channel={channel} handleToggleEditMode={() => setEditMode(!editMode)} /> */}
        </DetailsHeader>
        {channel.role && (
          <Actions
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
            showClearHistoryForDirectChannel={showClearHistoryForDirectChannel}
            showClearHistoryForPrivateChannel={showClearHistoryForPrivateChannel}
            showClearHistoryForPublicChannel={showClearHistoryForPublicChannel}
            clearHistoryOrder={clearHistoryOrder}
            clearHistoryIcon={clearHistoryIcon}
            clearHistoryTextColor={clearHistoryTextColor}
            showDeleteAllMessagesForDirectChannel={showDeleteAllMessagesForDirectChannel}
            showDeleteAllMessagesForPrivateChannel={showDeleteAllMessagesForPrivateChannel}
            showDeleteAllMessagesForPublicChannel={showDeleteAllMessagesForPublicChannel}
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
            blockUserWarningText={blockUserWarningText}
            blockAndLeavePublicChannelWarningText={blockAndLeavePublicChannelWarningText}
            blockAndLeavePrivateChannelWarningText={blockAndLeavePrivateChannelWarningText}
            leavePublicChannelWarningText={leavePublicChannelWarningText}
            leavePrivateChannelWarningText={leavePrivateChannelWarningText}
            deletePublicChannelWarningText={deletePublicChannelWarningText}
            deletePrivateChannelWarningText={deletePrivateChannelWarningText}
            deleteDirectChannelWarningText={deleteDirectChannelWarningText}
            clearHistoryPublicChannelWarningText={clearHistoryPublicChannelWarningText}
            clearHistoryPrivateChannelWarningText={clearHistoryPrivateChannelWarningText}
            clearHistoryDirectChannelWarningText={clearHistoryDirectChannelWarningText}
            timeOptionsToMuteNotifications={timeOptionsToMuteNotifications}
          />
        )}
        {/* <div ref={tabsRef}> */}
        <DetailsTab
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
          publicChannelDeleteMemberPopupDescription={publicChannelDeleteMemberPopupDescription}
          privateChannelDeleteMemberPopupDescription={privateChannelDeleteMemberPopupDescription}
          publicChannelRevokeAdminPopupDescription={publicChannelRevokeAdminPopupDescription}
          privateChannelRevokeAdminPopupDescription={privateChannelRevokeAdminPopupDescription}
          publicChannelMakeAdminPopupDescription={publicChannelMakeAdminPopupDescription}
          privateChannelMakeAdminPopupDescription={privateChannelMakeAdminPopupDescription}
        />
        {/* </div> */}
      </ChatDetails>
    </Container>
  )
}

export default Details

const Container = styled.div<{ mounted: boolean }>`
  flex: 0 0 auto;
  width: 0;
  border-left: 1px solid ${colors.gray1};
  //transition: all 0.1s;
  ${(props) => props.mounted && ' width: 360px'}
}
`

const ChannelDetailsHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 16px;
  position: relative;
  height: 64px;
  box-sizing: border-box;
  border-bottom: 1px solid ${colors.gray1};

  & svg {
    cursor: pointer;
  }
`

const ChatDetails = styled.div<{ heightOffset: number }>`
  position: relative;
  width: 360px;
  height: ${(props) => (props.heightOffset ? `calc(100vh - ${props.heightOffset}px)` : '100vh')};
  overflow-y: auto;
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

const ChannelInfo = styled.div`
  margin-left: 16px;
`

const DetailsHeader = styled.div`
  display: flex;
  position: relative;
  border-bottom: 6px solid ${colors.gray0};
  align-items: center;
  box-sizing: border-box;
  padding: 20px 16px;
`

const ChannelName = styled(SectionHeader)<any>`
  white-space: nowrap;
  max-width: ${(props) => (props.isDirect ? '200px' : '168px')};
  text-overflow: ellipsis;
  overflow: hidden;
`

const EditButton = styled.span`
  margin-left: 8px;
  cursor: pointer;
  color: #b2b6be;
`
