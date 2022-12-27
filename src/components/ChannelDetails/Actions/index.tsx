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
import { ReactComponent as BlockIcon } from '../../../assets/svg/blockChannel.svg'
import { ReactComponent as ReportIcon } from '../../../assets/svg/report.svg'
import { ReactComponent as StarIcon } from '../../../assets/svg/star.svg'
import { ReactComponent as PinIcon } from '../../../assets/svg/pin.svg'
import { DetailsSectionHeader, DropdownOptionLi, DropdownOptionsUl } from '../../../UIHelper'
import DeletePopup from '../../../common/popups/delete'
import { CHANNEL_TYPE } from '../../../helpers/constants'
// import DropDown from '../../../common/dropdown'
import { colors, customColors } from '../../../UIHelper/constants'
// import ReportPopup from '../../../../common/Popups/report';
// import { reportUserAC } from '../../../../store/member/actions'
import { IChannel } from '../../../types'
import DropDown from '../../../common/dropdown'
import {
  blockChannelAC,
  deleteChannelAC,
  leaveChannelAC,
  markChannelAsReadAC,
  markChannelAsUnReadAC,
  turnOffNotificationsAC,
  turnOnNotificationsAC
} from '../../../store/channel/actions'
import { blockUserAC, unblockUserAC } from '../../../store/user/actions'

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
  blockAndLeaveChannelOrder?: number
  blockAndLeaveChannelIcon?: JSX.Element
  blockAndLeaveChannelIconColor?: string
  blockAndLeaveChannelTextColor?: string
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
  showReportChannel = true,
  reportChannelIcon,
  reportChannelOrder,
  reportChannelIconColor,
  reportChannelTextColor,
  showDeleteChannel,
  deleteChannelIcon,
  deleteChannelIconColor,
  deleteChannelTextColor,
  showBlockAndLeaveChannel = true,
  blockAndLeaveChannelIcon,
  blockAndLeaveChannelIconColor,
  blockAndLeaveChannelTextColor
}: IProps) => {
  // const [clearHistoryPopupOpen, setClearHistoryPopupOpen] = useState(false)
  const [leaveChannelPopupOpen, setLeaveChannelPopupOpen] = useState(false)
  const [deleteChannelPopupOpen, setDeleteChannelPopupOpen] = useState(false)
  const [blockChannelPopupOpen, setBlockChannelPopupOpen] = useState(false)
  const [blockUserPopupOpen, setBlockUserPopupOpen] = useState(false)
  const [unblockUserPopupOpen, setUnblockUserPopupOpen] = useState(false)
  const [reportUserPopupOpen, setReportUserPopupOpen] = useState(false)
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
  const channelType = channel.type === CHANNEL_TYPE.PUBLIC ? 'channel' : isDirectChannel ? 'chat' : 'group'

  /* const handleToggleClearHistoryPopup = () => {
    setClearHistoryPopupOpen(!clearHistoryPopupOpen)
  } */

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
  /* const handleClearHistory = () => {
    dispatch(clearHistory(channel.id))
  }



  const handleReportChannel = (reportData: any) => {
    dispatch(reportChannelAC({ ...reportData, channelId: channel.id }))
  }

  const handleReportUser = (reportData: any) => {
    console.log('report data . ', reportData)
    dispatch(reportUserAC({ ...reportData, userId: channel.peer.id }))
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
          <DetailsSectionHeader>ACTIONS</DetailsSectionHeader>
          <MenuTriggerIcon isOpen={menuIsOpen}>
            <BottomIcon />
          </MenuTriggerIcon>
        </ActionHeader>
      )}
      <ActionsMenu isOpen={menuIsOpen}>
        {showMuteUnmuteNotifications &&
          (channel.muted ? (
            <ActionItem
              key={0}
              order={muteUnmuteNotificationsOrder}
              onClick={() => handleNotificationOnOff()}
              iconColor={muteNotificationIconColor || '#B2B6BE'}
              color={muteUnmuteNotificationTextColor || colors.gray6}
              hoverColor={muteUnmuteNotificationTextColor || colors.gray6}
            >
              <React.Fragment>{muteNotificationIcon || <DefaultMutedIcon />} Unmute notification</React.Fragment>
              {/* <ToggleSwitch backgroundColor={muteUnmuteNotificationSwitcherColor} state={channel.muted} /> */}
            </ActionItem>
          ) : (
            <DropDown
              isSelect
              height='auto'
              order={muteUnmuteNotificationsOrder}
              trigger={
                <ActionItem
                  key={0}
                  disableEvent
                  iconColor={unmuteNotificationIconColor || '#B2B6BE'}
                  color={muteUnmuteNotificationTextColor || colors.gray6}
                  hoverColor={muteUnmuteNotificationTextColor || colors.gray6}
                >
                  <React.Fragment>{unmuteNotificationIcon || <NotificationIcon />} Mute notification</React.Fragment>
                  {/* <ToggleSwitch state={channel.muted} /> */}
                </ActionItem>
              }
            >
              {/* {showMuteDropdown ? ( */}
              <DropdownOptionsUl>
                <DropdownOptionLi
                  key={1}
                  hoverBackground={customColors.selectedChannelBackground}
                  onClick={() => handleNotificationOnOff(oneHour)}
                >
                  Mute for 1 hour
                </DropdownOptionLi>
                <DropdownOptionLi
                  key={2}
                  hoverBackground={customColors.selectedChannelBackground}
                  onClick={() => handleNotificationOnOff(twoHours)}
                >
                  Mute for 2 hours
                </DropdownOptionLi>
                <DropdownOptionLi
                  key={3}
                  hoverBackground={customColors.selectedChannelBackground}
                  onClick={() => handleNotificationOnOff(oneDay)}
                >
                  Mute for 1 day
                </DropdownOptionLi>
                <DropdownOptionLi
                  key={4}
                  hoverBackground={customColors.selectedChannelBackground}
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
            iconColor={staredMessagesIconColor || '#B2B6BE'}
            color={staredMessagesTextColor || colors.gray6}
            hoverColor={staredMessagesTextColor || colors.gray6}
          >
            <React.Fragment>{staredMessagesIcon || <StarIcon />} Starred messages </React.Fragment>
          </ActionItem>
        )}
        {showPinChannel && (
          <ActionItem
            key={2}
            onClick={() => console.log('pin channel')}
            order={pinChannelOrder}
            iconColor={pinChannelIconColor || '#B2B6BE'}
            color={pinChannelTextColor || colors.gray6}
            hoverColor={pinChannelTextColor || colors.gray6}
          >
            <React.Fragment>
              {pinChannelIcon || <PinIcon />} Pin {channelType}
            </React.Fragment>
          </ActionItem>
        )}
        {showMarkAsReadUnread &&
          (channel.markedAsUnread ? (
            <ActionItem
              key={3}
              onClick={handleToggleChannelMarkAs}
              order={markAsReadUnreadOrder}
              iconColor={markAsReadIconColor || '#B2B6BE'}
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
              iconColor={markAsUnreadIconColor || '#B2B6BE'}
              color={markAsReadUnreadTextColor || colors.gray6}
              hoverColor={markAsReadUnreadTextColor || colors.gray6}
            >
              <React.Fragment>{markAsUnreadIcon || <MarkAsUnRead />} Mark as unread</React.Fragment>
            </ActionItem>
          ))}
        {/* <ActionItem
          key={2}
          iconColor='#B2B6BE'
          color='#17191C'
          hoverColor='#17191C'
          onClick={() => {
            setPopupButtonText('Clear')
            setPopupTitle('Clear Messages ?')
            handleToggleClearHistoryPopup()
          }}
        >
          <DeleteIcon /> Clear History
        </ActionItem> */}
        {!isDirectChannel && showLeaveChannel && (
          <ActionItem
            key={4}
            order={leaveChannelOrder}
            color={leaveChannelTextColor || '#FA4C56'}
            iconColor={leaveChannelIconColor || '#FA4C56'}
            hoverColor={leaveChannelTextColor || '#FA4C56'}
            onClick={() => {
              setPopupButtonText('Leave')
              setPopupTitle(`Leave ${channelType}?`)
              handleToggleLeaveChannelPopupOpen()
            }}
          >
            {leaveChannelIcon || <LeaveIcon />} Leave {channelType}
          </ActionItem>
        )}

        {showDeleteChannel && (
          <ActionItem
            key={5}
            color={deleteChannelTextColor || '#FA4C56'}
            iconColor={deleteChannelIconColor || '#FA4C56'}
            hoverColor={deleteChannelTextColor || '#FA4C56'}
            onClick={() => {
              setPopupButtonText('Delete')
              setPopupTitle(`Delete  ${channelType}?`)
              handleToggleDeleteChannelPopupOpen()
            }}
          >
            {deleteChannelIcon || <DeleteChannel />} Delete {channelType}
          </ActionItem>
        )}

        {isDirectChannel ? (
          <React.Fragment>
            {showBlockAndLeaveChannel &&
              (channel.peer.blocked ? (
                <ActionItem
                  key={6}
                  hoverColor='#0DBD8B'
                  onClick={() => {
                    setPopupButtonText('Unblock')
                    setPopupTitle('UnblockUser ?')
                    handleToggleUnblockUserPopupOpen()
                  }}
                >
                  <BlockIcon /> Unblock User
                </ActionItem>
              ) : (
                <ActionItem
                  key={6}
                  color={deleteChannelTextColor || '#FA4C56'}
                  iconColor={deleteChannelIconColor || '#FA4C56'}
                  hoverColor={deleteChannelTextColor || '#FA4C56'}
                  onClick={() => {
                    setPopupButtonText('Block')
                    setPopupTitle('Block User ?')
                    handleToggleBlockUserPopupOpen()
                  }}
                >
                  {blockAndLeaveChannelIcon || <BlockIcon />} Block User
                </ActionItem>
              ))}

            {showReportChannel && (
              <ActionItem
                color={deleteChannelTextColor || '#FA4C56'}
                iconColor={deleteChannelIconColor || '#FA4C56'}
                hoverColor={deleteChannelTextColor || '#FA4C56'}
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
                color={blockAndLeaveChannelTextColor || '#FA4C56'}
                iconColor={blockAndLeaveChannelIconColor || '#FA4C56'}
                hoverColor={blockAndLeaveChannelTextColor || '#FA4C56'}
                onClick={() => {
                  setPopupButtonText('Block')
                  setPopupTitle(`Block and Leave ${channelType} ?`)
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
                color={reportChannelTextColor || '#FA4C56'}
                iconColor={reportChannelIconColor || '#FA4C56'}
                hoverColor={reportChannelTextColor || '#FA4C56'}
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
      </ActionsMenu>

      {leaveChannelPopupOpen && (
        <DeletePopup
          deleteFunction={handleLeaveChannel}
          togglePopup={handleToggleLeaveChannelPopupOpen}
          buttonText={popupButtonText}
          description={`Are you sure you want to leave the "${
            channel.subject || (channel.type === CHANNEL_TYPE.DIRECT ? channel.peer.firstName : '')
          }"  channel?`}
          title={popupTitle}
        />
      )}
      {deleteChannelPopupOpen && (
        <DeletePopup
          deleteFunction={handleDeleteChannel}
          togglePopup={handleToggleDeleteChannelPopupOpen}
          buttonText={popupButtonText}
          description={`Are you sure you want to delete the ${
            channel.type === CHANNEL_TYPE.DIRECT
              ? `channel with ${channel.peer.firstName}`
              : `"${channel.subject}" channel`
          } ? This action cannot be undone.`}
          title={popupTitle}
        />
      )}
      {blockChannelPopupOpen && (
        <DeletePopup
          deleteFunction={handleBlockChannel}
          togglePopup={handleToggleBlockChannelPopupOpen}
          buttonText={popupButtonText}
          description={`Are you sure you want to block the "${
            channel.subject || (channel.type === CHANNEL_TYPE.DIRECT ? channel.peer.firstName : '')
          }"  channel?`}
          title={popupTitle}
        />
      )}
      {blockUserPopupOpen && (
        <DeletePopup
          deleteFunction={handleBlockUser}
          togglePopup={handleToggleBlockUserPopupOpen}
          buttonText={popupButtonText}
          description={`Are you sure you want to block ${
            channel.type === CHANNEL_TYPE.DIRECT ? channel.peer.firstName : ''
          } ?`}
          title={popupTitle}
        />
      )}
      {unblockUserPopupOpen && (
        <DeletePopup
          deleteFunction={handleUnblockUser}
          togglePopup={handleToggleUnblockUserPopupOpen}
          buttonText={popupButtonText}
          description={`Are you sure you want to unblock ${
            channel.type === CHANNEL_TYPE.DIRECT ? channel.peer.firstName : ''
          } ?`}
          title={popupTitle}
        />
      )}
      {/* {clearHistoryPopupOpen && (
        <DeletePopup
          deleteFunction={handleClearHistory}
          togglePopup={handleToggleClearHistoryPopup}
          buttonText={popupButtonText}
          description='Are you sure you want to clear history? This action cannot be undone.'
          title={popupTitle}
        />
      )}

      {blockUserPopupOpen && (
        <DeletePopup
          deleteFunction={handleBlockUser}
          togglePopup={handleToggleBlockUserPopupOpen}
          buttonText={popupButtonText}
          description={`Are you sure you want to block ${
            channel.type === CHANNEL_TYPE.DIRECT ? channel.peer.firstName : ''
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
          userId={channel.peer.id}
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
    color: ${(props) => props.iconColor || colors.gray6};
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
