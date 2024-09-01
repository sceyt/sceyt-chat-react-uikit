import React, { useEffect } from 'react'
import styled from 'styled-components'
import { ReactComponent as ItalicIcon } from '../../../assets/svg/italic.svg'
import { ReactComponent as StrikethroughIcon } from '../../../assets/svg/strikethrough.svg'
import { ReactComponent as MonoIcon } from '../../../assets/svg/mono.svg'
import { ReactComponent as BoldIcon } from '../../../assets/svg/bold.svg'
import { colors, THEME_COLOR_NAMES } from '../../../UIHelper/constants'
import { ItemNote } from '../../../UIHelper'
import { THEME } from '../../../helpers/constants'
import { useColor } from '../../../hooks'

export default function TextFormat({
  handleFormatToBold,
  handleFormatToItalic,
  handleFormatToStrikethrough,
  handleFormatToMonospace,
  handleClosePopup,
  isBoldText,
  isItalicText,
  isStrikethroughText,
  isMonospaceText,
  // isUnderlineText,
  top,
  bottom,
  right,
  left,
  theme,
  editorProps
}: {
  top?: string
  bottom?: string
  right?: string
  left?: string
  isBoldText?: boolean
  isItalicText?: boolean
  isStrikethroughText?: boolean
  isMonospaceText?: boolean
  isUnderlineText?: boolean
  // eslint-disable-next-line no-unused-vars
  handleFormatToBold?: (props?: any) => void
  // eslint-disable-next-line no-unused-vars
  handleFormatToItalic?: (props?: any) => void
  // eslint-disable-next-line no-unused-vars
  handleFormatToStrikethrough?: (props?: any) => void
  // eslint-disable-next-line no-unused-vars
  handleFormatToMonospace?: (props?: any) => void
  // eslint-disable-next-line no-unused-vars
  handleClosePopup?: () => void
  theme?: string
  editorProps: any
}) {
  const textPrimary = useColor(THEME_COLOR_NAMES.TEXT_PRIMARY)
  const textSecondary = useColor(THEME_COLOR_NAMES.TEXT_SECONDARY)
  const textFootnote = useColor(THEME_COLOR_NAMES.TEXT_FOOTNOTE)
  const ref: any = React.useRef(null)
  // const [reactionIsOpen, setReactionIsOpen] = useState(false)
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (handleClosePopup && ref.current && !ref.current.contains(event.target)) {
        handleClosePopup()
      }
    }
    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener('mousedown', handleClickOutside)
    }
  })
  return (
    <MessageActionsWrapper ref={ref} top={top} left={left} bottom={bottom} right={right}>
      <EditMessageContainer
        backgroundColor={theme === THEME.DARK ? colors.backgroundColor : colors.white}
        className='message_actions_cont '
      >
        {handleFormatToBold && (
          <Action
            order={0}
            iconColor={theme === THEME.DARK ? textFootnote : textSecondary}
            hoverBackgroundColor={colors.hoverBackgroundColor}
            hoverIconColor={colors.primary}
            onClick={() => handleFormatToBold(editorProps)}
            isActive={isBoldText}
          >
            <ItemNote disabledColor={textSecondary} bgColor={textPrimary} direction='top'>
              Bold
            </ItemNote>
            <BoldIcon />
          </Action>
        )}
        {handleFormatToItalic && (
          <Action
            order={1}
            iconColor={theme === THEME.DARK ? textFootnote : textSecondary}
            hoverBackgroundColor={colors.hoverBackgroundColor}
            hoverIconColor={colors.primary}
            onClick={() => handleFormatToItalic(editorProps)}
            isActive={isItalicText}
          >
            <ItemNote disabledColor={textSecondary} bgColor={textPrimary} direction='top'>
              Italic
            </ItemNote>
            <ItalicIcon />
          </Action>
        )}
        {handleFormatToStrikethrough && (
          <Action
            order={2}
            iconColor={theme === THEME.DARK ? textFootnote : textSecondary}
            hoverBackgroundColor={colors.hoverBackgroundColor}
            hoverIconColor={colors.primary}
            onClick={() => handleFormatToStrikethrough(editorProps)}
            isActive={isStrikethroughText}
          >
            <ItemNote disabledColor={textSecondary} bgColor={textPrimary} direction='top'>
              {' '}
              Strikethrough{' '}
            </ItemNote>
            <StrikethroughIcon />
          </Action>
        )}
        {handleFormatToMonospace && (
          <React.Fragment>
            <Action
              order={3}
              iconColor={theme === THEME.DARK ? textFootnote : textSecondary}
              hoverBackgroundColor={colors.hoverBackgroundColor}
              hoverIconColor={colors.primary}
              onClick={() => handleFormatToMonospace(editorProps)}
              isActive={isMonospaceText}
            >
              <ItemNote disabledColor={textSecondary} bgColor={textPrimary} direction='top'>
                Monospace
              </ItemNote>
              <MonoIcon />
            </Action>
          </React.Fragment>
        )}
      </EditMessageContainer>
    </MessageActionsWrapper>
  )
}

const MessageActionsWrapper = styled.div<{ left?: string; right?: string; top?: string; bottom?: string }>`
  position: ${(props) => (props.left || props.right || props.top || props.bottom) && 'fixed'};
  left: ${(props) => props.left || 0};
  right: ${(props) => props.right};
  top: ${(props) => props.top || 0};
  bottom: ${(props) => props.bottom};
  padding: 0 0 8px;
  z-index: 200;
`
const EditMessageContainer = styled.div<{ backgroundColor?: string; rtlDirection?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  direction: ${(props) => props.rtlDirection && 'initial'};
  background-color: ${(props) => props.backgroundColor};
  box-sizing: border-box;
  border-radius: 12px;
  box-shadow:
    0 0 2px rgba(17, 21, 57, 0.08),
    0 0 24px rgba(17, 21, 57, 0.16);
  //opacity: 0;
  //visibility: hidden;
  transition: all 0.2s;
  z-index: 100;
`

const Action = styled.div<{
  iconColor: string
  order?: number
  hoverIconColor?: string
  hoverBackgroundColor?: string
  isActive?: boolean
}>`
  position: relative;
  display: flex;
  padding: 4px;
  margin: 8px 6px;
  cursor: pointer;
  transition: all 0.2s;
  order: ${(props) => props.order || 1};
  color: ${(props) => props.iconColor};
  border-radius: 50%;
  ${(props) =>
    props.isActive &&
    `
    color: ${props.hoverIconColor || colors.primary};
    background-color: ${props.hoverBackgroundColor || colors.backgroundColor};
  `}
  &:first-child {
    margin-left: 8px;
  }

  &:last-child {
    margin-right: 8px;
  }

  &:hover {
    color: ${(props) => props.hoverIconColor || colors.primary};
    background-color: ${(props) => props.hoverBackgroundColor || colors.backgroundColor};

    ${ItemNote} {
      display: block;
    }
  }
`
