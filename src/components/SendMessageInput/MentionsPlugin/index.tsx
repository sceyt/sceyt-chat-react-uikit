import React, { useCallback, useEffect, useMemo, useState } from 'react'
import * as ReactDOM from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  MenuTextMatch,
  useBasicTypeaheadTriggerMatch
} from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { $createMentionNode } from '../MentionNode'
import { AvatarWrapper, UserStatus } from '../../Channel'
import Avatar from '../../Avatar'
import { colors } from '../../../UIHelper/constants'
import { SubTitle } from '../../../UIHelper'
import { USER_PRESENCE_STATUS } from '../../../helpers/constants'
import { userLastActiveDateFormat } from '../../../helpers'
import styled from 'styled-components'
import { $createTextNode, TextNode } from 'lexical'
import { IContactsMap, IMember } from '../../../types'
import { makeUsername } from '../../../helpers/message'

const PUNCTUATION = '\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%\'"~=<>_:;'
const NAME = '\\b[A-Z][^\\s' + PUNCTUATION + ']'

const DocumentMentionsRegex = {
  NAME,
  PUNCTUATION
}

const PUNC = DocumentMentionsRegex.PUNCTUATION

const TRIGGERS = ['@'].join('')

// Chars we expect to see in a mention (non-space, non-punctuation).
const VALID_CHARS = '[^' + TRIGGERS + PUNC + '\\s]'

// Non-standard series of chars. Each series must be preceded and followed by
// a valid char.
const VALID_JOINS =
  '(?:' +
  '\\.[ |$]|' + // E.g. "r. " in "Mr. Smith"
  ' |' + // E.g. " " in "Josh Duck"
  '[' +
  PUNC +
  ']|' + // E.g. "-' in "Salier-Hellendag"
  ')'

const LENGTH_LIMIT = 75

const AtSignMentionsRegex = new RegExp(
  '(^|\\s|\\()(' + '[' + TRIGGERS + ']' + '((?:' + VALID_CHARS + VALID_JOINS + '){0,' + LENGTH_LIMIT + '})' + ')$'
)

// 50 is the longest alias length limit.
const ALIAS_LENGTH_LIMIT = 50

// Regex used to match alias.
const AtSignMentionsRegexAliasRegex = new RegExp(
  '(^|\\s|\\()(' + '[' + TRIGGERS + ']' + '((?:' + VALID_CHARS + '){0,' + ALIAS_LENGTH_LIMIT + '})' + ')$'
)

// At most, 5 suggestions are shown in the popup.
const SUGGESTION_LIST_LENGTH_LIMIT = 50

const mentionsCache = new Map()

let membersMap = {}

function useMentionLookupService(
  mentionString: string | null,
  contactsMap: IContactsMap,
  userId: string,
  members: IMember[],
  getFromContacts?: boolean
) {
  // const members = useSelector(activeChannelMembersSelector, shallowEqual)
  const [results, setResults] = useState<Array<{ name: string; avatar?: string; id: string; presence: any }>>([])
  const membersMapMemo = useMemo(() => {
    mentionsCache.clear()
    return members.reduce((acc: any, member: any) => {
      acc[member.id] = member
      return acc
    }, {})
  }, [members])
  membersMap = membersMapMemo
  useEffect(() => {
    const cachedResults = mentionsCache.get(mentionString)
    if (mentionString == null) {
      setResults([])
      return
    }

    if (cachedResults === null) {
      return
    } else if (cachedResults !== undefined) {
      setResults(cachedResults)
      return
    }

    mentionsCache.set(mentionString, null)
    const searchedMembers = [...members]
      .filter((member: IMember) => {
        const displayName = makeUsername(contactsMap[member.id], member, getFromContacts)
        return (
          displayName &&
          member.id !== userId &&
          displayName
            .split(' ')
            .find((namePart) =>
              namePart[0] === '~'
                ? namePart.slice(1).toLowerCase().startsWith(mentionString.toLowerCase())
                : namePart.toLowerCase().startsWith(mentionString.toLowerCase())
            )
        )
      })
      .map((member) => {
        const displayName = makeUsername(contactsMap[member.id], member, getFromContacts)
        return {
          avatar: member.avatarUrl,
          name: displayName,
          id: member.id,
          presence: member.presence
        }
      })
    mentionsCache.set(mentionString, searchedMembers)
    setResults(searchedMembers)
  }, [mentionString, members])

  return results
}

function checkForAtSignMentions(text: string, minMatchLength: number): MenuTextMatch | null {
  let match = AtSignMentionsRegex.exec(text)
  if (match === null) {
    match = AtSignMentionsRegexAliasRegex.exec(text)
  }
  if (match !== null) {
    // The strategy ignores leading whitespace but we need to know it's
    // length to add it to the leadOffset
    const maybeLeadingWhitespace = match[1]
    const matchingString = match[3]
    if (matchingString.length >= minMatchLength) {
      return {
        leadOffset: match.index + maybeLeadingWhitespace.length,
        matchingString,
        replaceableString: match[2]
      }
    }
  }
  return null
}

function getPossibleQueryMatch(text: string): MenuTextMatch | null {
  return checkForAtSignMentions(text, 0)
}

export class MentionTypeaheadOption extends MenuOption {
  id: string
  name: string
  presence?: any
  avatarUrl?: string

  constructor(name: string, id: string, presence?: any, avatarUrl?: string) {
    super(name)
    this.name = name
    this.id = id
    this.presence = presence
    this.avatarUrl = avatarUrl
  }
}

function MentionsTypeaheadMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option
}: {
  index: number
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
  option: MentionTypeaheadOption
}) {
  let className = 'item'
  if (isSelected) {
    className += ' selected'
  }
  return (
    <MemberItem
      key={option.key}
      tabIndex={-1}
      className={className}
      ref={option.setRefElement}
      role='option'
      isActiveItem={isSelected}
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      activeBackgroundColor={colors.hoverBackgroundColor}
      onClick={onClick}
    >
      <AvatarWrapper>
        {/* @ts-ignore */}
        <Avatar name={option.name} image={option.avatarUrl} size={32} textSize={14} setDefaultAvatar />
      </AvatarWrapper>
      <UserNamePresence>
        <MemberName color={colors.textColor1}>
          {option.name}
          {/* {makeUsername(member.id === user.id ? member : contactsMap[member.id], member, getFromContacts)} */}
        </MemberName>
        <SubTitle>
          {/* @ts-ignore */}
          {option.presence && option.presence.state === USER_PRESENCE_STATUS.ONLINE
            ? 'Online'
            : // @ts-ignore
              option.presence && option.presence.lastActiveAt && userLastActiveDateFormat(option.presence.lastActiveAt)}
        </SubTitle>
      </UserNamePresence>
    </MemberItem>
  )
}

export default function MentionsPlugin({
  contactsMap,
  userId,
  getFromContacts,
  setMentionMember,
  members
}: {
  contactsMap: IContactsMap
  userId: string
  getFromContacts?: boolean
  setMentionMember: (member: any) => void
  members: IMember[]
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext()
  const [queryString, setQueryString] = useState<string | null>(null)
  const results = useMentionLookupService(queryString, contactsMap, userId, members, getFromContacts)
  const checkForSlashTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0
  })

  const options = useMemo(
    () =>
      results
        .map((result) => new MentionTypeaheadOption(result.name, result.id, result.presence, result.avatar))
        .slice(0, SUGGESTION_LIST_LENGTH_LIMIT),
    [results]
  )

  const onSelectOption = useCallback(
    (selectedOption: MentionTypeaheadOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      setMentionMember(membersMap[selectedOption.id])
      editor.update(() => {
        const mentionNode = $createMentionNode({ ...selectedOption, name: `@${selectedOption.name}` })
        if (nodeToReplace) {
          const replacedNode = nodeToReplace.replace(mentionNode)
          const appendedNode = replacedNode.insertAfter($createTextNode(' '))
          appendedNode.select()
        }
        closeMenu()
      })
    },
    [editor]
  )

  const checkForMentionMatch = useCallback(
    (text: string) => {
      const slashMatch = checkForSlashTriggerMatch(text, editor)
      if (slashMatch !== null) {
        return null
      }
      return getPossibleQueryMatch(text)
    },
    [checkForSlashTriggerMatch, editor]
  )

  return (
    <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForMentionMatch}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchorElementRef.current && results.length
          ? ReactDOM.createPortal(
              <MentionsContainer className='typeahead-popover mentions-menu'>
                <MentionsList>
                  {options.map((option, i: number) => (
                    <MentionsTypeaheadMenuItem
                      index={i}
                      isSelected={selectedIndex === i}
                      onClick={() => {
                        setHighlightedIndex(i)
                        selectOptionAndCleanUp(option)
                      }}
                      onMouseEnter={() => {
                        setHighlightedIndex(i)
                      }}
                      key={option.key}
                      option={option}
                    />
                  ))}
                </MentionsList>
              </MentionsContainer>,
              anchorElementRef.current
            )
          : null
      }
    />
  )
}

export const MentionsContainer = styled.div<{ mentionsIsOpen?: boolean }>`
  position: relative;
  animation: fadeIn 0.2s ease-in-out;
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`
const MentionsList = styled.ul<{ height?: number; hidden?: boolean; backgroundColor?: string; withBorder?: boolean }>`
  position: absolute;
  bottom: 100%;
  width: 300px;
  transition: all 0.2s;
  overflow: auto;
  max-height: 240px;
  z-index: 99;
  padding: 2px 0 0;
  background: ${(props) => props.backgroundColor || colors.white};
  border: ${(props) => props.withBorder && `1px solid ${colors.borderColor}`};
  box-sizing: border-box;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  visibility: ${(props) => (props.hidden ? 'hidden' : 'visible')};
`

export const MemberItem = styled.li<{ isActiveItem?: boolean; activeBackgroundColor?: string }>`
  display: flex;
  align-items: center;
  font-size: 15px;
  padding: 6px 16px;
  transition: all 0.2s;
  cursor: pointer;
  background-color: ${(props) => props.isActiveItem && (props.activeBackgroundColor || colors.hoverBackgroundColor)};

  & ${UserStatus} {
    width: 10px;
    height: 10px;
  }
`

const UserNamePresence = styled.div`
  width: 100%;
  margin-left: 12px;
`
const MemberName = styled.h3<{ color?: string }>`
  margin: 0;
  max-width: calc(100% - 1px);
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  color: ${(props) => props.color || colors.textColor1};
`
