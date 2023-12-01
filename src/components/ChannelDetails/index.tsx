import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
// import Info from './Info'
import Actions from './Actions'
import DetailsTab from './DetailsTab'
import { CloseIcon, SectionHeader, SubTitle } from '../../UIHelper'
import { CHANNEL_TYPE, channelDetailsTabs, LOADING_STATE, USER_PRESENCE_STATUS } from '../../helpers/constants'
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
  detailsTitleText,
  editDetailsTitleText,
  detailsTitleFontSize,
  size,
  channelNameFontSize,
  channelNameLineHeight,
  channelAvatarSize,
  channelAvatarTextSize,
  channelMembersFontSize,
  channelMembersLineHeight,
  showAboutChannel,
  showAboutChannelTitle,
  avatarAndNameDirection,
  channelEditIcon,
  channelEditIconTopPosition,
  channelEditIconRightPosition,
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
  fileNameFontSize,
  fileNameLineHeight,
  fileSizeFontSize,
  fileSizeLineHeight,
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
  showMakeMemberAdmin,
  memberHoverBackgroundColor,
  addMemberFontSize,
  memberNameFontSize,
  memberAvatarSize,
  memberPresenceFontSize,
  actionItemsFontSize,
  addMemberIcon,
  tabItemsFontSize,
  tabItemsLineHeight,
  tabItemsMinWidth,
  backgroundColor,
  bordersColor
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
  // const tabsRef = useRef<any>(null)
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
      : channel.type === CHANNEL_TYPE.BROADCAST || channel.type === CHANNEL_TYPE.PUBLIC
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
        dispatch(loadMoreAttachmentsAC(20))
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
    <Container
      backgroundColor={backgroundColor}
      mounted={mounted}
      size={size}
      theme={theme}
      borderColor={bordersColor || colors.backgroundColor}
    >
      <ChannelDetailsHeader borderColor={bordersColor || colors.backgroundColor}>
        {editMode ? (
          <React.Fragment>
            <ArrowLeft onClick={() => setEditMode(false)} />
            <SectionHeader fontSize={detailsTitleFontSize} margin='0 0 0 12px' color={colors.textColor1}>
              {editDetailsTitleText || 'Edit details'}
            </SectionHeader>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <SectionHeader fontSize={detailsTitleFontSize} color={colors.textColor1}>
              {detailsTitleText || 'Details'}
            </SectionHeader>{' '}
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
        size={size}
        onScroll={handleMembersListScroll}
        heightOffset={detailsRef && detailsRef.current && detailsRef.current.offsetTop}
        height={channelDetailsHeight}
        ref={detailsRef}
      >
        <DetailsHeader borderColor={bordersColor || colors.backgroundColor}>
          <ChannelAvatarAndName direction={avatarAndNameDirection}>
            <Avatar
              image={channel.avatarUrl || (directChannelUser && directChannelUser.avatarUrl)}
              name={channel.subject || (directChannelUser && (directChannelUser.firstName || directChannelUser.id))}
              size={channelAvatarSize || 72}
              textSize={channelAvatarTextSize || 26}
              setDefaultAvatar={isDirectChannel}
            />
            <ChannelInfo direction={avatarAndNameDirection}>
              <ChannelName
                isDirect={isDirectChannel}
                uppercase={directChannelUser && hideUserPresence && hideUserPresence(directChannelUser)}
                fontSize={channelNameFontSize}
                lineHeight={channelNameLineHeight}
              >
                {channel.subject ||
                  (isDirectChannel && directChannelUser
                    ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
                    : '')}
              </ChannelName>
              {isDirectChannel ? (
                <SubTitle fontSize={channelMembersFontSize} lineHeight={channelMembersLineHeight}>
                  {hideUserPresence && directChannelUser && hideUserPresence(directChannelUser)
                    ? ''
                    : directChannelUser &&
                      directChannelUser.presence &&
                      (directChannelUser.presence.state === USER_PRESENCE_STATUS.ONLINE
                        ? 'Online'
                        : directChannelUser.presence.lastActiveAt &&
                          userLastActiveDateFormat(directChannelUser.presence.lastActiveAt))}
                </SubTitle>
              ) : (
                <SubTitle fontSize={channelMembersFontSize} lineHeight={channelMembersLineHeight}>
                  {channel.memberCount} {displayMemberText}
                </SubTitle>
              )}
              {!isDirectChannel && checkActionPermission('editChannel') && (
                <EditButton
                  topPosition={channelEditIconTopPosition}
                  rightPosition={channelEditIconRightPosition}
                  onClick={() => setEditMode(true)}
                >
                  {channelEditIcon || <EditIcon />}
                </EditButton>
              )}
            </ChannelInfo>
          </ChannelAvatarAndName>

          {showAboutChannel && channel.metadata && channel.metadata.d && (
            <AboutChannel>
              {showAboutChannelTitle && <AboutChannelTitle>About</AboutChannelTitle>}
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
            actionItemsFontSize={actionItemsFontSize}
            borderColor={bordersColor}
          />
        )}
        {/* <div ref={tabsRef}> */}
        {!channel.isMockChannel && (
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
            fileNameFontSize={fileNameFontSize}
            fileNameLineHeight={fileNameLineHeight}
            fileSizeFontSize={fileSizeFontSize}
            fileSizeLineHeight={fileSizeLineHeight}
            checkActionPermission={checkActionPermission}
            showChangeMemberRole={showChangeMemberRole}
            showKickMember={showKickMember}
            showKickAndBlockMember={showKickAndBlockMember}
            showMakeMemberAdmin={showMakeMemberAdmin}
            memberHoverBackgroundColor={memberHoverBackgroundColor}
            addMemberFontSize={addMemberFontSize}
            addMemberIcon={addMemberIcon}
            memberNameFontSize={memberNameFontSize}
            memberAvatarSize={memberAvatarSize}
            memberPresenceFontSize={memberPresenceFontSize}
            backgroundColor={backgroundColor}
            borderColor={bordersColor}
            tabItemsFontSize={tabItemsFontSize}
            tabItemsLineHeight={tabItemsLineHeight}
            tabItemsMinWidth={tabItemsMinWidth}
          />
        )}
        {/* </div> */}
      </ChatDetails>
    </Container>
  )
}

export default Details

const Container = styled.div<{
  mounted: boolean
  theme?: string
  borderColor?: string
  size?: 'small' | 'medium' | 'large'
  backgroundColor?: string
}>`
  flex: 0 0 auto;
  width: 0;
  border-left: 1px solid ${(props) => props.borderColor || colors.backgroundColor};
  //transition: all 0.1s;
  ${(props) =>
    props.mounted && ` width: ${props.size === 'small' ? '300px' : props.size === 'medium' ? '350px' : '400px'};`}
  background-color: ${(props) => props.backgroundColor};
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

const ChatDetails = styled.div<{ height: number; heightOffset?: number; size?: 'small' | 'medium' | 'large' }>`
  //position: relative;
  width: ${(props) => (props.size === 'small' ? '300px' : props.size === 'medium' ? '350px' : '400px')};
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

const AboutChannelText = styled.h3<{ color: string }>`
  font-size: 15px;
  margin: 0;
  font-weight: 400;
  line-height: 20px;
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

const ChannelName = styled(SectionHeader)<{ isDirect?: boolean; uppercase?: boolean }>`
  white-space: nowrap;
  max-width: ${(props) => (props.isDirect ? '200px' : '168px')};
  text-overflow: ellipsis;
  overflow: hidden;
  text-transform: ${(props) => props.uppercase && 'uppercase'};
`

const EditButton = styled.span<{ topPosition?: string; rightPosition?: string }>`
  position: absolute;
  right: ${(props) => props.rightPosition || '-28px'};
  top: ${(props) => props.topPosition || '8px'};
  margin-left: 8px;
  cursor: pointer;
  color: #b2b6be;
`
