import React from 'react'
import styled from 'styled-components'
import { ReactComponent as SelectionIcon } from '../../../assets/svg/selectionIcon.svg'
import { MESSAGE_STATUS } from 'helpers/constants'

interface MessageSelectionProps {
  isActive: boolean
  isSelected: boolean
  tooManySelected: boolean
  messageState: string
  accentColor: string
  borderColor: string
  onSelect: (e?: React.MouseEvent) => void
}

const MessageSelection: React.FC<MessageSelectionProps> = ({
  isActive,
  isSelected,
  tooManySelected,
  messageState,
  accentColor,
  borderColor,
  onSelect
}) => {
  if (!isActive || messageState === MESSAGE_STATUS.DELETE) {
    return null
  }

  return (
    <SelectMessageWrapper activeColor={accentColor} disabled={tooManySelected && !isSelected} onClick={onSelect}>
      {isSelected ? <SelectionIcon /> : <EmptySelection disabled={tooManySelected} borderColor={borderColor} />}
    </SelectMessageWrapper>
  )
}

const SelectMessageWrapper = styled.div<{ activeColor?: string; disabled?: any }>`
  display: flex;
  padding: 10px;
  position: absolute;
  left: 4%;
  bottom: calc(50% - 22px);
  cursor: ${(props: any) => !props.disabled && 'pointer'};
  & > svg {
    color: ${(props) => props.activeColor};
    width: 24px;
    height: 24px;
  }
`

const EmptySelection = styled.span<{ disabled?: boolean; borderColor: string }>`
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 1.5px solid ${(props) => props.borderColor};
  box-sizing: border-box;
  border-radius: 50%;
  transform: scale(0.92);
  opacity: ${(props) => props.disabled && '0.5'};
`

export default MessageSelection
