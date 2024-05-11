import React, { useEffect } from 'react'
import styled from 'styled-components'
import { shallowEqual, useSelector } from 'react-redux'
import Details from '../ChannelDetails'
import { channelInfoIsOpenSelector } from '../../store/channel/selector'
import { MuteTime } from '../../types'
import { setShowChannelDetails } from '../../helpers/channelHalper'
export interface IDetailsProps {
  size?: 'small' | 'medium' | 'large'

  detailsTitleText?: string
  editDetailsTitleText?: string
  detailsTitleFontSize?: string

  channelNameFontSize?: string
  channelNameLineHeight?: string
  channelAvatarSize?: number
  channelAvatarTextSize?: number
  channelMembersFontSize?: string
  channelMembersLineHeight?: string

  showAboutChannel?: boolean
  showAboutChannelTitle?: boolean
  avatarAndNameDirection?: 'row' | 'column'
  channelEditIcon?: JSX.Element
  channelEditIconTopPosition?: string
  channelEditIconRightPosition?: string
  editChannelSaveButtonBackgroundColor?: string
  editChannelSaveButtonTextColor?: string
  editChannelCancelButtonBackgroundColor?: string
  editChannelCancelButtonTextColor?: string
  showMuteUnmuteNotifications?: boolean

  muteUnmuteNotificationsOrder?: number
  muteNotificationIcon?: JSX.Element
  unmuteNotificationIcon?: JSX.Element
  muteNotificationIconColor?: string
  unmuteNotificationIconColor?: string
  muteUnmuteNotificationSwitcherColor?: string
  muteUnmuteNotificationTextColor?: string
  timeOptionsToMuteNotifications?: [MuteTime, ...MuteTime[]]

  showClearHistory?: boolean
  clearHistoryOrder?: number
  clearHistoryIcon?: JSX.Element
  clearHistoryTextColor?: string

  showDeleteAllMessages?: boolean
  deleteAllMessagesOrder?: number
  deleteAllMessagesIcon?: JSX.Element
  deleteAllMessagesTextColor?: string

  showStarredMessages?: boolean
  starredMessagesOrder?: number
  staredMessagesIcon?: JSX.Element
  staredMessagesIconColor?: string
  staredMessagesTextColor?: string

  showPinChannel?: boolean
  pinChannelOrder?: number
  pinChannelIcon?: JSX.Element
  unpinChannelIcon?: JSX.Element
  pinChannelIconColor?: string
  pinChannelTextColor?: string

  showMarkAsReadUnread?: boolean
  markAsReadUnreadOrder?: number
  markAsReadIcon?: JSX.Element
  markAsUnreadIcon?: JSX.Element
  markAsReadIconColor?: string
  markAsUnreadIconColor?: string
  markAsReadUnreadTextColor?: string

  showLeaveChannel?: boolean
  leaveChannelOrder?: number
  leaveChannelIcon?: JSX.Element
  leaveChannelIconColor?: string
  leaveChannelTextColor?: string

  showReportChannel?: boolean
  reportChannelOrder?: number
  reportChannelIcon?: JSX.Element
  reportChannelIconColor?: string
  reportChannelTextColor?: string

  showDeleteChannel?: boolean
  deleteChannelOrder?: number
  deleteChannelIcon?: JSX.Element
  deleteChannelIconColor?: string
  deleteChannelTextColor?: string
  deleteDirectChannelStrategy?: 'deleteChannel' | 'clearMessagesAndHide'

  showBlockAndLeaveChannel?: boolean
  showBlockUser?: boolean

  blockAndLeaveChannelIcon?: JSX.Element
  blockAndLeaveChannelIconColor?: string
  blockAndLeaveChannelTextColor?: string
  unblockUserIcon?: JSX.Element

  linkPreviewIcon?: JSX.Element
  linkPreviewHoverIcon?: JSX.Element
  linkPreviewTitleColor?: string
  linkPreviewColor?: string
  linkPreviewHoverBackgroundColor?: string

  voicePreviewPlayIcon?: JSX.Element
  voicePreviewPlayHoverIcon?: JSX.Element
  voicePreviewPauseIcon?: JSX.Element
  voicePreviewPauseHoverIcon?: JSX.Element
  voicePreviewTitleColor?: string
  voicePreviewDateAndTimeColor?: string
  voicePreviewHoverBackgroundColor?: string

  filePreviewIcon?: JSX.Element
  filePreviewHoverIcon?: JSX.Element
  filePreviewTitleColor?: string
  filePreviewSizeColor?: string
  filePreviewHoverBackgroundColor?: string
  filePreviewDownloadIcon?: JSX.Element
  fileNameFontSize?: string
  fileNameLineHeight?: string
  fileSizeFontSize?: string
  fileSizeLineHeight?: string

  showChangeMemberRole?: boolean
  showKickMember?: boolean
  showKickAndBlockMember?: boolean
  showMakeMemberAdmin?: boolean
  memberHoverBackgroundColor?: string
  addMemberFontSize?: string
  memberNameFontSize?: string
  memberAvatarSize?: number
  memberPresenceFontSize?: string

  actionItemsFontSize?: string
  addMemberIcon?: JSX.Element
  tabItemsFontSize?: string
  tabItemsLineHeight?: string
  tabItemsMinWidth?: string

  backgroundColor?: string
  bordersColor?: string
}

const ChannelDetailsContainer = ({
  size = 'large',
  detailsTitleText,
  editDetailsTitleText,
  detailsTitleFontSize,
  channelNameFontSize,
  channelNameLineHeight,
  channelAvatarSize,
  channelAvatarTextSize,
  channelMembersFontSize,
  channelMembersLineHeight,
  channelEditIcon,
  channelEditIconTopPosition,
  channelEditIconRightPosition,
  showAboutChannel = true,
  showAboutChannelTitle = true,
  avatarAndNameDirection = 'column',
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
  showDeleteChannel,
  deleteChannelIcon,
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
  memberHoverBackgroundColor,
  addMemberFontSize,
  addMemberIcon,
  memberNameFontSize,
  memberAvatarSize,
  memberPresenceFontSize,
  showKickMember,
  showKickAndBlockMember,
  backgroundColor,
  actionItemsFontSize,
  tabItemsFontSize,
  tabItemsLineHeight,
  tabItemsMinWidth,
  bordersColor
}: IDetailsProps) => {
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)

  useEffect(() => {
    setShowChannelDetails(true)
  }, [])
  return (
    <DetailsWrapper id='channel_details_wrapper'>
      {channelDetailsIsOpen && (
        <Details
          size={size}
          showAboutChannel={showAboutChannel}
          showAboutChannelTitle={showAboutChannelTitle}
          avatarAndNameDirection={avatarAndNameDirection}
          channelEditIcon={channelEditIcon}
          channelEditIconTopPosition={channelEditIconTopPosition}
          channelEditIconRightPosition={channelEditIconRightPosition}
          editChannelSaveButtonBackgroundColor={editChannelSaveButtonBackgroundColor}
          editChannelSaveButtonTextColor={editChannelSaveButtonTextColor}
          editChannelCancelButtonBackgroundColor={editChannelCancelButtonBackgroundColor}
          editChannelCancelButtonTextColor={editChannelCancelButtonTextColor}
          showMuteUnmuteNotifications={showMuteUnmuteNotifications}
          muteUnmuteNotificationsOrder={muteUnmuteNotificationsOrder}
          muteNotificationIcon={muteNotificationIcon}
          unmuteNotificationIcon={unmuteNotificationIcon}
          muteNotificationIconColor={muteNotificationIconColor}
          unmuteNotificationIconColor={unmuteNotificationIconColor}
          muteUnmuteNotificationSwitcherColor={muteUnmuteNotificationSwitcherColor}
          muteUnmuteNotificationTextColor={muteUnmuteNotificationTextColor}
          timeOptionsToMuteNotifications={timeOptionsToMuteNotifications}
          showStarredMessages={showStarredMessages}
          starredMessagesOrder={starredMessagesOrder}
          staredMessagesIcon={staredMessagesIcon}
          staredMessagesIconColor={staredMessagesIconColor}
          staredMessagesTextColor={staredMessagesTextColor}
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
          showDeleteChannel={showDeleteChannel}
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
          linkPreviewIcon={linkPreviewIcon}
          linkPreviewHoverIcon={linkPreviewHoverIcon}
          linkPreviewTitleColor={linkPreviewTitleColor}
          linkPreviewColor={linkPreviewColor}
          linkPreviewHoverBackgroundColor={linkPreviewHoverBackgroundColor}
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
          showClearHistory={showClearHistory}
          clearHistoryOrder={clearHistoryOrder}
          clearHistoryIcon={clearHistoryIcon}
          clearHistoryTextColor={clearHistoryTextColor}
          showDeleteAllMessages={showDeleteAllMessages}
          deleteAllMessagesOrder={deleteAllMessagesOrder}
          deleteAllMessagesIcon={deleteAllMessagesIcon}
          deleteAllMessagesTextColor={deleteAllMessagesTextColor}
          showChangeMemberRole={showChangeMemberRole}
          showKickMember={showKickMember}
          memberHoverBackgroundColor={memberHoverBackgroundColor}
          addMemberFontSize={addMemberFontSize}
          memberNameFontSize={memberNameFontSize}
          memberAvatarSize={memberAvatarSize}
          memberPresenceFontSize={memberPresenceFontSize}
          showKickAndBlockMember={showKickAndBlockMember}
          backgroundColor={backgroundColor}
          bordersColor={bordersColor}
          detailsTitleText={detailsTitleText}
          editDetailsTitleText={editDetailsTitleText}
          detailsTitleFontSize={detailsTitleFontSize}
          channelNameFontSize={channelNameFontSize}
          channelNameLineHeight={channelNameLineHeight}
          channelAvatarSize={channelAvatarSize}
          channelAvatarTextSize={channelAvatarTextSize}
          channelMembersFontSize={channelMembersFontSize}
          channelMembersLineHeight={channelMembersLineHeight}
          actionItemsFontSize={actionItemsFontSize}
          addMemberIcon={addMemberIcon}
          tabItemsFontSize={tabItemsFontSize}
          tabItemsLineHeight={tabItemsLineHeight}
          tabItemsMinWidth={tabItemsMinWidth}
        />
      )}
    </DetailsWrapper>
  )
}

const DetailsWrapper = styled.div``
export default ChannelDetailsContainer
