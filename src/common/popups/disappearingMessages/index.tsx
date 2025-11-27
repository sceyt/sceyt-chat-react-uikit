import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Popup,
  PopupDescription,
  PopupName,
  CloseIcon,
  PopupBody,
  Button,
  PopupFooter,
  Label,
  CustomSelect,
  CustomSelectTrigger,
  DropdownOptionsUl,
  DropdownOptionLi
} from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import styled from 'styled-components'
import CustomRadio from '../../customRadio'
import PopupContainer from '../popupContainer'
import { useColor } from '../../../hooks'
import DropDown from '../../dropdown'
import { FIXED_TIMER_OPTIONS, TimerOption } from '../../../helpers/constants'
import { getDisappearingSettings } from 'helpers/channelHalper'

interface IProps {
  theme?: string
  togglePopup: () => void
  handleSetTimer: (timerInSeconds: number | null) => void
  currentTimer?: number | null
}

type TimerOptionItem = {
  key: TimerOption
  label: string
}

const TIMER_OPTIONS: TimerOptionItem[] = [
  { key: 'off', label: 'Off' },
  { key: '1day', label: '1 day' },
  { key: '1week', label: '1 week' },
  { key: '1month', label: '1 month' }
]

function DisappearingMessagesPopup({ theme, togglePopup, handleSetTimer, currentTimer }: IProps) {
  const colors = useColor()
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.WARNING]: warningColor,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.BORDER]: borderColor
  } = colors

  const [selectedOption, setSelectedOption] = useState<TimerOption>('off')
  const [customValue, setCustomValue] = useState<string>('')
  const [initialRender, setInitialRender] = useState(true)
  const [isDropdownOpen, setDropdownOpen] = useState(false)
  const previousTimerRef = useRef<number | null | undefined>(currentTimer)
  const hasInitializedRef = useRef(false)

  const CUSTOM_OPTIONS = useMemo(() => {
    return getDisappearingSettings()?.customOptions || []
  }, [])

  useEffect(() => {
    if (CUSTOM_OPTIONS.length > 0 && CUSTOM_OPTIONS[0]?.label) {
      setCustomValue(CUSTOM_OPTIONS[0]?.label || '')
    }
  }, [CUSTOM_OPTIONS])

  const CUSTOM_SECONDS_MAP = useMemo(() => {
    return Object.fromEntries(CUSTOM_OPTIONS.map((o) => [o.label, o.seconds]))
  }, [CUSTOM_OPTIONS])

  useEffect(() => {
    if (previousTimerRef.current !== currentTimer) {
      setInitialRender(true)
      hasInitializedRef.current = false
      previousTimerRef.current = currentTimer
    }

    if (!currentTimer) {
      setSelectedOption('off')
    } else {
      const fixedMatch = (Object.keys(FIXED_TIMER_OPTIONS) as TimerOption[]).find(
        (key) => (FIXED_TIMER_OPTIONS[key] || 0) * 1000 === currentTimer
      )

      if (fixedMatch) {
        setSelectedOption(fixedMatch)
      } else {
        const customMatch = CUSTOM_OPTIONS.find((o) => o.seconds * 1000 === currentTimer)
        setSelectedOption('custom')
        setCustomValue(customMatch?.label || '2days')
      }
    }
  }, [currentTimer])

  useEffect(() => {
    if (!hasInitializedRef.current && initialRender) {
      hasInitializedRef.current = true
      setInitialRender(false)
    }
  }, [initialRender])

  const selectedTimerValue = useMemo(() => {
    return selectedOption === 'custom' ? CUSTOM_SECONDS_MAP[customValue] : FIXED_TIMER_OPTIONS[selectedOption]
  }, [selectedOption, customValue])

  const isValueUnchanged = useMemo(() => {
    if (initialRender) return true

    if (!selectedTimerValue && !selectedTimerValue) {
      return true
    } else if (selectedTimerValue * 1000 === currentTimer) {
      return true
    }

    return false
  }, [currentTimer, selectedTimerValue, initialRender])

  const handleSet = useCallback(() => {
    if (selectedOption === 'custom') {
      handleSetTimer(CUSTOM_SECONDS_MAP[customValue])
    } else {
      handleSetTimer(FIXED_TIMER_OPTIONS[selectedOption])
    }
    togglePopup()
  }, [selectedOption, customValue, handleSetTimer, togglePopup])

  const selectedCustomLabel = useMemo(() => {
    return CUSTOM_OPTIONS.find((o) => o.label === customValue)?.label || '2 days'
  }, [customValue, CUSTOM_OPTIONS])

  return (
    <PopupContainer>
      <Popup theme={theme} backgroundColor={background} maxWidth='522px' minWidth='522px' width='100%' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px' marginBottom='0'>
          <CloseIcon color={iconPrimary} onClick={togglePopup} />

          <PopupName color={textPrimary} marginBottom='20px' lineHeight='24px'>
            Set a default message timer
          </PopupName>

          <PopupDescription color={textPrimary} highlightColor={accentColor}>
            Make messages in this chat disappear.
          </PopupDescription>

          <TimerOptionsSection marginTop='20px'>
            <Label color={textPrimary} marginTop='0'>
              Auto-delete after
            </Label>

            {TIMER_OPTIONS.map((option: TimerOptionItem) => (
              <TimerOptionItem key={option.key} color={textPrimary} onClick={() => setSelectedOption(option.key)}>
                <CustomRadio
                  index={option.key}
                  size='18px'
                  state={selectedOption === option.key}
                  onChange={() => setSelectedOption(option.key)}
                  checkedBorderColor={accentColor}
                  borderColor={iconInactive}
                  borderRadius='4px'
                  variant='checkbox'
                />
                {option.label}
              </TimerOptionItem>
            ))}

            {CUSTOM_OPTIONS.length > 0 && (
              <TimerOptionItem color={textPrimary} onClick={() => setSelectedOption('custom')}>
                <CustomRadio
                  index='custom'
                  size='18px'
                  state={selectedOption === 'custom'}
                  onChange={() => setSelectedOption('custom')}
                  checkedBorderColor={accentColor}
                  borderColor={iconInactive}
                  borderRadius='4px'
                  variant='checkbox'
                />
                Custom
              </TimerOptionItem>
            )}

            {selectedOption === 'custom' && (
              <CustomTimerSection>
                <Label color={textPrimary} marginTop='0'>
                  Auto-delete after
                </Label>

                <CustomSelectWrapper accentColor={accentColor}>
                  <CustomSelect
                    backgroundColor={background}
                    color={textPrimary}
                    errorColor={warningColor}
                    placeholderColor={textSecondary}
                    borderColor={isDropdownOpen ? accentColor : borderColor}
                    disabledColor={surface1}
                    minWidth='474px'
                    maxWidth='474px'
                  >
                    <DropDown
                      withIcon
                      theme={theme}
                      isSelect
                      position='top'
                      trigger={
                        <CustomSelectTriggerStyled color={textPrimary}>{selectedCustomLabel}</CustomSelectTriggerStyled>
                      }
                      watchToggleState={setDropdownOpen}
                    >
                      <CustomDropdownOptionsUl theme={theme} accentColor={accentColor}>
                        {CUSTOM_OPTIONS.map((o) => (
                          <CustomDropdownOptionLi
                            hoverBackground={backgroundHovered}
                            key={o.label}
                            onClick={() => setCustomValue(o.label)}
                            textColor={textPrimary}
                          >
                            {o.label}
                          </CustomDropdownOptionLi>
                        ))}
                      </CustomDropdownOptionsUl>
                    </DropDown>
                  </CustomSelect>
                </CustomSelectWrapper>
              </CustomTimerSection>
            )}
          </TimerOptionsSection>
        </PopupBody>

        <PopupFooter backgroundColor={surface1}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={togglePopup}>
            Cancel
          </Button>

          <SetButton
            type='button'
            backgroundColor={accentColor}
            color={textOnPrimary}
            borderRadius='8px'
            onClick={handleSet}
            disabled={isValueUnchanged}
          >
            Set
          </SetButton>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default DisappearingMessagesPopup

const TimerOptionsSection = styled.div<{ marginTop?: string }>`
  margin-top: ${(props) => props.marginTop || '14px'};
`

const TimerOptionItem = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  cursor: pointer;
  color: ${(props) => props.color};
  padding: 10px 0;
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;

  & > label {
    margin-right: 10px;
  }
`

const CustomTimerSection = styled.div`
  margin: 16px auto 0 auto;
`

const CustomSelectWrapper = styled.div<{ accentColor: string }>`
  position: relative;
  width: 474px;

  .dropdown-wrapper {
    width: 100%;

    .dropdown-body {
      width: 474px;
      // height: 268px;
      max-height: 268px;
      border-color: ${(props) => props.accentColor}
      border-radius: 8px;
    }
  }
`

const CustomSelectTriggerStyled = styled(CustomSelectTrigger)`
  font-size: 15px;
  text-transform: none;
`

const CustomDropdownOptionLi = styled(DropdownOptionLi)`
  font-size: 15px;
`

const CustomDropdownOptionsUl = styled(DropdownOptionsUl)<{ accentColor: string }>`
  border-color: ${(props) => props.accentColor};
  height: 268px;
  max-height: 268px;
  border-radius: 0;

  ${CustomDropdownOptionLi} {
    padding-left: 24px;
    padding-right: 24px;
  }
`

const SetButton = styled(Button)`
  width: 57px;
  height: 36px;
  min-width: 57px;
  max-width: 57px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`
