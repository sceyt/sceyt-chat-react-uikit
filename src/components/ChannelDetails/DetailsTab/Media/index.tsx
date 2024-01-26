import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
// Store
import { getAttachmentsAC, setAttachmentsAC } from '../../../../store/message/actions'
import { activeTabAttachmentsSelector } from '../../../../store/message/selector'
// Helpers
import { isJSON } from '../../../../helpers/message'
import { channelDetailsTabs } from '../../../../helpers/constants'
import { colors } from '../../../../UIHelper/constants'
import { IAttachment, IChannel } from '../../../../types'
// Components
import Attachment from '../../../Attachment'
import SliderPopup from '../../../../common/popups/sliderPopup'

interface IProps {
  channel: IChannel
}

const Media = ({ channel }: IProps) => {
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []
  const [mediaFile, setMediaFile] = useState<any>(null)
  const dispatch = useDispatch()
  const handleMediaItemClick = (file: IAttachment) => {
    setMediaFile(file)
  }
  useEffect(() => {
    dispatch(setAttachmentsAC([]))
    dispatch(getAttachmentsAC(channel.id, channelDetailsTabs.media))
  }, [channel.id])
  return (
    <Container>
      {attachments.map((file: IAttachment) => (
        <MediaItem key={file.id}>
          {file.type === 'image' ? (
            <Attachment
              attachment={{ ...file, metadata: isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata }}
              handleMediaItemClick={handleMediaItemClick}
              backgroundColor={colors.white}
              borderRadius='8px'
              isDetailsView
            />
          ) : (
            // <img src={file.url} alt='' />

            <Attachment
              attachment={{ ...file, metadata: isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata }}
              handleMediaItemClick={handleMediaItemClick}
              backgroundColor={colors.white}
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
  padding: 6px 4px;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  transition: all 0.2s;
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
`
const MediaItem = styled.div`
  width: calc(33.3333% - 4px);
  height: 110px;
  box-sizing: border-box;
  //border: 1px solid #ccc;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
  margin: 2px;
`
