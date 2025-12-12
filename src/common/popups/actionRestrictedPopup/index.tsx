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
    dispatch(setActionIsRestrictedAC(false, false, null))
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
            {fromChannel ? 'Privacy note' : "Can't create group"}
          </PopupName>
          <PopupDescription color={textPrimary} highlightColor={linkColor}>
            {fromChannel
              ? 'Couldn’t add the user. Please invite them directly instead.'
              : 'Not everyone can be added to this group.'}
          </PopupDescription>
        </PopupBody>
        <PopupFooter backgroundColor={surface1}>
          {fromChannel && (
            <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={handleClose}>
              Cancel
            </Button>
          )}
          <Button
            type='button'
            backgroundColor={accentColor}
            color={textOnPrimary}
            borderRadius='8px'
            onClick={fromChannel ? handleInvite : handleClose}
          >
            {fromChannel ? 'Invite' : 'Cancel'}
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default ActionRestrictedPopup
