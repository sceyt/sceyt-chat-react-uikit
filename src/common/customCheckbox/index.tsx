import React from 'react'
import styled from 'styled-components'
import { colors } from '../../UIHelper/constants'
import { ReactComponent as TickIcon } from '../../assets/svg/tick.svg'

interface IProps {
  // eslint-disable-next-line no-unused-vars
  onChange: (e: any) => void
  state: boolean
  index: any
  backgroundColor?: string
  checkedBackgroundColor?: string
  tickColor?: string
  borderRadius?: string
  size?: string
  disabled?: boolean
}

const CustomCheckbox = ({
  index,
  state,
  onChange,
  checkedBackgroundColor,
  backgroundColor,
  tickColor,
  borderRadius,
  disabled,
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
        disabled={disabled}
      >
        {state && <TickIcon />}
      </CustomLabel>

      <Checkbox
        type='checkbox'
        disabled={disabled}
        id={`checkbox-${index}`}
        checked={state}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e)}
      />
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
  disabled?: boolean
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
  border: ${(props) => (props.isChecked ? 'none' : `1px solid ${colors.borderColor2}`)};
  border-radius: ${(props) => props.borderRadius || '4px'};
  background-color: ${(props) =>
    props.isChecked ? props.checkedBackgroundColor || props.tickColor : props.backgroundColor || '#fff'};
  opacity: ${(props) => props.disabled && 0.4};

  & > svg {
    width: calc(100% - 4px);
    height: calc(100% - 8px);
  }
`

const Checkbox = styled.input`
  display: none;
`
