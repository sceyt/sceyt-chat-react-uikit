import React, { useEffect, useMemo } from 'react'
import styled, { keyframes } from 'styled-components'
import { shallowEqual } from 'react-redux'
import { useDispatch, useSelector } from 'store/hooks'
import { channelDetailsTabs, LOADING_STATE } from '../../../../helpers/constants'
import { activeTabAttachmentsSelector, attachmentLoadingStateSelector } from '../../../../store/message/selector'
import { IAttachment } from '../../../../types'
import { getAttachmentsAC } from '../../../../store/message/actions'
import VoiceItem from './voiceItem'
import { isJSON } from '../../../../helpers/message'
import { THEME_COLORS } from '../../../../UIHelper/constants'
import { useColor } from '../../../../hooks'

interface IProps {
  channelId: string
  voicePreviewPlayIcon?: JSX.Element
  voicePreviewPlayHoverIcon?: JSX.Element
  voicePreviewPauseIcon?: JSX.Element
  voicePreviewPauseHoverIcon?: JSX.Element
  voicePreviewTitleColor?: string
  voicePreviewDateAndTimeColor?: string
  voicePreviewHoverBackgroundColor?: string
}

const Voices = ({
  channelId,
  voicePreviewPlayIcon,
  voicePreviewPlayHoverIcon,
  voicePreviewPauseIcon,
  voicePreviewPauseHoverIcon,
  voicePreviewTitleColor,
  voicePreviewDateAndTimeColor,
  voicePreviewHoverBackgroundColor
}: IProps) => {
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_1]: surface1
  } = useColor()
  const dispatch = useDispatch()
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []
  const loadingState = useSelector(attachmentLoadingStateSelector)

  useEffect(() => {
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.voice, 35))
  }, [channelId])

  const groups = useMemo(() => {
    const result: { key: string; date: Date; items: IAttachment[] }[] = []
    attachments.forEach((att: IAttachment) => {
      const date = new Date(att.createdAt)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      const existing = result.find((g) => g.key === key)
      if (existing) {
        existing.items.push(att)
      } else {
        result.push({ key, date, items: [att] })
      }
    })
    return result
  }, [attachments])

  return (
    <Container>
      {loadingState === LOADING_STATE.LOADING ? (
        <React.Fragment>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i}>
              <SkeletonCircle color={surface1} />
              <SkeletonTextGroup>
                <SkeletonLine color={surface1} width='50%' />
                <SkeletonLine color={surface1} width='30%' height='12px' />
              </SkeletonTextGroup>
            </SkeletonRow>
          ))}
        </React.Fragment>
      ) : loadingState === LOADING_STATE.LOADED && attachments.length === 0 ? (
        <EmptyState color={textSecondary}>No shared voice messages.</EmptyState>
      ) : (
        groups.map((group) => (
          <MonthSection key={group.key}>
            <StickyMonthHeader color={textSecondary} background={background}>
              {group.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </StickyMonthHeader>
            {group.items.map((file: IAttachment) => (
              <VoiceItem
                key={file.id}
                file={{ ...file, metadata: isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata }}
                voicePreviewDateAndTimeColor={voicePreviewDateAndTimeColor}
                voicePreviewHoverBackgroundColor={voicePreviewHoverBackgroundColor}
                voicePreviewPlayHoverIcon={voicePreviewPlayIcon}
                voicePreviewPlayIcon={voicePreviewPlayHoverIcon}
                voicePreviewPauseIcon={voicePreviewPauseIcon}
                voicePreviewPauseHoverIcon={voicePreviewPauseHoverIcon}
                voicePreviewTitleColor={voicePreviewTitleColor}
              />
            ))}
          </MonthSection>
        ))
      )}
    </Container>
  )
}

export default Voices

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`

const SkeletonBlock = styled.div<{ color: string }>`
  background-color: ${(p) => p.color};
  background-image: linear-gradient(
    90deg,
    ${(p) => p.color} 0px,
    rgba(255, 255, 255, 0.65) 100px,
    ${(p) => p.color} 200px
  );
  background-size: 600px 100%;
  background-repeat: no-repeat;
  animation: ${shimmer} 1.1s ease infinite;
`

const SkeletonRow = styled.div`
  display: flex;
  align-items: center;
  padding: 9px 16px;
  gap: 12px;
`

const SkeletonCircle = styled(SkeletonBlock)`
  width: 42px;
  height: 42px;
  border-radius: 50%;
  flex-shrink: 0;
`

const SkeletonTextGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
`

const SkeletonLine = styled(SkeletonBlock)<{ width: string; height?: string }>`
  width: ${(p) => p.width};
  height: ${(p) => p.height || '14px'};
  border-radius: 7px;
`

const EmptyState = styled.div<{ color: string }>`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 16px;
  color: ${(props) => props.color};
  font-size: 14px;
  line-height: 20px;
  margin-top: 100px;
`

const Container = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  transition: all 0.2s;
`

const MonthSection = styled.div`
  width: 100%;
`

const StickyMonthHeader = styled.div<{ color: string; background: string }>`
  position: sticky;
  top: 44px;
  z-index: 10;
  background: ${(props) => props.background};
  padding: 9px 14px;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};
  text-transform: capitalize;
`
