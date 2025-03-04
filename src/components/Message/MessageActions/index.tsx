import React from 'react'
import { useSelector } from 'react-redux'
import styled from 'styled-components'
// Store
import { themeSelector } from '../../../store/theme/selector'
// Hooks
import usePermissions from '../../../hooks/usePermissions'
// Assets
import { ReactComponent as DeleteIcon } from '../../../assets/svg/deleteIcon.svg'
import { ReactComponent as SelectIcon } from '../../../assets/svg/checkCircle.svg'
import { ReactComponent as ReportIcon } from '../../../assets/svg/report_icon.svg'
import { ReactComponent as EditIcon } from '../../../assets/svg/editIcon.svg'
import { ReactComponent as ResendIcon } from '../../../assets/svg/resend.svg'
import { ReactComponent as ReactionIcon } from '../../../assets/svg/emojiSmileIcon.svg'
import { ReactComponent as ReplyIcon } from '../../../assets/svg/replyIcon.svg'
import { ReactComponent as ForwardIcon } from '../../../assets/svg/forward.svg'
import { ReactComponent as CopyIcon } from '../../../assets/svg/copyIcon.svg'
import { ReactComponent as ReplyThreadIcon } from '../../../assets/svg/replyInThreadIcon.svg'
// Helpers
import { colors, THEME_COLORS } from '../../../UIHelper/constants'
import { ItemNote } from '../../../UIHelper'
import { DEFAULT_CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS, THEME, USER_STATE } from '../../../helpers/constants'
import { IMember } from '../../../types'
import { getClient } from '../../../common/client'
import { useColor } from '../../../hooks'

interface EditMessageContainerProps {
  isThreadMessage?: boolean
  rtlDirection?: boolean
  backgroundColor?: string
}

export default function MessageActions({
  editModeToggle,
  channel,
  handleResendMessage,
  handleOpenDeleteMessage,
  handleOpenForwardMessage,
  handleCopyMessage,
  handleReportMessage,
  messageStatus,
  handleSelectMessage,
  handleReplyMessage,
  isThreadMessage,
  rtlDirection,
  showMessageReaction,
  showEditMessage,
  showCopyMessage,
  showReplyMessage,
  showReplyMessageInThread,
  showForwardMessage,
  showDeleteMessage,
  showSelectMessage,
  showReportMessage,
  reactionIcon,
  editIcon,
  copyIcon,
  replyIcon,
  replyInThreadIcon,
  deleteIcon,
  selectIcon,
  allowEditDeleteIncomingMessage,
  // starIcon,
  // staredIcon,
  reportIcon,
  reactionIconOrder,
  editIconOrder,
  copyIconOrder,
  replyIconOrder,
  replyInThreadIconOrder,
  forwardIcon,
  forwardIconOrder,
  deleteIconOrder,
  selectIconOrder,
  // starIconOrder,
  reportIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  copyIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
  selectIconTooltipText,
  // starIconTooltipText,
  reportIconTooltipText,
  myRole,
  isIncoming,
  messageActionIconsColor,
  handleOpenEmojis
}: any) {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.SECTION_BACKGROUND]: sectionBackground,
    [THEME_COLORS.HOVER_BACKGROUND]: hoverBackground,
    [THEME_COLORS.SURFACE_2]: surface2,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLORS.WARNING]: warningColor
  } = useColor()

  // const [reactionIsOpen, setReactionIsOpen] = useState(false)
  const ChatClient = getClient()
  const { user } = ChatClient
  const [checkActionPermission] = usePermissions(myRole)
  const theme = useSelector(themeSelector)
  const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
  const editMessagePermitted = isIncoming
    ? checkActionPermission('editAnyMessage')
    : checkActionPermission('editOwnMessage')

  const replyMessagePermitted = checkActionPermission('replyMessage')

  const forwardMessagePermitted = checkActionPermission('forwardMessage')

  // log.info('reactionPermitted .. . ', reactionPermitted)
  const handleOpenReaction = (e: any) => {
    e.stopPropagation()
    e.preventDefault()
    handleOpenEmojis()
  }
  // log.info('reactionPermitted .. . ', reactionPermitted)
  /* const handleClick = (e: any) => {
    log.info('e.target.  ..  .', e.target)
    if (emojisRef.current && !emojisRef.current.contains(e.target)) {
      log.info('set reaction close................ close.... ')
      setReactionIsOpen(false)
    }
  } */
  /* useEffect(() => {
    log.info('message actions useEffect . .. reactionIsOpen --- ', reactionIsOpen)
    document.addEventListener('mousedown', handleClick)

    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, []) */

  return (
    <MessageActionsWrapper isThreadMessage={isThreadMessage} rtlDirection={rtlDirection}>
      <EditMessageContainer
        backgroundColor={theme === THEME.DARK ? sectionBackground : colors.white}
        className='message_actions_cont '
      >
        {showMessageReaction &&
          messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING &&
          checkActionPermission('addMessageReaction') && (
            <Action
              order={reactionIconOrder || 0}
              iconColor={messageActionIconsColor || (theme === THEME.DARK ? textFootnote : textSecondary)}
              hoverBackgroundColor={hoverBackground}
              hoverIconColor={accentColor}
              onClick={handleOpenReaction}
            >
              <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
                {reactionIconTooltipText || 'React'}
              </ItemNote>
              {reactionIcon || <ReactionIcon />}
            </Action>
          )}
        {showEditMessage &&
          messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING &&
          (isIncoming ? allowEditDeleteIncomingMessage : true) &&
          editMessagePermitted &&
          (isDirectChannel && directChannelUser
            ? !isIncoming && directChannelUser.state !== USER_STATE.DELETED
            : true) && (
            <Action
              order={editIconOrder || 1}
              iconColor={messageActionIconsColor || (theme === THEME.DARK ? textFootnote : textSecondary)}
              hoverBackgroundColor={hoverBackground}
              hoverIconColor={accentColor}
              onClick={() => editModeToggle()}
            >
              <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
                {editIconTooltipText || 'Edit Message'}
              </ItemNote>
              {editIcon || <EditIcon />}
            </Action>
          )}
        {messageStatus === MESSAGE_DELIVERY_STATUS.PENDING && (
          <Action
            iconColor={messageActionIconsColor || (theme === THEME.DARK ? textFootnote : textSecondary)}
            hoverBackgroundColor={hoverBackground}
            hoverIconColor={accentColor}
            onClick={() => handleResendMessage()}
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              {' '}
              Resend Message{' '}
            </ItemNote>
            <ResendIcon />
          </Action>
        )}
        {!isThreadMessage && messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING && (
          <React.Fragment>
            {showReplyMessage &&
              replyMessagePermitted &&
              (isDirectChannel && directChannelUser ? directChannelUser.state !== USER_STATE.DELETED : true) && (
                <Action
                  order={replyIconOrder || 2}
                  iconColor={messageActionIconsColor || (theme === THEME.DARK ? textFootnote : textSecondary)}
                  hoverBackgroundColor={hoverBackground}
                  hoverIconColor={accentColor}
                  onClick={() => handleReplyMessage()}
                >
                  <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
                    {replyIconTooltipText || 'Reply'}
                  </ItemNote>
                  {replyIcon || <ReplyIcon />}
                </Action>
              )}

            {showReplyMessageInThread && replyMessagePermitted && (
              <Action
                order={replyInThreadIconOrder || 3}
                iconColor={messageActionIconsColor || (theme === THEME.DARK ? textFootnote : textSecondary)}
                hoverBackgroundColor={hoverBackground}
                hoverIconColor={accentColor}
                onClick={() => handleReplyMessage(true)}
              >
                <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
                  {replyInThreadIconTooltipText || 'Reply in thread'}
                </ItemNote>
                {replyInThreadIcon || <ReplyThreadIcon />}
              </Action>
            )}
          </React.Fragment>
        )}
        {showCopyMessage && (
          <Action
            order={copyIconOrder || 4}
            iconColor={messageActionIconsColor || (theme === THEME.DARK ? textFootnote : textSecondary)}
            hoverBackgroundColor={hoverBackground}
            hoverIconColor={accentColor}
            onClick={() => handleCopyMessage()}
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              {copyIconTooltipText || 'Copy'}
            </ItemNote>
            {copyIcon || <CopyIcon />}
          </Action>
        )}

        {showForwardMessage && forwardMessagePermitted && messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING && (
          <Action
            order={forwardIconOrder || 5}
            iconColor={messageActionIconsColor || (theme === THEME.DARK ? textFootnote : textSecondary)}
            hoverBackgroundColor={hoverBackground}
            hoverIconColor={accentColor}
            onClick={() => handleOpenForwardMessage()}
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              {forwardIconTooltipText || 'Forward Message'}
            </ItemNote>
            {forwardIcon || <ForwardIcon />}
          </Action>
        )}
        {showSelectMessage && (
          <Action
            order={selectIconOrder || 6}
            iconColor={messageActionIconsColor || (theme === THEME.DARK ? textFootnote : textSecondary)}
            hoverBackgroundColor={hoverBackground}
            hoverIconColor={accentColor}
            onClick={() => handleSelectMessage()}
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              {selectIconTooltipText || 'Select'}
            </ItemNote>
            {selectIcon || <SelectIcon />}
          </Action>
        )}
        {showDeleteMessage &&
          (channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
            ? myRole === 'owner' || myRole === 'admin'
            : true) && (
            <Action
              order={deleteIconOrder || 7}
              iconColor={messageActionIconsColor || warningColor}
              hoverBackgroundColor={hoverBackground}
              hoverIconColor={accentColor}
              onClick={() => handleOpenDeleteMessage()}
            >
              <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
                {deleteIconTooltipText || 'Delete Message'}
              </ItemNote>
              {deleteIcon || <DeleteIcon />}
            </Action>
          )}
        {showReportMessage && messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING && (
          <Action
            order={reportIconOrder || 8}
            iconColor={messageActionIconsColor || (theme === THEME.DARK ? textFootnote : textSecondary)}
            hoverBackgroundColor={colors.hoverBackgroundColor}
            hoverIconColor={accentColor}
            onClick={() => handleReportMessage()}
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              {reportIconTooltipText || 'Report'}
            </ItemNote>
            {reportIcon || <ReportIcon />}
          </Action>
        )}
      </EditMessageContainer>
    </MessageActionsWrapper>
  )
}

const MessageActionsWrapper = styled.div<EditMessageContainerProps>`
  position: absolute;
  left: ${({ isThreadMessage, rtlDirection }) => !rtlDirection && (isThreadMessage ? '8px' : '0')};
  right: ${({ rtlDirection }) => rtlDirection && '0'};
  direction: ${(props) => (props.rtlDirection ? 'initial' : '')};
  top: -46px;
  padding: 0 0 8px;
  z-index: 90;
`
const EditMessageContainer = styled.div<EditMessageContainerProps>`
  position: relative;
  display: flex;
  align-items: center;
  direction: ${(props) => props.rtlDirection && 'initial'};
  background-color: ${(props) => props.backgroundColor};
  box-sizing: border-box;
  border-radius: 12px;
  box-shadow:
    0 0 2px rgba(17, 21, 57, 0.08),
    0 0 24px rgba(17, 21, 57, 0.16);
  //opacity: 0;
  //visibility: hidden;
  transition: all 0.2s;
  z-index: 100;
`

const Action = styled.div<{
  iconColor: string
  order?: number
  hoverIconColor: string
  hoverBackgroundColor: string
}>`
  position: relative;
  display: flex;
  padding: 4px;
  margin: 8px 6px;
  cursor: pointer;
  transition: all 0.2s;
  order: ${(props) => props.order || 1};
  color: ${(props) => props.iconColor};
  border-radius: 50%;

  &:first-child {
    margin-left: 8px;
  }

  &:last-child {
    margin-right: 8px;
  }

  &:hover {
    color: ${(props) => props.hoverIconColor};
    background-color: ${(props) => props.hoverBackgroundColor};

    ${ItemNote} {
      display: block;
    }
  }
`
/*
const ReactMessage = styled(Action)<any>`
  order: ${(props) => props.order || 1};
`

const EditMessage = styled(Action)<any>`
  order: ${(props) => props.order || 2};
`

const RepliedMessage = styled(Action)<any>`
  order: ${(props) => props.order || 3};
`

const ReplyInThread = styled(Action)<any>`
  order: ${(props) => props.order || 4};
`

const DeleteMessage = styled(Action)<any>`
  order: ${(props) => props.order || 5};
`

const ReportMessage = styled(Action)<any>`
  order: ${(props) => props.order || 6};
` */
