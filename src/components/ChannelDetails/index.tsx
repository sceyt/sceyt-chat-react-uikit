import React, { useEffect, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
// Store
import { activeChannelSelector, channelEditModeSelector } from '../../store/channel/selector'
import { switchChannelInfoAC, toggleEditChannelAC } from '../../store/channel/actions'
import { activeTabAttachmentsHasNextSelector, messagesLoadingState } from '../../store/message/selector'
import { loadMoreMembersAC } from '../../store/member/actions'
import { membersLoadingStateSelector } from '../../store/member/selector'
import { loadMoreAttachmentsAC } from '../../store/message/actions'
import { contactsMapSelector } from '../../store/user/selector'
import { themeSelector } from '../../store/theme/selector'
// Hooks
import usePermissions from '../../hooks/usePermissions'
// Assets
import { ReactComponent as ArrowLeft } from '../../assets/svg/arrowLeft.svg'
import { ReactComponent as EditIcon } from '../../assets/svg/editIcon.svg'
import { IDetailsProps } from '../ChannelDetailsContainer'
// Helpers
import { userLastActiveDateFormat } from '../../helpers'
import { makeUsername } from '../../helpers/message'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { hideUserPresence } from '../../helpers/userHelper'
import { getChannelTypesMemberDisplayTextMap } from '../../helpers/channelHalper'
import { THEME_COLORS } from '../../UIHelper/constants'
import { IContactsMap, IMember } from '../../types'
import { CloseIcon, SectionHeader, SubTitle } from '../../UIHelper'
import { DEFAULT_CHANNEL_TYPE, channelDetailsTabs, LOADING_STATE, USER_PRESENCE_STATUS } from '../../helpers/constants'
import { getClient } from '../../common/client'
// Components
import Actions from './Actions'
import DetailsTab from './DetailsTab'
import Avatar from '../Avatar'
import EditChannel from './EditChannel'
import { useColor } from '../../hooks'

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
  unpinChannelIcon,
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
  bordersColor,
  showPhoneNumber
}: IDetailsProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BORDER]: borderThemeColor,
    [THEME_COLORS.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLORS.SURFACE_2]: surface2
  } = useColor()

  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const theme = useSelector(themeSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('')
  const [channelDetailsHeight, setChannelDetailsHeight] = useState<number>(0)
  const [actionsHeight, setActionsHeight] = useState<number>(0)
  // const [tabFixed, setTabFixed] = useState(false)
  // const [editMode, setEditMode] = useState(false)
  const editMode = useSelector(channelEditModeSelector)
  const activeChannel = useSelector(activeChannelSelector, shallowEqual)
  const [checkActionPermission] = usePermissions(activeChannel ? activeChannel.userRole : '')
  const membersLoading = useSelector(membersLoadingStateSelector)
  const messagesLoading = useSelector(messagesLoadingState)
  const attachmentsHasNex = useSelector(activeTabAttachmentsHasNextSelector)
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const detailsRef = useRef<any>(null)
  const detailsHeaderRef = useRef<any>(null)
  const openTimeOut = useRef<any>(null)
  // const tabsRef = useRef<any>(null)
  const isDirectChannel = activeChannel && activeChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const isSelfChannel = isDirectChannel && activeChannel.metadata?.s
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const displayMemberText =
    memberDisplayText &&
    (memberDisplayText[activeChannel.type]
      ? activeChannel.memberCount > 1
        ? `${memberDisplayText[activeChannel.type]}s`
        : memberDisplayText[activeChannel.type]
      : activeChannel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || activeChannel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
        ? activeChannel.memberCount > 1
          ? 'subscribers'
          : 'subscriber'
        : activeChannel.memberCount > 1
          ? 'members'
          : 'member')
  const directChannelUser = isDirectChannel && activeChannel.members.find((member: IMember) => member.id !== user.id)
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
          dispatch(loadMoreMembersAC(15, activeChannel.id))
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

  const handleTabChange = () => {
    if (detailsRef.current && detailsHeaderRef.current) {
      detailsRef.current.scrollTo({
        top: actionsHeight + detailsHeaderRef.current.offsetHeight,
        behavior: 'smooth'
      })
    }
  }

  return (
    <Container
      backgroundColor={backgroundColor}
      mounted={mounted}
      size={size}
      theme={theme}
      borderColor={bordersColor || borderThemeColor}
    >
      <ChannelDetailsHeader borderColor={bordersColor || borderThemeColor}>
        {editMode ? (
          <React.Fragment>
            <ArrowLeft onClick={() => setEditMode(false)} color={textPrimary} />
            <SectionHeader fontSize={detailsTitleFontSize} margin='0 0 0 12px' color={textPrimary}>
              {editDetailsTitleText || 'Edit details'}
            </SectionHeader>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <SectionHeader fontSize={detailsTitleFontSize} color={textPrimary}>
              {detailsTitleText || 'Details'}
            </SectionHeader>{' '}
            <CloseIcon color={accentColor} onClick={handleDetailsClose} />
          </React.Fragment>
        )}
      </ChannelDetailsHeader>

      {editMode && (
        <EditChannel
          theme={theme}
          channel={activeChannel}
          handleToggleEditMode={setEditMode}
          editChannelSaveButtonBackgroundColor={editChannelSaveButtonBackgroundColor}
          editChannelSaveButtonTextColor={editChannelSaveButtonTextColor}
          editChannelCancelButtonBackgroundColor={editChannelCancelButtonBackgroundColor}
          editChannelCancelButtonTextColor={editChannelCancelButtonTextColor}
        />
      )}

      <ChatDetails
        className={isScrolling ? 'show-scrollbar' : ''}
        size={size}
        onScroll={handleMembersListScroll}
        heightOffset={detailsRef && detailsRef.current && detailsRef.current.offsetTop}
        height={channelDetailsHeight}
        ref={detailsRef}
        onMouseEnter={() => setIsScrolling(true)}
        onMouseLeave={() => setIsScrolling(false)}
        thumbColor={surface2}
      >
        <DetailsHeader borderColor={bordersColor || borderThemeColor} ref={detailsHeaderRef}>
          <ChannelAvatarAndName direction={avatarAndNameDirection}>
            <Avatar
              image={
                (activeChannel && activeChannel.avatarUrl) ||
                (directChannelUser && directChannelUser.avatarUrl) ||
                (isSelfChannel && user.avatarUrl)
              }
              name={
                (activeChannel && activeChannel.subject) ||
                (directChannelUser && (directChannelUser.firstName || directChannelUser.id)) ||
                (isSelfChannel && 'Me')
              }
              size={channelAvatarSize || 72}
              textSize={channelAvatarTextSize || 26}
              setDefaultAvatar={isDirectChannel}
            />
            <ChannelInfo direction={avatarAndNameDirection}>
              <ChannelNameWrapper>
                <ChannelName
                  isDirect={isDirectChannel}
                  uppercase={directChannelUser && hideUserPresence && hideUserPresence(directChannelUser)}
                  fontSize={channelNameFontSize}
                  lineHeight={channelNameLineHeight}
                  color={textPrimary}
                >
                  {(activeChannel && activeChannel.subject) ||
                    (isDirectChannel && directChannelUser
                      ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
                      : isSelfChannel
                        ? 'Me'
                        : '')}
                </ChannelName>
                {!isDirectChannel && checkActionPermission('updateChannel') && (
                  <EditButton
                    topPosition={channelEditIconTopPosition}
                    rightPosition={channelEditIconRightPosition}
                    onClick={() => setEditMode(true)}
                  >
                    {channelEditIcon || <EditIcon />}
                  </EditButton>
                )}
              </ChannelNameWrapper>

              {isDirectChannel ? (
                <SubTitle color={textSecondary} fontSize={channelMembersFontSize} lineHeight={channelMembersLineHeight}>
                  {showPhoneNumber
                    ? `+${directChannelUser.id}`
                    : hideUserPresence && directChannelUser && hideUserPresence(directChannelUser)
                      ? ''
                      : directChannelUser &&
                        directChannelUser.presence &&
                        (directChannelUser.presence.state === USER_PRESENCE_STATUS.ONLINE
                          ? 'Online'
                          : directChannelUser.presence.lastActiveAt &&
                            userLastActiveDateFormat(directChannelUser.presence.lastActiveAt))}
                </SubTitle>
              ) : (
                <SubTitle color={textSecondary} fontSize={channelMembersFontSize} lineHeight={channelMembersLineHeight}>
                  {activeChannel && activeChannel.memberCount} {displayMemberText}
                </SubTitle>
              )}
            </ChannelInfo>
          </ChannelAvatarAndName>

          {showAboutChannel && activeChannel && activeChannel.metadata && activeChannel.metadata.d && (
            <AboutChannel>
              {showAboutChannelTitle && <AboutChannelTitle color={textFootnote}>About</AboutChannelTitle>}
              <AboutChannelText color={textPrimary}>
                {activeChannel && activeChannel.metadata && activeChannel.metadata.d ? activeChannel.metadata.d : ''}
              </AboutChannelText>
            </AboutChannel>
          )}
          {/* <Info channel={channel} handleToggleEditMode={() => setEditMode(!editMode)} /> */}
        </DetailsHeader>
        {activeChannel && activeChannel.userRole && (
          <Actions
            setActionsHeight={setActionsHeight}
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
            unpinChannelIcon={unpinChannelIcon}
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
            channel={activeChannel}
            toggleable={false}
            timeOptionsToMuteNotifications={timeOptionsToMuteNotifications}
            actionItemsFontSize={actionItemsFontSize}
            borderColor={bordersColor}
          />
        )}
        {/* <div ref={tabsRef}> */}
        {!(activeChannel && activeChannel.isMockChannel) && (
          <DetailsTab
            theme={theme}
            channel={activeChannel}
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
            borderColor={bordersColor}
            tabItemsFontSize={tabItemsFontSize}
            tabItemsLineHeight={tabItemsLineHeight}
            tabItemsMinWidth={tabItemsMinWidth}
            onTabChange={handleTabChange}
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
  border-left: 1px solid ${(props) => props.borderColor};
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
  border-bottom: 1px solid ${(props) => props.borderColor};

  & svg {
    cursor: pointer;
  }
`

const ChatDetails = styled.div<{
  height: number
  heightOffset?: number
  size?: 'small' | 'medium' | 'large'
  thumbColor: string
}>`
  //position: relative;
  width: ${(props) => (props.size === 'small' ? '300px' : props.size === 'medium' ? '350px' : '400px')};
  //height: ${(props) => (props.height ? `calc(100vh - ${props.heightOffset}px)` : '100vh')};
  height: ${(props) => props.height && `${props.height - (props.heightOffset ? props.heightOffset + 2 : 0)}px`};
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
  }

  &.show-scrollbar::-webkit-scrollbar-thumb {
    background: ${(props) => props.thumbColor};
    border-radius: 4px;
  }
  &.show-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
`
const AboutChannel = styled.div`
  margin-top: 20px;
`
const AboutChannelTitle = styled.h4<{ color: string }>`
  font-size: 12px;
  margin: 0;
  line-height: 16px;
  color: ${(props) => props.color};
`

const AboutChannelText = styled.h3<{ color: string }>`
  font-size: 15px;
  margin: 0;
  font-weight: 400;
  line-height: 20px;
  color: ${(props) => props.color};
`

const ChannelInfo = styled.div<{ direction?: 'column' | 'row' }>`
  position: relative;
  margin-left: ${(props) => (!props.direction || props.direction !== 'column') && '16px'};
  margin-top: ${(props) => props.direction && props.direction === 'column' && '16px'};
  text-align: ${(props) => props.direction && props.direction === 'column' && 'center'};
`

const DetailsHeader = styled.div<{ borderColor: string }>`
  border-bottom: 6px solid ${(props) => props.borderColor};
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
  text-color: ${(props) => props.color};
  overflow: hidden;
  text-transform: ${(props) => props.uppercase && 'uppercase'};
`

const ChannelNameWrapper = styled.div`
  display: flex;
  justify-content: center;
`

const EditButton = styled.span<{ topPosition?: string; rightPosition?: string }>`
  margin-left: 6px;
  cursor: pointer;
  color: #b2b6be;
`
