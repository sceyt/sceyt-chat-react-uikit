import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import styled from 'styled-components'
import { ReactComponent as BottomIcon } from '../../../assets/svg/bottom.svg'
// import { ReactComponent as DeleteIcon } from '../../../assets/lib/svg/clearHistory.svg'
import { ReactComponent as NotificationIcon } from '../../../assets/svg/notifications.svg'
import { ReactComponent as NotificationOffIcon } from '../../../assets/svg/notificationsOff2.svg'
import { ReactComponent as MarkAsUnRead } from '../../../assets/svg/markAsUnRead.svg'
import { ReactComponent as MarkAsRead } from '../../../assets/svg/markAsRead.svg'
import { ReactComponent as LeaveIcon } from '../../../assets/svg/leave.svg'
import { ReactComponent as DeleteChannel } from '../../../assets/svg/deleteChannel.svg'
import { ReactComponent as CleareIcon } from '../../../assets/svg/clear.svg'
import { ReactComponent as BlockIcon } from '../../../assets/svg/blockChannel.svg'
import { ReactComponent as ReportIcon } from '../../../assets/svg/report.svg'
import { ReactComponent as StarIcon } from '../../../assets/svg/star.svg'
import { ReactComponent as PinIcon } from '../../../assets/svg/pin.svg'
import { SectionHeader, DropdownOptionLi, DropdownOptionsUl } from '../../../UIHelper'
import ConfirmPopup from '../../../common/popups/delete'
import { CHANNEL_TYPE } from '../../../helpers/constants'
// import DropDown from '../../../common/dropdown'
import { colors } from '../../../UIHelper/constants'
// import ReportPopup from '../../../../common/Popups/report';
// import { reportUserAC } from '../../../../store/member/actions'
import { IChannel, IMember, MuteTime } from '../../../types'
import DropDown from '../../../common/dropdown'
import {
  blockChannelAC,
  clearHistoryAC,
  deleteAllMessagesAC,
  deleteChannelAC,
  leaveChannelAC,
  markChannelAsReadAC,
  markChannelAsUnReadAC,
  turnOffNotificationsAC,
  turnOnNotificationsAC
} from '../../../store/channel/actions'
import { blockUserAC, unblockUserAC } from '../../../store/user/actions'
import usePermissions from '../../../hooks/usePermissions'

interface IProps {
  channel: IChannel
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
  showBlockUser?: boolean
  blockAndLeaveChannelOrder?: number
  blockAndLeaveChannelIcon?: JSX.Element
  unblockUserIcon?: JSX.Element
  blockAndLeaveChannelIconColor?: string
  blockAndLeaveChannelTextColor?: string
  unblockUserTextColor?: string
}

const Actions = ({
  channel,
  actionMenuOpen,
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
  showPinChannel = false,
  pinChannelOrder,
  pinChannelIcon,
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
  showDeleteChannel,
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
  deleteAllMessagesTextColor
}: IProps) => {
  const [clearHistoryPopupOpen, setClearHistoryPopupOpen] = useState(false)
  const [deleteAllMessagesPopupOpen, setDeleteAllMessagesPopupOpenPopupOpen] = useState(false)
  const [leaveChannelPopupOpen, setLeaveChannelPopupOpen] = useState(false)
  const [deleteChannelPopupOpen, setDeleteChannelPopupOpen] = useState(false)
  const [blockChannelPopupOpen, setBlockChannelPopupOpen] = useState(false)
  const [blockUserPopupOpen, setBlockUserPopupOpen] = useState(false)
  const [unblockUserPopupOpen, setUnblockUserPopupOpen] = useState(false)
  const [reportUserPopupOpen, setReportUserPopupOpen] = useState(false)
  const [checkActionPermission] = usePermissions(channel.role)
  // const [reportPopupOpen, setReportPopupOpen] = useState(false)
  const [popupButtonText, setPopupButtonText] = useState('')
  const [popupTitle, setPopupTitle] = useState('')
  // const [showMuteDropdown, setShowMuteDropdown] = useState(false)
  // const dropDownElem = useRef<any>(null)
  const dispatch = useDispatch()

  const oneHour = 60 * 60 * 1000
  const twoHours = oneHour * 2
  const oneDay = oneHour * 24

  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const isPublicChannel = channel.type === CHANNEL_TYPE.PUBLIC
  const isPrivateChannel = channel.type === CHANNEL_TYPE.PRIVATE
  const channelType = channel.type === CHANNEL_TYPE.PUBLIC ? 'channel' : isDirectChannel ? 'chat' : 'group'

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
    dispatch(blockUserAC([channel.peer.id]))
  }

  const handleUnblockUser = () => {
    dispatch(unblockUserAC([channel.peer.id]))
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
    console.log('report data . ', reportData)
    directChannelUser
    dispatch(reportUserAC({ ...reportData, userId: directChannelUser.id }))
  } */

  /* const handleNotificationSwitch = () => {
    console.log('clocked ,,,', channel.muted)
    if (channel.muted) {
      // dispatch(turnOnNotifications())
    } else {
      // dispatch(turnOffNotifications(expTime))
      console.log('show dropdown -- ')
      // setShowMuteDropdown(true)
    }
  } */

  const handleNotificationOnOff = (expTime?: number) => {
    console.log('exp time ... ', expTime)
    if (channel.muted) {
      dispatch(turnOnNotificationsAC())
    } else {
      dispatch(turnOffNotificationsAC(expTime))
    }
  }

  const handleToggleChannelMarkAs = () => {
    console.log('handle action mark read ', channel.markedAsUnread)
    if (channel.markedAsUnread) {
      dispatch(markChannelAsReadAC(channel.id))
    } else {
      dispatch(markChannelAsUnReadAC(channel.id))
    }
  }

  return (
    <Container isDirect={isDirectChannel}>
      {toggleable && (
        <ActionHeader onClick={handleActionsOpen}>
          <SectionHeader>ACTIONS</SectionHeader>
          <MenuTriggerIcon isOpen={menuIsOpen}>
            <BottomIcon />
          </MenuTriggerIcon>
        </ActionHeader>
      )}
      <ActionsMenu isOpen={menuIsOpen}>
        {showMuteUnmuteNotifications &&
          (isDirectChannel ? channel.peer.activityState !== 'Deleted' : true) &&
          (channel.muted ? (
            <ActionItem
              key={0}
              order={muteUnmuteNotificationsOrder}
              onClick={() => handleNotificationOnOff()}
              iconColor={muteNotificationIconColor || colors.gray4}
              color={muteUnmuteNotificationTextColor || colors.gray6}
              hoverColor={muteUnmuteNotificationTextColor || colors.gray6}
            >
              <React.Fragment>{muteNotificationIcon || <DefaultMutedIcon />} Unmute notifications</React.Fragment>
              {/* <ToggleSwitch backgroundColor={muteUnmuteNotificationSwitcherColor} state={channel.muted} /> */}
            </ActionItem>
          ) : (
            <DropDown
              isSelect
              height='auto'
              position='left'
              order={muteUnmuteNotificationsOrder}
              trigger={
                <ActionItem
                  key={0}
                  disableEvent
                  iconColor={unmuteNotificationIconColor || colors.gray4}
                  color={muteUnmuteNotificationTextColor || colors.gray6}
                  hoverColor={muteUnmuteNotificationTextColor || colors.gray6}
                >
                  <React.Fragment>{unmuteNotificationIcon || <NotificationIcon />} Mute notifications</React.Fragment>
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
                        key={value + index}
                        hoverBackground={colors.primaryLight}
                        onClick={() => handleNotificationOnOff(value * oneHour)}
                      >
                        Mute for {value < 24 ? `${value} ${value > 1 ? 'hours' : 'hour'} ` : '1 day'}
                      </DropdownOptionLi>
                    )
                  })
                ) : (
                  <React.Fragment>
                    <DropdownOptionLi
                      key={1}
                      hoverBackground={colors.primaryLight}
                      onClick={() => handleNotificationOnOff(oneHour)}
                    >
                      Mute for 1 hour
                    </DropdownOptionLi>
                    <DropdownOptionLi
                      key={2}
                      hoverBackground={colors.primaryLight}
                      onClick={() => handleNotificationOnOff(twoHours)}
                    >
                      Mute for 2 hours
                    </DropdownOptionLi>
                    <DropdownOptionLi
                      key={3}
                      hoverBackground={colors.primaryLight}
                      onClick={() => handleNotificationOnOff(oneDay)}
                    >
                      Mute for 1 day
                    </DropdownOptionLi>
                  </React.Fragment>
                )}

                <DropdownOptionLi
                  key={4}
                  hoverBackground={colors.primaryLight}
                  onClick={() => handleNotificationOnOff()}
                >
                  Mute forever
                </DropdownOptionLi>
              </DropdownOptionsUl>
              {/* ) : undefined} */}
            </DropDown>
          ))}
        {showStarredMessages && (
          <ActionItem
            key={1}
            onClick={() => console.log('stared messages')}
            order={starredMessagesOrder}
            iconColor={staredMessagesIconColor || colors.gray4}
            color={staredMessagesTextColor || colors.gray6}
            hoverColor={staredMessagesTextColor || colors.gray6}
          >
            <React.Fragment>{staredMessagesIcon || <StarIcon />} Starred messages </React.Fragment>
          </ActionItem>
        )}
        {showPinChannel && (isDirectChannel ? channel.peer.activityState !== 'Deleted' : true) && (
          <ActionItem
            key={2}
            onClick={() => console.log('pin channel')}
            order={pinChannelOrder}
            iconColor={pinChannelIconColor || colors.gray4}
            color={pinChannelTextColor || colors.gray6}
            hoverColor={pinChannelTextColor || colors.gray6}
          >
            <React.Fragment>
              {pinChannelIcon || <PinIcon />} Pin {channelType}
            </React.Fragment>
          </ActionItem>
        )}
        {showMarkAsReadUnread &&
          (isDirectChannel ? channel.peer.activityState !== 'Deleted' : true) &&
          (channel.markedAsUnread ? (
            <ActionItem
              key={3}
              onClick={handleToggleChannelMarkAs}
              order={markAsReadUnreadOrder}
              iconColor={markAsReadIconColor || colors.gray4}
              color={markAsReadUnreadTextColor || colors.gray6}
              hoverColor={markAsReadUnreadTextColor || colors.gray6}
            >
              <React.Fragment>{markAsReadIcon || <MarkAsRead />} Mark as read</React.Fragment>
            </ActionItem>
          ) : (
            <ActionItem
              key={3}
              order={markAsReadUnreadOrder}
              onClick={handleToggleChannelMarkAs}
              iconColor={markAsUnreadIconColor || colors.gray4}
              color={markAsReadUnreadTextColor || colors.gray6}
              hoverColor={markAsReadUnreadTextColor || colors.gray6}
            >
              <React.Fragment>{markAsUnreadIcon || <MarkAsUnRead />} Mark as unread</React.Fragment>
            </ActionItem>
          ))}

        {!isDirectChannel && showLeaveChannel && (
          <ActionItem
            key={4}
            order={leaveChannelOrder}
            color={leaveChannelTextColor || colors.red1}
            iconColor={leaveChannelIconColor || colors.red1}
            hoverColor={leaveChannelTextColor || colors.red1}
            onClick={() => {
              setPopupButtonText('Leave')
              setPopupTitle(`Leave ${channelType}`)
              handleToggleLeaveChannelPopupOpen()
            }}
          >
            {leaveChannelIcon || <LeaveIcon />} Leave {channelType}
          </ActionItem>
        )}
        {isDirectChannel ? (
          <React.Fragment>
            {showBlockUser &&
              (isDirectChannel ? channel.peer.activityState !== 'Deleted' : true) &&
              (channel.peer.blocked ? (
                <ActionItem
                  key={5}
                  color={unblockUserTextColor || colors.gray6}
                  hoverColor={unblockUserTextColor || colors.gray6}
                  onClick={() => {
                    handleUnblockUser()
                  }}
                >
                  {unblockUserIcon || <BlockIcon />} Unblock user
                </ActionItem>
              ) : (
                <ActionItem
                  key={6}
                  color={deleteChannelTextColor || colors.red1}
                  iconColor={deleteChannelIconColor || colors.red1}
                  hoverColor={deleteChannelTextColor || colors.red1}
                  onClick={() => {
                    setPopupButtonText('Block')
                    setPopupTitle('Block user')
                    handleToggleBlockUserPopupOpen()
                  }}
                >
                  {blockAndLeaveChannelIcon || <BlockIcon />} Block user
                </ActionItem>
              ))}

            {showReportChannel && (
              <ActionItem
                color={deleteChannelTextColor || colors.red1}
                iconColor={deleteChannelIconColor || colors.red1}
                hoverColor={deleteChannelTextColor || colors.red1}
                key={7}
                onClick={() => toggleReportUserPopup()}
              >
                <ReportIcon />
                Report user
              </ActionItem>
            )}
          </React.Fragment>
        ) : (
          <React.Fragment>
            {showBlockAndLeaveChannel && (
              <ActionItem
                key={8}
                color={blockAndLeaveChannelTextColor || colors.red1}
                iconColor={blockAndLeaveChannelIconColor || colors.red1}
                hoverColor={blockAndLeaveChannelTextColor || colors.red1}
                onClick={() => {
                  setPopupButtonText('Block')
                  setPopupTitle(`Block and Leave ${channelType}`)
                  handleToggleBlockChannelPopupOpen()
                }}
              >
                {blockAndLeaveChannelIcon || <BlockIcon />} Block and Leave {channelType}
              </ActionItem>
            )}
            {showReportChannel && (
              <ActionItem
                key={9}
                order={reportChannelOrder}
                color={reportChannelTextColor || colors.red1}
                iconColor={reportChannelIconColor || colors.red1}
                hoverColor={reportChannelTextColor || colors.red1}
                onClick={() => {
                  setPopupButtonText('Report')
                  setPopupTitle('Report channel')
                  // handleToggleReportPopupOpen()
                  console.log('Report channel')
                }}
              >
                {reportChannelIcon || <ReportIcon />} Report{' '}
                {channel.type === CHANNEL_TYPE.PUBLIC
                  ? 'channel'
                  : channel.type === CHANNEL_TYPE.PRIVATE
                  ? 'group'
                  : 'chat'}
              </ActionItem>
            )}
          </React.Fragment>
        )}
        {((isDirectChannel && showClearHistoryForDirectChannel && channel.peer.activityState !== 'Deleted') ||
          (isPrivateChannel && showClearHistoryForPrivateChannel) ||
          (isPublicChannel && showClearHistoryForPublicChannel)) &&
          checkActionPermission('deleteAllMessagesForMe') && (
            <ActionItem
              key={10}
              color={clearHistoryTextColor || colors.red1}
              iconColor={clearHistoryTextColor || colors.red1}
              order={clearHistoryOrder}
              hoverColor={clearHistoryTextColor || colors.red1}
              onClick={() => {
                setPopupButtonText('Clear')
                setPopupTitle('Clear history')
                handleToggleClearHistoryPopup()
              }}
            >
              {clearHistoryIcon || <CleareIcon />} Clear history
            </ActionItem>
          )}
        {((isDirectChannel && showDeleteAllMessagesForDirectChannel) ||
          (isPrivateChannel && showDeleteAllMessagesForPrivateChannel) ||
          (isPublicChannel && showDeleteAllMessagesForPublicChannel)) &&
          checkActionPermission('deleteAllMessagesForAll') && (
            <ActionItem
              key={11}
              color={deleteAllMessagesTextColor || colors.red1}
              iconColor={deleteAllMessagesTextColor || colors.red1}
              order={deleteAllMessagesOrder}
              hoverColor={deleteAllMessagesTextColor || colors.red1}
              onClick={() => {
                setPopupButtonText('Clear')
                setPopupTitle(`Clear history`)
                handleToggleDeleteAllMessagesPopup()
              }}
            >
              {deleteAllMessagesIcon || <CleareIcon />} Clear history
            </ActionItem>
          )}

        {showDeleteChannel && checkActionPermission('deleteChannel') && (
          <ActionItem
            key={12}
            order={deleteChannelOrder}
            color={deleteChannelTextColor || colors.red1}
            iconColor={deleteChannelIconColor || colors.red1}
            hoverColor={deleteChannelTextColor || colors.red1}
            onClick={() => {
              setPopupButtonText('Delete')
              setPopupTitle(`Delete  ${channelType}`)
              handleToggleDeleteChannelPopupOpen()
            }}
          >
            {deleteChannelIcon || <DeleteChannel />} Delete {channelType}
          </ActionItem>
        )}
      </ActionsMenu>

      {leaveChannelPopupOpen && (
        <ConfirmPopup
          handleFunction={handleLeaveChannel}
          togglePopup={handleToggleLeaveChannelPopupOpen}
          buttonText={popupButtonText}
          description={
            channel.type === CHANNEL_TYPE.PRIVATE && leavePrivateChannelWarningText
              ? leavePrivateChannelWarningText
              : channel.type === CHANNEL_TYPE.PUBLIC && leavePublicChannelWarningText
              ? leavePublicChannelWarningText
              : `Are you sure you want to leave the "${
                  channel.subject || (channel.type === CHANNEL_TYPE.DIRECT ? channel.peer.firstName : '')
                }"  channel?`
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
            channel.type === CHANNEL_TYPE.DIRECT && deleteDirectChannelWarningText
              ? deleteDirectChannelWarningText
              : channel.type === CHANNEL_TYPE.PRIVATE && deletePrivateChannelWarningText
              ? deletePrivateChannelWarningText
              : channel.type === CHANNEL_TYPE.PUBLIC && deletePublicChannelWarningText
              ? deletePublicChannelWarningText
              : `Are you sure you want to delete the ${
                  channel.type === CHANNEL_TYPE.DIRECT
                    ? `channel with ${channel.peer.firstName}`
                    : `"${channel.subject}" channel`
                } ? This action cannot be undone.`
          }
          title={popupTitle}
        />
      )}
      {blockChannelPopupOpen && (
        <ConfirmPopup
          handleFunction={handleBlockChannel}
          togglePopup={handleToggleBlockChannelPopupOpen}
          buttonText={popupButtonText}
          description={
            channel.type === CHANNEL_TYPE.PRIVATE && blockAndLeavePrivateChannelWarningText
              ? blockAndLeavePrivateChannelWarningText
              : channel.type === CHANNEL_TYPE.PUBLIC && blockAndLeavePublicChannelWarningText
              ? blockAndLeavePublicChannelWarningText
              : `Are you sure you want to block the "${
                  channel.subject || (channel.type === CHANNEL_TYPE.DIRECT ? channel.peer.firstName : '')
                }"  channel?`
          }
          title={popupTitle}
        />
      )}
      {blockUserPopupOpen && (
        <ConfirmPopup
          handleFunction={handleBlockUser}
          togglePopup={handleToggleBlockUserPopupOpen}
          buttonText={popupButtonText}
          description={
            blockUserWarningText ||
            `Are you sure you want to block ${channel.type === CHANNEL_TYPE.DIRECT ? channel.peer.firstName : ''} ?`
          }
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
            channel.type === CHANNEL_TYPE.DIRECT && clearHistoryDirectChannelWarningText
              ? clearHistoryDirectChannelWarningText
              : channel.type === CHANNEL_TYPE.PRIVATE && clearHistoryPrivateChannelWarningText
              ? clearHistoryPrivateChannelWarningText
              : channel.type === CHANNEL_TYPE.PUBLIC && clearHistoryPublicChannelWarningText
              ? clearHistoryPublicChannelWarningText
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
            channel.type === CHANNEL_TYPE.DIRECT && clearHistoryDirectChannelWarningText
              ? clearHistoryDirectChannelWarningText
              : channel.type === CHANNEL_TYPE.PRIVATE && clearHistoryPrivateChannelWarningText
              ? clearHistoryPrivateChannelWarningText
              : channel.type === CHANNEL_TYPE.PUBLIC && clearHistoryPublicChannelWarningText
              ? clearHistoryPublicChannelWarningText
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

const Container = styled.div<{ isDirect: boolean }>`
  padding: 10px 16px;
  border-top: 0.5px solid ${colors.gray1};
  border-bottom: 6px solid ${colors.gray0};
  /*${(props) => !props.isDirect && `border-bottom: 6px solid ${colors.gray0}`}*/
`

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

const ActionItem = styled.li<{
  color?: string
  disableEvent?: boolean
  iconColor?: string
  hoverColor?: string
  order?: number
}>`
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 0;
  font-size: 15px;
  height: 20px;
  color: ${(props) => props.color || colors.blue6};
  cursor: pointer;
  order: ${(props) => props.order};
  pointer-events: ${(props) => props.disableEvent && 'none'};

  & > div {
    margin-left: auto;
  }

  & > svg {
    margin-right: 16px;
    color: ${(props) => props.iconColor || colors.gray4};
  }

  & > ${DefaultMutedIcon} {
    margin-right: 12px;
    margin-left: 2px;
  }

  &:hover {
    color: ${(props) => props.hoverColor || colors.blue2};
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
