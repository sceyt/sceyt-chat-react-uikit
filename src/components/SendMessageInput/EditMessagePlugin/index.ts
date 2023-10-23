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
  // eslint-disable-next-line no-unused-vars
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
          const bodyAttributes = JSON.parse(JSON.stringify(editMessage.bodyAttributes))
          const modifiedAttributes: IBodyAttribute[] = []
          bodyAttributes
            .sort((a: any, b: any) => a.offset - b.offset)
            .forEach((attribute: IBodyAttribute, index: number) => {
              if (attribute.type === 'mention') {
                const prevAttribute = bodyAttributes[index - 1]
                if (prevAttribute && attribute.offset < prevAttribute.offset + prevAttribute.length) {
                  modifiedAttributes.pop()
                  const modifiedAttribute = {
                    ...prevAttribute,
                    offset: prevAttribute.offset,
                    length: attribute.offset - prevAttribute.offset
                  }
                  modifiedAttributes.push(modifiedAttribute)
                  modifiedAttributes.push(attribute)
                  modifiedAttributes.push({ ...attribute, type: modifiedAttribute.type, metadata: '' })
                  const modifiedNextAttribute = {
                    ...prevAttribute,
                    offset: attribute.offset + attribute.length,
                    length: prevAttribute.offset + prevAttribute.length - (attribute.offset + attribute.length)
                  }
                  modifiedAttributes.push(modifiedNextAttribute)
                } else {
                  modifiedAttributes.push(attribute)
                }
              } else {
                modifiedAttributes.push(attribute)
              }
            })
          const combinedAttributes = combineMessageAttributes(modifiedAttributes)
          combinedAttributes.forEach((attribute: IBodyAttribute, index) => {
            const attributeOffset = attribute.offset
            const firstPart = `${textPart ? textPart?.substring(nextPartIndex || 0, attributeOffset) : ''}`
            const secondPart = `${textPart ? textPart?.substring(attributeOffset + attribute.length) : ''}`

            nextPartIndex = attribute.offset + attribute.length
            if (attribute.type.includes('mention')) {
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
                if (attribute.type.length > 7) {
                  const typeArray = attribute.type.split(' ').filter((type) => type !== 'mention')
                  // const styleNumber = 0
                  typeArray.forEach((type: any) => {
                    /* mentionNode.setStyle(
                      type === 'monospace'
                        ? 'letter-spacing: 4px'
                        : type === 'strikethrough'
                        ? 'text-decoration: line-through'
                        : ''
                    ) */
                    const format = type === 'monospace' ? 'code' : type
                    mentionNode.toggleFormat(format)
                  })
                  /*  const attTypes = attribute.type.replace('mention', '').trim()
                  for (const style in bodyAttributesMapByType) {
                    const stylesStr = bodyAttributesMapByType[style].join(' ')
                    if (stylesStr === attTypes) {
                      styleNumber = Number(style)
                    }
                  } */
                  // console.log('styleNumber >>>>>>>>>>>>> ', styleNumber)
                  // mentionNode.setFormat(styleNumber)
                }
                // const typeArray = attribute.type.split(' ').reverse()
                paragraphNode.append(mentionNode)
              }
            } else {
              if (
                combinedAttributes[index + 1] &&
                combinedAttributes[index + 1].type.includes('mention') &&
                combinedAttributes[index + 1].offset < attributeOffset + attribute.length
              ) {
                return
              }
              if (firstPart) {
                paragraphNode.append($createTextNode(firstPart))
              }
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
          })
          rootNode.append(paragraphNode)
          rootNode.selectEnd()
        } else {
          paragraphNode.append($createTextNode(editMessage.body))
          rootNode.append(paragraphNode)
        }
      })
    }
  }, [editMessage])

  return null
}
