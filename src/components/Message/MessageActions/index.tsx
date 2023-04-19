import React from 'react'
import styled from 'styled-components'
import { ReactComponent as DeleteIcon } from '../../../assets/svg/trash.svg'
import { ReactComponent as ReportIcon } from '../../../assets/svg/report_icon.svg'
import { ReactComponent as EditIcon } from '../../../assets/svg/editSquare.svg'
import { ReactComponent as ResendIcon } from '../../../assets/svg/resend.svg'
import { ReactComponent as ReactionIcon } from '../../../assets/svg/react.svg'
import { ReactComponent as ReplyIcon } from '../../../assets/svg/replyIcon.svg'
import { ReactComponent as ForwardIcon } from '../../../assets/svg/forward.svg'
import { ReactComponent as CopyIcon } from '../../../assets/svg/copy.svg'
import { ReactComponent as ReplyThreadIcon } from '../../../assets/svg/thread_reply.svg'
import { colors } from '../../../UIHelper/constants'
import { ItemNote } from '../../../UIHelper'
// import { MESSAGE_DELIVERY_STATUS } from '../../../helpers/constants'
import usePermissions from '../../../hooks/usePermissions'
import { CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS } from '../../../helpers/constants'

interface EditMessageContainerProps {
  isThreadMessage?: boolean
  rtlDirection?: boolean
}

export default function MessageActions({
  editModeToggle,
  channel,
  handleResendMessage,
  handleOpenDeleteMessage,
  handleDeletePendingMessage,
  handleOpenForwardMessage,
  handleCopyMessage,
  handleReportMessage,
  messageStatus,
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
  showReportMessage,
  reactionIcon,
  editIcon,
  copyIcon,
  replyIcon,
  replyInThreadIcon,
  deleteIcon,
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
  // starIconOrder,
  reportIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  copyIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
  // starIconTooltipText,
  reportIconTooltipText,
  myRole,
  isIncoming,
  messageActionIconsColor,
  handleOpenEmojis
}: any) {
  // const [reactionIsOpen, setReactionIsOpen] = useState(false)
  const [checkActionPermission] = usePermissions(myRole)
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const editMessagePermitted = isIncoming
    ? checkActionPermission('editAnyMessage')
    : checkActionPermission('editOwnMessage')

  const replyMessagePermitted = isIncoming
    ? checkActionPermission('replyAnyMessage')
    : checkActionPermission('replyOwnMessage')

  const forwardMessagePermitted = checkActionPermission('forwardMessage')

  // console.log('reactionPermitted .. . ', reactionPermitted)
  const handleOpenReaction = (e: any) => {
    e.stopPropagation()
    e.preventDefault()
    handleOpenEmojis()
  }
  // console.log('reactionPermitted .. . ', reactionPermitted)
  /* const handleClick = (e: any) => {
    console.log('e.target.  ..  .', e.target)
    if (emojisRef.current && !emojisRef.current.contains(e.target)) {
      console.log('set reaction close................ close.... ')
      setReactionIsOpen(false)
    }
  } */
  /* useEffect(() => {
    console.log('message actions useEffect . .. reactionIsOpen --- ', reactionIsOpen)
    document.addEventListener('mousedown', handleClick)

    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, []) */

  return (
    <MessageActionsWrapper isThreadMessage={isThreadMessage} rtlDirection={rtlDirection}>
      <EditMessageContainer className='message_actions_cont '>
        {showMessageReaction &&
          messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING &&
          checkActionPermission('addMessageReaction') && (
            <Action
              order={reactionIconOrder || 0}
              iconColor={messageActionIconsColor}
              hoverIconColor={colors.primary}
              onClick={handleOpenReaction}
            >
              <ItemNote direction='top'>{reactionIconTooltipText || 'React'}</ItemNote>
              {reactionIcon || <ReactionIcon />}
            </Action>
          )}
        {showEditMessage &&
          messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING &&
          (isIncoming ? allowEditDeleteIncomingMessage : true) &&
          editMessagePermitted &&
          (isDirectChannel ? !isIncoming && channel.peer.activityState !== 'Deleted' : true) && (
            <Action
              order={editIconOrder || 1}
              iconColor={messageActionIconsColor}
              hoverIconColor={colors.primary}
              onClick={() => editModeToggle()}
            >
              <ItemNote direction='top'>{editIconTooltipText || 'Edit Message'}</ItemNote>
              {editIcon || <EditIcon />}
            </Action>
          )}
        {messageStatus === MESSAGE_DELIVERY_STATUS.PENDING && (
          <Action
            iconColor={messageActionIconsColor}
            hoverIconColor={colors.primary}
            onClick={() => handleResendMessage()}
          >
            <ItemNote direction='top'> Resend Message </ItemNote>
            <ResendIcon />
          </Action>
        )}
        {!isThreadMessage && messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING && (
          <React.Fragment>
            {showReplyMessage &&
              replyMessagePermitted &&
              (isDirectChannel ? channel.peer.activityState !== 'Deleted' : true) && (
                <Action
                  order={replyIconOrder || 2}
                  iconColor={messageActionIconsColor}
                  hoverIconColor={colors.primary}
                  onClick={() => handleReplyMessage()}
                >
                  <ItemNote direction='top'>{replyIconTooltipText || 'Reply'}</ItemNote>
                  {replyIcon || <ReplyIcon />}
                </Action>
              )}

            {showReplyMessageInThread && replyMessagePermitted && (
              <Action
                order={replyInThreadIconOrder || 3}
                iconColor={messageActionIconsColor}
                hoverIconColor={colors.primary}
                onClick={() => handleReplyMessage(true)}
              >
                <ItemNote direction='top'>{replyInThreadIconTooltipText || 'Reply in thread'}</ItemNote>
                {replyInThreadIcon || <ReplyThreadIcon />}
              </Action>
            )}
          </React.Fragment>
        )}
        {showCopyMessage && (
          <Action
            order={copyIconOrder || 4}
            iconColor={messageActionIconsColor}
            hoverIconColor={colors.primary}
            onClick={() => handleCopyMessage()}
          >
            <ItemNote direction='top'>{copyIconTooltipText || 'Copy'}</ItemNote>
            {copyIcon || <CopyIcon />}
          </Action>
        )}

        {showForwardMessage && forwardMessagePermitted && messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING && (
          <Action
            order={forwardIconOrder || 5}
            iconColor={messageActionIconsColor}
            hoverIconColor={colors.primary}
            onClick={() => handleOpenForwardMessage()}
          >
            <ItemNote direction='top'>{forwardIconTooltipText || 'Forward Message'}</ItemNote>
            {forwardIcon || <ForwardIcon />}
          </Action>
        )}

        {showDeleteMessage && (channel.type === CHANNEL_TYPE.PUBLIC ? myRole === 'owner' || myRole === 'admin' : true) && (
          <Action
            order={deleteIconOrder || 6}
            iconColor={messageActionIconsColor}
            hoverIconColor={colors.primary}
            onClick={() =>
              messageStatus === MESSAGE_DELIVERY_STATUS.PENDING
                ? handleDeletePendingMessage()
                : handleOpenDeleteMessage()
            }
          >
            <ItemNote direction='top'>{deleteIconTooltipText || 'Delete Message'}</ItemNote>
            {deleteIcon || <DeleteIcon />}
          </Action>
        )}
        {showReportMessage && messageStatus !== MESSAGE_DELIVERY_STATUS.PENDING && (
          <Action
            order={reportIconOrder || 7}
            iconColor={messageActionIconsColor}
            hoverIconColor={colors.primary}
            onClick={() => handleReportMessage()}
          >
            <ItemNote direction='top'>{reportIconTooltipText || 'Report'}</ItemNote>
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
  top: -46px;
  padding: 0 0 8px;
  z-index: 200;
`
const EditMessageContainer = styled.div<EditMessageContainerProps>`
  position: relative;
  display: flex;
  align-items: center;
  direction: ${(props) => props.rtlDirection && 'initial'};
  background-color: #fff;
  border: 1px solid ${colors.gray1};
  box-sizing: border-box;
  border-radius: 4px;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
  //opacity: 0;
  //visibility: hidden;
  transition: all 0.2s;
  z-index: 100;
`

const Action = styled.div<any>`
  position: relative;
  display: flex;
  padding: 9px;
  cursor: pointer;
  color: ${(props) => props.iconColor || colors.gray6};
  transition: all 0.2s;
  order: ${(props) => props.order || 1};

  &:hover {
    color: ${(props) => props.hoverIconColor || colors.cobalt1};

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

const ReplyMessage = styled(Action)<any>`
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
