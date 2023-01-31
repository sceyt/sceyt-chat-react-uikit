import React from 'react'
import { shallowEqual, useSelector } from 'react-redux'
import Details from '../ChannelDetails'
import { channelInfoIsOpenSelector } from '../../store/channel/selector'
import {MuteTime} from "../../types";
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
  timeOptionsToMuteNotifications?: [MuteTime, ...MuteTime[]]

  showClearHistoryForDirectChannel?: boolean
  showClearHistoryForPrivateChannel?: boolean
  showClearHistoryForPublicChannel?: boolean
  clearHistoryOrder?: number
  clearHistoryIcon?: JSX.Element
  clearHistoryTextColor?: string

  showDeleteAllMessagesForDirectChannel?: boolean
  showDeleteAllMessagesForPrivateChannel?: boolean
  showDeleteAllMessagesForPublicChannel?: boolean
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

  voicePreviewIcon?: JSX.Element
  voicePreviewHoverIcon?: JSX.Element
  voicePreviewTitleColor?: string
  voicePreviewDateAndTimeColor?: string
  voicePreviewHoverBackgroundColor?: string

  filePreviewIcon?: JSX.Element
  filePreviewHoverIcon?: JSX.Element
  filePreviewTitleColor?: string
  filePreviewSizeColor?: string
  filePreviewHoverBackgroundColor?: string
  filePreviewDownloadIcon?: JSX.Element

  blockUserWarningText?: string
  blockAndLeavePublicChannelWarningText?: string
  blockAndLeavePrivateChannelWarningText?: string
  leavePublicChannelWarningText?: string
  leavePrivateChannelWarningText?: string
  deletePublicChannelWarningText?: string
  deletePrivateChannelWarningText?: string
  deleteDirectChannelWarningText?: string
  clearHistoryPublicChannelWarningText?: string
  clearHistoryPrivateChannelWarningText?: string
  clearHistoryDirectChannelWarningText?: string

  showChangeMemberRole?: boolean
  showKickMember?: boolean
  showKickAndBlockMember?: boolean
  showMakeMemberAdmin?: boolean
  publicChannelDeleteMemberPopupDescription?: string
  privateChannelDeleteMemberPopupDescription?: string
  publicChannelRevokeAdminPopupDescription?: string
  privateChannelRevokeAdminPopupDescription?: string
  publicChannelMakeAdminPopupDescription?: string
  privateChannelMakeAdminPopupDescription?: string
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
  publicChannelDeleteMemberPopupDescription,
  privateChannelDeleteMemberPopupDescription,
  publicChannelRevokeAdminPopupDescription,
  privateChannelRevokeAdminPopupDescription,
  publicChannelMakeAdminPopupDescription,
  privateChannelMakeAdminPopupDescription
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
          showChangeMemberRole={showChangeMemberRole}
          showKickMember={showKickMember}
          showKickAndBlockMember={showKickAndBlockMember}
          publicChannelDeleteMemberPopupDescription={publicChannelDeleteMemberPopupDescription}
          privateChannelDeleteMemberPopupDescription={privateChannelDeleteMemberPopupDescription}
          publicChannelRevokeAdminPopupDescription={publicChannelRevokeAdminPopupDescription}
          privateChannelRevokeAdminPopupDescription={privateChannelRevokeAdminPopupDescription}
          publicChannelMakeAdminPopupDescription={publicChannelMakeAdminPopupDescription}
          privateChannelMakeAdminPopupDescription={privateChannelMakeAdminPopupDescription}
        />
      )}
    </React.Fragment>
  )
}

export default ChannelDetailsContainer
