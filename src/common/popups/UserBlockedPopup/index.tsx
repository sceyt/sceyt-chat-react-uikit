import React from 'react'
import { useDispatch, useSelector } from 'store/hooks'
import { Popup, PopupDescription, PopupName, CloseIcon, PopupBody, Button, PopupFooter } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'
import PopupContainer from '../popupContainer'
import { setUserBlockedForInviteAC } from '../../../store/member/actions'
import { unblockUserAC } from '../../../store/user/actions'
import { connectionStatusSelector } from 'store/user/selector'
import { CONNECTION_STATUS } from 'store/user/constants'

const UserBlockedPopup = ({
  userIds,
  selectUsers
}: {
  userIds: string[]
  selectUsers?: (userIds: string[]) => void
}) => {
  const dispatch = useDispatch()
  const connectionStatus = useSelector(connectionStatusSelector)
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
    dispatch(setUserBlockedForInviteAC(false, []))
  }

  const handleUnblock = () => {
    dispatch(unblockUserAC(userIds))
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      selectUsers?.(userIds)
    }
    handleClose()
  }

  return (
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='520px' minWidth='520px' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={iconPrimary} onClick={handleClose} />
          <PopupName color={textPrimary} marginBottom='20px'>
            Failed to invite
          </PopupName>
          <PopupDescription color={textPrimary} highlightColor={linkColor}>
            You have blocked this user. Please unblock to invite.
          </PopupDescription>
        </PopupBody>
        <PopupFooter backgroundColor={surface1}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type='button'
            backgroundColor={accentColor}
            color={textOnPrimary}
            borderRadius='8px'
            onClick={handleUnblock}
          >
            Unblock
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default UserBlockedPopup
