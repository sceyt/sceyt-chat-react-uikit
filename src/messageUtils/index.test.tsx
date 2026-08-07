import React from 'react'
import { setClient } from '../common/client'
import { MessageTextFormat } from './index'

describe('MessageTextFormat mentions', () => {
  const mentionedUser = { id: 'member-1', firstName: 'Jane', lastName: 'Doe' }
  const message: any = {
    body: 'Before @Jane after',
    bodyAttributes: [{ type: 'mention', offset: 7, length: 5, metadata: mentionedUser.id }],
    mentionedUsers: [mentionedUser]
  }

  beforeEach(() => {
    setClient({ user: { id: 'current-user' } } as any)
  })

  const getMentionElement = (onMentionNameClick: jest.Mock) => {
    const result: any = MessageTextFormat({
      text: message.body,
      message,
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#000',
      onMentionNameClick,
      shouldOpenUserProfileForMention: true
    })
    return result.find((part: any) => React.isValidElement(part) && String(part.props.className).includes('mention'))
  }

  it('does not activate a mention after a drag selection', () => {
    const onMentionNameClick = jest.fn()
    const getSelection = jest.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false } as Selection)

    getMentionElement(onMentionNameClick).props.onClick()

    expect(onMentionNameClick).not.toHaveBeenCalled()
    getSelection.mockRestore()
  })

  it('still activates a mention after a normal click', () => {
    const onMentionNameClick = jest.fn()
    const getSelection = jest.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: true } as Selection)

    getMentionElement(onMentionNameClick).props.onClick()

    expect(onMentionNameClick).toHaveBeenCalledWith(mentionedUser)
    getSelection.mockRestore()
  })
})
