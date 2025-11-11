import styled from 'styled-components'
import React, { memo, useEffect, useRef, useState } from 'react'
import { ReactComponent as PlayIcon } from '../../assets/svg/playVideo.svg'
import { ReactComponent as VideoCamIcon } from '../../assets/svg/video-call.svg'
import { IAttachment } from '../../types'
// import { ReactComponent as DownloadIcon } from '../../assets/svg/download.svg'
// import { ReactComponent as CancelIcon } from '../../assets/svg/cancel.svg'
import { AttachmentIconCont, UploadProgress } from '../../UIHelper'
import { getAttachmentUrlFromCache } from '../../helpers/attachmentsCache'
import { base64ToToDataURL } from '../../helpers/resizeImage'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'
// import { CircularProgressbar } from 'react-circular-progressbar'
// import { ProgressWrapper } from '../Attachment'

interface IVideoPreviewProps {
  width?: string
  height?: string
  theme?: string
  file: IAttachment
  borderRadius?: string
  isPreview?: boolean
  isCachedFile?: boolean
  isRepliedMessage?: boolean
  backgroundColor: string
  src: string
  uploading?: boolean
  isDetailsView?: boolean
  // eslint-disable-next-line no-unused-vars
  setVideoIsReadyToSend?: (attachmentId: string) => void
}
const VideoPreview = memo(function VideoPreview({
  width,
  height,
  src,
  file,
  borderRadius,
  isPreview,
  uploading,
  // isCachedFile = true,
  isRepliedMessage,
  backgroundColor,
  isDetailsView,
  setVideoIsReadyToSend
}: IVideoPreviewProps) {
  const {
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.OVERLAY_BACKGROUND_2]: overlayBackground2,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary
  } = useColor()
  // const { [THEME_COLORS.TEXT_PRIMARY]: background } = useSelector(themeSelector)
  // const VideoPreview =
  let currentTime = ''
  if (file.metadata && file.metadata.dur) {
    const mins = Math.floor(file.metadata.dur / 60)
    const seconds = Math.floor(file.metadata.dur % 60)
    currentTime = `${mins}:${seconds < 10 ? `0${seconds}` : seconds}`
  }
  const [videoCurrentTime, setVideoCurrentTime] = useState<string | null>(currentTime)
  const [loading, setLoading] = useState(true)
  // const [progress, setProgress] = useState(3)
  // const [showProgress, setShowProgress] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  // const [downloadIsCancelled, setDownloadIsCancelled] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  let attachmentThumb
  let withPrefix = true

  if (file.metadata && file.metadata.tmb) {
    if (file.metadata.tmb.length < 70) {
      attachmentThumb = base64ToToDataURL(file.metadata.tmb)
      withPrefix = false
    } else {
      attachmentThumb = file.metadata && file.metadata.tmb
    }
  }
  /*  const handleVideoProgress = (e: any) => {
    const loadedPercentage = e.currentTarget.buffered.end(0) / e.currentTarget.duration
    if (loadedPercentage > 0.03) {
      setProgress(loadedPercentage * 100)
    }
  } */
  /* const handlePauseResumeDownload = (e: Event) => {
    e.stopPropagation()
    if (downloadIsCancelled) {
      setDownloadIsCancelled(false)
      if (videoRef.current && videoUrl) {
        videoRef.current.src = videoUrl
      }
    } else {
      setDownloadIsCancelled(true)
      if (videoRef.current) {
        videoRef.current.src = ''
      }
    }
  } */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const checkReadyState = () => {
      if (video.readyState > 3) {
        // Video is ready
        setLoading(false)
        const minutes = Math.floor(video.duration / 60)
        const seconds = Math.floor(video.duration % 60)
        if (!videoCurrentTime) {
          setVideoCurrentTime(`${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`)
        }
        if (setVideoIsReadyToSend) {
          setVideoIsReadyToSend(file.tid!)
        }
        return true
      }
      return false
    }

    // Try immediate check
    if (checkReadyState()) return

    // Set up event listeners
    const handleCanPlay = () => checkReadyState()
    const handleLoadedMetadata = () => checkReadyState()

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)

    // Fallback interval
    const interval = setInterval(() => {
      if (checkReadyState()) {
        clearInterval(interval)
      }
    }, 1000)

    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    getAttachmentUrlFromCache(file.url).then((cachedUrl: string) => {
      if (!videoUrl) {
        if (!cachedUrl && src) {
          setVideoUrl(src)
        } else if (cachedUrl) {
          setVideoUrl(cachedUrl)
        }
      }
    })
  }, [src])

  /* useEffect(() => {
    log.info('render video *********************************************')
  }) */
  // log.info('!isPreview && loading && !uploading &&. . . .  . . . . . .. ', !isPreview && loading && !uploading)
  return (
    <Component
      width={width}
      height={height}
      borderRadius={borderRadius}
      isRepliedMessage={isRepliedMessage}
      isPreview={isPreview}
      backgroundColor={backgroundColor}
      isDetailsView={isDetailsView}
    >
      {!isPreview && loading && !uploading && (
        <UploadProgress
          isDetailsView={isDetailsView}
          // onClick={handlePauseResumeDownload}
          isRepliedMessage={isRepliedMessage}
          borderRadius={borderRadius}
          backgroundImage={attachmentThumb}
          withPrefix={withPrefix}
          borderColor={border}
        >
          {/* {showProgress && (
            <UploadPercent isRepliedMessage={isRepliedMessage} backgroundColor={'rgba(23, 25, 28, 0.40)'}>
              <CancelResumeWrapper onClick={handlePauseResumeDownload}>
                {downloadIsCancelled ? <DownloadIcon /> : <CancelIcon />}
              </CancelResumeWrapper>
              <ProgressWrapper>
                <CircularProgressbar
                  minValue={0}
                  maxValue={100}
                  value={progress}
                  backgroundPadding={3}
                  background={true}
                  text=''
                  styles={{
                    // Rotation of path and trail, in number of turns (0-1)
                    // Whether to use rounded or flat corners on the ends - can use 'butt' or 'round'

                    // Text size
                    // textSize: '16px',
                    background: {
                      fill: 'rgba(23, 25, 28, 0)'
                    },
                    path: {
                      // Path color
                      stroke: `#fff`,
                      // Whether to use rounded or flat corners on the ends - can use 'butt' or 'round'
                      strokeLinecap: 'butt',
                      strokeWidth: '4px',
                      // Customize transition animation
                      transition: 'stroke-dashoffset 0.5s ease 0s',
                      // Rotate the path
                      transform: 'rotate(0turn)',
                      transformOrigin: 'center center'
                    }
                    // How long animation takes to go from one percentage to another, in seconds
                    // pathTransitionDuration: 0.5,

                    // Can specify path transition in more detail, or remove it entirely
                    // pathTransition: 'none',

                    // Colors
                    // pathColor: '#fff',
                    // textColor: '#f88',
                    // trailColor: 'transparent'
                  }}
                />
              </ProgressWrapper>
            </UploadPercent>
          )} */}
        </UploadProgress>
      )}
      <video
        draggable={false}
        ref={videoRef}
        preload='auto'
        id='video'
        // crossOrigin='anonymous'
        src={file.attachmentUrl || videoUrl}
        // onProgress={handleVideoProgress}
      />
      {/* {file.metadata && file.metadata.thumbnail && (
        <ImageThumbnail
          src={file.metadata.thumbnail}
          width={file.metadata.width}
          height={file.metadata.height}
          borderRadius={borderRadius}
          isLoaded={!loading}
        />
      )} */}
      {videoCurrentTime && !isRepliedMessage && (!isDetailsView || !loading) && (
        <VideoControls>
          {!isPreview && !!videoCurrentTime && !isRepliedMessage && !uploading && !isDetailsView && (
            // <VideoPlayButton showOnHover={videoPlaying} onClick={() => setVideoPlaying(!videoPlaying)}>
            <VideoPlayButton>
              <PlayIcon />
            </VideoPlayButton>
          )}
          <VideoTime
            isDetailsView={isDetailsView}
            isRepliedMessage={isPreview || isRepliedMessage}
            color={textOnPrimary}
            messageTimeBackgroundColor={overlayBackground2}
          >
            {!isRepliedMessage && !isPreview && <VideoCamIcon />}
            {videoCurrentTime}
          </VideoTime>
        </VideoControls>
      )}
    </Component>
  )
})

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

const VideoTime = styled.div<{
  isRepliedMessage?: boolean
  isDetailsView?: boolean
  color: string
  messageTimeBackgroundColor: string
}>`
  position: absolute;
  top: ${(props) => (props.isRepliedMessage ? '3px' : props.isDetailsView ? undefined : '8px')};
  bottom: ${(props) => (props.isDetailsView ? '8px' : undefined)};
  left: ${(props) => (props.isRepliedMessage ? '3px' : '8px')};
  font-size: ${(props) => (props.isRepliedMessage ? '10px' : '12px')};
  display: flex;
  align-items: center;
  border-radius: 16px;
  padding: ${(props) => (props.isRepliedMessage ? '0 3px' : '4px 6px')};
  background-color: ${(props) => `${props.messageTimeBackgroundColor}66`};
  line-height: 14px;
  color: ${(props) => props.color};
  z-index: 10;

  & > svg {
    color: ${(props) => props.color};
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
  width?: string
  height?: string
  borderRadius?: string
  backgroundColor: string
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 100%;
  max-height: 100%;
  width: ${(props) => props.width};
  height: ${(props) => props.height};
  min-height: ${(props) => !props.isRepliedMessage && !props.isPreview && !props.isDetailsView && '165px'};

  ${(props) => props.isRepliedMessage && 'margin-right: 8px'};
  /*width: 100vw;
  background-color: transparent;
  margin-top: -50vw;
  padding: 0 40px;
  z-index: 20;*/

  & > video {
    max-width: 100%;
    max-height: 100%;
    width: ${(props) => props.width};
    height: ${(props) => props.height};
    min-height: ${(props) => !props.isRepliedMessage && !props.isPreview && '165px'};
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
  borderColor: string
}>`
  display: flex;
  position: relative;
  align-items: center;
  padding: 6px 12px;
  width: 350px;
  height: 70px;
  background: ${(props) => props.background || '#ffffff'};
  border: ${(props) => props.border || `1px solid ${props.borderColor}`};
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
