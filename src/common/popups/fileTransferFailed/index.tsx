import React, { useCallback } from 'react'
import { useDispatch, useSelector } from '../../../store/hooks'
import styled from 'styled-components'
import { Popup, PopupBody, PopupName, PopupDescription, CloseIcon, PopupFooter, Button } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'
import { fileTransferFailedPopupSelector } from '../../../store/message/selector'
import { setFileTransferFailedPopupAC } from '../../../store/message/actions'
import PopupContainer from '../popupContainer'

const TEXTS = {
  download: { title: 'Download failed', description: 'This file is unavailable and cannot be downloaded.' },
  upload: { title: 'Upload failed', description: 'The file could not be uploaded. Please try again.' }
}

// The popup shown when a file the user downloads or uploads fails (setFileTransferFailedPopupAC).
function FileTransferFailedPopup() {
  const dispatch = useDispatch()
  const popup = useSelector(fileTransferFailedPopupSelector)
  const colors = useColor()
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary
  } = colors

  const handleClose = useCallback(() => {
    dispatch(setFileTransferFailedPopupAC(null))
  }, [])

  if (!popup) return null
  const { title, description } = TEXTS[popup]

  return (
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='522px' minWidth='522px' width='522px' height='175px' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px' marginBottom='0'>
          <CloseIcon color={iconPrimary} onClick={handleClose} />

          <StyledPopupName color={textPrimary} marginBottom='20px'>
            {title}
          </StyledPopupName>

          <StyledPopupDescription color={textPrimary} highlightColor={accentColor}>
            {description}
          </StyledPopupDescription>
        </PopupBody>

        <PopupFooter backgroundColor={surface1} justify='flex-end'>
          <CloseButton
            type='button'
            backgroundColor={accentColor}
            color={textOnPrimary}
            borderRadius='8px'
            onClick={handleClose}
          >
            Close
          </CloseButton>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default FileTransferFailedPopup

const StyledPopupName = styled(PopupName)`
  font-weight: 500;
  font-size: 20px;
  line-height: 24px;
`

const StyledPopupDescription = styled(PopupDescription)`
  display: block;
  font-weight: 400;
  font-size: 15px;
  line-height: 150%;
  margin-top: 0;
  margin-bottom: 0;
  overflow-wrap: break-word;
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
