import React, { useEffect, useState } from 'react'
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
// Shared Components & Hooks
import { MonthHeader, useGroupedAttachments } from '../shared'

interface IProps {
  channel: IChannel
}

const Media = ({ channel }: IProps) => {
  const { [THEME_COLORS.BACKGROUND]: background } = useColor()
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []
  const [mediaFile, setMediaFile] = useState<any>(null)
  const dispatch = useDispatch()
  const handleMediaItemClick = (file: IAttachment) => {
    setMediaFile(file)
  }
  useEffect(() => {
    dispatch(setAttachmentsAC([]))
    dispatch(getAttachmentsAC(channel.id, channelDetailsTabs.media))
  }, [channel.id, dispatch])

  const groupedAttachments = useGroupedAttachments(attachments)

  return (
    <Container>
      {groupedAttachments.map((group) => (
        <React.Fragment key={group.monthKey}>
          <MonthHeader month={group.monthHeader} leftPadding={6} />
          <MediaGroup>
            {group.files.map((file: IAttachment) => (
              <MediaItem key={file.id}>
                {file.type === 'image' ? (
                  <Attachment
                    attachment={{
                      ...file,
                      metadata: isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata
                    }}
                    handleMediaItemClick={handleMediaItemClick}
                    backgroundColor={background}
                    borderRadius='8px'
                    isDetailsView
                  />
                ) : (
                  // <img src={file.url} alt='' />

                  <Attachment
                    attachment={{
                      ...file,
                      metadata: isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata
                    }}
                    handleMediaItemClick={handleMediaItemClick}
                    backgroundColor={background}
                    borderRadius='8px'
                    isDetailsView
                  />
                  /* <video>
                    <source src={file.url} type={`video/${getFileExtension(file.name)}`} />
                    <source src={file.url} type='video/ogg' />
                    <track default kind='captions' srcLang='en' src='/media/examples/friday.vtt' />
                    Your browser does not support the video tag.
                  </video> */
                )}
              </MediaItem>
            ))}
          </MediaGroup>
        </React.Fragment>
      ))}
      {mediaFile && (
        <SliderPopup
          channel={channel}
          setIsSliderOpen={setMediaFile}
          mediaFiles={attachments}
          currentMediaFile={mediaFile}
        />
      )}
    </Container>
  )
}

export default Media

const Container = styled.div<any>`
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  transition: all 0.2s;
`
const MediaGroup = styled.div`
  padding: 9px 2px 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
`
const MediaItem = styled.div`
  width: calc(33.3333% - 4px);
  aspect-ratio: 1/1;
  box-sizing: border-box;
  //border: 1px solid #ccc;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
  margin: 2px;
`
