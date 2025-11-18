import React, { useEffect } from 'react'
import styled from 'styled-components'
import { shallowEqual } from 'react-redux'
import { useDispatch, useSelector } from 'store/hooks'
import { channelDetailsTabs } from '../../../../helpers/constants'
import { activeTabAttachmentsSelector } from '../../../../store/message/selector'
import { IAttachment } from '../../../../types'
import { getAttachmentsAC } from '../../../../store/message/actions'
import VoiceItem from './voiceItem'
import { isJSON } from '../../../../helpers/message'
// Shared Components & Hooks
import { MonthHeader, useGroupedAttachments } from '../shared'

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
  const dispatch = useDispatch()
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []

  useEffect(() => {
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.voice))
  }, [channelId, dispatch])

  const groupedAttachments = useGroupedAttachments(attachments)

  return (
    <Container>
      {groupedAttachments.map((group) => (
        <React.Fragment key={group.monthKey}>
          <MonthHeader month={group.monthHeader} />
          {group.files.map((file: IAttachment) => (
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
        </React.Fragment>
      ))}
    </Container>
  )
}

export default Voices

const Container = styled.ul`
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  transition: all 0.2s;
`
