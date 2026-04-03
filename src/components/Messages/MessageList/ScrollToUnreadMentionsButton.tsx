import React from 'react'
import { ReactComponent as MentionIcon } from '../../../assets/svg/mention.svg'
import FloatingScrollButton from './FloatingScrollButton'

interface ScrollToUnreadMentionsButtonProps {
  show: boolean
  bottomOffset: number
  backgroundColor: string
  badgeBackgroundColor: string
  count: number
  stackedAbove?: boolean
  onClick: () => void
}

const ScrollToUnreadMentionsButton: React.FC<ScrollToUnreadMentionsButtonProps> = ({
  show,
  bottomOffset,
  backgroundColor,
  badgeBackgroundColor,
  count,
  stackedAbove = false,
  onClick
}) => {
  return (
    <FloatingScrollButton
      show={show}
      bottomOffset={bottomOffset}
      backgroundColor={backgroundColor}
      badgeBackgroundColor={badgeBackgroundColor}
      icon={<MentionIcon />}
      count={count}
      stackedAbove={stackedAbove}
      onClick={onClick}
    />
  )
}

export default ScrollToUnreadMentionsButton
