import React from 'react'
import styled from 'styled-components'

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
      />

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
`

const Radio = styled.input`
  display: none;
`
