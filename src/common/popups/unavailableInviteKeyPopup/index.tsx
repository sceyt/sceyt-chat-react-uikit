import React from 'react'
import { useDispatch } from 'store/hooks'
import { Popup, PopupDescription, PopupName, CloseIcon, PopupBody, Button, PopupFooter } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'
import PopupContainer from '../popupContainer'
import { setChannelInviteKeyAvailableAC } from 'store/channel/actions'

const UnavailableInviteKeyPopup = () => {
  const dispatch = useDispatch()
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.LINK_COLOR]: linkColor
  } = useColor()

  const handleClose = () => {
    dispatch(setChannelInviteKeyAvailableAC(true))
  }

  return (
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='520px' minWidth='520px' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={iconPrimary} onClick={handleClose} />
          <PopupName color={textPrimary} marginBottom='20px'>
            Failed to join
          </PopupName>
          <PopupDescription color={textPrimary} highlightColor={linkColor}>
            You can't join the group or community as the invite link was reset.
          </PopupDescription>
        </PopupBody>
        <PopupFooter backgroundColor={surface1}>
          <Button
            type='button'
            backgroundColor={accentColor}
            color={textOnPrimary}
            borderRadius='8px'
            onClick={handleClose}
          >
            Close
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default UnavailableInviteKeyPopup
