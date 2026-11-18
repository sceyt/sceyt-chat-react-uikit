import React from 'react'
import { render } from '@testing-library/react'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  createEditor,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  PASTE_COMMAND
} from 'lexical'

import { $getHtmlContent } from '@lexical/clipboard'

import FormatMessagePlugin, { serializeFormattedMessage } from './index'
import { $createMentionNode, isMentionTextUnchanged, MentionNode } from '../MentionNode'

const mockUseLexicalComposerContext = jest.fn()

jest.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => mockUseLexicalComposerContext()
}))

jest.mock('../../../hooks', () => ({
  useDidUpdate: jest.fn()
}))

describe('FormatMessagePlugin mention deletion', () => {
  it('keeps an edited mention as the final plain text instead of restoring its ID token', () => {
    const result = serializeFormattedMessage(
      '@KarenTest',
      [
        {
          type: 'mention',
          text: '@KarenTest',
          format: 0,
          mentionName: 'member-1',
          mentionText: '@KarenTestTwo Ch'
        }
      ],
      [{ start: 0, end: '@KarenTest'.length }]
    )

    expect(result).toEqual({ messageText: '@KarenTest', bodyAttributes: [] })
  })

  it('still serializes an untouched mention as an ID token', () => {
    const result = serializeFormattedMessage(
      '@KarenTestTwo Ch',
      [
        {
          type: 'mention',
          text: '@KarenTestTwo Ch',
          format: 0,
          mentionName: 'member-1',
          mentionText: '@KarenTestTwo Ch'
        }
      ],
      [{ start: 0, end: '@KarenTestTwo Ch'.length }]
    )

    expect(result).toEqual({
      messageText: '@member-1',
      bodyAttributes: [{ type: 'mention', metadata: 'member-1', offset: 0, length: '@member-1'.length }]
    })
  })

  it('marks edited mention text as no longer intact', () => {
    expect(isMentionTextUnchanged('@My Phone Number', '@My Phone')).toBe(false)
    expect(isMentionTextUnchanged('@My Phone Number', '@My Phone Number')).toBe(true)
  })

  it('keeps the mention node when the preceding text node is removed', () => {
    const editor = createEditor({
      namespace: 'mention-deletion-test',
      nodes: [MentionNode],
      onError: (error) => {
        throw error
      }
    })
    editor.update(
      () => {
        const root = $getRoot()
        const paragraph = $createParagraphNode()
        const prefix = $createTextNode('a')
        const mention = $createMentionNode({ id: 'member-1', name: '@KarenTestTwo Ch' })

        paragraph.append(prefix, mention)
        root.append(paragraph)
        prefix.remove()
      },
      { discrete: true }
    )

    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('@KarenTestTwo Ch')
      expect($getRoot().getFirstChild()?.getFirstChild()?.getType()).toBe('mention')
    })
  })

  it('does not register a delete handler that can consume deletion before Lexical processes it', () => {
    const unregister = jest.fn()
    const editor = {
      registerCommand: jest.fn(() => unregister)
    }
    mockUseLexicalComposerContext.mockReturnValue([editor])

    render(
      <FormatMessagePlugin
        editorState={null}
        setMessageBodyAttributes={jest.fn()}
        setMessageText={jest.fn()}
        setMentionedMember={jest.fn()}
        activeChannelMembers={[]}
        contactsMap={{}}
        getFromContacts={false}
      />
    )

    expect(editor.registerCommand).toHaveBeenCalledWith(PASTE_COMMAND, expect.any(Function), COMMAND_PRIORITY_NORMAL)
    const registeredCommands = editor.registerCommand.mock.calls.map(([command]) => command)
    expect(registeredCommands).not.toContain(KEY_BACKSPACE_COMMAND)
    expect(registeredCommands).not.toContain(KEY_DELETE_COMMAND)
  })
})

describe('FormatMessagePlugin pasting mentions', () => {
  const anna = { id: 'member-1', firstName: 'Anna', lastName: 'Smith' }

  const newEditor = () =>
    createEditor({
      namespace: 'mention-paste-test',
      nodes: [MentionNode],
      onError: (error) => {
        throw error
      }
    })

  // A composer holding `@Anna Smith` (a mention) followed by `text`.
  const composerWithMention = (text: string, mentionText = '@Anna Smith') => {
    const editor = newEditor()
    editor.update(
      () => {
        const paragraph = $createParagraphNode()
        const mention = $createMentionNode({ id: anna.id, name: '@Anna Smith' })
        mention.setTextContent(mentionText)
        paragraph.append(mention, $createTextNode(text))
        $getRoot().append(paragraph)
      },
      { discrete: true }
    )
    return editor
  }

  // What the browser's clipboard gets when everything in the composer is cut (Lexical's own copy).
  const cutAll = (editor: ReturnType<typeof newEditor>) => {
    const clipboard: { [type: string]: string } = {}
    editor.update(
      () => {
        $getRoot().select(0, $getRoot().getChildrenSize())
        const selection = $getSelection()
        clipboard['text/html'] = $getHtmlContent(editor)
        clipboard['text/plain'] = $isRangeSelection(selection) ? selection.getTextContent() : ''
      },
      { discrete: true }
    )
    return clipboard
  }

  // Pastes into an empty composer of a chat with Anna, through the plugin's paste handler.
  const paste = async (clipboard: { [type: string]: string }) => {
    const editor = newEditor()
    // Lexical has a selection to paste at only in an editor on the page.
    const composer = document.createElement('div')
    composer.contentEditable = 'true'
    document.body.appendChild(composer)
    editor.setRootElement(composer)
    editor.update(
      () => {
        const paragraph = $createParagraphNode()
        $getRoot().append(paragraph)
        paragraph.select()
      },
      { discrete: true }
    )
    mockUseLexicalComposerContext.mockReturnValue([editor])
    render(
      <FormatMessagePlugin
        editorState={null}
        setMessageBodyAttributes={jest.fn()}
        setMessageText={jest.fn()}
        setMentionedMember={jest.fn()}
        activeChannelMembers={[anna as any]}
        contactsMap={{}}
        getFromContacts={false}
      />
    )
    editor.dispatchCommand(PASTE_COMMAND, {
      clipboardData: { getData: (type: string) => clipboard[type] || '' }
    } as any)
    // Lexical commits the paste's update on a later tick.
    await new Promise((resolve) => setTimeout(resolve, 0))

    const pasted = editor.getEditorState().read(() =>
      ($getRoot().getFirstChild() as any).getChildren().map((node: any) => ({
        type: node.getType(),
        text: node.getTextContent(),
        ...(node.getType() === 'mention' ? { member: node.mentionId } : {})
      }))
    )
    editor.setRootElement(null)
    composer.remove()
    return pasted
  }

  it('keeps a mention followed by a symbol when it is cut and pasted back', async () => {
    const pasted = await paste(cutAll(composerWithMention('!')))

    expect(pasted).toEqual([
      { type: 'mention', text: '@Anna Smith', member: 'member-1' },
      { type: 'text', text: '!' }
    ])
  })

  it('pastes an edited mention as plain text', async () => {
    const pasted = await paste(cutAll(composerWithMention('!', '@Anna Smi')))

    expect(pasted).toEqual([{ type: 'text', text: '@Anna Smi!' }])
  })

  it('recognizes a mention followed by punctuation in pasted plain text', async () => {
    const pasted = await paste({ 'text/plain': '@Anna Smith, hi' })

    expect(pasted).toEqual([
      { type: 'mention', text: '@Anna Smith', member: 'member-1' },
      { type: 'text', text: ', hi' }
    ])
  })

  it('does not take a longer name in pasted plain text for a mention', async () => {
    const pasted = await paste({ 'text/plain': '@Anna Smithson' })

    expect(pasted).toEqual([{ type: 'text', text: '@Anna Smithson' }])
  })
})
