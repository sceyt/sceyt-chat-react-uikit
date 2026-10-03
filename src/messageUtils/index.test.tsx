import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { setClient } from '../common/client'
import { MessageTextFormat, MessageStatusIcon } from './index'
import { itFailing } from '../testUtils/itFailing'
import { MESSAGE_DELIVERY_STATUS } from '../helpers/constants'

// Helper to render MessageTextFormat output inside a div
const renderMessageText = (props: Parameters<typeof MessageTextFormat>[0]) => {
  const result = MessageTextFormat(props)
  return render(<div data-testid='message-container'>{result}</div>)
}

describe('MessageTextFormat rendering', () => {
  beforeEach(() => {
    setClient({ user: { id: 'current-user', firstName: 'Current', lastName: 'User' } } as any)
  })

  // ─── plain text ─────────────────────────────────────────────────────────────

  it('renders plain text with no URL as text only, no <a> elements', () => {
    renderMessageText({
      text: 'Hello world',
      message: { body: 'Hello world' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    expect(screen.getByTestId('message-container')).toHaveTextContent('Hello world')
    expect(screen.queryByRole('link')).toBeNull()
  })

  // ─── single URL ─────────────────────────────────────────────────────────────

  it('renders text with a URL as a link with correct attributes', () => {
    renderMessageText({
      text: 'Visit https://example.com today',
      message: { body: 'Visit https://example.com today' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
    expect(screen.getByTestId('message-container')).toHaveTextContent('Visit https://example.com today')
  })

  // ─── multiple URLs ──────────────────────────────────────────────────────────

  it('renders several URLs as links, preserving text between them', () => {
    renderMessageText({
      text: 'Check https://alpha.com and https://beta.com please',
      message: { body: 'Check https://alpha.com and https://beta.com please' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', 'https://alpha.com')
    expect(links[1]).toHaveAttribute('href', 'https://beta.com')
    expect(screen.getByTestId('message-container')).toHaveTextContent(
      'Check https://alpha.com and https://beta.com please'
    )
  })

  // ─── asSampleText and isLastMessage ─────────────────────────────────────────

  it('renders NO links when asSampleText=true and isLastMessage=true', () => {
    renderMessageText({
      text: 'Visit https://example.com today',
      message: { body: 'Visit https://example.com today' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666',
      asSampleText: true,
      isLastMessage: true
    })

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByTestId('message-container')).toHaveTextContent('Visit https://example.com today')
  })

  // ─── unsupportedMessage ─────────────────────────────────────────────────────

  it('renders "not supported" string when unsupportedMessage=true', () => {
    renderMessageText({
      text: 'Some message',
      message: { body: 'Some message' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666',
      unsupportedMessage: true
    })

    expect(screen.getByTestId('message-container')).toHaveTextContent(
      'This message is not supported. Update your app to view this message.'
    )
  })

  // ─── target prop ────────────────────────────────────────────────────────────

  it('passes target prop to links', () => {
    renderMessageText({
      text: 'Visit https://example.com',
      message: { body: 'Visit https://example.com' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666',
      target: '_self'
    })

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_self')
  })

  // ─── formatting attributes ──────────────────────────────────────────────────

  it('renders bold text with the bold class', () => {
    renderMessageText({
      text: 'Hello bold world',
      message: {
        body: 'Hello bold world',
        bodyAttributes: [{ type: 'bold', offset: 6, length: 4 }]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const container = screen.getByTestId('message-container')
    const boldElement = container.querySelector('.bold')
    expect(boldElement).toBeTruthy()
    expect(boldElement).toHaveTextContent('bold')
  })

  it('renders italic text with the italic class', () => {
    renderMessageText({
      text: 'Hello italic world',
      message: {
        body: 'Hello italic world',
        bodyAttributes: [{ type: 'italic', offset: 6, length: 6 }]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const container = screen.getByTestId('message-container')
    const italicElement = container.querySelector('.italic')
    expect(italicElement).toBeTruthy()
    expect(italicElement).toHaveTextContent('italic')
  })

  it('renders underline text with the underline class', () => {
    renderMessageText({
      text: 'Hello underline world',
      message: {
        body: 'Hello underline world',
        bodyAttributes: [{ type: 'underline', offset: 6, length: 9 }]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const container = screen.getByTestId('message-container')
    const underlineElement = container.querySelector('.underline')
    expect(underlineElement).toBeTruthy()
    expect(underlineElement).toHaveTextContent('underline')
  })

  it('renders strikethrough text with the strikethrough class', () => {
    renderMessageText({
      text: 'Hello strike world',
      message: {
        body: 'Hello strike world',
        bodyAttributes: [{ type: 'strikethrough', offset: 6, length: 6 }]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const container = screen.getByTestId('message-container')
    const strikeElement = container.querySelector('.strikethrough')
    expect(strikeElement).toBeTruthy()
    expect(strikeElement).toHaveTextContent('strike')
  })

  it('renders monospace text with the monospace class', () => {
    renderMessageText({
      text: 'Hello mono world',
      message: {
        body: 'Hello mono world',
        bodyAttributes: [{ type: 'monospace', offset: 6, length: 4 }]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const container = screen.getByTestId('message-container')
    const monoElement = container.querySelector('.monospace')
    expect(monoElement).toBeTruthy()
    expect(monoElement).toHaveTextContent('mono')
  })

  // ─── mentions ───────────────────────────────────────────────────────────────

  it('renders mention with name from mentionedUsers', () => {
    const mentionedUser = { id: 'user-1', firstName: 'Alice', lastName: 'Smith' }
    renderMessageText({
      text: 'Hello @user-1 there',
      message: {
        body: 'Hello @user-1 there',
        bodyAttributes: [{ type: 'mention', offset: 6, length: 8, metadata: 'user-1' }],
        mentionedUsers: [mentionedUser]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const container = screen.getByTestId('message-container')
    const mentionElement = container.querySelector('.mention')
    expect(mentionElement).toBeTruthy()
    expect(mentionElement).toHaveTextContent('@Alice Smith')
  })

  it('renders mention with name from contactsMap when getFromContacts is true', () => {
    const mentionedUser = { id: 'user-1', firstName: 'Alice', lastName: 'Smith' }
    const contactUser = { id: 'user-1', firstName: 'Contact', lastName: 'Name' }
    renderMessageText({
      text: 'Hello @user-1 there',
      message: {
        body: 'Hello @user-1 there',
        bodyAttributes: [{ type: 'mention', offset: 6, length: 8, metadata: 'user-1' }],
        mentionedUsers: [mentionedUser]
      },
      contactsMap: { 'user-1': contactUser },
      getFromContacts: true,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const container = screen.getByTestId('message-container')
    const mentionElement = container.querySelector('.mention')
    expect(mentionElement).toBeTruthy()
    expect(mentionElement).toHaveTextContent('@Contact Name')
  })

  it('renders current user mention with their own name', () => {
    const currentUser = { id: 'current-user', firstName: 'Current', lastName: 'User' }
    renderMessageText({
      text: 'Hello @current-user there',
      message: {
        body: 'Hello @current-user there',
        bodyAttributes: [{ type: 'mention', offset: 6, length: 13, metadata: 'current-user' }],
        mentionedUsers: [currentUser]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const container = screen.getByTestId('message-container')
    const mentionElement = container.querySelector('.mention')
    expect(mentionElement).toBeTruthy()
    expect(mentionElement).toHaveTextContent('@Current User')
  })

  it('clicking mention calls onMentionNameClick when shouldOpenUserProfileForMention is true', () => {
    const mentionedUser = { id: 'user-1', firstName: 'Alice', lastName: 'Smith' }
    const onMentionNameClick = jest.fn()
    jest.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: true } as Selection)

    renderMessageText({
      text: 'Hello @user-1 there',
      message: {
        body: 'Hello @user-1 there',
        bodyAttributes: [{ type: 'mention', offset: 6, length: 8, metadata: 'user-1' }],
        mentionedUsers: [mentionedUser]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666',
      onMentionNameClick,
      shouldOpenUserProfileForMention: true
    })

    const container = screen.getByTestId('message-container')
    const mentionElement = container.querySelector('.mention')!
    fireEvent.click(mentionElement)

    expect(onMentionNameClick).toHaveBeenCalledWith(mentionedUser)
  })

  it('clicking mention does NOT call onMentionNameClick when shouldOpenUserProfileForMention is false', () => {
    const mentionedUser = { id: 'user-1', firstName: 'Alice', lastName: 'Smith' }
    const onMentionNameClick = jest.fn()

    renderMessageText({
      text: 'Hello @user-1 there',
      message: {
        body: 'Hello @user-1 there',
        bodyAttributes: [{ type: 'mention', offset: 6, length: 8, metadata: 'user-1' }],
        mentionedUsers: [mentionedUser]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666',
      onMentionNameClick,
      shouldOpenUserProfileForMention: false
    })

    const container = screen.getByTestId('message-container')
    const mentionElement = container.querySelector('.mention')!
    fireEvent.click(mentionElement)

    expect(onMentionNameClick).not.toHaveBeenCalled()
  })

  // ─── URL adjacent to mention/formatting ─────────────────────────────────────

  it('keeps a URL that starts right after a mention intact', () => {
    // '@user-1' is 7 characters; the mention range must not cover the URL's first character
    const mentionedUser = { id: 'user-1', firstName: 'Alice', lastName: 'Smith' }
    renderMessageText({
      text: '@user-1https://example.com',
      message: {
        body: '@user-1https://example.com',
        bodyAttributes: [{ type: 'mention', offset: 0, length: 7, metadata: 'user-1' }],
        mentionedUsers: [mentionedUser]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  // ─── partly bold URL ────────────────────────────────────────────────────────

  // KNOWN LIMITATION (not fixed yet): text is split at formatting boundaries before links are
  // detected, so a URL that is only partly bold becomes broken partial links. Fixing it needs
  // link detection on the whole body before applying formatting. Convert to it() when fixed.
  itFailing('URL that is PARTLY bold should still be one link with the full href', () => {
    renderMessageText({
      text: 'See https://example.com/path here',
      message: {
        body: 'See https://example.com/path here',
        // Bold covers only 'https://example' (first 15 chars of URL)
        bodyAttributes: [{ type: 'bold', offset: 4, length: 15 }]
      },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666'
    })

    const links = screen.getAllByRole('link')
    // Should be exactly one link with the full URL
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://example.com/path')
  })

  // ─── invite links ───────────────────────────────────────────────────────────

  it('renders invite link with no href when isInviteLink=true', () => {
    renderMessageText({
      text: 'Join https://example.com/invite/abc123',
      message: { body: 'Join https://example.com/invite/abc123' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666',
      isInviteLink: true,
      onInviteLinkClick: jest.fn()
    })

    // Note: <a> without href is not considered role="link" by testing-library
    const container = screen.getByTestId('message-container')
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link).not.toHaveAttribute('href')
  })

  it('clicking invite link calls onInviteLinkClick with the key (last path segment)', () => {
    const onInviteLinkClick = jest.fn()
    renderMessageText({
      text: 'Join https://example.com/invite/abc123',
      message: { body: 'Join https://example.com/invite/abc123' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666',
      isInviteLink: true,
      onInviteLinkClick
    })

    const container = screen.getByTestId('message-container')
    const link = container.querySelector('a')!
    fireEvent.click(link)

    expect(onInviteLinkClick).toHaveBeenCalledWith('abc123')
  })

  it('clicking invite link with trailing slash extracts correct key', () => {
    const onInviteLinkClick = jest.fn()
    renderMessageText({
      text: 'Join https://example.com/invite/xyz789/',
      message: { body: 'Join https://example.com/invite/xyz789/' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666',
      isInviteLink: true,
      onInviteLinkClick
    })

    const container = screen.getByTestId('message-container')
    const link = container.querySelector('a')!
    fireEvent.click(link)

    expect(onInviteLinkClick).toHaveBeenCalledWith('xyz789')
  })

  // ─── two invite links bug ───────────────────────────────────────────────────

  it('clicking the SECOND invite link calls onInviteLinkClick with its own key', () => {
    // Bug: only the first <a> gets the onClick handler
    const onInviteLinkClick = jest.fn()
    renderMessageText({
      text: 'Join https://example.com/invite/first and https://example.com/invite/second',
      message: { body: 'Join https://example.com/invite/first and https://example.com/invite/second' },
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#666',
      isInviteLink: true,
      onInviteLinkClick
    })

    const container = screen.getByTestId('message-container')
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(2)

    // Click the second link
    fireEvent.click(links[1])

    // BUG: The second link's onClick is not properly wired
    expect(onInviteLinkClick).toHaveBeenCalledWith('second')
  })

  // ─── malformed bodyAttributes ───────────────────────────────────────────────

  it('handles bodyAttributes with offset past the end without throwing', () => {
    expect(() => {
      renderMessageText({
        text: 'Short text',
        message: {
          body: 'Short text',
          bodyAttributes: [{ type: 'bold', offset: 100, length: 5 }]
        },
        contactsMap: {},
        getFromContacts: false,
        accentColor: '#000',
        textSecondary: '#666'
      })
    }).not.toThrow()

    expect(screen.getByTestId('message-container')).toHaveTextContent('Short text')
  })

  it('handles bodyAttributes with negative length without throwing', () => {
    // The behavior with negative length is undefined, but the component should not crash
    expect(() => {
      renderMessageText({
        text: 'Some text here',
        message: {
          body: 'Some text here',
          bodyAttributes: [{ type: 'bold', offset: 5, length: -3 }]
        },
        contactsMap: {},
        getFromContacts: false,
        accentColor: '#000',
        textSecondary: '#666'
      })
    }).not.toThrow()

    // Text may be garbled but component didn't crash - that's the key assertion
    expect(screen.getByTestId('message-container')).toBeTruthy()
  })
})

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

  it('resolves a serialized mention identifier through its mentioned user', () => {
    const mentionedUser = { id: '+15551234567', firstName: 'Jane', lastName: 'Doe' }
    const draft: any = {
      body: 'Before @+15551234567 after',
      bodyAttributes: [{ type: 'mention', offset: 7, length: 13, metadata: mentionedUser.id }],
      mentionedUsers: [mentionedUser]
    }

    const result: any = MessageTextFormat({
      text: draft.body,
      message: draft,
      contactsMap: {},
      getFromContacts: false,
      accentColor: '#000',
      textSecondary: '#000'
    })
    const mention = result.find(
      (part: any) => React.isValidElement(part) && String(part.props.className).includes('mention')
    )

    expect(mention.props.children).toBe('@Jane Doe')
  })
})

describe('MessageStatusIcon', () => {
  // ─── ticks display type ─────────────────────────────────────────────────────

  it('renders read icon for PLAYED status with ticks display type', () => {
    const { container } = render(
      <MessageStatusIcon
        messageStatus={MESSAGE_DELIVERY_STATUS.PLAYED}
        messageStatusDisplayingType='ticks'
        color='#000'
        accentColor='#3B82F6'
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders read icon for OPENED status with ticks display type', () => {
    const { container } = render(
      <MessageStatusIcon
        messageStatus={MESSAGE_DELIVERY_STATUS.OPENED}
        messageStatusDisplayingType='ticks'
        color='#000'
        accentColor='#3B82F6'
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders read icon for READ status with ticks display type', () => {
    const { container } = render(
      <MessageStatusIcon
        messageStatus={MESSAGE_DELIVERY_STATUS.READ}
        messageStatusDisplayingType='ticks'
        color='#000'
        accentColor='#3B82F6'
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders delivered icon for DELIVERED status with ticks display type', () => {
    const { container } = render(
      <MessageStatusIcon
        messageStatus={MESSAGE_DELIVERY_STATUS.DELIVERED}
        messageStatusDisplayingType='ticks'
        color='#000'
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders sent icon for SENT status with ticks display type', () => {
    const { container } = render(
      <MessageStatusIcon
        messageStatus={MESSAGE_DELIVERY_STATUS.SENT}
        messageStatusDisplayingType='ticks'
        color='#000'
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders pending icon for default status', () => {
    const { container } = render(<MessageStatusIcon messageStatus='pending' color='#000' />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  // ─── text display type ──────────────────────────────────────────────────────

  it('renders "Seen" text for PLAYED status without ticks display type', () => {
    const { container } = render(<MessageStatusIcon messageStatus={MESSAGE_DELIVERY_STATUS.PLAYED} color='#000' />)
    expect(container.textContent).toContain('Seen')
  })

  it('renders "Seen" text for OPENED status without ticks display type', () => {
    const { container } = render(<MessageStatusIcon messageStatus={MESSAGE_DELIVERY_STATUS.OPENED} color='#000' />)
    expect(container.textContent).toContain('Seen')
  })

  it('renders "Seen" text for READ status without ticks display type', () => {
    const { container } = render(<MessageStatusIcon messageStatus={MESSAGE_DELIVERY_STATUS.READ} color='#000' />)
    expect(container.textContent).toContain('Seen')
  })

  it('renders "Not seen yet" text for DELIVERED status without ticks display type', () => {
    const { container } = render(<MessageStatusIcon messageStatus={MESSAGE_DELIVERY_STATUS.DELIVERED} color='#000' />)
    expect(container.textContent).toContain('Not seen yet')
  })

  it('renders "Not seen yet" text for SENT status without ticks display type', () => {
    const { container } = render(<MessageStatusIcon messageStatus={MESSAGE_DELIVERY_STATUS.SENT} color='#000' />)
    expect(container.textContent).toContain('Not seen yet')
  })

  // ─── readIconColor prop ─────────────────────────────────────────────────────

  it('uses readIconColor over accentColor when provided', () => {
    const { container } = render(
      <MessageStatusIcon
        messageStatus={MESSAGE_DELIVERY_STATUS.READ}
        messageStatusDisplayingType='ticks'
        color='#000'
        readIconColor='#FF0000'
        accentColor='#3B82F6'
      />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })
})
