import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ReactComponent as BoldIcon } from '../../../assets/svg/bold.svg'
import { ReactComponent as ItalicIcon } from '../../../assets/svg/italic.svg'
import { ReactComponent as StrikethroughIcon } from '../../../assets/svg/strikethrough.svg'
import { ReactComponent as MonoIcon } from '../../../assets/svg/mono.svg'
import { ReactComponent as UnderlineIcon } from '../../../assets/svg/underline.svg'
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  ElementNode,
  FORMAT_TEXT_COMMAND,
  LexicalEditor,
  RangeSelection,
  SELECTION_CHANGE_COMMAND,
  TextNode
} from 'lexical'
import { createPortal } from 'react-dom'

import styled from 'styled-components'
import { colors, THEME_COLORS } from '../../../UIHelper/constants'
import { ItemNote } from '../../../UIHelper'
import { useColor, useEventListener } from '../../../hooks'
import { $isMentionNode } from '../MentionNode'
type Func = () => void
export function mergeRegister(...func: Array<Func>): () => void {
  return () => {
    func.forEach((f) => f())
  }
}
export function getDOMRangeRect(nativeSelection: Selection, rootElement: HTMLElement): DOMRect {
  const domRange = nativeSelection.getRangeAt(0)

  let rect

  if (nativeSelection.anchorNode === rootElement) {
    let inner = rootElement
    while (inner.firstElementChild != null) {
      inner = inner.firstElementChild as HTMLElement
    }
    rect = inner.getBoundingClientRect()
  } else {
    rect = domRange.getBoundingClientRect()
  }

  return rect
}
const VERTICAL_GAP = 10
const HORIZONTAL_OFFSET = 40

function setFloatingElemPosition(
  targetRect: DOMRect | null,
  floatingElem: HTMLElement,
  anchorElem: HTMLElement,
  verticalGap: number = VERTICAL_GAP,
  horizontalOffset: number = HORIZONTAL_OFFSET
): void {
  const scrollerElem = anchorElem.parentElement

  if (targetRect === null || !scrollerElem) {
    floatingElem.style.opacity = '0'
    floatingElem.style.transform = 'translate(-10000px, -10000px)'
    return
  }

  const floatingElemRect = floatingElem.getBoundingClientRect()
  const anchorElementRect = anchorElem.getBoundingClientRect()
  const top = floatingElemRect.height - targetRect.height + verticalGap
  const menuWidthHalf = floatingElemRect.width / 2
  const selectionWidthHalf = targetRect.width / 2
  const left = targetRect.left - anchorElementRect.left + horizontalOffset - menuWidthHalf + selectionWidthHalf

  floatingElem.style.opacity = '1'
  floatingElem.style.transform = `translate(${left}px, ${-top}px)`
}

export function getSelectedNode(selection: RangeSelection): TextNode | ElementNode {
  const anchor = selection.anchor
  const focus = selection.focus
  const anchorNode = selection.anchor.getNode()
  const focusNode = selection.focus.getNode()
  if (anchorNode === focusNode) {
    return anchorNode
  }
  const isBackward = selection.isBackward()
  if (isBackward) {
    return focus ? anchorNode : focusNode
  } else {
    return anchor ? anchorNode : focusNode
  }
}

function TextFormatFloatingToolbar({
  editor,
  anchorElem,
  isBold,
  isItalic,
  isUnderline,
  isCode,
  isStrikethrough,
  setShowMenu,
  showMenu
}: {
  editor: LexicalEditor
  anchorElem: HTMLElement
  isBold: boolean
  isCode: boolean
  isItalic: boolean
  isStrikethrough: boolean
  isSubscript: boolean
  isSuperscript: boolean
  isUnderline: boolean
  // eslint-disable-next-line no-unused-vars
  setShowMenu: (showMenu: boolean) => void
  showMenu: boolean
}): JSX.Element {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_2]: surface2,
    [THEME_COLORS.SECTION_BACKGROUND]: backgroundSections,
    [THEME_COLORS.SURFACE_1]: surface1
  } = useColor()

  const popupCharStylesEditorRef = useRef<HTMLDivElement | null>(null)
  function mouseMoveListener(e: MouseEvent) {
    if (popupCharStylesEditorRef?.current && (e.buttons === 1 || e.buttons === 3)) {
      if (popupCharStylesEditorRef.current.style.pointerEvents !== 'none') {
        const x = e.clientX
        const y = e.clientY
        const elementUnderMouse = document.elementFromPoint(x, y)

        if (!popupCharStylesEditorRef.current.contains(elementUnderMouse)) {
          // Mouse is not over the target element => not a normal click, but probably a drag
          popupCharStylesEditorRef.current.style.pointerEvents = 'none'
        }
      }
    }
  }

  function mouseUpListener() {
    if (popupCharStylesEditorRef?.current) {
      if (popupCharStylesEditorRef.current.style.pointerEvents !== 'auto') {
        popupCharStylesEditorRef.current.style.pointerEvents = 'auto'
      }
    }
  }

  // @ts-ignore
  useEffect(() => {
    if (popupCharStylesEditorRef?.current) {
      document.addEventListener('mousemove', mouseMoveListener)
      document.addEventListener('mouseup', mouseUpListener)

      return () => {
        document.removeEventListener('mousemove', mouseMoveListener)
        document.removeEventListener('mouseup', mouseUpListener)
      }
    }
  }, [popupCharStylesEditorRef])

  const updateTextFormatFloatingToolbar = useCallback(() => {
    const selection = $getSelection()
    const popupCharStylesEditorElem = popupCharStylesEditorRef.current
    const nativeSelection = window.getSelection()
    if (popupCharStylesEditorElem === null) {
      return
    }

    const rootElement = editor.getRootElement()
    if (
      selection !== null &&
      nativeSelection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      setShowMenu(true)
      const rangeRect = getDOMRangeRect(nativeSelection, rootElement)

      setFloatingElemPosition(rangeRect, popupCharStylesEditorElem, anchorElem)
    }
  }, [editor, anchorElem])

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement
    const update = () => {
      editor.getEditorState().read(() => {
        updateTextFormatFloatingToolbar()
      })
    }

    window.addEventListener('resize', update)
    if (scrollerElem) {
      scrollerElem.addEventListener('scroll', update)
    }

    return () => {
      window.removeEventListener('resize', update)
      setShowMenu(false)
      if (scrollerElem) {
        scrollerElem.removeEventListener('scroll', update)
      }
    }
  }, [editor, updateTextFormatFloatingToolbar, anchorElem])

  useEffect(() => {
    editor.getEditorState().read(() => {
      updateTextFormatFloatingToolbar()
    })
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateTextFormatFloatingToolbar()
        })
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateTextFormatFloatingToolbar()
          return false
        },
        COMMAND_PRIORITY_LOW
      )
    )
  }, [editor, updateTextFormatFloatingToolbar])

  return (
    <FloatingTextFormatPopup
      showMenu={showMenu}
      ref={popupCharStylesEditorRef}
      className='floating-text-format-popup'
      popupColor={backgroundSections}
    >
      {editor.isEditable() && (
        <React.Fragment>
          <Action
            type='button'
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
            }}
            aria-label='Format text as bold'
            iconColor={textSecondary}
            hoverBackgroundColor={surface1}
            hoverIconColor={accentColor}
            isActive={isBold}
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              Bold
            </ItemNote>
            <BoldIcon />
          </Action>

          <Action
            iconColor={textSecondary}
            hoverBackgroundColor={surface1}
            hoverIconColor={accentColor}
            isActive={isItalic}
            type='button'
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
            }}
            aria-label='Format text as italics'
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              Italic
            </ItemNote>
            <ItalicIcon />
          </Action>
          <Action
            iconColor={textSecondary}
            hoverBackgroundColor={surface1}
            hoverIconColor={accentColor}
            isActive={isStrikethrough}
            type='button'
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
            }}
            aria-label='Format text with a strikethrough'
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              {' '}
              Strikethrough{' '}
            </ItemNote>
            <StrikethroughIcon />
          </Action>
          <Action
            type='button'
            iconColor={textSecondary}
            hoverBackgroundColor={surface1}
            hoverIconColor={accentColor}
            isActive={isCode}
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
            }}
            aria-label='Insert code block'
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              Monospace
            </ItemNote>
            <MonoIcon />
          </Action>
          <Action
            type='button'
            iconColor={textSecondary}
            hoverBackgroundColor={surface1}
            hoverIconColor={accentColor}
            isActive={isUnderline}
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')
            }}
            aria-label='Insert code block'
          >
            <ItemNote disabledColor={textSecondary} bgColor={surface2} direction='top'>
              Underline
            </ItemNote>
            <UnderlineIcon />
          </Action>
        </React.Fragment>
      )}
    </FloatingTextFormatPopup>
  )
}

function useFloatingTextFormatToolbar(editor: LexicalEditor, anchorElem: HTMLElement): JSX.Element | null {
  const [isText, setIsText] = useState(false)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isSubscript, setIsSubscript] = useState(false)
  const [isSuperscript, setIsSuperscript] = useState(false)
  const [isCode, setIsCode] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const handleClick = (e: any) => {
    if (!e.target.closest('.rich_text_editor')) {
      setIsText(false)
    }
  }

  const updatePopup = useCallback(() => {
    editor.getEditorState().read(() => {
      // Should not to pop up the floating toolbar when using IME input
      if (editor.isComposing()) {
        return
      }
      const selection = $getSelection()
      const nativeSelection = window.getSelection()
      const rootElement = editor.getRootElement()

      if (
        nativeSelection !== null &&
        (!$isRangeSelection(selection) || rootElement === null || !rootElement.contains(nativeSelection.anchorNode))
      ) {
        setIsText(false)
        return
      }

      if (!$isRangeSelection(selection)) {
        return
      }

      const node = getSelectedNode(selection)
      if ($isMentionNode(node)) {
        const nextSibling = node.getNextSibling()
        if (!nextSibling) {
          editor.update(() => {
            const appendedNode = node.insertAfter($createTextNode(' '))
            appendedNode.selectStart()
          })
        }
      }
      // const textContent = node.getTextContent()
      // const lastChar = textContent.slice(-1)
      // Update text format
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))
      setIsStrikethrough(selection.hasFormat('strikethrough'))
      setIsSubscript(selection.hasFormat('subscript'))
      setIsSuperscript(selection.hasFormat('superscript'))
      setIsCode(selection.hasFormat('code'))

      if (/*! $isCodeHighlightNode(selection.anchor.getNode()) && */ selection.getTextContent() !== '') {
        setIsText($isTextNode(node))
      } else {
        setIsText(false)
      }

      const rawTextContent = selection.getTextContent().replace(/\n/g, '')
      if (!selection.isCollapsed() && rawTextContent === '') {
        setIsText(false)
      }
    })
  }, [editor, showMenu])

  useEventListener('click', handleClick)
  useEffect(() => {
    document.addEventListener('selectionchange', updatePopup)
    return () => {
      document.removeEventListener('selectionchange', updatePopup)
    }
  }, [updatePopup])

  useEffect(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection()

      if (!$isRangeSelection(selection)) {
        return
      }
      if (!showMenu && !selection.getTextContent()) {
        if (selection.hasFormat('bold')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
        }
        if (selection.hasFormat('italic')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
        }
        if (selection.hasFormat('underline')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')
        }
        if (selection.hasFormat('strikethrough')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
        }
        if (selection.hasFormat('subscript')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')
        }
        if (selection.hasFormat('superscript')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')
        }
        if (selection.hasFormat('code')) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
        }
      }
    })
  }, [showMenu])
  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        updatePopup()
      }),
      editor.registerRootListener(() => {
        if (editor.getRootElement() === null) {
          setIsText(false)
        }
      })
    )
  }, [editor, updatePopup])

  if (!isText) {
    return null
  }

  return createPortal(
    <TextFormatFloatingToolbar
      editor={editor}
      anchorElem={anchorElem}
      isBold={isBold}
      isItalic={isItalic}
      isStrikethrough={isStrikethrough}
      isSubscript={isSubscript}
      isSuperscript={isSuperscript}
      isUnderline={isUnderline}
      isCode={isCode}
      setShowMenu={setShowMenu}
      showMenu={showMenu}
    />,
    anchorElem
  )
}

export default function FloatingTextFormatToolbarPlugin({
  anchorElem = document.body
}: {
  anchorElem?: HTMLElement
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext()
  return useFloatingTextFormatToolbar(editor, anchorElem)
}

const FloatingTextFormatPopup = styled.div<{ showMenu?: boolean; popupColor?: string }>`
  display: flex;
  background: ${(props) => props.popupColor};
  vertical-align: middle;
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  transition: opacity 0.5s;
  padding: 12px;
  will-change: transform;
  z-index: 99;

  & button.popup-item {
    border: 0;
    display: flex;
    background: none;
    border-radius: 10px;
    padding: 8px;
    cursor: pointer;
    vertical-align: middle;
  }
  & button.popup-item:disabled {
    cursor: not-allowed;
  }
  & button.popup-item.spaced {
    margin-right: 2px;
  }
  & button.popup-item i.format {
    background-size: contain;
    height: 18px;
    width: 18px;
    margin-top: 2px;
    vertical-align: -0.25em;
    display: flex;
    opacity: 0.6;
  }

  & button.popup-item:disabled i.format {
    opacity: 0.2;
  }
  & button.popup-item.active {
    background-color: rgba(223, 232, 250, 0.3);
  }
  & button.popup-item.active i {
    opacity: 1;
  }
  & .popup-item:hover:not([disabled]) {
    background-color: #eee;
  }
  & select.popup-item {
    border: 0;
    display: flex;
    background: none;
    border-radius: 10px;
    padding: 8px;
    vertical-align: middle;
    -webkit-appearance: none;
    -moz-appearance: none;
    width: 70px;
    font-size: 14px;
    color: #777;
    text-overflow: ellipsis;
  }
  & select.code-language {
    text-transform: capitalize;
    width: 130px;
  }

  & .popup-item .text {
    display: flex;
    line-height: 20px;
    vertical-align: middle;
    font-size: 14px;
    color: #777;
    text-overflow: ellipsis;
    width: 70px;
    overflow: hidden;
    height: 20px;
    text-align: left;
  }

  & .popup-item .icon {
    display: flex;
    width: 20px;
    height: 20px;
    user-select: none;
    margin-right: 8px;
    line-height: 16px;
    background-size: contain;
  }
  & i.chevron-down {
    margin-top: 3px;
    width: 16px;
    height: 16px;
    display: flex;
    user-select: none;
  }
  & i.chevron-down.inside {
    width: 16px;
    height: 16px;
    display: flex;
    margin-left: -25px;
    margin-top: 11px;
    margin-right: 10px;
    pointer-events: none;
  }
  & .divider {
    width: 1px;
    background-color: #eee;
    margin: 0 4px;
  }
  @media (max-width: 1024px) {
    & button.insert-comment {
      display: none;
    }
  }
`
const Action = styled.button<{
  color?: string
  iconColor: string
  order?: number
  hoverIconColor?: string
  hoverBackgroundColor: string
  isActive?: boolean
}>`
  border: 0;
  display: flex;
  background-color: inherit;
  vertical-align: middle;
  position: relative;
  padding: 3px;
  margin-right: 10px;
  //margin: 8px 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: ${(props) => props.iconColor};
  border-radius: 50%;
  ${(props) =>
    props.isActive &&
    `
    color: ${props.hoverIconColor || colors.primary};
    background-color: ${props.hoverBackgroundColor};
  `}

  &:last-child {
    margin-right: 0;
  }

  &:hover {
    color: ${(props) => props.hoverIconColor || colors.primary};
    background-color: ${(props) => props.hoverBackgroundColor};

    ${ItemNote} {
      display: block;
    }
  }
`
