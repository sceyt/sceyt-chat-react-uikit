import React from 'react'
import { render } from '@testing-library/react'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  COMMAND_PRIORITY_NORMAL,
  createEditor,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  PASTE_COMMAND
} from 'lexical'

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
