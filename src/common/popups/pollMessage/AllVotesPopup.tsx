import React, { useEffect, useCallback, useMemo } from 'react'
import styled from 'styled-components'
import PopupContainer from '../popupContainer'
import { Popup, PopupBody, PopupName, CloseIcon } from 'UIHelper'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'
import Avatar from 'components/Avatar'
import { IPollDetails, IPollVote } from 'types'
import { useDispatch, useSelector } from 'store/hooks'
import { getPollVotesAC, loadMorePollVotesAC } from 'store/message/actions'
import { pollVotesListSelector, pollVotesHasMoreSelector, pollVotesLoadingStateSelector } from 'store/message/selector'
import { LOADING_STATE } from 'helpers/constants'
import { ReactComponent as ArrowLeft } from '../../../assets/svg/arrowLeft.svg'
import { makeUsername } from 'helpers/message'
import { contactsMapSelector } from 'store/user/selector'
import { getShowOnlyContactUsers } from 'helpers/contacts'
import { getClient } from 'common/client'
import moment from 'moment'

interface AllVotesPopupProps {
  onClose: () => void
  poll: IPollDetails
  messageId: string | number
  optionId: string
  optionName: string
}

const POLL_VOTES_LIMIT = 20

const AllVotesPopup = ({ onClose, poll, messageId, optionId, optionName }: AllVotesPopupProps) => {
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_1]: surface1
  } = useColor()
  const contactsMap = useSelector(contactsMapSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const user = getClient().user

  const dispatch = useDispatch()
  const key = `${poll.id}_${optionId}`
  const pollVotesList = useSelector(pollVotesListSelector)
  const pollVotesHasMore = useSelector(pollVotesHasMoreSelector)
  const pollVotesLoadingState = useSelector(pollVotesLoadingStateSelector)

  const allVotes = pollVotesList[key] || []
  const hasMore = pollVotesHasMore[key] ?? false
  const isLoading = pollVotesLoadingState[key] === LOADING_STATE.LOADING
  const totalVotes = poll.voteDetails?.votesPerOption?.[optionId] || 0
  const isLoadingInitial = allVotes.length === 0 && (isLoading || totalVotes > 0)

  useEffect(() => {
    if (allVotes.length === 0 && totalVotes > 0 && !isLoading) {
      dispatch(getPollVotesAC(messageId, poll.id, optionId, POLL_VOTES_LIMIT))
    }
  }, [])

  useEffect(() => {
    if (allVotes.length > 0 && hasMore && !isLoading && allVotes.length < POLL_VOTES_LIMIT - 1) {
      dispatch(loadMorePollVotesAC(poll.id, optionId, POLL_VOTES_LIMIT))
    }
  }, [allVotes.length, hasMore, isLoading, poll.id, optionId, dispatch])

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget
      const isNearBottom = target.scrollTop >= target.scrollHeight - target.offsetHeight - 100

      if (isNearBottom && hasMore && isLoading === false) {
        dispatch(loadMorePollVotesAC(poll.id, optionId, POLL_VOTES_LIMIT))
      }
    },
    [hasMore, isLoading, dispatch, poll.id, optionId]
  )

  const formatDate = (d: Date) => {
    try {
      return moment(d).format('DD.MM.YY  HH:mm')
    } catch {
      return ''
    }
  }

  const ownVote = useMemo(
    () => poll?.voteDetails?.ownVotes?.find((vote: IPollVote) => vote.optionId === optionId),
    [poll?.voteDetails?.ownVotes, optionId]
  )

  return (
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='560px' minWidth='560px' padding='0'>
        <PopupBody paddingH='24px' paddingV='20px'>
          <BackButton onClick={onClose} color={textSecondary}>
            <ArrowLeft />
          </BackButton>
          <TitleWrapper>
            <PopupName color={textPrimary} marginTop='1'>
              {optionName}
            </PopupName>
          </TitleWrapper>
          <CloseIcon color={textSecondary} onClick={onClose} />
          <VotesContainer backgroundColor={surface1}>
            <VotesCount color={textSecondary}>{totalVotes} votes</VotesCount>
            {isLoadingInitial ? (
              <LoaderContainer>
                <Loader color={textSecondary} />
              </LoaderContainer>
            ) : (
              <VotesList onScroll={handleScroll}>
                {[...(ownVote ? [ownVote] : []), ...allVotes].map((vote: IPollVote) => {
                  const contact = contactsMap[vote.user.id]
                  return (
                    <VoterRow key={`${vote.optionId}_${vote.user.id}`}>
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
                                contact,
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
                  )
                })}
                {isLoading && allVotes.length > 0 && <LoadingText color={textSecondary}>Loading...</LoadingText>}
              </VotesList>
            )}
          </VotesContainer>
        </PopupBody>
      </Popup>
    </PopupContainer>
  )
}

export default AllVotesPopup

const VotesList = styled.div`
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: 500px;
  padding: 8px 0;
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
  max-width: calc(100% - 120px);
`

const VotedAt = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
`

const LoadingText = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  text-align: center;
  padding: 16px;
  font-size: 14px;
`
const TitleWrapper = styled.div`
  max-width: calc(100% - 54px);
  margin: 0 auto;
`

const BackButton = styled.button<{ color: string }>`
  position: absolute;
  left: 13px;
  top: 13px;
  padding: 9px;
  cursor: pointer;
  box-sizing: content-box;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(p) => p.color};
  flex-shrink: 0;

  & > svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    opacity: 0.7;
  }
`

const VotesContainer = styled.div<{ backgroundColor: string }>`
  padding: 0 16px 8px 16px;
  border-radius: 10px;
  background-color: ${(p) => p.backgroundColor};
  margin-top: 16px;
`

const VotesCount = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.4px;
  padding: 12px 0;
`

const LoaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  min-height: 100px;
`

const Loader = styled.div<{ color: string }>`
  width: 40px;
  height: 40px;
  border: 3px solid ${(p) => p.color}20;
  border-top-color: ${(p) => p.color};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`
