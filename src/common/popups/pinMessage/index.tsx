import React, { useState } from 'react'
import styled from 'styled-components'
import PopupContainer from '../popupContainer'
import CustomRadio from '../../customRadio'
import { Button, CloseIcon, Popup, PopupBody, PopupDescription, PopupFooter, PopupName } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'

interface PinMessagePopupProps {
  canPinForAll: boolean
  onClose: () => void
  onPin: (scope: number) => void
}

const PIN_TYPE_PERSONAL = 1
const PIN_TYPE_SHARED = 0

const PinMessagePopup = ({ canPinForAll, onClose, onPin }: PinMessagePopupProps) => {
  const {
    [THEME_COLORS.ACCENT]: accent,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.SURFACE_1]: surface,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary
  } = useColor()
  const [scope, setScope] = useState(PIN_TYPE_PERSONAL)

  return (
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='520px' minWidth='520px' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={iconPrimary} onClick={onClose} />
          <PopupName color={textPrimary} isDelete marginBottom='20px'>
            Pin message
          </PopupName>
          <PopupDescription color={textPrimary} highlightColor='red'>
            Do you want to pin this message in the chat?
          </PopupDescription>
          <Options>
            <Option color={textPrimary} onClick={() => setScope(PIN_TYPE_PERSONAL)}>
              <CustomRadio
                index='pin-for-me'
                size='18px'
                state={scope === PIN_TYPE_PERSONAL}
                onChange={() => setScope(PIN_TYPE_PERSONAL)}
                checkedBorderColor={accent}
                borderColor={iconInactive}
              />
              Pin for me
            </Option>
            <Option
              color={canPinForAll ? textPrimary : iconInactive}
              disabled={!canPinForAll}
              onClick={() => canPinForAll && setScope(PIN_TYPE_SHARED)}
            >
              <CustomRadio
                index='pin-for-all'
                size='18px'
                state={scope === PIN_TYPE_SHARED}
                onChange={() => canPinForAll && setScope(PIN_TYPE_SHARED)}
                checkedBorderColor={accent}
                borderColor={iconInactive}
                disabled={!canPinForAll}
              />
              Pin for all
            </Option>
          </Options>
        </PopupBody>
        <PopupFooter backgroundColor={surface}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={onClose}>
            Cancel
          </Button>
          <Button
            type='button'
            backgroundColor={accent}
            color={textOnPrimary}
            borderRadius='8px'
            onClick={() => onPin(scope)}
          >
            Pin
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default PinMessagePopup

const Options = styled.div`
  margin-top: 18px;
`
const Option = styled.label<{ color: string; disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 16px 0;
  color: ${({ color }) => color};
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
`
