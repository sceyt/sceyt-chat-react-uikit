import React, { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
// Store
import { getAttachmentsAC, setAttachmentsAC } from '../../../../store/message/actions'
import { activeTabAttachmentsSelector } from '../../../../store/message/selector'
// Helpers
import { isJSON } from '../../../../helpers/message'
import { channelDetailsTabs } from '../../../../helpers/constants'
import { IAttachment, IChannel } from '../../../../types'
// Components
import Attachment from '../../../Attachment'
import SliderPopup from '../../../../common/popups/sliderPopup'
import { useColor } from '../../../../hooks'
import { THEME_COLORS } from '../../../../UIHelper/constants'

interface IProps {
  channel: IChannel
}

const Media = ({ channel }: IProps) => {
  const { [THEME_COLORS.BACKGROUND]: background, [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []
  const [mediaFile, setMediaFile] = useState<any>(null)
  const dispatch = useDispatch()

  const handleMediaItemClick = (file: IAttachment) => {
    if (file?.id) {
      setMediaFile(file)
    }
  }

  useEffect(() => {
    dispatch(setAttachmentsAC([]))
    dispatch(getAttachmentsAC(channel.id, channelDetailsTabs.media, 35))
  }, [channel.id])

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
      {groups.map((group) => (
        <MonthSection key={group.key}>
          <StickyMonthHeader color={textSecondary} background={background}>
            {group.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </StickyMonthHeader>
          <ItemsGrid>
            {group.items.map((file: IAttachment, index: number) => (
              <MediaItem key={`${file.id}_${index}`}>
                <Attachment
                  attachment={{ ...file, metadata: isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata }}
                  handleMediaItemClick={handleMediaItemClick}
                  backgroundColor={background}
                  borderRadius='8px'
                  isDetailsView
                />
              </MediaItem>
            ))}
          </ItemsGrid>
        </MonthSection>
      ))}
      {mediaFile && <SliderPopup channel={channel} setIsSliderOpen={setMediaFile} currentMediaFile={mediaFile} />}
    </Container>
  )
}

export default Media

const Container = styled.div`
  padding: 0 4px;
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
  padding: 9px 6px;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};
`

const ItemsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
`

const MediaItem = styled.div`
  width: calc(33.3333% - 4px);
  aspect-ratio: 1/1;
  box-sizing: border-box;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
  margin: 2px;
`
