import React from 'react'
import styled from 'styled-components'
import { ReactComponent as TickIcon } from '../../assets/svg/tick.svg'

interface IProps {
  onChange: (e: any) => void
  state: boolean
  index: any
  checkedBorderColor: string
  borderColor: string
  border?: string
  borderRadius?: string
  size?: string
  disabled?: boolean
  variant?: 'radio' | 'checkbox'
}

const CustomRadio = ({
  index,
  state,
  onChange,
  checkedBorderColor,
  borderColor,
  border,
  borderRadius,
  size,
  disabled,
  variant = 'radio'
}: IProps) => {
  const isCheckboxStyle = variant === 'checkbox'

  return (
    <React.Fragment>
      <CustomLabel
        isChecked={state}
        size={size}
        checkedBorderColor={checkedBorderColor}
        borderColor={borderColor}
        border={border}
        borderRadius={borderRadius}
        isCheckboxStyle={isCheckboxStyle}
        htmlFor={`radio-${index}`}
      >
        {state && isCheckboxStyle && <TickIcon />}
      </CustomLabel>

      <Radio
        disabled={disabled}
        type='radio'
        id={`radio-${index}`}
        checked={state}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e)}
      />
    </React.Fragment>
  )
}

export default CustomRadio

const CustomLabel = styled.label<{
  size?: string
  border?: string
  borderColor: string
  checkedBorderColor: string
  borderRadius?: string
  isChecked: boolean
  isCheckboxStyle: boolean
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: ${(props) => props.size || '12px'};
  height: ${(props) => props.size || '12px'};
  cursor: pointer;
  border: ${(props) =>
    props.isChecked ? `2px solid ${props.checkedBorderColor}` : props.border || `1px solid ${props.borderColor}`};
  border-radius: ${(props) => props.borderRadius || '50%'};

  ${(props) =>
    props.isChecked &&
    !props.isCheckboxStyle &&
    `
    &::after {
    content: '';
    position: absolute;
    width: calc(100% - 3px);
    height: calc(100% - 3px);
    border-radius: 50%;
    background-color: ${props.checkedBorderColor};
    }
  `}

  ${(props) =>
    props.isCheckboxStyle &&
    `
    background-color: ${props.isChecked ? props.checkedBorderColor : 'transparent'};
    border: ${props.isChecked ? 'none' : props.border || `1px solid ${props.borderColor}`};
    &::after {
      display: none;
    }
    & > svg {
      width: calc(100% - 4px);
      height: calc(100% - 4px);
    }
  `}
`

const Radio = styled.input`
  display: none;
`
