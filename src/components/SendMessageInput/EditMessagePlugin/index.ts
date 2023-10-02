import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { useDidUpdate } from '../../../hooks'
import { IBodyAttribute, IMessage } from '../../../types'
import { $createMentionNode } from '../MentionNode'
import { MentionTypeaheadOption } from '../MentionsPlugin'
import { combineMessageAttributes, makeUsername } from '../../../helpers/message'

export default function EditMessagePlugin({
  editMessage,
  contactsMap,
  getFromContacts,
  setMentionedMember
}: {
  editMessage: IMessage
  contactsMap: any
  getFromContacts: boolean
  setMentionedMember: (mentionedMember: any) => void
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext()
  useDidUpdate(() => {
    if (editMessage) {
      if (editMessage.mentionedUsers && editMessage.mentionedUsers.length) {
        setMentionedMember(editMessage.mentionedUsers)
      }
      editor.update(() => {
        const rootNode = $getRoot()
        $getRoot().clear()
        const paragraphNode = $createParagraphNode()
        const textPart = editMessage.body
        let nextPartIndex: any
        if (editMessage.bodyAttributes && editMessage.bodyAttributes.length) {
          const combinedAttributes = combineMessageAttributes(editMessage.bodyAttributes)
          combinedAttributes.forEach((attribute: IBodyAttribute, index) => {
            const attributeOffset = attribute.offset
            const firstPart = `${textPart ? textPart?.substring(nextPartIndex || 0, attributeOffset) : ''}`
            const secondPart = `${textPart ? textPart?.substring(attributeOffset + attribute.length) : ''}`

            nextPartIndex = attribute.offset + attribute.length
            if (attribute.type === 'mention') {
              const mentionUser = editMessage.mentionedUsers.find((mention) => mention.id === attribute.metadata)
              if (mentionUser) {
                const userDisplayName = makeUsername(contactsMap[mentionUser.id], mentionUser, getFromContacts)
                const mentionNodeParams = new MentionTypeaheadOption(
                  `@${userDisplayName}`,
                  mentionUser.id || '',
                  mentionUser.presence,
                  mentionUser.avatarUrl || ''
                )
                const mentionNode = $createMentionNode(mentionNodeParams)
                // mentionNode.setMetadata(attribute.metadata)
                if (firstPart) {
                  paragraphNode.append($createTextNode(firstPart))
                }
                paragraphNode.append(mentionNode)
              }
            } else {
              if (firstPart) {
                paragraphNode.append($createTextNode(firstPart))
              }
              console.log('attribute. . . ..  ', attribute)
              const textNode = $createTextNode(textPart.slice(attributeOffset, attributeOffset + attribute.length))
              switch (attribute.type) {
                case 'bold': {
                  textNode.toggleFormat('bold')
                  break
                }
                case 'italic': {
                  textNode.toggleFormat('italic')
                  break
                }
                case 'strikethrough': {
                  textNode.toggleFormat('strikethrough')
                  break
                }
                case 'monospace': {
                  textNode.toggleFormat('code')
                  break
                }
                case 'underline': {
                  textNode.toggleFormat('underline')
                  break
                }

                default: {
                  const typeArray = attribute.type.split(' ')
                  if (typeArray.length > 1) {
                    typeArray.forEach((type) => {
                      textNode.toggleFormat((type === 'monospace' ? 'code' : type) as any)
                    })
                  }
                }
              }

              paragraphNode.append(textNode)
            }
            if (index === combinedAttributes.length - 1) {
              if (secondPart) {
                paragraphNode.append($createTextNode(secondPart))
              } else {
                paragraphNode.append($createTextNode(' '))
              }
            }
            rootNode.append(paragraphNode)
            rootNode.selectEnd()
          })
        } else {
          paragraphNode.append($createTextNode(editMessage.body))
          rootNode.append(paragraphNode)
        }
      })
    }
  }, [editMessage])

  return null
}
