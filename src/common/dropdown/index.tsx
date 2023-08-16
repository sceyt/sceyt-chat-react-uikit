import React, { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { useDidUpdate, useEventListener } from '../../hooks'
import { colors } from '../../UIHelper/constants'
import { THEME } from '../../helpers/constants'

const DropDownContainer = styled.div<{
  height?: string
  center: boolean
  order?: number
  margin?: string
  theme?: string
}>`
  position: relative;
  height: ${(props) => (props.height ? props.height : '100%')};
  order: ${(props) => (props.order === 0 || props.order ? props.order : 0)};
  margin: ${(props) => props.margin};
  ${(props) =>
    props.center &&
    ` display: flex;
      justify-content: center;
    `};
`

const DropDownTriggerContainer = styled.div<{
  withIcon?: boolean
  iconColor?: string
  isOpen?: boolean
}>`
  position: relative;
  cursor: pointer;
  height: 100%;
  width: 100%;
  user-select: none;
  background-color: transparent;
  box-shadow: none;
  border: none;
  padding: 0;
  outline: none !important;
  -webkit-tap-highlight-color: transparent;
  & svg {
    color: ${(props) => props.iconColor};
  }
  ${(props) =>
    props.withIcon &&
    `
        // padding-right: 20px;

        &::after {
            content: "";
            position: absolute;
            width: 7px;
            height: 7px;
            border-width: 1px 1px 0 0;
            border-color: ${props.iconColor || 'black'};
            border-style: solid;
            top: calc(50% - 2px);
            right: 14px;
            transform: translateY(-50%) rotate(135deg);
            transition: all 0.2s;
        }
    `} ${(props) =>
    props.isOpen &&
    `
        &::after {
            transform: translateY(-50%) rotate(-45deg);
            top: calc(50% + 2px);
        }
        `};
`

const DropDownBody = styled.div<{ position?: string; onScroll?: any; backgroundColor?: string }>`
  position: absolute;
  z-index: 300;
  min-width: 200px;
  right: ${(props) => props.position !== 'left' && '0'};
  left: ${(props) => props.position === 'left' && '0'};
  top: 100%;
  display: flex;
  direction: initial;
  flex-direction: column;
  background: ${(props) => props.backgroundColor || colors.backgroundColor};
  border-radius: 8px;
  max-height: 220px;
  overflow-y: auto;
  box-shadow: 0.8px 0.8px 0 rgba(31, 35, 60, 0.06), 0 0 2px rgba(31, 35, 60, 0.08), 0 2px 6px rgba(31, 35, 60, 0.16);

  & > * {
    &:first-child {
      margin-top: 5px;
    }

    &:first-child {
      margin-bottom: 5px;
    }
  }

  ${(props) =>
    props.position === 'top'
      ? `top: inherit;
         bottom: 100%;`
      : props.position === 'topRight'
      ? `top: inherit;
         right: inherit;
         bottom: 100%`
      : props.position === 'right' || props.position === 'center'
      ? `right: inherit;`
      : props.position === 'left'
      ? `right: inherit;
          left: 0;`
      : ''}
`

interface IProps {
  trigger: JSX.Element
  position?: string
  withIcon?: boolean
  iconColor?: string
  isStatic?: boolean
  forceClose?: boolean
  isSelect?: boolean
  dropDownState?: boolean
  order?: number
  margin?: string
  watchToggleState?: (state: boolean) => void
  height?: string
  children?: JSX.Element | JSX.Element[]
  theme?: string
}

const DropDown = ({
  trigger,
  position,
  withIcon,
  iconColor,
  margin,
  isStatic,
  forceClose,
  isSelect,
  dropDownState,
  watchToggleState,
  height,
  children,
  theme,
  order
}: IProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropDownRef = useRef<any>(null)
  const dropDownBodyRef = useRef<any>(null)

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
    if (watchToggleState) {
      watchToggleState(!isOpen)
    }
  }

  const handleDropdownClicks = (e: Event) => {
    e.stopPropagation()
    if (isOpen) {
      if (!isStatic) {
        const dropDownElem = dropDownRef.current
        const dropDownBodyElem = dropDownBodyRef.current

        // Click outside dropdown
        if (dropDownElem && !dropDownElem.contains(e.target)) {
          console.log('call toggle dropdown. .. ')
          toggleDropdown()
        }

        // Click on dropdown body
        /* if (dropDownBodyElem && dropDownBodyElem.contains(e.target)) {

                    const listElement = dropDownBodyElem.getElementsByTagName('ul')[0];
                    if (listElement && listElement.contains(e.target)) {
                        setIsOpen(false);
                    }
                } */
        if (isSelect && dropDownBodyElem && dropDownBodyElem.contains(e.target)) {
          const listElement = dropDownBodyElem.getElementsByTagName('ul')[0]
          if (listElement && listElement.contains(e.target)) {
            console.log('call toggle dropdown. .. !!')
            toggleDropdown()
          }
        }
      }
    }
  }

  const handleScrolling = (event: Event) => {
    event.stopPropagation()
  }

  useEventListener('click', handleDropdownClicks)

  useDidUpdate(() => {
    if (forceClose) {
      setIsOpen(false)
    }
  }, [forceClose])

  useEffect(() => {
    if (dropDownState !== undefined) {
      setIsOpen(dropDownState)
    }
  }, [dropDownState])
  return (
    <DropDownContainer
      theme={theme}
      order={order}
      margin={margin}
      className='dropdown-wrapper'
      center={position === 'center'}
      ref={dropDownRef}
      height={height}
    >
      <DropDownTriggerContainer
        onClick={(e) => {
          e.stopPropagation()
          toggleDropdown()
        }}
        withIcon={React.isValidElement(trigger) ? withIcon : true}
        isOpen={isOpen}
        className={`dropdown-trigger ${isOpen ? 'open' : ''}`}
        iconColor={iconColor || (theme === THEME.DARK ? colors.white : '')}
      >
        {React.isValidElement(trigger) ? trigger : <span>{trigger}</span>}
        {/* {React.cloneElement(trigger, { onClick: toggleDropdown })} */}
      </DropDownTriggerContainer>
      {isOpen && (
        <DropDownBody
          backgroundColor={theme === THEME.DARK ? colors.backgroundColor : colors.white}
          onScroll={handleScrolling}
          className='dropdown-body'
          ref={dropDownBodyRef}
          position={position}
        >
          {children}
        </DropDownBody>
      )}
    </DropDownContainer>
  )
}

export default DropDown
