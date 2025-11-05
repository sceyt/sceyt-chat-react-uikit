import React, { useMemo, useState, useCallback } from 'react'
import styled from 'styled-components'
import PopupContainer from '../popupContainer'
import { Popup, PopupBody, PopupName, CloseIcon, Row, Button } from 'UIHelper'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'
import Avatar from 'components/Avatar'
import { IPollDetails, IPollVote } from 'types'
import { makeUsername } from 'helpers/message'
import AllVotesPopup from './AllVotesPopup'
import { getShowOnlyContactUsers } from 'helpers/contacts'
import { getClient } from 'common/client'
import { useSelector } from 'store/hooks'
import { contactsMapSelector } from 'store/user/selector'

interface VotesResultsPopupProps {
  onClose: () => void
  poll: IPollDetails
  messageId: string | number
  onViewMoreOption?: (optionId: string) => void
}

const VotesResultsPopup = ({ onClose, poll, messageId, onViewMoreOption }: VotesResultsPopupProps) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const getFromContacts = getShowOnlyContactUsers()
  const user = getClient().user
  const contactsMap = useSelector(contactsMapSelector)
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.ACCENT]: accent
  } = useColor()

  const optionIdToVotes = useMemo(() => {
    const votes: Record<string, IPollVote[]> = {}
    poll.options.forEach((opt) => {
      const allOptionVotes = (poll.votes || []).filter((vote) => vote.optionId === opt.id)
      if (allOptionVotes.length < 5) {
        const ownVote = poll.ownVotes.find((vote) => vote.optionId === opt.id)
        if (ownVote) {
          allOptionVotes.push(ownVote)
        }
      }
      votes[opt.id] = allOptionVotes
    })
    return votes
  }, [poll.votes, poll.options, poll.ownVotes])

  const handleShowAll = useCallback(
    (optionId: string) => {
      if (onViewMoreOption) {
        onViewMoreOption(optionId)
      }
      setSelectedOptionId(optionId)
    },
    [onViewMoreOption]
  )

  const handleCloseAllVotes = useCallback(() => {
    setSelectedOptionId(null)
  }, [])

  const formatDate = (d: Date) => {
    try {
      const date = new Date(d)
      const month = date.toLocaleString(undefined, { month: 'short' })
      const day = date.getDate()
      const year = date.getFullYear()
      return `${month} ${day}, ${year}`
    } catch {
      return ''
    }
  }

  return (
    <div>
      {!selectedOptionId && (
        <PopupContainer>
          <Popup backgroundColor={background} maxWidth='560px' minWidth='560px' padding='0'>
            <PopupBody paddingH='24px' paddingV='20px'>
              <CloseIcon color={textSecondary} onClick={onClose} />
              <PopupName color={textPrimary} marginBottom='16px'>
                Vote results
              </PopupName>

              <OptionsList>
                {poll.options.map((opt) => {
                  const allVotes = optionIdToVotes[opt.id] || []
                  const totalVotes = poll.votesPerOption?.[opt.id] || 0

                  return (
                    <OptionBlock key={opt.id} background={surface1} border={border}>
                      <OptionHeader>
                        <OptionTitle color={textPrimary}>{opt.name}</OptionTitle>
                        <OptionCount color={textSecondary}>{totalVotes} votes</OptionCount>
                      </OptionHeader>
                      <Voters>
                        {allVotes.map((vote) => (
                          <VoterRow key={`${opt.id}_${vote.user.id}`}>
                            <Avatar
                              image={vote.user.profile.avatar}
                              name={vote.user.profile.firstName || vote.user.id}
                              size={40}
                              textSize={16}
                              setDefaultAvatar
                            />
                            <VoterInfo>
                              <VoterName color={textPrimary}>
                                {user.id === vote.user.id
                                  ? 'You'
                                  : makeUsername(
                                      contactsMap[vote.user.id],
                                      {
                                        id: vote?.user?.id,
                                        firstName: vote?.user?.profile?.firstName,
                                        lastName: vote?.user?.profile?.lastName,
                                        avatarUrl: vote?.user?.profile?.avatar,
                                        state: vote?.user?.presence?.status,
                                        blocked: false,
                                        presence: {
                                          state: vote?.user?.presence?.status,
                                          status: vote?.user?.presence?.status,
                                          lastActiveAt: new Date(vote?.user?.createdAt || '')
                                        }
                                      },
                                      getFromContacts
                                    )}
                              </VoterName>
                              <VotedAt color={textSecondary}>{formatDate(new Date(vote.createdAt))}</VotedAt>
                            </VoterInfo>
                          </VoterRow>
                        ))}
                      </Voters>
                      {allVotes.length < totalVotes && (
                        <Row justify='center' paddingBottom='5px '>
                          <Button
                            type='button'
                            backgroundColor='transparent'
                            color={accent}
                            onClick={() => handleShowAll(opt.id)}
                          >
                            Show All
                          </Button>
                        </Row>
                      )}
                    </OptionBlock>
                  )
                })}
              </OptionsList>
            </PopupBody>
          </Popup>
        </PopupContainer>
      )}
      {selectedOptionId && (
        <AllVotesPopup
          onClose={handleCloseAllVotes}
          poll={poll}
          messageId={messageId}
          optionId={selectedOptionId}
          optionName={poll.options.find((opt) => opt.id === selectedOptionId)?.name || ''}
        />
      )}
    </div>
  )
}

export default VotesResultsPopup

const OptionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  max-height: 585px;
`

const OptionBlock = styled.div<{ background: string; border: string }>`
  background: ${(p) => p.background};
  border-radius: 12px;
  border: 1px solid ${(p) => p.border}0F; /* subtle */
  padding: 14px 16px 0 16px;
`

const OptionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`

const OptionTitle = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.4px;
`

const OptionCount = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-size: 13px;
`

const Voters = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 5px;
`

const VoterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
`

const VoterInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  justify-content: space-between;
`

const VoterName = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
`

const VotedAt = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
`
