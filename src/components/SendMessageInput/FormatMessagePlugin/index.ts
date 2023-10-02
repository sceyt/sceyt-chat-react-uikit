import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createOffsetView } from '@lexical/offset'
import { $getRoot, LexicalEditor } from 'lexical'

import { useDidUpdate } from '../../../hooks'
import { bodyAttributesMapByType } from '../../../helpers/message'
import { IMessage } from '../../../types'

function useFormatMessage(
  editor: LexicalEditor,
  editorState: any,
  setMessageBodyAttributes: (data: any) => void,
  setMessageText: (newMessageText: string) => void,
  messageToEdit?: IMessage
): void {
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
              parsedEditorState.root.children[0].children[0].type === 'mention'))
        ) {
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
                      offset: attIndex,
                      length
                    })
                  })
                } else {
                  messageBodyAttributes.push({
                    type: attributeTypes[0],
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
