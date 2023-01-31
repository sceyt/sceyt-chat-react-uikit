import React from 'react'
import styled from 'styled-components'
import { colors } from '../../UIHelper/constants'

interface IProps {
  handleSwitch?: () => void
  state: boolean
  backgroundColor?: string
}

const ToggleSwitch = ({ state, handleSwitch, backgroundColor }: IProps) => {
  const switcherID = Date.now().toString(36) + Math.random().toString(36).substring(2)
  const handleChane = () => {
    if (handleSwitch) {
      handleSwitch()
    }
  }
  return (
    <Container>
      <CustomCheckbox checked={state} onChange={handleChane} type='checkbox' id={switcherID} />
      <CustomLabel htmlFor={switcherID}>
        <Inner backgroundColor={backgroundColor} />
        <Switch />
      </CustomLabel>
    </Container>
  )
}

const Container = styled.div`
  position: relative;
  width: 36px;
  display: inline-block;
  text-align: left;
`

const CustomLabel = styled.label<any>`
  display: block;
  overflow: hidden;
  cursor: pointer;
  border: 0 solid #bbb;
  border-radius: 20px;
`

const Inner = styled.span<any>`
  display: block;
  width: 200%;
  margin-left: -100%;
  transition: margin 0.1s ease-in 0s;

  &::before,
  &::after {
    float: left;
    width: 50%;
    height: 18px;
    padding: 0;
    line-height: 36px;
    color: #fff;
    font-weight: bold;
    box-sizing: border-box;
  }

  &::before {
    content: '';
    padding-left: 10px;
    background-color: ${(props) => props.backgroundColor || colors.primary};
    color: #fff;
  }

  &::after {
    content: '';
    padding-right: 10px;
    background-color: #bbb;
    color: #fff;
    text-align: right;
  }
`

const Switch = styled.span`
  display: block;
  width: 14px;
  margin: 2px;
  background: #fff;
  position: absolute;
  top: 0;
  bottom: 0;
  right: 18px;
  border: 0 solid #bbb;
  border-radius: 20px;
  transition: all 0.1s ease-in 0s;
`

const CustomCheckbox = styled.input<any>`
  display: none;
  &:checked + ${CustomLabel} ${Inner} {
    margin-left: 0;
  }
  &:checked + ${CustomLabel} ${Switch} {
    right: 0;
  }
`
export default ToggleSwitch
