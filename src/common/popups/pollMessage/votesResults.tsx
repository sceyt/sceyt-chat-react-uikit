import React, { useMemo } from 'react'
import styled from 'styled-components'
import PopupContainer from '../popupContainer'
import { Popup, PopupBody, PopupName, CloseIcon, Row, Button } from 'UIHelper'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'
import Avatar from 'components/Avatar'
import { IPollVote } from 'types'

interface VotesResultsPopupProps {
  onClose: () => void
  poll: {
    id: string
    name: string
    options: { id: string; name: string }[]
    votes: IPollVote[]
    votesPerOption: Record<string, number>
  }
  // Optional: number of voters to show initially per option
  initialCount?: number
  onViewMoreOption?: (optionId: string) => void
}

const VotesResultsPopup = ({ onClose, poll, initialCount = 5, onViewMoreOption }: VotesResultsPopupProps) => {
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.ACCENT]: accent
  } = useColor()

  const optionIdToVotes = useMemo(() => {
    const map: Record<string, IPollVote[]> = {}
    ;(poll.votes || []).forEach((v) => {
      if (!map[v.optionId]) map[v.optionId] = []
      map[v.optionId].push(v)
    })
    // sort by createdAt desc (latest first)
    Object.keys(map).forEach((k) => map[k].sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt)))
    return map
  }, [poll.votes])

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
              const allVotes = optionIdToVotes[opt.id] || []
              const shownVotes = allVotes.slice(0, initialCount)
              const remaining = Math.max(0, (poll.votesPerOption?.[opt.id] || allVotes.length) - shownVotes.length)
              return (
                <OptionBlock key={opt.id} background={surface1} border={border}>
                  <OptionHeader>
                    <OptionTitle color={textPrimary}>{opt.name}</OptionTitle>
                    <OptionCount color={textSecondary}>
                      {(poll.votesPerOption && poll.votesPerOption[opt.id]) || allVotes.length} votes
                    </OptionCount>
                  </OptionHeader>
                  <Voters>
                    {shownVotes.map((vote) => (
                      <VoterRow key={`${opt.id}_${vote.user.id}`}>
                        <Avatar
                          image={vote.user.profile.avatar}
                          name={vote.user.profile.firstName || vote.user.id}
                          size={28}
                          textSize={12}
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
                  {remaining > 0 && (
                    <Row justify='center' marginTop='8px'>
                      <Button
                        type='button'
                        backgroundColor='transparent'
                        color={accent}
                        onClick={() => onViewMoreOption && onViewMoreOption(opt.id)}
                      >
                        View More
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
`

const OptionBlock = styled.div<{ background: string; border: string }>`
  background: ${(p) => p.background};
  border-radius: 12px;
  border: 1px solid ${(p) => p.border}0F; /* subtle */
  padding: 14px 16px;
`

const OptionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`

const OptionTitle = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-weight: 500;
  font-size: 14px;
`

const OptionCount = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-size: 13px;
`

const Voters = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const VoterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
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
  font-size: 14px;
`

const VotedAt = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-size: 13px;
`
