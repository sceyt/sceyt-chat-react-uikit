import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import styled from 'styled-components'
// Hooks
import usePermissions from '../../../hooks/usePermissions'

// Store
import {
  blockChannelAC,
  clearHistoryAC,
  deleteAllMessagesAC,
  deleteChannelAC,
  leaveChannelAC,
  markChannelAsReadAC,
  markChannelAsUnReadAC,
  pinChannelAC,
  turnOffNotificationsAC,
  turnOnNotificationsAC,
  unpinChannelAC
} from '../../../store/channel/actions'
import { blockUserAC, unblockUserAC } from '../../../store/user/actions'
// Assets
import { ReactComponent as BottomIcon } from '../../../assets/svg/bottom.svg'
import { ReactComponent as NotificationIcon } from '../../../assets/svg/notifications.svg'
import { ReactComponent as NotificationOffIcon } from '../../../assets/svg/unmuteNotifications.svg'
import { ReactComponent as MarkAsUnReadIconD } from '../../../assets/svg/markAsUnRead.svg'
import { ReactComponent as MarkAsReadIconD } from '../../../assets/svg/markAsRead.svg'
import { ReactComponent as LeaveIcon } from '../../../assets/svg/leave.svg'
import { ReactComponent as DeleteChannelIconD } from '../../../assets/svg/deleteChannel.svg'
import { ReactComponent as ClearIcon } from '../../../assets/svg/clear.svg'
import { ReactComponent as BlockIcon } from '../../../assets/svg/blockChannel.svg'
import { ReactComponent as ReportIcon } from '../../../assets/svg/report.svg'
import { ReactComponent as StarIcon } from '../../../assets/svg/star.svg'
import { ReactComponent as PinIcon } from '../../../assets/svg/pin.svg'
import { ReactComponent as UnpinIcon } from '../../../assets/svg/unpin.svg'
// Helpers
import { hideUserPresence } from '../../../helpers/userHelper'
import { SectionHeader, DropdownOptionLi, DropdownOptionsUl } from '../../../UIHelper'
import { DEFAULT_CHANNEL_TYPE, USER_STATE } from '../../../helpers/constants'
// import DropDown from '../../../common/dropdown'
import { colors, THEME_COLORS } from '../../../UIHelper/constants'
import { IChannel, IMember, MuteTime } from '../../../types'
import { getClient } from '../../../common/client'
// Components
// import ReportPopup from '../../../../common/Popups/report';
import ConfirmPopup from '../../../common/popups/delete'
import DropDown from '../../../common/dropdown'
import { useColor } from '../../../hooks'
import log from 'loglevel'

interface IProps {
  channel: IChannel
  theme?: string
  actionMenuOpen?: () => void
  menuIsOpen?: boolean
  toggleable: boolean
  showMuteUnmuteNotifications?: boolean
  muteUnmuteNotificationsOrder?: number
  muteNotificationIcon?: JSX.Element
  unmuteNotificationIcon?: JSX.Element
  muteNotificationIconColor?: string
  unmuteNotificationIconColor?: string
  muteUnmuteNotificationSwitcherColor?: string
  muteUnmuteNotificationTextColor?: string
  timeOptionsToMuteNotifications?: [MuteTime, ...MuteTime[]]

  showStarredMessages?: boolean
  starredMessagesOrder?: number
  staredMessagesIcon?: JSX.Element
  staredMessagesIconColor?: string
  staredMessagesTextColor?: string

  showClearHistory?: boolean
  clearHistoryOrder?: number
  clearHistoryIcon?: JSX.Element
  clearHistoryTextColor?: string

  showDeleteAllMessages?: boolean
  deleteAllMessagesOrder?: number
  deleteAllMessagesIcon?: JSX.Element
  deleteAllMessagesTextColor?: string

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
  showBlockAndLeaveChannel?: boolean
  showBlockUser?: boolean
  blockAndLeaveChannelOrder?: number
  blockAndLeaveChannelIcon?: JSX.Element
  unblockUserIcon?: JSX.Element
  blockAndLeaveChannelIconColor?: string
  blockAndLeaveChannelTextColor?: string
  unblockUserTextColor?: string

  actionItemsFontSize?: string

  borderColor?: string
}

const Actions = ({
  channel,
  actionMenuOpen,
  theme,
  menuIsOpen,
  toggleable,
  showMuteUnmuteNotifications = true,
  muteUnmuteNotificationsOrder,
  muteNotificationIcon,
  unmuteNotificationIcon,
  muteNotificationIconColor,
  unmuteNotificationIconColor,
  muteUnmuteNotificationTextColor,
  timeOptionsToMuteNotifications,
  showStarredMessages = false,
  starredMessagesOrder,
  staredMessagesIcon,
  staredMessagesIconColor,
  staredMessagesTextColor,
  showPinChannel = true,
  pinChannelOrder,
  pinChannelIcon,
  unpinChannelIcon,
  pinChannelIconColor,
  pinChannelTextColor,
  showMarkAsReadUnread = true,
  markAsReadUnreadOrder,
  markAsReadIcon,
  markAsUnreadIcon,
  markAsReadIconColor,
  markAsUnreadIconColor,
  markAsReadUnreadTextColor,
  showLeaveChannel = true,
  leaveChannelOrder,
  leaveChannelIcon,
  leaveChannelIconColor,
  leaveChannelTextColor,
  showReportChannel = false,
  reportChannelIcon,
  reportChannelOrder,
  reportChannelIconColor,
  reportChannelTextColor,
  showDeleteChannel = true,
  deleteChannelIcon,
  deleteChannelIconColor,
  deleteChannelTextColor,
  deleteChannelOrder,
  showBlockAndLeaveChannel = true,
  showBlockUser = true,
  blockAndLeaveChannelIcon,
  unblockUserIcon,
  blockAndLeaveChannelIconColor,
  blockAndLeaveChannelTextColor,
  unblockUserTextColor,
  showClearHistory = true,
  clearHistoryOrder,
  clearHistoryIcon,
  clearHistoryTextColor,
  // showDeleteAllMessages,
  deleteAllMessagesOrder,
  deleteAllMessagesIcon,
  deleteAllMessagesTextColor,
  actionItemsFontSize,
  borderColor
}: IProps) => {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.HOVER_BACKGROUND]: hoverBackground,
    [THEME_COLORS.BORDER]: borderThemeColor,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.WARNING]: errorColor
  } = useColor()

  const ChatClient = getClient()
  const { user } = ChatClient
  const [clearHistoryPopupOpen, setClearHistoryPopupOpen] = useState(false)
  const [deleteAllMessagesPopupOpen, setDeleteAllMessagesPopupOpenPopupOpen] = useState(false)
  const [leaveChannelPopupOpen, setLeaveChannelPopupOpen] = useState(false)
  const [deleteChannelPopupOpen, setDeleteChannelPopupOpen] = useState(false)
  const [blockChannelPopupOpen, setBlockChannelPopupOpen] = useState(false)
  const [blockUserPopupOpen, setBlockUserPopupOpen] = useState(false)
  const [unblockUserPopupOpen, setUnblockUserPopupOpen] = useState(false)
  const [reportUserPopupOpen, setReportUserPopupOpen] = useState(false)
  const [checkActionPermission] = usePermissions(channel.userRole)
  // const [reportPopupOpen, setReportPopupOpen] = useState(false)
  const [popupButtonText, setPopupButtonText] = useState('')
  const [popupTitle, setPopupTitle] = useState('')
  // const [showMuteDropdown, setShowMuteDropdown] = useState(false)
  // const dropDownElem = useRef<any>(null)
  const dispatch = useDispatch()

  const oneHour = 60 * 60 * 1000
  const twoHours = oneHour * 2
  const oneDay = oneHour * 24
  const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const isSelfChannel = isDirectChannel && channel.metadata?.s
  const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
  const disableAction = directChannelUser && !isSelfChannel && hideUserPresence && hideUserPresence(directChannelUser)
  const otherMembers = (isDirectChannel && channel.members.filter((member) => member.id && member.id !== user.id)) || []
  const handleToggleClearHistoryPopup = () => {
    setClearHistoryPopupOpen(!clearHistoryPopupOpen)
  }

  const handleToggleDeleteAllMessagesPopup = () => {
    setDeleteAllMessagesPopupOpenPopupOpen(!deleteAllMessagesPopupOpen)
  }

  const handleToggleLeaveChannelPopupOpen = () => {
    setLeaveChannelPopupOpen(!leaveChannelPopupOpen)
  }

  const handleToggleDeleteChannelPopupOpen = () => {
    setDeleteChannelPopupOpen(!deleteChannelPopupOpen)
  }

  const handleToggleBlockChannelPopupOpen = () => {
    setBlockChannelPopupOpen(!blockChannelPopupOpen)
  }

  const handleToggleBlockUserPopupOpen = () => {
    setBlockUserPopupOpen(!blockUserPopupOpen)
  }

  const handleToggleUnblockUserPopupOpen = () => {
    setUnblockUserPopupOpen(!unblockUserPopupOpen)
  }

  /* const handleToggleReportPopupOpen = () => {
    setReportPopupOpen(!reportPopupOpen)
  } */

  const toggleReportUserPopup = () => {
    setReportUserPopupOpen(!reportUserPopupOpen)
  }

  const handleActionsOpen = () => {
    if (toggleable && actionMenuOpen) {
      actionMenuOpen()
    }
  }

  const handleLeaveChannel = () => {
    dispatch(leaveChannelAC(channel.id))
  }

  const handleDeleteChannel = () => {
    dispatch(deleteChannelAC(channel.id))
  }

  const handleBlockChannel = () => {
    dispatch(blockChannelAC(channel.id))
  }

  const handleBlockUser = () => {
    if (otherMembers.length === 1) {
      dispatch(blockUserAC([otherMembers[0].id]))
    }
  }

  const handleUnblockUser = () => {
    if (otherMembers.length === 1) {
      dispatch(unblockUserAC([otherMembers[0].id]))
    }
  }

  const handleClearHistory = () => {
    dispatch(clearHistoryAC(channel.id))
  }

  const handleDeleteAllMessagesHistory = () => {
    dispatch(deleteAllMessagesAC(channel.id))
  }
  /*


  const handleReportChannel = (reportData: any) => {
    dispatch(reportChannelAC({ ...reportData, channelId: channel.id }))
  }

  const handleReportUser = (reportData: any) => {
    log.info('report data . ', reportData)
    directChannelUser
    dispatch(reportUserAC({ ...reportData, userId: directChannelUser.id }))
  } */

  /* const handleNotificationSwitch = () => {
    log.info('clocked ,,,', channel.muted)
    if (channel.muted) {
      // dispatch(turnOnNotifications())
    } else {
      // dispatch(turnOffNotifications(expTime))
      log.info('show dropdown -- ')
      // setShowMuteDropdown(true)
    }
  } */

  const handleNotificationOnOff = (expTime?: number) => {
    log.info('exp time ... ', expTime)
    if (channel.muted) {
      dispatch(turnOnNotificationsAC())
    } else {
      dispatch(turnOffNotificationsAC(expTime))
    }
  }

  const handleToggleChannelMarkAs = () => {
    log.info('handle action mark read ', channel.unread)
    if (channel.unread) {
      dispatch(markChannelAsReadAC(channel.id))
    } else {
      dispatch(markChannelAsUnReadAC(channel.id))
    }
  }

  const handlePinUnpinChannel = () => {
    if (channel.pinnedAt) {
      dispatch(unpinChannelAC(channel.id))
    } else {
      dispatch(pinChannelAC(channel.id))
    }
  }

  return (
    <Container isDirect={isDirectChannel} theme={theme} borderColor={borderColor || borderThemeColor}>
      {toggleable && (
        <ActionHeader onClick={handleActionsOpen}>
          <SectionHeader color={textPrimary}>ACTIONS</SectionHeader>
          <MenuTriggerIcon isOpen={menuIsOpen}>
            <DefaultBottomIcon color={iconPrimary} />
          </MenuTriggerIcon>
        </ActionHeader>
      )}
      <ActionsMenu isOpen={menuIsOpen}>
        {showMuteUnmuteNotifications &&
          !isSelfChannel &&
          !channel.isMockChannel &&
          (isDirectChannel && directChannelUser ? directChannelUser.state !== USER_STATE.DELETED : true) &&
          (channel.muted ? (
            <ActionItem
              key={0}
              order={muteUnmuteNotificationsOrder}
              onClick={() => handleNotificationOnOff()}
              iconColor={muteNotificationIconColor || textSecondary}
              color={muteUnmuteNotificationTextColor || textPrimary}
              hoverColor={muteUnmuteNotificationTextColor || textPrimary}
              fontSize={actionItemsFontSize}
            >
              <React.Fragment>{muteNotificationIcon || <DefaultMutedIcon />} Unmute notifications</React.Fragment>
              {/* <ToggleSwitch backgroundColor={muteUnmuteNotificationSwitcherColor} state={channel.muted} /> */}
            </ActionItem>
          ) : (
            <DropDown
              isSelect
              theme={theme}
              height='auto'
              position='left'
              order={muteUnmuteNotificationsOrder}
              trigger={
                <ActionItem
                  key={0}
                  disableEvent
                  iconColor={unmuteNotificationIconColor || textSecondary}
                  color={muteUnmuteNotificationTextColor || textPrimary}
                  hoverColor={muteUnmuteNotificationTextColor || textPrimary}
                  fontSize={actionItemsFontSize}
                >
                  <React.Fragment>{unmuteNotificationIcon || <DefaultMuteIcon />} Mute notifications</React.Fragment>
                  {/* <ToggleSwitch state={channel.muted} /> */}
                </ActionItem>
              }
            >
              {/* {showMuteDropdown ? ( */}
              <DropdownOptionsUl>
                {timeOptionsToMuteNotifications && timeOptionsToMuteNotifications.length ? (
                  timeOptionsToMuteNotifications.map((value, index) => {
                    return (
                      <DropdownOptionLi
                        textColor={textPrimary}
                        key={value + index}
                        hoverBackground={hoverBackground}
                        onClick={() => handleNotificationOnOff(value * oneHour)}
                      >
                        Mute for {value < 24 ? `${value} ${value > 1 ? 'hours' : 'hour'} ` : '1 day'}
                      </DropdownOptionLi>
                    )
                  })
                ) : (
                  <React.Fragment>
                    <DropdownOptionLi
                      textColor={textPrimary}
                      key={1}
                      hoverBackground={hoverBackground}
                      onClick={() => handleNotificationOnOff(oneHour)}
                    >
                      Mute for 1 hour
                    </DropdownOptionLi>
                    <DropdownOptionLi
                      textColor={textPrimary}
                      key={2}
                      hoverBackground={hoverBackground}
                      onClick={() => handleNotificationOnOff(twoHours)}
                    >
                      Mute for 2 hours
                    </DropdownOptionLi>
                    <DropdownOptionLi
                      textColor={textPrimary}
                      key={3}
                      hoverBackground={hoverBackground}
                      onClick={() => handleNotificationOnOff(oneDay)}
                    >
                      Mute for 1 day
                    </DropdownOptionLi>
                  </React.Fragment>
                )}

                <DropdownOptionLi
                  textColor={textPrimary}
                  key={4}
                  hoverBackground={hoverBackground}
                  onClick={() => handleNotificationOnOff()}
                >
                  Mute forever
                </DropdownOptionLi>
              </DropdownOptionsUl>
              {/* ) : undefined} */}
            </DropDown>
          ))}
        {showStarredMessages && !channel.isMockChannel && (
          <ActionItem
            key={1}
            onClick={() => log.info('stared messages')}
            order={starredMessagesOrder}
            iconColor={staredMessagesIconColor || textSecondary}
            color={staredMessagesTextColor || textPrimary}
            hoverColor={staredMessagesTextColor || textPrimary}
            fontSize={actionItemsFontSize}
          >
            <React.Fragment>{staredMessagesIcon || <DefaultStarIcon />} Starred messages </React.Fragment>
          </ActionItem>
        )}
        {showPinChannel &&
          !channel.isMockChannel &&
          (isDirectChannel && directChannelUser ? directChannelUser.state !== USER_STATE.DELETED : true) && (
            <ActionItem
              key={2}
              onClick={handlePinUnpinChannel}
              order={pinChannelOrder}
              iconColor={pinChannelIconColor || textSecondary}
              color={pinChannelTextColor || textPrimary}
              hoverColor={pinChannelTextColor || textPrimary}
              fontSize={actionItemsFontSize}
            >
              <React.Fragment>
                {channel.pinnedAt ? unpinChannelIcon || <DefaultUnpinIcon /> : pinChannelIcon || <DefaultPinIcon />}
                {channel.pinnedAt ? 'Unpin' : 'Pin'}
              </React.Fragment>
            </ActionItem>
          )}
        {showMarkAsReadUnread &&
          !isSelfChannel &&
          !channel.isMockChannel &&
          (isDirectChannel && directChannelUser ? directChannelUser.state !== USER_STATE.DELETED : true) &&
          (channel.unread ? (
            <ActionItem
              key={3}
              onClick={handleToggleChannelMarkAs}
              order={markAsReadUnreadOrder}
              iconColor={markAsReadIconColor || textSecondary}
              color={markAsReadUnreadTextColor || textPrimary}
              hoverColor={markAsReadUnreadTextColor || textPrimary}
              fontSize={actionItemsFontSize}
            >
              <React.Fragment>{markAsReadIcon || <DefaultMarkAsRead />} Mark as read</React.Fragment>
            </ActionItem>
          ) : (
            <ActionItem
              key={3}
              order={markAsReadUnreadOrder}
              onClick={handleToggleChannelMarkAs}
              iconColor={markAsUnreadIconColor || textSecondary}
              color={markAsReadUnreadTextColor || textPrimary}
              hoverColor={markAsReadUnreadTextColor || textPrimary}
              fontSize={actionItemsFontSize}
            >
              <React.Fragment>{markAsUnreadIcon || <DefaultMarkAsUnRead />} Mark as unread</React.Fragment>
            </ActionItem>
          ))}

        {!isDirectChannel && showLeaveChannel && (
          <ActionItem
            key={4}
            order={leaveChannelOrder}
            color={leaveChannelTextColor || errorColor}
            iconColor={leaveChannelIconColor || errorColor}
            hoverColor={leaveChannelTextColor || errorColor}
            fontSize={actionItemsFontSize}
            onClick={() => {
              setPopupButtonText('Leave')
              setPopupTitle(
                `Leave ${
                  channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
                    ? 'group'
                    : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                      ? 'channel'
                      : channel.type
                }`
              )
              handleToggleLeaveChannelPopupOpen()
            }}
          >
            {leaveChannelIcon || <DefaultMarkAsReadIcon />}
            {` Leave ${
              channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
                ? 'group'
                : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                  ? 'channel'
                  : channel.type
            }`}
          </ActionItem>
        )}
        {isDirectChannel && otherMembers.length === 1 ? (
          <React.Fragment>
            {showBlockUser &&
              !disableAction &&
              (isDirectChannel && directChannelUser ? directChannelUser.state !== USER_STATE.DELETED : true) &&
              (directChannelUser && directChannelUser.blocked ? (
                <ActionItem
                  key={5}
                  color={unblockUserTextColor || textPrimary}
                  hoverColor={unblockUserTextColor || textPrimary}
                  iconColor={textSecondary}
                  fontSize={actionItemsFontSize}
                  onClick={() => {
                    handleUnblockUser()
                  }}
                >
                  {unblockUserIcon || <DefaultBlockIcon />} Unblock user
                </ActionItem>
              ) : (
                <ActionItem
                  key={6}
                  color={deleteChannelTextColor || errorColor}
                  iconColor={deleteChannelIconColor || errorColor}
                  hoverColor={deleteChannelTextColor || errorColor}
                  fontSize={actionItemsFontSize}
                  onClick={() => {
                    setPopupButtonText('Block')
                    setPopupTitle('Block user')
                    handleToggleBlockUserPopupOpen()
                  }}
                >
                  {blockAndLeaveChannelIcon || <DefaultBlockIcon />} Block user
                </ActionItem>
              ))}

            {showReportChannel && (
              <ActionItem
                color={deleteChannelTextColor || errorColor}
                iconColor={deleteChannelIconColor || errorColor}
                hoverColor={deleteChannelTextColor || errorColor}
                fontSize={actionItemsFontSize}
                key={7}
                onClick={() => toggleReportUserPopup()}
              >
                <DefaultReportIcon />
                Report user
              </ActionItem>
            )}
          </React.Fragment>
        ) : (
          <React.Fragment>
            {showBlockAndLeaveChannel && !isSelfChannel && !channel.isMockChannel && (
              <ActionItem
                key={8}
                color={blockAndLeaveChannelTextColor || errorColor}
                iconColor={blockAndLeaveChannelIconColor || errorColor}
                hoverColor={blockAndLeaveChannelTextColor || errorColor}
                fontSize={actionItemsFontSize}
                onClick={() => {
                  setPopupButtonText('Block')
                  setPopupTitle(
                    `Block and Leave ${
                      channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
                        ? 'group'
                        : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST ||
                            channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                          ? 'channel'
                          : channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
                            ? 'chat'
                            : channel.type
                    }`
                  )
                  handleToggleBlockChannelPopupOpen()
                }}
              >
                {blockAndLeaveChannelIcon || <DefaultBlockIcon />}
                {`Block and Leave ${
                  channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
                    ? 'group'
                    : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                      ? 'channel'
                      : channel.type === 'direct'
                        ? 'chat'
                        : channel.type
                }
                `}
              </ActionItem>
            )}
            {showReportChannel && !channel.isMockChannel && (
              <ActionItem
                key={9}
                order={reportChannelOrder}
                color={reportChannelTextColor || errorColor}
                iconColor={reportChannelIconColor || errorColor}
                hoverColor={reportChannelTextColor || errorColor}
                fontSize={actionItemsFontSize}
                onClick={() => {
                  setPopupButtonText('Report')
                  setPopupTitle('Report channel')
                  // handleToggleReportPopupOpen()
                  log.info('Report channel')
                }}
              >
                {reportChannelIcon || <DefaultReportIcon />} Report{' '}
                {channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                  ? 'channel'
                  : channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
                    ? 'group'
                    : 'chat'}
              </ActionItem>
            )}
          </React.Fragment>
        )}
        {showClearHistory &&
          !channel.isMockChannel &&
          (channel.type === DEFAULT_CHANNEL_TYPE.GROUP ||
            channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE ||
            channel.type === DEFAULT_CHANNEL_TYPE.DIRECT) && (
            <ActionItem
              key={10}
              color={clearHistoryTextColor || errorColor}
              iconColor={clearHistoryTextColor || errorColor}
              order={clearHistoryOrder}
              fontSize={actionItemsFontSize}
              hoverColor={clearHistoryTextColor || errorColor}
              onClick={() => {
                setPopupButtonText('Clear')
                setPopupTitle('Clear history')
                handleToggleClearHistoryPopup()
              }}
            >
              {clearHistoryIcon || <DefaultClearIcon />} Clear history
            </ActionItem>
          )}
        {showClearHistory &&
          !channel.isMockChannel &&
          (channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC) &&
          checkActionPermission('clearAllMessages') && (
            <ActionItem
              key={11}
              color={deleteAllMessagesTextColor || errorColor}
              iconColor={deleteAllMessagesTextColor || errorColor}
              order={deleteAllMessagesOrder}
              hoverColor={deleteAllMessagesTextColor || errorColor}
              fontSize={actionItemsFontSize}
              onClick={() => {
                setPopupButtonText('Clear')
                setPopupTitle(`Clear history`)
                handleToggleDeleteAllMessagesPopup()
              }}
            >
              {deleteAllMessagesIcon || <DefaultClearIcon />} Clear history
            </ActionItem>
          )}

        {showDeleteChannel && !channel.isMockChannel && checkActionPermission('deleteChannel') && (
          <ActionItem
            key={12}
            order={deleteChannelOrder}
            color={deleteChannelTextColor || errorColor}
            iconColor={deleteChannelIconColor || errorColor}
            hoverColor={deleteChannelTextColor || errorColor}
            fontSize={actionItemsFontSize}
            onClick={() => {
              setPopupButtonText('Delete')
              setPopupTitle(
                `Delete   ${
                  channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE || channel.type === DEFAULT_CHANNEL_TYPE.GROUP
                    ? 'group'
                    : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                      ? 'channel'
                      : channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
                        ? 'chat'
                        : channel.type
                }`
              )
              handleToggleDeleteChannelPopupOpen()
            }}
          >
            {deleteChannelIcon || <DefaultDeleteChannelIcon />}
            {` Delete ${
              channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE || channel.type === DEFAULT_CHANNEL_TYPE.GROUP
                ? 'group'
                : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                  ? 'channel'
                  : channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
                    ? 'chat'
                    : channel.type
            }`}
          </ActionItem>
        )}
      </ActionsMenu>

      {leaveChannelPopupOpen && (
        <ConfirmPopup
          handleFunction={handleLeaveChannel}
          togglePopup={handleToggleLeaveChannelPopupOpen}
          buttonText={popupButtonText}
          description={
            channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
              ? 'Once you leave this group it will be removed for you along with its entire history.'
              : 'Once you leave this channel it will be removed for you along with its entire history.'
          }
          title={popupTitle}
        />
      )}
      {deleteChannelPopupOpen && (
        <ConfirmPopup
          handleFunction={handleDeleteChannel}
          togglePopup={handleToggleDeleteChannelPopupOpen}
          buttonText={popupButtonText}
          description={
            channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
              ? 'Once you delete this chat it will be removed from the chat list with its message history.'
              : channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
                ? 'Once you delete this group it will be permanently removed along with its entire history for all the group members.'
                : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                  ? // eslint-disable-next-line max-len
                    'Once you delete this channel it will be permanently removed along with its entire history for all the channel subscribers.'
                  : 'Once you delete this channel it will be permanently removed along with its entire history for all the channel members.'
          }
          title={popupTitle}
        />
      )}
      {blockChannelPopupOpen && (
        <ConfirmPopup
          handleFunction={handleBlockChannel}
          togglePopup={handleToggleBlockChannelPopupOpen}
          buttonText={popupButtonText}
          description={`Are you sure you want to block the ${
            channel.subject ||
            (channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
              ? channel.members && (channel.members[0].firstName || channel.members[0].id)
              : 'channel')
          }`}
          title={popupTitle}
        />
      )}
      {blockUserPopupOpen && (
        <ConfirmPopup
          handleFunction={handleBlockUser}
          togglePopup={handleToggleBlockUserPopupOpen}
          buttonText={popupButtonText}
          description='Blocking a user will prevent them from sending you messages, calls, adding you to groups and channels.'
          title={popupTitle}
        />
      )}
      {unblockUserPopupOpen && (
        <ConfirmPopup
          handleFunction={handleUnblockUser}
          togglePopup={handleToggleUnblockUserPopupOpen}
          buttonText={popupButtonText}
          description='Are you sure you want to unblock?'
          title={popupTitle}
        />
      )}
      {clearHistoryPopupOpen && (
        <ConfirmPopup
          handleFunction={handleClearHistory}
          togglePopup={handleToggleClearHistoryPopup}
          buttonText={popupButtonText}
          description={
            channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
              ? 'Once you clear the history, the messages in this chat will be permanently removed for you.'
              : channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
                ? 'Once you clear the history it will be permanently removed for you.'
                : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                  ? 'Once you clear the history, the messages in this channel will be permanently removed for all the subscribers.'
                  : 'Are you sure you want to clear history? This action cannot be undone.'
          }
          title={popupTitle}
        />
      )}
      {deleteAllMessagesPopupOpen && (
        <ConfirmPopup
          handleFunction={handleDeleteAllMessagesHistory}
          togglePopup={handleToggleDeleteAllMessagesPopup}
          buttonText={popupButtonText}
          description={
            channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
              ? 'Once you clear the history, the messages in this chat will be permanently removed for you.'
              : channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
                ? 'Once you clear the history it will be permanently removed for you.'
                : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                  ? 'Once you clear the history, the messages in this channel will be permanently removed for all the subscribers.'
                  : 'Are you sure you want to delete all messages? This action cannot be undone.'
          }
          title={popupTitle}
        />
      )}

      {/*  {blockUserPopupOpen && (
        <DeletePopup
          deleteFunction={handleBlockUser}
          togglePopup={handleToggleBlockUserPopupOpen}
          buttonText={popupButtonText}
          description={`Are you sure you want to block ${
            channel.type === CHANNEL_TYPE.DIRECT ? directChannelUser.firstName : ''
          } ?`}
          title={popupTitle}
        />
      )}

      {reportPopupOpen && (
        <ReportPopup
          reportFunction={handleReportChannel}
          togglePopup={handleToggleReportPopupOpen}
          buttonText={popupButtonText}
          description='Choose the right reason to help us better process the report.'
          title={popupTitle}
        />
      )}

      {reportUserPopupOpen && (
        <ReportPopup
          title='Report Users'
          description='Choose the right reason to help us better process the report.'
          buttonText='Report'
          togglePopup={toggleReportUserPopup}
          reportFunction={handleReportUser}
          userId={directChannelUser.id}
        />
      )} */}
    </Container>
  )
}

export default Actions

const Container = styled.div<{ isDirect: boolean; theme?: string; borderColor?: string }>`
  padding: 10px 16px;
  border-bottom: 6px solid ${(props) => props.borderColor};
]`

const ActionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 25px 0 22px;
  cursor: pointer;
`

const MenuTriggerIcon = styled.span<{ isOpen?: boolean }>`
  transition: all 0.2s;
  ${(props) => !props.isOpen && ' transform: rotate(-90deg);'}
`

const ActionsMenu = styled.ul<{
  isOpen?: boolean
}>`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  transition: all 0.2s;
`

const DefaultMutedIcon = styled(NotificationOffIcon)``
const DefaultMuteIcon = styled(NotificationIcon)``
const DefaultStarIcon = styled(StarIcon)``
const DefaultUnpinIcon = styled(UnpinIcon)``
const DefaultPinIcon = styled(PinIcon)``
const DefaultMarkAsRead = styled(MarkAsReadIconD)``
const DefaultMarkAsUnRead = styled(MarkAsUnReadIconD)``
const DefaultBlockIcon = styled(BlockIcon)``
const DefaultReportIcon = styled(ReportIcon)``
const DefaultClearIcon = styled(ClearIcon)``
const DefaultDeleteChannelIcon = styled(DeleteChannelIconD)``
const DefaultBottomIcon = styled(BottomIcon)``
const DefaultMarkAsReadIcon = styled(LeaveIcon)``

const ActionItem = styled.li<{
  color: string
  fontSize?: string
  disableEvent?: boolean
  iconColor: string
  hoverColor?: string
  order?: number
}>`
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 0;
  font-size: ${(props) => props.fontSize || '15px'};
  color: ${(props) => props.color};
  cursor: pointer;
  order: ${(props) => props.order};
  pointer-events: ${(props) => props.disableEvent && 'none'};

  & > div {
    margin-left: auto;
  }

  & > svg {
    margin-right: 16px;
    color: ${(props) => props.iconColor};
  }

  &:hover {
    color: ${(props) => props.hoverColor || colors.blue};
  }

  &:last-child {
    //margin-bottom: 0;
  }
`
/*
const NotificationsMuteDropdown = styled(DropdownOptionsUl)`
  position: absolute;
  right: 0;
  top: 100%;
  background-color: #fff;
`
*/
