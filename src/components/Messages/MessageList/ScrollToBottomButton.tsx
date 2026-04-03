import React from 'react'
import { ReactComponent as BottomIcon } from '../../../assets/svg/chevron_down.svg'
import FloatingScrollButton from './FloatingScrollButton'

interface ScrollToBottomButtonProps {
  show: boolean
  bottomOffset: number
  backgroundColor: string
  badgeBackgroundColor: string
  count: number
  onClick: () => void
}

const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  show,
  bottomOffset,
  backgroundColor,
  badgeBackgroundColor,
  count,
  onClick
}) => {
  return (
    <FloatingScrollButton
      show={show}
      bottomOffset={bottomOffset}
      backgroundColor={backgroundColor}
      badgeBackgroundColor={badgeBackgroundColor}
      icon={<BottomIcon />}
      count={count}
      onClick={onClick}
    />
  )
}

export default ScrollToBottomButton
