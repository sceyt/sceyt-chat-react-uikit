import React, { useEffect, useState, useCallback, useMemo } from 'react'
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

interface IProps {
  theme?: string
  togglePopup: () => void
  handleSetTimer: (timerInSeconds: number | null) => void
  currentTimer?: number | null
}

type TimerOption = 'off' | '1hour' | '1day' | '1week' | 'custom'

const FIXED_TIMER_OPTIONS: Record<TimerOption, number | null> = {
  off: 0,
  '1hour': 60 * 60,
  '1day': 60 * 60 * 24,
  '1week': 60 * 60 * 24 * 7,
  custom: 60 * 60 * 24 * 2
}

const CUSTOM_OPTIONS = [
  { label: '1 day', value: '1day', seconds: 60 * 60 * 24 },
  { label: '2 days', value: '2days', seconds: 60 * 60 * 24 * 2 },
  { label: '3 days', value: '3days', seconds: 60 * 60 * 24 * 3 },
  { label: '4 days', value: '4days', seconds: 60 * 60 * 24 * 4 },
  { label: '5 days', value: '5days', seconds: 60 * 60 * 24 * 5 },
  { label: '1 week', value: '1week', seconds: 60 * 60 * 24 * 7 },
  { label: '2 weeks', value: '2weeks', seconds: 60 * 60 * 24 * 14 },
  { label: '1 month', value: '1month', seconds: 60 * 60 * 24 * 30 }
]

const CUSTOM_SECONDS_MAP = Object.fromEntries(CUSTOM_OPTIONS.map((o) => [o.value, o.seconds]))

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
  const [customValue, setCustomValue] = useState('2days')
  const [initialRender, setInitialRender] = useState(true)
  const [isDropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    if (!currentTimer) {
      setSelectedOption('off')
    } else {
      const fixedMatch = (Object.keys(FIXED_TIMER_OPTIONS) as TimerOption[]).find(
        (key) => FIXED_TIMER_OPTIONS[key] === currentTimer
      )

      if (fixedMatch) {
        setSelectedOption(fixedMatch)
      } else {
        const customMatch = CUSTOM_OPTIONS.find((o) => o.seconds === currentTimer)
        setSelectedOption('custom')
        setCustomValue(customMatch?.value || '2days')
      }
    }

    setInitialRender(false)
  }, [currentTimer])

  const handleSet = useCallback(() => {
    if (selectedOption === 'custom') {
      handleSetTimer(CUSTOM_SECONDS_MAP[customValue])
    } else {
      handleSetTimer(FIXED_TIMER_OPTIONS[selectedOption])
    }
    togglePopup()
  }, [selectedOption, customValue, handleSetTimer, togglePopup])

  const selectedCustomLabel = useMemo(() => {
    return CUSTOM_OPTIONS.find((o) => o.value === customValue)?.label || '2 days'
  }, [customValue])

  return (
    <PopupContainer>
      <Popup
        theme={theme}
        backgroundColor={background}
        maxWidth='522px'
        minWidth='522px'
        width={selectedOption === 'custom' ? '522px' : undefined}
        height={selectedOption === 'custom' ? '491px' : undefined}
        padding='0'
      >
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={iconPrimary} onClick={togglePopup} />

          <PopupName color={textPrimary} marginBottom='20px'>
            Set a default message timer
          </PopupName>

          <PopupDescription color={textPrimary} highlightColor={accentColor}>
            Make messages in this chat disappear.
          </PopupDescription>

          <TimerOptionsSection marginTop='20px'>
            <Label color={textSecondary} marginTop='0'>
              Auto-delete after
            </Label>

            {(['off', '1hour', '1day', '1week'] as TimerOption[]).map((option) => (
              <TimerOptionItem key={option} color={textPrimary} onClick={() => setSelectedOption(option)}>
                <CustomRadio
                  index={option}
                  size='18px'
                  state={selectedOption === option}
                  onChange={() => setSelectedOption(option)}
                  checkedBorderColor={accentColor}
                  borderColor={iconInactive}
                  borderRadius='4px'
                />
                {option === 'off' ? 'Off' : option === '1hour' ? '1 hour' : option === '1day' ? '1 day' : '1 week'}
              </TimerOptionItem>
            ))}

            <TimerOptionItem color={textPrimary} onClick={() => setSelectedOption('custom')}>
              <CustomRadio
                index='custom'
                size='18px'
                state={selectedOption === 'custom'}
                onChange={() => setSelectedOption('custom')}
                checkedBorderColor={accentColor}
                borderColor={iconInactive}
                borderRadius='4px'
              />
              Custom
            </TimerOptionItem>

            {selectedOption === 'custom' && (
              <CustomTimerSection>
                <Label color={textSecondary} marginTop='12px'>
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
                            key={o.value}
                            onClick={() => setCustomValue(o.value)}
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
            disabled={initialRender}
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
  font-size: 16px;
  line-height: 160%;
  color: ${(props) => props.color};
  margin-bottom: 12px;

  & > label {
    margin-right: 10px;
  }
`

const CustomTimerSection = styled.div`
  margin: 0 auto;
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
