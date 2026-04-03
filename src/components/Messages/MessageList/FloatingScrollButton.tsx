import React from 'react'
import styled from 'styled-components'

interface FloatingScrollButtonProps {
  show: boolean
  bottomOffset: number
  backgroundColor: string
  badgeBackgroundColor: string
  icon: React.ReactNode
  count?: number
  stackedAbove?: boolean
  onClick: () => void
}

const FloatingScrollButton: React.FC<FloatingScrollButtonProps> = ({
  show,
  bottomOffset,
  backgroundColor,
  badgeBackgroundColor,
  icon,
  count = 0,
  stackedAbove = false,
  onClick
}) => {
  return (
    <Button
      show={show}
      bottomOffset={bottomOffset}
      backgroundColor={backgroundColor}
      stackedAbove={stackedAbove}
      onClick={onClick}
    >
      {count > 0 && <Badge backgroundColor={badgeBackgroundColor}>{count > 99 ? '99+' : count}</Badge>}
      {icon}
    </Button>
  )
}

export default FloatingScrollButton

const Button = styled.button<{ show: boolean; bottomOffset: number; backgroundColor: string; stackedAbove: boolean }>`
  position: absolute;
  right: 16px;
  bottom: ${(props) => props.bottomOffset + 45 + (props.stackedAbove ? 60 : 0)}px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  background-color: ${(props) => props.backgroundColor};
  cursor: pointer;
  z-index: 14;
  opacity: ${(props) => (props.show ? 1 : 0)};
  transform: translateY(${(props) => (props.show ? '0' : '12px')}) scale(${(props) => (props.show ? 1 : 0.96)});
  pointer-events: ${(props) => (props.show ? 'auto' : 'none')};
  transition:
    bottom 0.2s ease,
    opacity 0.2s ease,
    transform 0.2s ease;

  & > svg {
    color: rgba(129, 140, 153, 1);
  }
`

const Badge = styled.span<{ backgroundColor: string }>`
  position: absolute;
  right: 16px;
  bottom: 32px;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  border-radius: 10px;
  box-sizing: border-box;
  background-color: ${(props) => props.backgroundColor};
  color: #fff;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  text-align: center;
`
