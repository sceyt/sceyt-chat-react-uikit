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
  disabled
}: IProps) => {
  const isCheckboxStyle = borderRadius && borderRadius !== '50%'

  return (
    <React.Fragment>
      <CustomLabel
        isChecked={state}
        size={size}
        checkedBorderColor={checkedBorderColor}
        borderColor={borderColor}
        border={border}
        borderRadius={borderRadius}
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
  // background-color: ${(props) => (props.isChecked ? props.checkedBorderColor : 'transparent')};

  ${(props) =>
    props.isChecked &&
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

  ${(props) => {
    const isCheckboxStyle = props.borderRadius && props.borderRadius !== '50%'
    if (isCheckboxStyle) {
      return `
        background-color: ${props.isChecked ? props.checkedBorderColor : 'transparent'};
        border: ${props.isChecked ? 'none' : props.border || `1px solid ${props.borderColor}`};
        &::after {
          display: none;
        }
        & > svg {
          width: calc(100% - 4px);
          height: calc(100% - 4px);
        }
      `
    }
    return ''
  }}
`

const Radio = styled.input`
  display: none;
`
