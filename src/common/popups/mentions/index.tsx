import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { activeChannelMembersSelector, membersLoadingStateSelector } from '../../../store/member/selector'
import { LOADING_STATE, PRESENCE_STATUS } from '../../../Helpers/constants'
import { colors } from '../../../UIHelper/constants'
import { IMember } from '../../../types'
import { getMembersAC, loadMoreMembersAC } from '../../../store/member/actions'
import { AvatarWrapper, UserStatus } from '../../../components/Channel'
import { Avatar } from '../../../components'
import { userLastActiveDateFormat } from '../../../helpers'
import { makeUserName } from '../../../helpers/message'
import { contactsMapSelector } from '../../../store/user/selector'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { getClient } from '../../client'
import { useDidUpdate, useEventListener } from '../../../hooks'
import { SubTitle } from '../../../UIHelper'

interface IMentionsPopupProps {
  channelId: string
  addMentionMember: (member: IMember) => void
  handleMentionsPopupClose: () => void
  searchMention: string
}

export default function MentionMembersPopup({
  channelId,
  addMentionMember,
  handleMentionsPopupClose,
  searchMention
}: IMentionsPopupProps) {
  const members = useSelector(activeChannelMembersSelector, shallowEqual)
  const contactsMap = useSelector(contactsMapSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const [filteredMembers, setFilteredMembers] = useState<IMember[]>([])
  const filteredMembersLength = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const user = getClient().user
  const membersLoading = useSelector(membersLoadingStateSelector, shallowEqual) || {}
  const dispatch = useDispatch()
  const handleMembersListScroll = (event: any) => {
    if (event.target.scrollTop >= event.target.scrollHeight - event.target.offsetHeight - 100) {
      if (membersLoading === LOADING_STATE.LOADED) {
        dispatch(loadMoreMembersAC(15))
      }
    }
  }

  const handleMentionMember = () => {
    addMentionMember(filteredMembers[activeIndex])
    handleMentionsPopupClose()
  }

  const sortMembers = (membersList: IMember[]) => {
    return [...membersList].sort((a: IMember, b: IMember) => {
      const aDisplayName = makeUserName(a.id === user.id ? a : contactsMap[a.id], a, getFromContacts)
      const bDisplayName = makeUserName(b.id === user.id ? b : contactsMap[b.id], b, getFromContacts)
      if (aDisplayName < bDisplayName) {
        return -1
      }
      if (aDisplayName > bDisplayName) {
        return 1
      }
      return 0
    })
  }

  const handleKeyDown = (e: any) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prevState) => (prevState < filteredMembersLength.current - 1 ? prevState + 1 : prevState))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prevState) => (prevState > 0 ? prevState - 1 : prevState))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // setActiveIndex((prevState) => (prevState > 0 ? prevState - 1 : prevState))
      handleMentionMember()
    }
  }
  const handleClicks = (e: any) => {
    if (e.target.closest('.mention_member_popup')) {
      return
    }
    handleMentionsPopupClose()
  }

  useEventListener('click', handleClicks)

  useEffect(() => {
    dispatch(getMembersAC(channelId))
  }, [channelId])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [filteredMembers, activeIndex])

  useEffect(() => {
    if (members && members.length && !searchMention) {
      const sortedMembers = sortMembers(members.filter((member: IMember) => member.id !== user.id))
      filteredMembersLength.current = sortedMembers.length
      setFilteredMembers(sortedMembers)
    }
  }, [members])

  useDidUpdate(() => {
    if (searchMention) {
      const searchedMembers = [...members].filter((member: IMember) => {
        const displayName = makeUserName(contactsMap[member.id], member, getFromContacts)
        return displayName && member.id !== user.id && displayName.toLowerCase().includes(searchMention.toLowerCase())
      })
      filteredMembersLength.current = searchedMembers.length
      setFilteredMembers(sortMembers(searchedMembers))
    } else {
      const searchedMembers = [...members].filter((member: IMember) => member.id !== user.id)
      filteredMembersLength.current = searchedMembers.length || 0
      setFilteredMembers(sortMembers(searchedMembers || []))
    }
  }, [searchMention])

  return (
    <Container className='mention_member_popup' height={filteredMembers && filteredMembers.length * 44}>
      <MembersList onScroll={handleMembersListScroll}>
        {filteredMembers.map((member: IMember, index: number) => (
          <MemberItem
            key={member.id}
            onClick={() => {
              handleMentionMember()
            }}
            isActiveItem={activeIndex === index}
            onMouseEnter={() => setActiveIndex(index)}
          >
            <AvatarWrapper>
              <Avatar
                name={member.firstName || member.id}
                image={member.avatarUrl}
                size={32}
                textSize={14}
                setDefaultAvatar
              />
            </AvatarWrapper>
            <UserNamePresence>
              <MemberName>
                {makeUserName(member.id === user.id ? member : contactsMap[member.id], member, getFromContacts)}
              </MemberName>
              <SubTitle>
                {member.presence && member.presence.state === PRESENCE_STATUS.ONLINE
                  ? 'Online'
                  : member.presence &&
                    member.presence.lastActiveAt &&
                    userLastActiveDateFormat(member.presence.lastActiveAt)}
              </SubTitle>
            </UserNamePresence>
          </MemberItem>
        ))}
      </MembersList>
    </Container>
  )
}

const Container = styled.div<{ height?: number }>`
  width: 300px;
  height: ${(props) => props.height && props.height + 22}px;
  max-height: 240px;
  background: #ffffff;
  border: 1px solid #dfe0eb;
  box-sizing: border-box;
  box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
`

const UserNamePresence = styled.div`
  width: 100%;
  margin-left: 12px;
`

const MemberName = styled.h3`
  margin: 0;
  max-width: calc(100% - 1px);
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;

  & > span {
    color: #abadb7;
  }
`

const EditMemberIcon = styled.span`
  margin-left: auto;
  cursor: pointer;
  padding: 2px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
`

const MembersList = styled.ul`
  margin: 10px 0 0;
  padding: 0;
  overflow-x: hidden;
  list-style: none;
  transition: all 0.2s;
  height: calc(100% - 10px); ;
`
const MemberItem = styled.li<{ isActiveItem?: boolean }>`
  display: flex;
  align-items: center;
  font-size: 15px;
  padding: 6px 16px;
  transition: all 0.2s;
  cursor: pointer;
  background-color: ${(props) => props.isActiveItem && colors.gray0};

  &:hover ${EditMemberIcon} {
    opacity: 1;
    visibility: visible;
  }

  & .dropdown-wrapper {
    margin-left: auto;
  }

  & .dropdown-body {
    bottom: -100px;
    right: 0;
  }

  & ${UserStatus} {
    width: 10px;
    height: 10px;
  }
`
