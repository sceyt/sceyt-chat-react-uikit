import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createOffsetView } from '@lexical/offset'
import {
  $createTextNode,
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
import { bodyAttributesMapByType, makeUsername } from '../../../helpers/message'
import { IMessage, IMember } from '../../../types'
import { useCallback, useEffect } from 'react'
import { $createMentionNode, $isMentionNode } from '../MentionNode'
import { getSelectedNode, mergeRegister } from '../FloatingTextFormatToolbarPlugin'

function useFormatMessage(
  editor: LexicalEditor,
  editorState: any,
  // eslint-disable-next-line no-unused-vars
  setMessageBodyAttributes: (data: any) => void,
  // eslint-disable-next-line no-unused-vars
  setMessageText: (newMessageText: string) => void,
  setMentionedMember: (mentionedMember: any) => void,
  messageToEdit?: IMessage,
  activeChannelMembers: IMember[] = [],
  contactsMap: any = {},
  getFromContacts: boolean = false
): void {
  const processMentionsInPastedText = useCallback(
    (
      pastedText: string,
      activeChannelMembers: IMember[],
      contactsMap: any,
      getFromContacts: boolean,
      setMentionedMember: (mentionedMember: any) => void,
      selection: RangeSelection
    ): void => {
      if (!pastedText) return

      // Build contacts list - include contactsMap values if getFromContacts is true
      const contacts = [...activeChannelMembers]
      const mentionPatterns: Array<{ pattern: string; contact: any }> = []
      contacts.forEach((contactOrMember: any) => {
        const contactFromMap = contactsMap[contactOrMember.id]

        const contact = getFromContacts && contactFromMap ? contactFromMap : undefined
        const member = contact ? undefined : contactOrMember

        const fullDisplayName = makeUsername(contact, member, getFromContacts, false)

        if (fullDisplayName && fullDisplayName !== 'Deleted user') {
          mentionPatterns.push({
            pattern: `@${fullDisplayName}`,
            contact: contactOrMember
          })
        }
      })

      mentionPatterns.sort((a, b) => b.pattern.length - a.pattern.length)

      // Find all mention matches in the pasted text
      const matches: Array<{ start: number; end: number; contact: any; pattern: string }> = []
      const usedRanges: Array<{ start: number; end: number }> = []

      mentionPatterns.forEach(({ pattern, contact }) => {
        let searchIndex = 0
        while (true) {
          const index = pastedText.indexOf(pattern, searchIndex)
          if (index === -1) break

          const isOverlapping = usedRanges.some((range) => index < range.end && index + pattern.length > range.start)

          if (!isOverlapping) {
            const charBefore = index > 0 ? pastedText[index - 1] : undefined
            const isValidStart =
              charBefore === undefined || charBefore === ' ' || charBefore === '\n' || charBefore === '\r'

            const charAfter = pastedText[index + pattern.length]
            const isValidEnd = charAfter === undefined || charAfter === ' ' || charAfter === '\n' || charAfter === '\r'

            if (isValidStart && isValidEnd) {
              matches.push({ start: index, end: index + pattern.length, contact, pattern })
              usedRanges.push({ start: index, end: index + pattern.length })
            }
          }
          searchIndex = index + 1
        }
      })

      // Sort matches by start position (ascending for left-to-right processing)
      matches.sort((a, b) => a.start - b.start)

      // Build nodes from the pasted text with mentions converted
      const nodes: any[] = []
      let currentIndex = 0

      matches.forEach(({ start, end, contact, pattern }) => {
        // Add text before the mention
        if (start > currentIndex) {
          const textBefore = pastedText.substring(currentIndex, start)
          if (textBefore) {
            nodes.push($createTextNode(textBefore))
          }
        }

        // Add mention node
        setMentionedMember(contact)
        const mentionNode = $createMentionNode({ ...contact, name: pattern })
        nodes.push(mentionNode)

        currentIndex = end
      })

      // Add remaining text after the last mention
      if (currentIndex < pastedText.length) {
        const remainingText = pastedText.substring(currentIndex)
        if (remainingText) {
          nodes.push($createTextNode(remainingText))
        }
      }

      // Insert all nodes at the selection, replacing any selected content
      if (matches.length === 0) {
        // For plain text without mentions, use insertText which properly replaces selection
        selection.insertText(pastedText)
      } else if (nodes.length > 0) {
        // For text with mentions, use insertNodes
        selection.insertNodes(nodes)
      }
    },
    [activeChannelMembers, contactsMap, getFromContacts, setMentionedMember]
  )

  const handlePast = useCallback(
    (e: ClipboardEvent | KeyboardEvent | InputEvent) => {
      // Only process mentions on paste events (which have clipboardData)
      if (!('clipboardData' in e) || !e.clipboardData) {
        return false
      }
      const pastedText = e.clipboardData.getData('text/plain')
      if (pastedText) {
        // Process paste and mentions in a single update to create one undo step
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            // Process mentions only in the pasted text and insert the processed content
            processMentionsInPastedText(
              pastedText,
              activeChannelMembers,
              contactsMap,
              getFromContacts,
              setMentionedMember,
              selection
            )
          }
        })
      }
      return true
    },
    [editor, contactsMap, setMentionedMember, getFromContacts, activeChannelMembers, processMentionsInPastedText]
  )

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault()
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const node = getSelectedNode(selection)
          if ($isMentionNode(node)) {
            const parent = node.getParent()
            if (parent) {
              const space = $createTextNode(' ')
              node.replace(space)
              space.select() // Move the selection to the new space node
            } else {
              node.remove()
            }
          }
        }
      })
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
  }, [editor, handlePast, onDelete])
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
  setMentionedMember,
  messageToEdit,
  activeChannelMembers,
  contactsMap,
  getFromContacts
}: {
  editorState: any
  setMessageBodyAttributes: (data: any) => void
  setMessageText: (newMessageText: string) => void
  setMentionedMember: (mentionedMember: any) => void
  messageToEdit?: IMessage
  activeChannelMembers: IMember[]
  contactsMap: any
  getFromContacts: boolean
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext()
  useFormatMessage(
    editor,
    editorState,
    setMessageBodyAttributes,
    setMessageText,
    setMentionedMember,
    messageToEdit,
    activeChannelMembers,
    contactsMap,
    getFromContacts
  )
  return null
}
