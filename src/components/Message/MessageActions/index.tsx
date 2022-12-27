import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { ReactComponent as DeleteIcon } from '../../../assets/svg/trash.svg'
import { ReactComponent as ReportIcon } from '../../../assets/svg/report_icon.svg'
import { ReactComponent as EditIcon } from '../../../assets/svg/editSquare.svg'
// import { ReactComponent as ResendIcon } from '../../../assets/svg/resend.svg'
import { ReactComponent as ReactionIcon } from '../../../assets/svg/react.svg'
import { ReactComponent as ReplyIcon } from '../../../assets/svg/replyIcon.svg'
import { ReactComponent as ForwardIcon } from '../../../assets/svg/forward.svg'
import { ReactComponent as ReplyThreadIcon } from '../../../assets/svg/thread_reply.svg'
import { colors } from '../../../UIHelper/constants'
import { ItemNote } from '../../../UIHelper'
// import { MESSAGE_DELIVERY_STATUS } from '../../../helpers/constants'
import EmojisPopup from '../../Emojis'
import usePermissions from '../../../hooks/usePermissions'

interface EditMessageContainerProps {
  isThreadMessage?: boolean
  rtlDirection?: boolean
}

export default function MessageActions({
  editModeToggle,
  // handleResendMessage,
  handleOpenDeleteMessage,
  handleOpenForwardMessage,
  handleReportMessage,
  // messageStatus,
  handleAddReaction,
  handleReplyMessage,
  isThreadMessage,
  rtlDirection,
  showMessageReaction,
  showEditMessage,
  showReplyMessage,
  showReplyMessageInThread,
  showForwardMessage,
  showDeleteMessage,
  showReportMessage,
  reactionIcon,
  editIcon,
  replyIcon,
  replyInThreadIcon,
  deleteIcon,
  // starIcon,
  // staredIcon,
  reportIcon,
  reactionIconOrder,
  editIconOrder,
  replyIconOrder,
  replyInThreadIconOrder,
  forwardIcon,
  forwardIconOrder,
  deleteIconOrder,
  // starIconOrder,
  reportIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
  // starIconTooltipText,
  reportIconTooltipText,
  messageActionIconsHoverColor,
  myRole,
  isIncoming,
  messageActionIconsColor
}: any) {
  const [reactionIsOpen, setReactionIsOpen] = useState(false)
  const emojisRef = useRef<any>(null)
  const [chekActionPermission] = usePermissions(myRole)

  const editMessagePermitted = isIncoming
    ? chekActionPermission('editAnyMessage')
    : chekActionPermission('editOwnMessage')

  const replyMessagePermitted = isIncoming
    ? chekActionPermission('replyAnyMessage')
    : chekActionPermission('replyOwnMessage')

  const deleteMessagePermitted = isIncoming
    ? chekActionPermission('deleteAnyMessage')
    : chekActionPermission('deleteOwnMessage')

  const forwardMessagePermitted = chekActionPermission('forwardMessage')

  // console.log('reactionPermitted .. . ', reactionPermitted)
  const handleClick = (e: any) => {
    if (emojisRef.current && !emojisRef.current.contains(e.target)) {
      setReactionIsOpen(false)
    }
  }
  useEffect(() => {
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])
  return (
    <MessageActionsWrapper isThreadMessage={isThreadMessage} rtlDirection={rtlDirection}>
      <EditMessageContainer className='message_actions_cont '>
        {showMessageReaction && chekActionPermission('addMessageReaction') && (
          <Action
            order={reactionIconOrder || 0}
            iconColor={messageActionIconsColor}
            hoverIconColor={messageActionIconsHoverColor}
            onClick={() => setReactionIsOpen(true)}
          >
            <ItemNote direction='top'>{reactionIconTooltipText || 'React'}</ItemNote>
            {reactionIcon || <ReactionIcon />}
          </Action>
        )}
        {showEditMessage && editMessagePermitted && (
          <Action
            order={editIconOrder || 1}
            iconColor={messageActionIconsColor}
            hoverIconColor={messageActionIconsHoverColor}
            onClick={() => editModeToggle()}
          >
            <ItemNote direction='top'>{editIconTooltipText || 'Edit Message'}</ItemNote>
            {editIcon || <EditIcon />}
          </Action>
        )}
        {/* {messageStatus === MESSAGE_DELIVERY_STATUS.PENDING && (
          <Action
            iconColor={messageActionIconsColor}
            hoverIconColor={messageActionIconsHoverColor}
            onClick={() => handleResendMessage()}
          >
            <ItemNote direction='top'> Resend Message </ItemNote>
            <ResendIcon />
          </Action>
        )} */}
        {!isThreadMessage && (
          <React.Fragment>
            {showReplyMessage && replyMessagePermitted && (
              <Action
                order={replyIconOrder || 2}
                iconColor={messageActionIconsColor}
                hoverIconColor={messageActionIconsHoverColor}
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
                hoverIconColor={messageActionIconsHoverColor}
                onClick={() => handleReplyMessage(true)}
              >
                <ItemNote direction='top'>{replyInThreadIconTooltipText || 'Reply in thread'}</ItemNote>
                {replyInThreadIcon || <ReplyThreadIcon />}
              </Action>
            )}
          </React.Fragment>
        )}
        {showForwardMessage && forwardMessagePermitted && (
          <Action
            order={forwardIconOrder || 4}
            iconColor={messageActionIconsColor}
            hoverIconColor={messageActionIconsHoverColor}
            onClick={() => handleOpenForwardMessage()}
          >
            <ItemNote direction='top'>{forwardIconTooltipText || 'Forward Message'}</ItemNote>
            {forwardIcon || <ForwardIcon />}
          </Action>
        )}
        {showDeleteMessage && deleteMessagePermitted && (
          <Action
            order={deleteIconOrder || 5}
            iconColor={messageActionIconsColor}
            hoverIconColor={messageActionIconsHoverColor}
            onClick={() => handleOpenDeleteMessage()}
          >
            <ItemNote direction='top'>{deleteIconTooltipText || 'Delete Message'}</ItemNote>
            {deleteIcon || <DeleteIcon />}
          </Action>
        )}
        {showReportMessage && (
          <Action
            order={reportIconOrder || 6}
            iconColor={messageActionIconsColor}
            hoverIconColor={messageActionIconsHoverColor}
            onClick={() => handleReportMessage()}
          >
            <ItemNote direction='top'>{reportIconTooltipText || 'Report'}</ItemNote>
            {reportIcon || <ReportIcon />}
          </Action>
        )}

        <EmojiContainer ref={emojisRef} rtlDirection={rtlDirection}>
          {reactionIsOpen && (
            <EmojisPopup handleEmojiPopupToggle={setReactionIsOpen} handleAddReaction={handleAddReaction} />
          )}
        </EmojiContainer>
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
  display: flex;
  align-items: center;
  direction: ${(props) => props.rtlDirection && 'initial'};
  background-color: #fff;
  border: 1px solid ${colors.gray1};
  box-sizing: border-box;
  border-radius: 4px;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
  opacity: 0;
  visibility: hidden;
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

const EmojiContainer = styled.div<any>`
  position: absolute;
  left: ${(props) => (props.rtlDirection ? '-84px' : '')};
  right: ${(props) => (props.rtlDirection ? '' : '-84px')};
  top: -202px;
  z-index: 9998;
`
