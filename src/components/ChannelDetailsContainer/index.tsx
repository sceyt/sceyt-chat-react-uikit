import React from 'react'
import { shallowEqual, useSelector } from 'react-redux'
import Details from '../ChannelDetails'
import { channelInfoIsOpenSelector } from '../../store/channel/selector'
export interface IDetailsProps {
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
  showBlockAndLeaveChannel?: boolean
  blockAndLeaveChannelIcon?: JSX.Element
  blockAndLeaveChannelIconColor?: string
  blockAndLeaveChannelTextColor?: string
  linkPreviewIcon?: JSX.Element
  linkPreviewHoverIcon?: JSX.Element
  linkPreviewTitleColor?: string
  linkPreviewColor?: string
  linkPreviewHoverBackgroundColor?: string
  filePreviewIcon?: JSX.Element
  filePreviewHoverIcon?: JSX.Element
  filePreviewTitleColor?: string
  filePreviewSizeColor?: string
  filePreviewHoverBackgroundColor?: string
  filePreviewDownloadIcon?: JSX.Element
}

const ChannelDetailsContainer = ({
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
  deleteChannelIconColor,
  deleteChannelTextColor,
  showBlockAndLeaveChannel,
  blockAndLeaveChannelIcon,
  blockAndLeaveChannelIconColor,
  blockAndLeaveChannelTextColor,
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
  filePreviewDownloadIcon
}: IDetailsProps) => {
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)

  return (
    <React.Fragment>
      {channelDetailsIsOpen && (
        <Details
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
          deleteChannelIcon={deleteChannelIcon}
          deleteChannelIconColor={deleteChannelIconColor}
          deleteChannelTextColor={deleteChannelTextColor}
          showBlockAndLeaveChannel={showBlockAndLeaveChannel}
          blockAndLeaveChannelIcon={blockAndLeaveChannelIcon}
          blockAndLeaveChannelIconColor={blockAndLeaveChannelIconColor}
          blockAndLeaveChannelTextColor={blockAndLeaveChannelTextColor}
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
        />
      )}
    </React.Fragment>
  )
}

export default ChannelDetailsContainer
