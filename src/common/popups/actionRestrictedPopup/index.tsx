import React from 'react'
import { useDispatch } from 'store/hooks'
import { Popup, PopupDescription, PopupName, CloseIcon, PopupBody, Button, PopupFooter } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'
import PopupContainer from '../popupContainer'
import { setActionIsRestrictedAC, setOpenInviteModalAC } from '../../../store/member/actions'

const ActionRestrictedPopup = ({ fromChannel }: { fromChannel: boolean }) => {
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
    dispatch(setActionIsRestrictedAC(false, false))
  }

  const handleInvite = () => {
    dispatch(setOpenInviteModalAC(true))
    handleClose()
  }

  return (
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='520px' minWidth='520px' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={iconPrimary} onClick={handleClose} />
          <PopupName color={textPrimary} marginBottom='20px'>
            Privacy note
          </PopupName>
          <PopupDescription color={textPrimary} highlightColor={linkColor}>
            Unable to add this member. Try inviting them directly to the group.
          </PopupDescription>
        </PopupBody>
        <PopupFooter backgroundColor={surface1}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={handleClose}>
            Cancel
          </Button>
          {fromChannel && (
            <Button
              type='button'
              backgroundColor={accentColor}
              color={textOnPrimary}
              borderRadius='8px'
              onClick={handleInvite}
            >
              Invite
            </Button>
          )}
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default ActionRestrictedPopup
