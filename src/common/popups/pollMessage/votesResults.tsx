import React, { useMemo, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import PopupContainer from '../popupContainer'
import { Popup, PopupBody, PopupName, CloseIcon, Row, Button } from 'UIHelper'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'
import Avatar from 'components/Avatar'
import { IPollVote } from 'types'
import { useDispatch, useSelector } from 'store/hooks'
import { getPollVotesAC, loadMorePollVotesAC } from 'store/message/actions'
import { pollVotesListSelector, pollVotesHasMoreSelector, pollVotesLoadingStateSelector } from 'store/message/selector'
import { LOADING_STATE } from 'helpers/constants'

interface VotesResultsPopupProps {
  onClose: () => void
  poll: {
    id: string
    name: string
    options: { id: string; name: string }[]
    votes: IPollVote[]
    votesPerOption: Record<string, number>
  }
  messageId: string | number
  // Optional: number of voters to show initially per option
  initialCount?: number
  onViewMoreOption?: (optionId: string) => void
}

const VotesResultsPopup = ({ onClose, poll, messageId, initialCount = 2, onViewMoreOption }: VotesResultsPopupProps) => {
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.ACCENT]: accent
  } = useColor()

  const dispatch = useDispatch()
  const pollVotesList = useSelector(pollVotesListSelector)
  const pollVotesHasMore = useSelector(pollVotesHasMoreSelector)
  const pollVotesLoadingState = useSelector(pollVotesLoadingStateSelector)

  // Default load: Load initial votes for all options when popup opens
  useEffect(() => {
    poll.options.forEach((option) => {
      const key = `${poll.id}_${option.id}`
      const reduxVotes = pollVotesList[key] || []
      
      // Load if we don't have Redux votes yet
      if (reduxVotes.length === 0) {
        const totalVotes = poll.votesPerOption?.[option.id] || 0
        if (totalVotes > 0) {
          dispatch(getPollVotesAC(messageId, poll.id, option.id, initialCount))
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleViewMore = useCallback(
    (optionId: string) => {
      if (onViewMoreOption) {
        onViewMoreOption(optionId)
      }
      dispatch(loadMorePollVotesAC(poll.id, optionId, 20))
    },
    [dispatch, poll.id, onViewMoreOption]
  )

  // Get votes from Redux only
  const optionIdToVotes = useMemo(() => {
    const votes: Record<string, IPollVote[]> = {}
    poll.options.forEach((opt) => {
      const key = `${poll.id}_${opt.id}`
      votes[opt.id] = pollVotesList[key] || []
    })
    return votes
  }, [pollVotesList, poll.id, poll.options])

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
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='560px' minWidth='560px' padding='0'>
        <PopupBody paddingH='24px' paddingV='20px'>
          <CloseIcon color={textSecondary} onClick={onClose} />
          <PopupName color={textPrimary} marginBottom='16px'>
            Vote results
          </PopupName>

          <OptionsList>
            {poll.options.map((opt) => {
              const key = `${poll.id}_${opt.id}`
              const allVotes = optionIdToVotes[opt.id] || []
              const hasMore = pollVotesHasMore[key] ?? false
              const isLoading = pollVotesLoadingState[key] === LOADING_STATE.LOADING

              return (
                <OptionBlock key={opt.id} background={surface1} border={border}>
                  <OptionHeader>
                    <OptionTitle color={textPrimary}>{opt.name}</OptionTitle>
                    <OptionCount color={textSecondary}>
                      {(poll.votesPerOption && poll.votesPerOption[opt.id]) || allVotes.length} votes
                    </OptionCount>
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
                            {vote.user.profile.firstName || vote.user.id} {vote.user.profile.lastName || ''}
                          </VoterName>
                          <VotedAt color={textSecondary}>{formatDate(new Date(vote.createdAt))}</VotedAt>
                        </VoterInfo>
                      </VoterRow>
                    ))}
                  </Voters>
                  {hasMore && (
                    <Row justify='center' paddingBottom='5px '>
                      <Button
                        type='button'
                        backgroundColor='transparent'
                        color={accent}
                        onClick={() => handleViewMore(opt.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Loading...' : 'View More'}
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
  )
}

export default VotesResultsPopup

const OptionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  max-height: 64vh;
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
