import React, { useState } from 'react'
import styled from 'styled-components'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'
import { IMessage, IPollVote } from 'types'
import { useDispatch, useSelector } from 'store/hooks'
import { activeChannelSelector } from 'store/channel/selector'
import { userSelector } from 'store/user/selector'
import { addPollVoteAC, deletePollVoteAC } from 'store/message/actions'
import { Button } from 'UIHelper'
import VotesResultsPopup from 'common/popups/pollMessage/votesResults'
import Avatar from 'components/Avatar'
import { ReactComponent as FilledCheckboxIcon } from '../../../assets/svg/filled-checkbox.svg'

interface PollMessageProps {
  message: IMessage
}

const PollMessage = ({ message }: PollMessageProps) => {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.ACCENT]: accent,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND]: incomingMessageBackground,
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: outgoingMessageBackground,
    [THEME_COLORS.BORDER_SECONDARY]: borderSecondary
  } = useColor()

  const dispatch = useDispatch()
  const channel = useSelector(activeChannelSelector)
  useSelector(userSelector)

  const poll = message?.pollDetails
  const [showResults, setShowResults] = useState(false)
  if (!poll) {
    return null
  }

  const votesPerOption: Record<string, number> = poll.votesPerOption || {}
  const maxVotes = poll.options.reduce((acc, opt) => Math.max(acc, votesPerOption[opt.id] || 0), 0)
  const ownVotedOptionIds = new Set((poll.ownVotes || []).map((v) => v.optionId))
  const votesUsers = poll.votes || []

  const canVote = !poll.closed

  const handleVote = (optionId: string) => {
    if (!canVote) return
    const hasVoted = ownVotedOptionIds.has(optionId)

    if (hasVoted) {
      if (!poll.allowVoteRetract) return
      dispatch(deletePollVoteAC(channel.id, poll.id, optionId, message))
      return
    }
    dispatch(addPollVoteAC(channel.id, poll.id, optionId, message))
  }

  const handleViewResults = () => setShowResults(true)

  return (
    <Container>
      <Question color={textPrimary}>{poll.name}</Question>
      <SubTitle color={textSecondary}>{poll.closed ? 'Poll finished' : poll.anonymous ? 'Anonymous poll' : 'Public poll'}</SubTitle>
      <Options>
        {(poll.options || []).map((opt: any) => {
          const votes = votesPerOption[opt.id] || 0
          const pct = maxVotes > 0 ? Math.round((votes / maxVotes) * 100) : 0
          const selected = ownVotedOptionIds.has(opt.id)
          const optionVotesUsers = votesUsers.filter((v: IPollVote) => v.optionId === opt.id).slice(0, 3)
          if (optionVotesUsers.length < 3) {
            poll?.ownVotes?.forEach((vote: IPollVote) => {
              if (vote.optionId === opt.id) {
                optionVotesUsers.push(vote)
              }
            })
          }

          return (
            <Option
              key={opt.id}
              background={surface1}
              hover={backgroundHovered}
              color={textPrimary}
              onClick={() => {
                if (poll?.closed) return
                handleVote(opt.id)
              }}
              role='button'
              disabled={poll?.closed}
            >
              <TopRow>
                {!poll.closed && <Indicator disabled={poll?.closed}>
                  {selected ? <StyledCheck color={accent} /> : <EmptyCircle border={borderSecondary} />}
                </Indicator>}
                <Title color={textPrimary}>{opt.name}</Title>
                {poll.anonymous ? null : (
                  <UsersContainer>
                    {optionVotesUsers.map((vote: IPollVote) => (
                      <Avatar
                        key={vote?.user?.id}
                        image={vote?.user?.profile?.avatar}
                        name={vote?.user?.profile?.firstName}
                        size={18}
                        textSize={12}
                        setDefaultAvatar
                        marginAuto='0 0 0 -10px'
                        border={`2px solid ${message.incoming ? incomingMessageBackground : outgoingMessageBackground}`}
                      />
                    ))}
                  </UsersContainer>
                )}
                <Votes color={textPrimary}>{votes}</Votes>
              </TopRow>
              <Bar track={borderSecondary} closed={poll.closed}>
                <Fill style={{ width: `${pct}%`, background: accent }} />
              </Bar>
            </Option>
          )
        })}
      </Options>
      {!poll?.anonymous && (
        <Button
          type='button'
          backgroundColor={background}
          color={accent}
          borderRadius='14px'
          onClick={handleViewResults}
          style={{ width: '100%', marginTop: 10 }}
        >
          View Results
        </Button>
      )}
      {showResults && (
        <VotesResultsPopup
          onClose={() => setShowResults(false)}
          poll={poll as any}
          messageId={message.id}
        />
      )}
    </Container>
  )
}

export default PollMessage

const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 250px;
`

const Question = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.4px;
`

const SubTitle = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  margin: 4px 0 6px 0;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.08px;
`

const Options = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 4px;
`

const Option = styled.div<{ background: string; hover: string; color: string; disabled?: boolean }>`
  padding: 10px 0;
  color: ${(p) => p.color};
  cursor: pointer;
  user-select: none;
  cursor: ${(p) => (p.disabled ? 'not-allowed' : 'pointer')};
`

const TopRow = styled.div`
  display: flex;
  margin-bottom: 6px;
  min-height: 22px;
`

const Indicator = styled.div<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  min-width: 20px;
  height: 20px;
  margin-right: 8px;
  opacity: ${(p) => (p.disabled ? 0.5 : 1)};
  cursor: ${(p) => (p.disabled ? 'not-allowed' : 'pointer')};
`

const EmptyCircle = styled.span<{ border: string }>`
  display: inline-block;
  width: 18.5px;
  height: 18.5px;
  border-radius: 50%;
  border: 1px solid ${(p) => p.border};
  box-sizing: border-box;
`

const StyledCheck = styled(FilledCheckboxIcon) <{ color: string }>`
  color: ${(p) => p.color};
  width: 18.5px;
  height: 18.5px;
`

const Title = styled.div<{ color: string }>`
  flex: 1 1 auto;
  color: ${(p) => p.color};
  margin-right: auto;
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.2px;
`

const Votes = styled.span<{ color: string }>`
  color: ${(p) => p.color};
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.2px;
  margin-left: 4px;
  margin-top: auto;
  margin-bottom: 1px;
`

const Bar = styled.div<{ track: string; closed?: boolean }>`
  width: ${(p) => p.closed ? '100%' : `calc(100% - 28px)`};
  height: 6px;
  border-radius: 6px;
  background: ${(p) => p.track};
  overflow: hidden;
  margin-left: auto;
`

const Fill = styled.div`
  height: 100%;
  border-radius: 6px;
`

const UsersContainer = styled.div`
  display: flex;
  align-items: center;
  margin-left: auto;
  padding-left: 16px;
  height: max-content;
  margin-top: auto;
`
