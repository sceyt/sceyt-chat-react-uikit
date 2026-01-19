import React from 'react'
import styled from 'styled-components'
import { IMessage, IReaction } from 'types'
import ReactionsPopup from 'common/popups/reactions'

interface MessageReactionsProps {
  message: IMessage
  reactionsCount: number
  reactionsPopupOpen: boolean
  reactionsPopupPosition: number
  reactionsPopupHorizontalPosition: { left: number; right: number }
  rtlDirection: boolean
  backgroundSections: string
  textPrimary: string
  reactionsDisplayCount?: number
  showEachReactionCount?: boolean
  showTotalReactionCount?: boolean
  reactionItemBorder?: string
  reactionItemBorderRadius?: string
  reactionItemBackground?: string
  reactionItemPadding?: string
  reactionItemMargin?: string
  reactionsFontSize?: string
  reactionsContainerBoxShadow?: string
  reactionsContainerBorder?: string
  reactionsContainerBorderRadius?: string
  reactionsContainerBackground?: string
  reactionsContainerTopPosition?: string
  reactionsContainerPadding?: string
  reactionsDetailsPopupBorderRadius?: string
  reactionsDetailsPopupHeaderItemsStyle?: 'bubbles' | 'inline'
  onToggleReactionsPopup: () => void
  onReactionAddDelete: (selectedEmoji: string) => void
  onOpenUserProfile: (user?: any) => void
}

const MessageReactions: React.FC<MessageReactionsProps> = ({
  message,
  reactionsCount,
  reactionsPopupOpen,
  reactionsPopupPosition,
  reactionsPopupHorizontalPosition,
  rtlDirection,
  backgroundSections,
  textPrimary,
  reactionsDisplayCount = 5,
  showEachReactionCount = true,
  showTotalReactionCount,
  reactionItemBorder,
  reactionItemBorderRadius,
  reactionItemBackground,
  reactionItemPadding,
  reactionItemMargin,
  reactionsFontSize,
  reactionsContainerBoxShadow,
  reactionsContainerBorder,
  reactionsContainerBorderRadius,
  reactionsContainerBackground,
  reactionsContainerTopPosition,
  reactionsContainerPadding,
  reactionsDetailsPopupBorderRadius,
  reactionsDetailsPopupHeaderItemsStyle,
  onToggleReactionsPopup,
  onReactionAddDelete,
  onOpenUserProfile
}) => {
  return (
    <React.Fragment>
      {reactionsPopupOpen && (
        <ReactionsPopup
          openUserProfile={onOpenUserProfile}
          bottomPosition={reactionsPopupPosition}
          horizontalPositions={reactionsPopupHorizontalPosition}
          reactionTotals={message.reactionTotals || []}
          messageId={message.id}
          handleReactionsPopupClose={onToggleReactionsPopup}
          rtlDirection={rtlDirection}
          handleAddDeleteEmoji={onReactionAddDelete}
          reactionsDetailsPopupBorderRadius={reactionsDetailsPopupBorderRadius}
          reactionsDetailsPopupHeaderItemsStyle={reactionsDetailsPopupHeaderItemsStyle}
        />
      )}
      <ReactionsContainer
        id={`${message.id}_reactions_container`}
        border={reactionsContainerBorder}
        boxShadow={reactionsContainerBoxShadow}
        borderRadius={reactionsContainerBorderRadius}
        topPosition={reactionsContainerTopPosition}
        padding={reactionsContainerPadding}
        backgroundColor={reactionsContainerBackground || backgroundSections}
        rtlDirection={rtlDirection}
        isReacted={message.reactionTotals && message.reactionTotals.length > 0}
      >
        {message.reactionTotals && message.reactionTotals.length && (
          <MessageReactionsCont rtlDirection={rtlDirection} onClick={onToggleReactionsPopup}>
            {message.reactionTotals.slice(0, reactionsDisplayCount).map((summery) => (
              <MessageReaction
                key={summery.key}
                color={textPrimary}
                self={!!message.userReactions?.find((userReaction: IReaction) => userReaction.key === summery.key)}
                border={reactionItemBorder}
                borderRadius={reactionItemBorderRadius}
                backgroundColor={reactionItemBackground || backgroundSections}
                padding={reactionItemPadding}
                margin={reactionItemMargin}
                isLastReaction={reactionsCount === 1}
                fontSize={reactionsFontSize}
              >
                <MessageReactionKey>
                  {summery.key}
                  {showEachReactionCount && <ReactionItemCount color={textPrimary}>{summery.count}</ReactionItemCount>}
                </MessageReactionKey>
              </MessageReaction>
            ))}
            {showTotalReactionCount && reactionsCount && reactionsCount > 1 && (
              <MessageReaction
                border={reactionItemBorder}
                color={textPrimary}
                borderRadius={reactionItemBorderRadius}
                backgroundColor={reactionItemBackground}
                padding={reactionItemPadding}
                margin={'0'}
                fontSize={'12px'}
              >
                {reactionsCount}
              </MessageReaction>
            )}
          </MessageReactionsCont>
        )}
      </ReactionsContainer>
    </React.Fragment>
  )
}

const MessageReactionKey = styled.span`
  display: inline-flex;
  align-items: center;
  font-family:
    apple color emoji,
    segoe ui emoji,
    noto color emoji,
    android emoji,
    emojisymbols,
    emojione mozilla,
    twemoji mozilla,
    segoe ui symbol;
`

const ReactionItemCount = styled.span<{ color: string }>`
  margin-left: 2px;
  font-family: Inter, sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 16px;
  color: ${(props) => props.color};
`

const MessageReaction = styled.span<{
  self?: boolean
  isLastReaction?: boolean
  border?: string
  color?: string
  borderRadius?: string
  backgroundColor?: string
  fontSize?: string
  padding?: string
  margin?: string
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: ${(props: any) => props.margin || '0 8px 0 0'};
  margin-right: ${(props) => props.isLastReaction && '0'};
  border: ${(props) => props.border};
  color: ${(props) => props.color};
  box-sizing: border-box;
  border-radius: ${(props) => props.borderRadius || '16px'};
  font-size: ${(props) => props.fontSize || '18px'};
  line-height: ${(props) => props.fontSize || '18px'};
  padding: ${(props) => props.padding || '0'};
  background-color: ${(props) => props.backgroundColor};
  white-space: nowrap;

  &:last-child {
    margin-right: 0;
  }
`

const ReactionsContainer = styled.div<{
  border?: string
  boxShadow?: string
  borderRadius?: string
  topPosition?: string
  backgroundColor: string
  padding?: string
  rtlDirection?: boolean
  isReacted?: boolean
}>`
  display: inline-flex;
  margin-left: ${(props: any) => props.rtlDirection && 'auto'};
  margin-right: ${(props) => !props.rtlDirection && 'auto'};
  margin-top: 4px;
  justify-content: flex-end;
  border: ${(props) => props.border};
  box-shadow: ${(props) => props.boxShadow || '0px 4px 12px -2px rgba(17, 21, 57, 0.08)'};
  filter: drop-shadow(0px 0px 2px rgba(17, 21, 57, 0.08));
  border-radius: ${(props) => props.borderRadius || '16px'};
  background-color: ${(props) => props.backgroundColor};
  padding: ${(props) => (!props.isReacted ? '0' : props.padding || '4px 8px')};
  z-index: 9;
  ${(props) =>
    props.topPosition &&
    `
      position: relative;
      top: ${props.topPosition};
  `};
  overflow: hidden;
  height: ${(props) => (props.isReacted ? '16px' : '0')};
  transition: all 0.3s;
`

const MessageReactionsCont = styled.div<{ rtlDirection?: boolean }>`
  position: relative;
  display: inline-flex;
  max-width: 300px;
  direction: ${(props: any) => props.rtlDirection && 'ltr'};
  cursor: pointer;
`

export default MessageReactions
