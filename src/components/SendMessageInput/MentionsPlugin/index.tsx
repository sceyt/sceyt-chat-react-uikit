import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { colors, THEME_COLORS } from '../../../UIHelper/constants'
import { SubTitle } from '../../../UIHelper'
import { USER_PRESENCE_STATUS } from '../../../helpers/constants'
import { userLastActiveDateFormat } from '../../../helpers'
import styled from 'styled-components'
import { $createTextNode, TextNode } from 'lexical'
import { IContactsMap, IMember } from '../../../types'
import { makeUsername } from '../../../helpers/message'
import { useColor } from '../../../hooks'

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

let membersMap: { [key: string]: IMember } = {}

function useMentionLookupService(
  mentionString: string | null,
  contactsMap: IContactsMap,
  userId: string,
  members: IMember[],
  getFromContacts?: boolean
) {
  // const members = useSelector(activeChannelMembersSelector, shallowEqual)
  const [results, setResults] = useState<Array<{ name: string; avatar?: string; id: string; presence: any }>>([])
  membersMap = useMemo(() => {
    mentionsCache.clear()
    return members.reduce((acc: any, member: any) => {
      acc[member.id] = member
      return acc
    }, {})
  }, [members])
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
  const { [THEME_COLORS.TEXT_PRIMARY]: textPrimary, [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()

  let className = 'item'
  if (isSelected) {
    className += ' selected'
  }
  return (
    <MemberItem
      key={option.id}
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
        <MemberName color={textPrimary}>
          {option.name}
          {/* {makeUsername(member.id === user.id ? member : contactsMap[member.id], member, getFromContacts)} */}
        </MemberName>
        <SubTitle color={textSecondary}>
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
const optionObj: any = {}
function MentionsContainer({
  queryString,
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
  setMentionsIsOpen
}: any) {
  const { [THEME_COLORS.BORDER]: borderColor } = useColor()

  const contRef: any = useRef()
  // const [editor] = useLexicalComposerContext()
  optionObj.selectedIndex = selectedIndex

  const handleKeyDown = (event: any) => {
    const { code } = event
    const isEnter: boolean = code === 'Enter'
    if (isEnter) {
      const selectedOption = options[selectedIndex]
      selectOptionAndCleanUp(selectedOption)
    }
  }

  useEffect(() => {
    setHighlightedIndex(selectedIndex + 1)
    setTimeout(() => {
      setHighlightedIndex(selectedIndex || 0)
    }, 50)
  }, [queryString])
  useEffect(() => {
    document.removeEventListener('keydown', handleKeyDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedIndex])
  useEffect(() => {
    setMentionsIsOpen(true)
    const menuTimeOut = setTimeout(() => {
      const menuElement = document.getElementById('typeahead-menu')
      if (menuElement) {
        menuElement.style.zIndex = 'inherit'
      }
    }, 200)
    return () => {
      clearTimeout(menuTimeOut)
      const menuElement = document.getElementById('typeahead-menu')
      if (menuElement) {
        menuElement.style.zIndex = '-1'
      }
      selectOptionAndCleanUp(null)
      setMentionsIsOpen(false)
    }
  }, [])
  return (
    <MentionsContainerWrapper className='typeahead-popover mentions-menu' ref={contRef}>
      <MentionsList borderColor={borderColor}>
        {options.map((option: any, i: number) => (
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
            key={option.id}
            option={option}
          />
        ))}
      </MentionsList>
    </MentionsContainerWrapper>
  )
}

export default function MentionsPlugin({
  contactsMap,
  userId,
  getFromContacts,
  setMentionMember,
  setMentionsIsOpen,
  members
}: {
  contactsMap: IContactsMap
  userId: string
  getFromContacts?: boolean
  // eslint-disable-next-line no-unused-vars
  setMentionMember: (member: any) => void
  // eslint-disable-next-line no-unused-vars
  setMentionsIsOpen: (state: boolean) => void
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

  const handleOnOpen = () => {
    const menuElement = document.getElementById('typeahead-menu')
    if (menuElement) {
      menuElement.style.zIndex = 'inherit'
    }
  }

  const onSelectOption = useCallback(
    (selectedOption: MentionTypeaheadOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      if (selectedOption) {
        setMentionMember(membersMap[selectedOption.id])
        editor.update(() => {
          const mentionNode = $createMentionNode({ ...selectedOption, name: `@${selectedOption.name}` })
          if (nodeToReplace) {
            const replacedNode = nodeToReplace.replace(mentionNode)
            const appendedNode = replacedNode.insertAfter($createTextNode(' '))
            appendedNode.selectStart()
          }
          closeMenu()
        })
      } else {
        closeMenu()
      }
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
      onOpen={handleOnOpen}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchorElementRef.current && results.length
          ? ReactDOM.createPortal(
              <MentionsContainer
                queryString={queryString}
                options={options}
                setMentionsIsOpen={setMentionsIsOpen}
                selectOptionAndCleanUp={selectOptionAndCleanUp}
                selectedIndex={selectedIndex}
                setHighlightedIndex={setHighlightedIndex}
              />,
              anchorElementRef.current
            )
          : null
      }
    />
  )
}

export const MentionsContainerWrapper = styled.div<{ mentionsIsOpen?: boolean; ref?: any }>`
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

const MentionsList = styled.ul<{
  height?: number
  hidden?: boolean
  backgroundColor?: string
  withBorder?: boolean
  borderColor: string
}>`
  position: absolute;
  bottom: 100%;
  width: 300px;
  transition: all 0.2s;
  overflow: auto;
  max-height: 240px;
  z-index: 200;
  padding: 2px 0 0;
  background: ${(props) => props.backgroundColor || colors.white};
  border: ${(props) => props.withBorder && `1px solid ${props.borderColor}`};
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
  width: calc(100% - 44px);
  margin-left: 12px;
`
const MemberName = styled.h3<{ color: string }>`
  margin: 0;
  max-width: calc(100% - 1px);
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  color: ${(props) => props.color};
`
