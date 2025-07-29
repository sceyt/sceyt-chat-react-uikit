import React from 'react'
import styled from 'styled-components'
import { ReactComponent as TickIcon } from '../../assets/svg/tick.svg'

interface IProps {
  // eslint-disable-next-line no-unused-vars
  onChange?: (e: any) => void
  onClick?: (e: any) => void
  state: boolean
  index: any
  backgroundColor: string
  checkedBackgroundColor?: string
  borderRadius?: string
  size?: string
  disabled?: boolean
  borderColor: string
}

const CustomCheckbox = ({
  index,
  state,
  onChange,
  onClick,
  checkedBackgroundColor,
  backgroundColor,
  borderRadius,
  disabled,
  size,
  borderColor
}: IProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e)
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      onClick(e)
    }
  }

  return (
    <React.Fragment>
      <CustomLabel
        isChecked={state}
        size={size}
        checkedBackgroundColor={checkedBackgroundColor}
        backgroundColor={backgroundColor}
        borderRadius={borderRadius}
        htmlFor={`checkbox-${index}`}
        disabled={disabled}
        borderColor={borderColor}
      >
        {state && <TickIcon />}
      </CustomLabel>

      <Checkbox
        type='checkbox'
        disabled={disabled}
        id={`checkbox-${index}`}
        checked={state}
        onChange={handleChange}
        onClick={handleClick}
      />
    </React.Fragment>
  )
}

export default CustomCheckbox

const CustomLabel = styled.label<{
  size?: string
  backgroundColor: string
  checkedBackgroundColor?: string
  borderRadius?: string
  isChecked: boolean
  disabled?: boolean
  borderColor: string
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: ${(props) => props.size || '12px'};
  min-width: ${(props) => props.size || '12px'};
  height: ${(props) => props.size || '12px'};
  cursor: ${(props) => !props.disabled && 'pointer'};
  border: ${(props) => (props.isChecked ? 'none' : `1px solid ${props.borderColor}`)};
  border-radius: ${(props) => props.borderRadius || '4px'};
  background-color: ${(props) => (props.isChecked ? props.checkedBackgroundColor : props.backgroundColor)};
  opacity: ${(props) => props.disabled && 0.4};

  & > svg {
    width: calc(100% - 4px);
    height: calc(100% - 8px);
  }
`

const Checkbox = styled.input`
  display: none;
`
