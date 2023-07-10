import React from 'react'
import styled from 'styled-components'
import { colors } from '../../UIHelper/constants'

interface IProps {
  onChange: (e: any) => void
  state: boolean
  index: any
  checkedBorder?: string
  border?: string
  tickColor?: string
  borderRadius?: string
  size?: string
  disabled?: boolean
}

const CustomRadio = ({ index, state, onChange, checkedBorder, border, borderRadius, size, disabled }: IProps) => {
  return (
    <React.Fragment>
      <CustomLabel
        isChecked={state}
        size={size}
        checkedBorder={checkedBorder}
        border={border}
        borderRadius={borderRadius}
        htmlFor={`radio-${index}`}
      />

      <Radio disabled={disabled} type='radio' id={`radio-${index}`} checked={state} onChange={(e) => onChange(e)} />
    </React.Fragment>
  )
}

export default CustomRadio

const CustomLabel = styled.label<{
  size?: string
  border?: string
  checkedBorder?: string
  tickColor?: string
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
    props.isChecked
      ? props.checkedBorder || `6px solid ${colors.primary}`
      : props.border || `1px solid ${colors.textColor2}`};
  border-radius: ${(props) => props.borderRadius || '50%'};
`

const Radio = styled.input`
  display: none;
`
