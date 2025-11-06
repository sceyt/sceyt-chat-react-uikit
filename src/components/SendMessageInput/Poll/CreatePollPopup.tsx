import React, { useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { ReactComponent as OptionsSvgIcon } from '../../../assets/svg/dots_vertica.svg'
import { ReactComponent as RemoveIcon } from '../../../assets/svg/close.svg'
import { Popup, PopupBody, PopupFooter, PopupName, Button, Label, CustomInput, CloseIcon, Row } from '../../../UIHelper'
import PopupContainer from '../../../common/popups/popupContainer'
import CustomCheckbox from '../../../common/customCheckbox'
import ConfirmPopup from '../../../common/popups/delete'
import { useColor } from '../../../hooks'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { v4 as uuidv4 } from 'uuid'

interface IPollOption {
  id: string
  name: string
}

interface IProps {
  togglePopup: () => void
  onCreate?: (
    event: React.MouseEvent<HTMLButtonElement>,
    payload: {
      name: string
      options: IPollOption[]
      anonymous: boolean
      allowMultipleVotes: boolean
      allowVoteRetract: boolean
      id: string
    }
  ) => void
}

const CreatePollPopup = ({ togglePopup, onCreate }: IProps) => {
  const {
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.BORDER]: borderColor,
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary
  } = useColor()

  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<IPollOption[]>([
    { id: uuidv4(), name: '' },
    { id: uuidv4(), name: '' }
  ])
  const [anonymous, setAnonymous] = useState(false)
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(true)
  // const [allowVoteRetract, setAllowVoteRetract] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const optionsListRef = useRef<HTMLDivElement>(null)
  const optionInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const questionLimit = 200
  const optionLimit = 120
  const maxOptions = 12
  const canCreate = useMemo(() => {
    const validOptions = options.map((o) => o.name.trim()).filter(Boolean)
    return question.trim().length > 0 && validOptions.length >= 2
  }, [question, options])

  const hasUnsavedChanges = useMemo(() => {
    const hasQuestion = question.trim().length > 0
    const hasOptions = options.some((o) => o.name.trim().length > 0)
    return hasQuestion || hasOptions
  }, [question, options])

  const allowPaste = (e: React.ClipboardEvent<HTMLInputElement>, type: 'question' | 'option', id?: string) => {
    if (type === 'question') {
      setQuestion((e.target as HTMLInputElement).value)
    } else {
      setOptions(options.map((o) => (o.id === id ? { ...o, name: (e.target as HTMLInputElement).value } : o)))
    }
  }

  const addOption = () => {
    if (options.length >= maxOptions) return
    const nextId = uuidv4()
    setOptions([...options, { id: nextId, name: '' }])
    setTimeout(() => optionInputRefs.current[nextId]?.focus(), 0)
  }

  const removeOption = (id: string) => {
    if (options.length <= 2) return
    setOptions(options.filter((o) => o.id !== id))
  }

  const editOption = (id: string, value: string) => {
    setOptions((prev) => {
      const index = prev.findIndex((o) => o.id === id)
      if (index === -1) return prev
      const wasEmpty = prev[index].name.trim() === ''
      const isLast = index === prev.length - 1
      const updated = prev.map((o, i) => (i === index ? { ...o, name: value } : o))
      const nowFilled = value.trim().length > 0
      if (isLast && wasEmpty && nowFilled && prev.length < maxOptions) {
        const nextId = uuidv4()
        return [...updated, { id: nextId, name: '' }]
      }
      return updated
    })
  }

  const moveOption = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    const updated = [...options]
    const sourceIndex = updated.findIndex((o) => o.id === sourceId)
    const targetIndex = updated.findIndex((o) => o.id === targetId)
    if (sourceIndex === -1 || targetIndex === -1) return
    const [moved] = updated.splice(sourceIndex, 1)
    updated.splice(targetIndex, 0, moved)
    setOptions(updated)
  }

  const handleCreate = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!canCreate) return
    const payload = {
      name: question.trim(),
      options: options.filter((o) => o.name.trim()),
      anonymous,
      allowMultipleVotes,
      allowVoteRetract: true,
      id: uuidv4()
    }
    if (onCreate) onCreate(event, payload)
    togglePopup()
  }

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true)
    } else {
      togglePopup()
    }
  }

  const handleDiscard = () => {
    setShowDiscardConfirm(false)
    togglePopup()
  }

  const handleAutoScroll = (e: React.DragEvent<HTMLDivElement>) => {
    const container = optionsListRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const y = e.clientY
    const threshold = 40 // px from edges to start scrolling
    const maxStep = 18 // px per event
    if (y - rect.top < threshold) {
      const intensity = 1 - (y - rect.top) / threshold
      container.scrollTop -= Math.ceil(intensity * maxStep)
    } else if (rect.bottom - y < threshold) {
      const intensity = 1 - (rect.bottom - y) / threshold
      container.scrollTop += Math.ceil(intensity * maxStep)
    }
  }

  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    e.stopPropagation()
    // Defer to allow state from onChange (which may append a new option) to flush
    setTimeout(() => {
      const currentIndex = options.findIndex((o) => o.id === id)
      if (currentIndex === -1) return
      const next = options[currentIndex + 1]
      if (next) {
        optionInputRefs.current[next.id]?.focus()
      } else if (options.length < maxOptions) {
        const newId = uuidv4()
        setOptions((prev) => [...prev, { id: newId, name: '' }])
        setTimeout(() => optionInputRefs.current[newId]?.focus(), 0)
      }
    }, 0)
  }

  return (
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='520px' minWidth='520px' padding='0'>
        <PopupBody paddingH='20px' paddingV='20px'>
          <CloseIcon color={iconPrimary} onClick={handleCloseAttempt} />
          <PopupName color={textPrimary}>Create poll</PopupName>

          <Label color={textSecondary}>Question</Label>
          <QuestionInputWrapper>
            <CustomInput
              padding='11px 80px 11px 14px'
              color={textPrimary}
              placeholderColor={textSecondary}
              backgroundColor={surface1}
              borderColor={borderColor}
              errorColor={borderColor}
              disabledColor={surface1}
              maxLength={questionLimit}
              value={question}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setQuestion(e.target.value)
              }}
              placeholder='Add question'
              onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => allowPaste(e, 'question')}
              data-allow-paste='true'
            />
            <TextCounter color={textSecondary}>{`${question.length}/${questionLimit}`}</TextCounter>
          </QuestionInputWrapper>

          <Label color={textSecondary}>Options</Label>
          <OptionsList ref={optionsListRef} onDragOver={handleAutoScroll}>
            {options.map((opt) => (
              <OptionRow
                key={opt.id}
                draggable
                isDragging={draggingId === opt.id}
                isDragOver={dragOverId === opt.id}
                onDragStart={() => setDraggingId(opt.id)}
                onDragEnd={() => {
                  setDraggingId(null)
                  setDragOverId(null)
                }}
                onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                  e.preventDefault()
                  if (dragOverId !== opt.id) setDragOverId(opt.id)
                  handleAutoScroll(e)
                }}
                onDrop={(e: React.DragEvent<HTMLDivElement>) => {
                  e.preventDefault()
                  if (draggingId) moveOption(draggingId, opt.id)
                  setDraggingId(null)
                  setDragOverId(null)
                }}
              >
                <OptionsSvgIcon color={textSecondary} />
                <CustomInput
                  color={textPrimary}
                  placeholderColor={textSecondary}
                  backgroundColor={surface1}
                  borderColor={borderColor}
                  errorColor={borderColor}
                  disabledColor={surface1}
                  maxLength={optionLimit}
                  value={opt.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => editOption(opt.id, e.target.value)}
                  placeholder='Add option'
                  onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => allowPaste(e, 'option', opt.id)}
                  data-allow-paste='true'
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleOptionKeyDown(e, opt.id)}
                  ref={(el: HTMLInputElement | null) => {
                    optionInputRefs.current[opt.id] = el
                  }}
                />
                <RemoveOptionIcon
                  color={iconInactive}
                  disabled={options.length <= 2}
                  onClick={() => removeOption(opt.id)}
                  aria-label='Remove option'
                  width='12px'
                  height='12px'
                />
              </OptionRow>
            ))}
          </OptionsList>

          <AddOptionButton
            type='button'
            color={accentColor}
            onClick={addOption}
            disabled={options.length >= maxOptions}
            disabledColor={iconInactive}
          >
            Add another option
          </AddOptionButton>

          <Label color={textSecondary}>Poll settings</Label>
          <Settings>
            <SettingItem color={textPrimary}>
              <CustomCheckbox
                index='anonymous'
                state={anonymous}
                onClick={() => setAnonymous(!anonymous)}
                backgroundColor={background}
                checkedBackgroundColor={accentColor}
                borderColor={borderColor}
                size='18px'
              />
              Anonymous poll
            </SettingItem>
            <SettingItem color={textPrimary}>
              <CustomCheckbox
                index='multi'
                state={allowMultipleVotes}
                onClick={() => setAllowMultipleVotes(!allowMultipleVotes)}
                backgroundColor={background}
                checkedBackgroundColor={accentColor}
                borderColor={borderColor}
                size='18px'
              />
              Multiple votes
            </SettingItem>
            {/* <SettingItem color={textPrimary}>
              <CustomCheckbox
                index='allowVoteRetract'
                state={!allowVoteRetract}
                onClick={() => setAllowVoteRetract(!allowVoteRetract)}
                backgroundColor={background}
                checkedBackgroundColor={accentColor}
                borderColor={borderColor}
                size='18px'
              />
              Can't retract votes
            </SettingItem> */}
          </Settings>
        </PopupBody>

        <PopupFooter backgroundColor={surface1}>
          <Row>
            <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={handleCloseAttempt}>
              Cancel
            </Button>
            <Button
              type='button'
              backgroundColor={canCreate ? accentColor : iconInactive}
              color={textOnPrimary}
              borderRadius='8px'
              disabled={!canCreate}
              onClick={handleCreate}
              style={{ marginLeft: 8 }}
            >
              Create
            </Button>
          </Row>
        </PopupFooter>
      </Popup>
      {showDiscardConfirm && (
        <ConfirmPopup
          togglePopup={() => setShowDiscardConfirm(false)}
          handleFunction={handleDiscard}
          title='Discard Poll'
          description='Are you sure you want to discard this poll? All changes will be lost.'
          buttonText='Discard'
        />
      )}
    </PopupContainer>
  )
}

export default CreatePollPopup

const QuestionInputWrapper = styled.div<{}>`
  position: relative;
`

const TextCounter = styled.span<{ color: string }>`
  position: absolute;
  top: 12px;
  right: 12px;
  color: ${(props) => props.color};
  font-weight: 500;
  font-size: 13px;
  line-height: 20px;
`

const OptionsList = styled.div`
  max-height: 240px;
  overflow-y: auto;
  margin-top: 8px;
  padding-right: 6px;
`

const OptionRow = styled.div<{
  isDragging?: boolean
  isDragOver?: boolean
}>`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  cursor: grab;
  border: ${(props) => (props.isDragOver ? '1px dashed #A0A1B0' : '1px solid transparent')};
  border-radius: 6px;
  padding: 4px;
  opacity: ${(props) => (props.isDragging ? 0.6 : 1)};
`

const RemoveOptionIcon = styled(RemoveIcon)<{ color: string; width: string; height: string; disabled: boolean }>`
  cursor: pointer;
  color: ${(props) => props.color};
  width: ${(props) => props.width};
  height: ${(props) => props.height};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
`

const AddOptionButton = styled.button<{ color: string; disabledColor?: string }>`
  margin: 16px 0 0 0;
  background: transparent;
  border: none;
  color: ${(props) => (props.disabled ? props.disabledColor : props.color)};
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  width: 100%;
  text-align: left;
  padding-left: 32px;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
`

const Settings = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
`

const SettingItem = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${(props) => props.color};
`
