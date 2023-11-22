import React from 'react'
import { shallowEqual, useSelector } from 'react-redux'
import Details from '../ChannelDetails'
import { channelInfoIsOpenSelector } from '../../store/channel/selector'
import { MuteTime } from '../../types'
import styled from 'styled-components'
export interface IDetailsProps {
  size?: 'small' | 'medium' | 'large'
  showAboutChannel?: boolean
  showAboutChannelTitle?: boolean
  avatarAndNameDirection?: 'row' | 'column'
  channelEditIcon?: JSX.Element
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

  showChangeMemberRole?: boolean
  showKickMember?: boolean
  showKickAndBlockMember?: boolean
  showMakeMemberAdmin?: boolean
}

const ChannelDetailsContainer = ({
  size = 'large',
  channelEditIcon,
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
  showKickAndBlockMember
}: IDetailsProps) => {
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)

  return (
    <DetailsWrapper id='channel_details_wrapper'>
      {channelDetailsIsOpen && (
        <Details
          size={size}
          showAboutChannel={showAboutChannel}
          showAboutChannelTitle={showAboutChannelTitle}
          avatarAndNameDirection={avatarAndNameDirection}
          channelEditIcon={channelEditIcon}
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
          showKickAndBlockMember={showKickAndBlockMember}
        />
      )}
    </DetailsWrapper>
  )
}

const DetailsWrapper = styled.div``
export default ChannelDetailsContainer
