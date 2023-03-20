import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { ReactComponent as PlayIcon } from '../../assets/svg/playVideo.svg'
import { ReactComponent as VideoCamIcon } from '../../assets/svg/video-call.svg'
import { IAttachment } from '../../types'
import { colors } from '../../UIHelper/constants'
import { getFileExtension } from '../../helpers'
import { ReactComponent as DownloadIcon } from '../../assets/svg/download.svg'
import { ReactComponent as CancelIcon } from '../../assets/svg/cancel.svg'
import { getFrame3 } from '../../helpers/getVideoFrame'
import { setVideoThumb } from '../../helpers/messagesHalper'
import { AttachmentIconCont, UploadProgress, UploadingIcon, UploadPercent } from '../../UIHelper'
import { getAttachmentUrlFromCache } from '../../helpers/attachmentsCache'

interface IVideoPreviewProps {
  maxWidth?: string
  maxHeight?: string
  file: IAttachment
  borderRadius?: string
  isPreview?: boolean
  isRepliedMessage?: boolean
  backgroundColor: string
  src: string
  uploading?: boolean
  isDetailsView?: boolean
  setVideoIsReadyToSend?: (attachmentId: string) => void
}

const VideoPreview = ({
  maxWidth,
  maxHeight,
  src,
  file,
  borderRadius,
  isPreview,
  uploading,
  isRepliedMessage,
  backgroundColor,
  isDetailsView,
  setVideoIsReadyToSend
}: IVideoPreviewProps) => {
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoCurrentTime, setVideoCurrentTime] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [videoUrl, setVideoUrl] = useState(src)
  const [downloadIsCancelled, setDownloadIsCancelled] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handlePauseResumeDownload = (e: Event) => {
    e.stopPropagation()
    if (downloadIsCancelled) {
      setDownloadIsCancelled(false)
      if (videoRef.current) {
        videoRef.current.src = videoUrl
      }
    } else {
      setDownloadIsCancelled(true)
      if (videoRef.current) {
        videoRef.current.src = ''
      }
    }
  }
  useEffect(() => {
    let checkVideoInterval: any
    if (videoRef.current) {
      if (videoPlaying) {
        checkVideoInterval = setInterval(() => {
          if (videoRef.current && videoRef.current.readyState > 0) {
            const minutes = Math.floor((videoDuration - videoRef.current.currentTime) / 60)
            const seconds = Math.floor((videoDuration - videoRef.current.currentTime) % 60)
            setVideoCurrentTime(`${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`)
            if (videoRef.current.currentTime >= videoDuration) {
              setVideoPlaying(false)
              const minutes = Math.floor(videoDuration / 60)
              const seconds = Math.floor(videoDuration % 60)
              setVideoCurrentTime(`${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`)
            }
          }
        }, 500)
        videoRef.current.play()
      } else {
        clearInterval(checkVideoInterval)
        videoRef.current.pause()
      }
    }

    return () => clearInterval(checkVideoInterval)
  }, [videoPlaying])

  useEffect(() => {
    let checkVideoInterval: any

    if (videoRef.current) {
      checkVideoInterval = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState > 3) {
          // drawCanvas()
          videoRef.current.currentTime = 2
          setLoading(false)
          setVideoDuration(videoRef.current.duration)
          const minutes = Math.floor(videoRef.current.duration / 60)
          const seconds = Math.floor(videoRef.current.duration % 60)
          setVideoCurrentTime(`${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`)
          if (isPreview) {
            const thumb = await getFrame3(videoRef.current, 1)
            if (thumb) {
              setVideoThumb(file.attachmentId!, { ...thumb, duration: videoRef.current.duration })
              if (setVideoIsReadyToSend) {
                setVideoIsReadyToSend(file.attachmentId!)
              }
            }
          }
          clearInterval(checkVideoInterval)
        }
      }, 1000)
    }
    if (downloadIsCancelled) {
      clearInterval(checkVideoInterval)
    }
    return () => clearInterval(checkVideoInterval)
  }, [downloadIsCancelled])

  useEffect(() => {
    getAttachmentUrlFromCache(file.id!).then((cachedUrl) => {
      if (!cachedUrl) {
        setVideoUrl(src)
      } else if (!videoUrl) {
        setVideoUrl(src)
      }
    })
  }, [src])
  return (
    <Component
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      borderRadius={borderRadius}
      isRepliedMessage={isRepliedMessage}
      isPreview={isPreview}
      backgroundColor={backgroundColor}
      isDetailsView={isDetailsView}
    >
      {!isPreview && loading && !uploading && (
        <UploadProgress
          isDetailsView={isDetailsView}
          onClick={handlePauseResumeDownload}
          isRepliedMessage={isRepliedMessage}
          borderRadius={borderRadius}
          backgroundImage={file.metadata && file.metadata.tmb ? file.metadata.tmb : ''}
        >
          {/* {!isCached && ( */}
          <React.Fragment>
            <UploadPercent isRepliedMessage={isRepliedMessage}>
              {downloadIsCancelled ? <DownloadIcon /> : <CancelIcon />}
            </UploadPercent>
            {!downloadIsCancelled && <UploadingIcon isRepliedMessage={isRepliedMessage} className='rotate_cont' />}
          </React.Fragment>
          {/* )} */}
        </UploadProgress>
      )}
      <video
        draggable={false}
        ref={videoRef}
        preload='auto'
        id='video'
        // crossOrigin='anonymous'
        src={videoUrl}
        onPause={() => setVideoPlaying(false)}
        onPlay={() => setVideoPlaying(true)}
      >
        <source src={videoUrl || file.url} type={`video/${getFileExtension(file.name || file.data.name)}`} />
        <source src={videoUrl || file.url} type='video/ogg' />
        {/* <track default kind='captions' srcLang='en' src='../../assets/img/defaultAvatar.png' /> */}
        Your browser does not support the video tag.
      </video>
      {/* {file.metadata && file.metadata.thumbnail && (
        <ImageThumbnail
          src={file.metadata.thumbnail}
          width={file.metadata.width}
          height={file.metadata.height}
          borderRadius={borderRadius}
          isLoaded={!loading}
        />
      )} */}
      {videoCurrentTime && (
        <VideoControls>
          {!isPreview && !!videoDuration && !isRepliedMessage && !uploading && !isDetailsView && (
            // <VideoPlayButton showOnHover={videoPlaying} onClick={() => setVideoPlaying(!videoPlaying)}>
            <VideoPlayButton showOnHover={videoPlaying}>
              <PlayIcon />
            </VideoPlayButton>
          )}
          <VideoTime isDetailsView={isDetailsView} isRepliedMessage={isPreview || isRepliedMessage}>
            {!isRepliedMessage && !isPreview && <VideoCamIcon />}
            {videoCurrentTime}
          </VideoTime>
        </VideoControls>
      )}
    </Component>
  )
}

export default VideoPreview

const VideoControls = styled.div`
  position: absolute;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`

const VideoTime = styled.div<{ isRepliedMessage?: boolean; isDetailsView?: boolean }>`
  position: absolute;
  top: ${(props) => (props.isRepliedMessage ? '3px' : props.isDetailsView ? undefined : '8px')};
  bottom: ${(props) => (props.isDetailsView ? '8px' : undefined)};
  left: ${(props) => (props.isRepliedMessage ? '3px' : '8px')};
  font-size: ${(props) => (props.isRepliedMessage ? '10px' : '12px')};
  display: flex;
  align-items: center;
  border-radius: 16px;
  padding: ${(props) => (props.isRepliedMessage ? '0 3px' : '4px 6px')};
  background-color: rgba(1, 1, 1, 0.3);
  line-height: 14px;
  color: ${colors.white};

  & > svg {
    color: ${colors.white};
    margin-right: 4px;
  }
`

const VideoPlayButton = styled.div<{ showOnHover?: boolean }>`
  cursor: pointer;
  visibility: ${(props) => props.showOnHover && 'hidden'};
`

const Component = styled.div<{
  isPreview?: boolean
  isRepliedMessage?: boolean
  isDetailsView?: boolean
  maxWidth?: string
  maxHeight?: string
  borderRadius?: string
  backgroundColor: string
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: ${(props) => props.maxWidth || '100%'};
  max-height: ${(props) => props.maxHeight || '100%'};
  width: ${(props) => props.maxWidth};
  height: ${(props) => props.maxHeight};

  ${(props) => props.isRepliedMessage && 'margin-right: 8px'};
  /*width: 100vw;
  background-color: transparent;
  margin-top: -50vw;
  padding: 0 40px;
  z-index: 20;*/

  & > video {
    max-width: ${(props) => props.maxWidth || '100%'};
    max-height: ${(props) => props.maxHeight || '100%'};
    width: ${(props) => props.maxWidth};
    height: ${(props) => props.maxHeight};
    border: ${(props) =>
      !props.isPreview && props.isRepliedMessage
        ? '0.5px solid rgba(0, 0, 0, 0.1)'
        : !props.isDetailsView && `2px solid ${props.backgroundColor}`};
    object-fit: cover;
    box-sizing: border-box;
    border-radius: ${(props) => (props.borderRadius ? props.borderRadius : props.isRepliedMessage ? '4px' : '8px')};
  }

  &:hover {
    & ${VideoPlayButton} {
      visibility: visible;
    }
  }
`
const DownloadFile = styled.a<any>`
  visibility: hidden;
  opacity: 0;
  margin-left: auto;
  cursor: pointer;
  transition: all 0.1s;
`

export const AttachmentFile = styled.div<{
  isPrevious?: boolean
  borderRadius?: string
  background?: string
  border?: string
}>`
  display: flex;
  position: relative;
  align-items: center;
  padding: 6px 12px;
  width: 350px;
  height: 70px;
  background: ${(props) => props.background || '#ffffff'};
  border: ${(props) => props.border || `1px solid ${colors.gray1}`};
  box-sizing: border-box;
  margin-right: ${(props) => props.isPrevious && '16px'};
  margin-top: ${(props) => !props.isPrevious && '8px'};
  border-radius: ${(props) => props.borderRadius || '6px'};

  &:hover ${DownloadFile} {
    visibility: visible;
    opacity: 1;
  }

  & > ${AttachmentIconCont} svg {
    width: 36px;
    height: 36px;
  }
`

export const AttachmentImg = styled.img<{ borderRadius?: string }>`
  width: 100%;
  border-radius: ${(props) => props.borderRadius || '6px'};
  object-fit: cover;
`
