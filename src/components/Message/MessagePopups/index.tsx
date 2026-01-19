import React from 'react'
import ConfirmPopup from 'common/popups/delete'
import ForwardMessagePopup from 'common/popups/forwardMessage'
import MessageInfo from 'common/popups/messageInfo'
import ConfirmEndPollPopup from 'common/popups/pollMessage/ConfirmEndPollPopup'
import { IChannel, IMessage } from 'types'
import { DEFAULT_CHANNEL_TYPE } from 'helpers/constants'

interface MessagePopupsProps {
  message: IMessage
  channel: IChannel
  deletePopupOpen: boolean
  forwardPopupOpen: boolean
  infoPopupOpen: boolean
  showEndVoteConfirmPopup: boolean
  allowEditDeleteIncomingMessage?: boolean
  showInfoMessageProps?: any
  contactsMap: { [key: string]: any }
  onDeleteMessage: (deleteOption: 'forMe' | 'forEveryone') => void
  onToggleDeletePopup: () => void
  onForwardMessage: (channelIds: string[]) => void
  onToggleForwardPopup: () => void
  onToggleInfoPopup: () => void
  onEndVote: () => void
  onToggleEndVotePopup: () => void
  onOpenUserProfile: (user?: any) => void
}

const MessagePopups: React.FC<MessagePopupsProps> = ({
  message,
  channel,
  deletePopupOpen,
  forwardPopupOpen,
  infoPopupOpen,
  showEndVoteConfirmPopup,
  allowEditDeleteIncomingMessage,
  showInfoMessageProps = {},
  contactsMap,
  onDeleteMessage,
  onToggleDeletePopup,
  onForwardMessage,
  onToggleForwardPopup,
  onToggleInfoPopup,
  onEndVote,
  onToggleEndVotePopup,
  onOpenUserProfile
}) => {
  return (
    <React.Fragment>
      {deletePopupOpen && (
        <ConfirmPopup
          handleFunction={onDeleteMessage}
          togglePopup={onToggleDeletePopup}
          buttonText='Delete'
          description='Who do you want to remove this message for?'
          isDeleteMessage
          isIncomingMessage={message.incoming}
          myRole={channel.userRole}
          allowDeleteIncoming={allowEditDeleteIncomingMessage}
          isDirectChannel={channel.type === DEFAULT_CHANNEL_TYPE.DIRECT}
          title='Delete message'
        />
      )}
      {forwardPopupOpen && (
        <ForwardMessagePopup
          handleForward={onForwardMessage}
          togglePopup={onToggleForwardPopup}
          buttonText='Forward'
          title='Forward message'
        />
      )}
      {infoPopupOpen && (
        <MessageInfo
          message={message}
          togglePopup={onToggleInfoPopup}
          {...showInfoMessageProps}
          contacts={contactsMap}
          handleOpenUserProfile={onOpenUserProfile}
          isP2PChannel={channel.type === DEFAULT_CHANNEL_TYPE.DIRECT}
        />
      )}
      {showEndVoteConfirmPopup && (
        <ConfirmEndPollPopup
          handleFunction={onEndVote}
          togglePopup={onToggleEndVotePopup}
          title='End Poll'
          buttonText='End Poll'
          description='Are you sure you want to end this poll? People will no longer be able to vote.'
        />
      )}
    </React.Fragment>
  )
}

export default MessagePopups
