import type {
  Spread,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedTextNode
} from 'lexical'
import { $applyNodeReplacement, TextNode } from 'lexical'

export type SerializedMentionNode = Spread<
  {
    mentionName: string
  },
  SerializedTextNode
>

function convertMentionElement(domNode: HTMLElement): DOMConversionOutput | null {
  const textContent = domNode.textContent
  if (textContent !== null) {
    const node = $createMentionNode(textContent)
    return {
      node
    }
  }
  return null
}

export class MentionNode extends TextNode {
  __mention: any
  mentionId: string

  static getType(): string {
    return 'mention'
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mention, node.__text, node.__key)
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    const node = $createMentionNode(serializedNode.mentionName)
    node.setTextContent(serializedNode.text)
    node.setFormat(serializedNode.format)
    node.setDetail(serializedNode.detail)
    node.setMode(serializedNode.mode)
    node.setStyle(serializedNode.style)
    return node
  }

  constructor(mention: any, text?: string, key?: NodeKey) {
    super(text ?? mention.name, key)
    this.__mention = mention
    this.mentionId = mention.id
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      mentionName: this.__mention.id,
      type: 'mention',
      version: 1
    }
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    dom.className = 'mention'
    return dom
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span')
    element.setAttribute('data-lexical-mention', 'true')
    element.textContent = this.__text
    return { element }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-lexical-mention')) {
          return null
        }
        return {
          conversion: convertMentionElement,
          priority: 1
        }
      }
    }
  }

  isTextEntity(): true {
    return true
  }

  canInsertTextBefore(): boolean {
    return false
  }

  canInsertTextAfter(): boolean {
    return false
  }
}

export function $createMentionNode(mention: any): MentionNode {
  const mentionNode = new MentionNode(mention, mention.name)
  mentionNode.setMode('segmented').toggleDirectionless()
  return $applyNodeReplacement(mentionNode)
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode
}
