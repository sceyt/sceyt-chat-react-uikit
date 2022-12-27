import React from 'react'
import styled from 'styled-components'
import { colors } from '../../UIHelper/constants'
import { ReactComponent as TickIcon } from '../../assets/svg/tick.svg'

interface IProps {
  onChange: (e: any) => void
  state: boolean
  index: any
  backgroundColor?: string
  checkedBackgroundColor?: string
  tickColor?: string
  borderRadius?: string
  size?: string
}

const CustomCheckbox = ({
  index,
  state,
  onChange,
  checkedBackgroundColor,
  backgroundColor,
  tickColor,
  borderRadius,
  size
}: IProps) => {
  return (
    <React.Fragment>
      <CustomLabel
        isChecked={state}
        size={size}
        checkedBackgroundColor={checkedBackgroundColor}
        backgroundColor={backgroundColor}
        tickColor={tickColor}
        borderRadius={borderRadius}
        htmlFor={`checkbox-${index}`}
      >
        {state && <TickIcon />}
      </CustomLabel>

      <Checkbox type='checkbox' id={`checkbox-${index}`} checked={state} onChange={(e) => onChange(e)} />
    </React.Fragment>
  )
}

export default CustomCheckbox

const CustomLabel = styled.label<{
  size?: string
  backgroundColor?: string
  checkedBackgroundColor?: string
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
  min-width: ${(props) => props.size || '12px'};
  height: ${(props) => props.size || '12px'};
  cursor: pointer;
  border: ${(props) => (props.isChecked ? 'none' : '1px solid #818C99')};
  border-radius: ${(props) => props.borderRadius || '4px'};
  background-color: ${(props) =>
    props.isChecked ? props.checkedBackgroundColor || colors.green1 : props.backgroundColor || '#fff'};

  & > svg {
    width: calc(100% - 4px);
    height: calc(100% - 8px);
  }
`

const Checkbox = styled.input`
  display: none;
`
