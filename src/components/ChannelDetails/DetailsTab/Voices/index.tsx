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
  const dispatch = useDispatch()
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []
  const { [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()

  useEffect(() => {
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.voice))
  }, [channelId])

  return (
    <Container>
      {attachments.map((file: IAttachment, index: number) => {
        let monthComponent: React.ReactNode = null

        if (index === 0) {
          monthComponent = (
            <MonthHeader color={textSecondary}>
              {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </MonthHeader>
          )
        } else if (
          index > 0 &&
          new Date(file.createdAt).getMonth() !== new Date(attachments[index - 1].createdAt).getMonth()
        ) {
          monthComponent = (
            <MonthHeader color={textSecondary}>
              {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </MonthHeader>
          )
        }

        return (
          <React.Fragment key={file.id}>
            {monthComponent}
            <VoiceItem
              file={{ ...file, metadata: isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata }}
              voicePreviewDateAndTimeColor={voicePreviewDateAndTimeColor}
              voicePreviewHoverBackgroundColor={voicePreviewHoverBackgroundColor}
              voicePreviewPlayHoverIcon={voicePreviewPlayIcon}
              voicePreviewPlayIcon={voicePreviewPlayHoverIcon}
              voicePreviewPauseIcon={voicePreviewPauseIcon}
              voicePreviewPauseHoverIcon={voicePreviewPauseHoverIcon}
              voicePreviewTitleColor={voicePreviewTitleColor}
            />
          </React.Fragment>
        )
      })}
    </Container>
  )
}

export default Voices

const Container = styled.ul`
  margin: 0;
  padding: 11px 0 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  transition: all 0.2s;
`
const MonthHeader = styled.div<{ color: string }>`
  padding: 9px 16px;
  font-style: normal;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};
  text-transform: uppercase;
`
