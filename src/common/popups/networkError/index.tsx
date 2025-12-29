import React from 'react'
import { Popup, PopupBody, PopupName, PopupDescription, CloseIcon, PopupFooter, Button } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import styled from 'styled-components'
import { useColor } from '../../../hooks'
import PopupContainer from '../popupContainer'

interface IProps {
  togglePopup: () => void
}

function NetworkErrorPopup({ togglePopup }: IProps) {
  const colors = useColor()
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary
  } = colors

  return (
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='522px' minWidth='522px' width='522px' height='220px' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px' marginBottom='0'>
          <CloseIcon color={iconPrimary} onClick={togglePopup} />

          <StyledPopupName color={textPrimary} marginBottom='12px'>
            Unable to save the changes
          </StyledPopupName>

          <StyledPopupDescription color={textPrimary} highlightColor={accentColor}>
            The timer change could not be applied due to network connectivity issues. Please check your connection and
            try again.
          </StyledPopupDescription>
        </PopupBody>

        <PopupFooter backgroundColor={surface1} justify='flex-end'>
          <CloseButton
            type='button'
            backgroundColor={accentColor}
            color={textOnPrimary}
            borderRadius='8px'
            onClick={togglePopup}
          >
            Close
          </CloseButton>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default NetworkErrorPopup

const StyledPopupName = styled(PopupName)`
  font-weight: 500;
  font-style: normal;
  font-size: 20px;
  line-height: 120%;
  letter-spacing: 0%;
`

const StyledPopupDescription = styled(PopupDescription)`
  font-weight: 400;
  font-style: normal;
  font-size: 15px;
  line-height: 150%;
  letter-spacing: 0%;
  margin-top: 0;
  margin-bottom: 0;
  width: 437px;
  height: 68px;
  opacity: 1;
  display: block;
  overflow-wrap: break-word;
  word-wrap: break-word;
`

const CloseButton = styled(Button)`
  width: 73px;
  height: 36px;
  min-width: 73px;
  max-width: 73px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`
