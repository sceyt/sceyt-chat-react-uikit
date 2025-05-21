import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createOffsetView } from '@lexical/offset'
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  LexicalEditor,
  PASTE_COMMAND,
  RangeSelection
} from 'lexical'

import { useDidUpdate } from '../../../hooks'
import { bodyAttributesMapByType } from '../../../helpers/message'
import { IMessage } from '../../../types'
import { useCallback, useEffect } from 'react'
import { $isMentionNode } from '../MentionNode'
import { getSelectedNode, mergeRegister } from '../FloatingTextFormatToolbarPlugin'

function useFormatMessage(
  editor: LexicalEditor,
  editorState: any,
  // eslint-disable-next-line no-unused-vars
  setMessageBodyAttributes: (data: any) => void,
  // eslint-disable-next-line no-unused-vars
  setMessageText: (newMessageText: string) => void,
  messageToEdit?: IMessage
): void {
  function $insertDataTransferForPlainText(dataTransfer: DataTransfer, selection: RangeSelection): void {
    const text = dataTransfer.getData('text/plain') || dataTransfer.getData('text/uri-list')

    if (text != null) {
      selection.insertRawText(text)
    }
  }
  const handlePast = useCallback(
    (e: any) => {
      const pastedTex = e.clipboardData.getData('text/plain')
      if (pastedTex) {
        editor.update(() => {
          const selection = $getSelection()
          const { clipboardData } = event as ClipboardEvent
          if (clipboardData != null && $isRangeSelection(selection)) {
            $insertDataTransferForPlainText(clipboardData, selection)
          }
        })
      }
    },
    [editor]
  )
  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault()
      const selection = $getSelection()
      const node = getSelectedNode(selection as any)
      if ($isMentionNode(node)) {
        node.remove()
      }
      return false
    },
    [editor]
  )
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        PASTE_COMMAND,
        (e) => {
          handlePast(e)
          return true
        },
        COMMAND_PRIORITY_NORMAL
      ),
      editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW)
    )
    // log.info('selectedIndex. .> > >> > . . ', selectedIndex)
    /* editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event !== null) {
          log.info('...>>>> preventDefault ...>>>>>')
          event.preventDefault()
          event.stopImmediatePropagation()
        }
        return true
      },
      COMMAND_PRIORITY_NORMAL
    ) */
  }, [])
  useDidUpdate(() => {
    if (editorState) {
      editorState.read(() => {
        const rootNode = $getRoot()
        const messageText = rootNode.getTextContent()
        const parsedEditorState = editorState.toJSON()
        const offsetView = $createOffsetView(editor)
        const offsetList = Array.from(offsetView._offsetMap.values())
        const messageBodyAttributes: any = []
        if (
          parsedEditorState.root &&
          parsedEditorState.root.children &&
          parsedEditorState.root.children.length &&
          (parsedEditorState.root.children[0].children.length > 1 ||
            (parsedEditorState.root.children[0].children[0] &&
              (parsedEditorState.root.children[0].children[0].type === 'mention' ||
                parsedEditorState.root.children[0].children[0].format > 0)))
        ) {
          /* if (
          parsedEditorState.root &&
          parsedEditorState.root.children &&
          parsedEditorState.root.children.length &&
          (parsedEditorState.root.children[0].children.length > 1 ||
            (parsedEditorState.root.children[0].children[0] &&
              parsedEditorState.root.children[0].children[0].type === 'mention'))
        ) { */
          /*   if (
            parsedEditorState.root.children[0].children.length === 1 &&
            parsedEditorState.root.children[0].children[0].format > 0
          ) {
            return
          } */
          // log.info('parsedEditorState.root.children[0].children >>> ', parsedEditorState.root.children[0].children)
          // log.info('offsetList >>> ', offsetList)
          let currentOffsetDiff = 0
          let newMessageText = messageText
          parsedEditorState.root.children[0].children.forEach((child: any, index: number) => {
            if (child.type === 'mention') {
              const offset = offsetList[index].start
              const length = offsetList[index].end - offsetList[index].start
              const mentionId = `@${child.mentionName}`
              const idLength = mentionId.length
              newMessageText = `${newMessageText.slice(
                0,
                offset + currentOffsetDiff
              )}${mentionId}${newMessageText.slice(offset + currentOffsetDiff + length)}`
              const menIndex = offset + currentOffsetDiff
              currentOffsetDiff += idLength - length
              messageBodyAttributes.push({
                type: 'mention',
                metadata: child.mentionName,
                offset: menIndex,
                length: idLength
              })
              if (child.format) {
                const attributeTypes = bodyAttributesMapByType[child.format]

                if (attributeTypes.length > 1) {
                  attributeTypes.forEach((attributeType: string) => {
                    messageBodyAttributes.push({
                      type: attributeType,
                      metadata: child.metadata || '',
                      offset: menIndex,
                      length
                    })
                  })
                } else {
                  messageBodyAttributes.push({
                    type: attributeTypes[0],
                    metadata: child.metadata || '',
                    offset: menIndex,
                    length
                  })
                }
              }
            } else {
              const attributeTypes = bodyAttributesMapByType[child.format]
              if (attributeTypes) {
                const offset = offsetList[index].start
                const length = offsetList[index].end - offsetList[index].start

                const attIndex = offset + currentOffsetDiff

                if (attributeTypes.length > 1) {
                  attributeTypes.forEach((attributeType: string) => {
                    messageBodyAttributes.push({
                      type: attributeType,
                      metadata: child.metadata || '',
                      offset: attIndex,
                      length
                    })
                  })
                } else {
                  messageBodyAttributes.push({
                    type: attributeTypes[0],
                    metadata: child.metadata || '',
                    offset: attIndex,
                    length
                  })
                }
              }
            }
          })
          if (messageText) {
            setMessageText(newMessageText)
            setMessageBodyAttributes(messageBodyAttributes)
          } else {
            setMessageText(messageToEdit ? messageToEdit.body : '')
          }
        } else {
          setMessageText(messageText)
          setMessageBodyAttributes([])
        }
      })
    }
  }, [editor, editorState])
}

export default function FormatMessagePlugin({
  editorState,
  setMessageBodyAttributes,
  setMessageText,
  messageToEdit
}: any): JSX.Element | null {
  const [editor] = useLexicalComposerContext()
  useFormatMessage(editor, editorState, setMessageBodyAttributes, setMessageText, messageToEdit)
  return null
}
