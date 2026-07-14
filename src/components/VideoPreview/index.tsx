import styled from 'styled-components'
import React, { memo, useEffect, useMemo, useRef } from 'react'
import { ReactComponent as PlayIcon } from '../../assets/svg/playVideo.svg'
import { ReactComponent as VideoPlayerPlay } from '../../assets/svg/videoPlayerPlay.svg'
import { ReactComponent as VideoCamIcon } from '../../assets/svg/video-call.svg'
import { IAttachment } from '../../types'
import { AttachmentIconCont } from '../../UIHelper'
import {
  getAttachmentUrlFromCache,
  getAttachmentURLWithVersion,
  setAttachmentToCache
} from '../../helpers/attachmentsCache'
import { base64ToDataURL } from '../../helpers/resizeImage'
import { getVideoFirstFrame } from '../../helpers/getVideoFrame'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'
import { setUpdateMessageAttachmentAC } from 'store/message/actions'
import { useDispatch, useSelector } from 'store/hooks'
import { calculateRenderedImageWidth } from 'helpers'
import { isJSON } from 'helpers/message'

interface IVideoPreviewProps {
  width: string
  height: string
  file: IAttachment
  borderRadius?: string
  isPreview?: boolean
  isCachedFile?: boolean
  isRepliedMessage?: boolean
  backgroundColor: string
  src: string
  uploading?: boolean
  isDetailsView?: boolean
  setVideoIsReadyToSend?: (attachmentId: string) => void
  downloading: boolean
  onlyVideoImage?: boolean
}

const VideoPreview = memo(
  function VideoPreview({
    width,
    height,
    src,
    file,
    borderRadius,
    isPreview,
    uploading,
    isRepliedMessage,
    backgroundColor,
    isDetailsView,
    downloading,
    setVideoIsReadyToSend,
    onlyVideoImage
  }: IVideoPreviewProps) {
    const {
      [THEME_COLORS.BORDER]: border,
      [THEME_COLORS.OVERLAY_BACKGROUND_2]: overlayBackground2,
      [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary
    } = useColor()
    const dispatch = useDispatch()

    const attachmentVideoFirstFrame = useSelector((store: any) => {
      const map = store.MessageReducer.attachmentUpdatedMap
      return (
        map[getAttachmentURLWithVersion(file.metadata?.tmb)] || map[getAttachmentURLWithVersion(file.url)] || undefined
      )
    })

    const parsedMetadata = useMemo(() => {
      if (!file.metadata) return null
      return isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata
    }, [file.metadata])

    // Calculate initial duration from metadata
    const videoCurrentTime = useMemo(() => {
      if (parsedMetadata?.dur) {
        const mins = Math.floor(parsedMetadata.dur / 60)
        const seconds = Math.floor(parsedMetadata.dur % 60)
        return `${mins}:${seconds < 10 ? `0${seconds}` : seconds}`
      }
      return null
    }, [parsedMetadata])

    // Stable background image state - prevents blinking
    // Get thumbnail from metadata
    const attachmentThumb = useMemo(() => {
      if (parsedMetadata?.tmb) {
        if (parsedMetadata.tmb.length < 70) {
          return { thumbnail: base64ToDataURL(parsedMetadata.tmb), withPrefix: false }
        }
        return { thumbnail: parsedMetadata.tmb, withPrefix: true }
      }
      return { thumbnail: undefined, withPrefix: false }
    }, [parsedMetadata])

    const isExtractingRef = useRef(false)
    const hasExtractionFailedRef = useRef(false)

    useEffect(() => {
      const videoSource = src
      if (!videoSource || isExtractingRef.current || hasExtractionFailedRef.current) return

      // If we already have a cached frame from store, skip extraction
      if (attachmentVideoFirstFrame && !isPreview) return

      const frameCacheKey = file.url

      // Reset extraction failed flag when source changes
      hasExtractionFailedRef.current = false

      const checkCache = async (): Promise<boolean> => {
        try {
          const cachedUrl = await getAttachmentUrlFromCache(frameCacheKey)
          if (cachedUrl) {
            if (!isPreview) {
              dispatch(setUpdateMessageAttachmentAC(file.url, cachedUrl))
            }
            return true
          }
        } catch (error) {
          // Cache miss, continue to extraction
          console.error('Error checking cache:', error)
        }
        return false
      }

      const extractFirstFrame = async () => {
        if (isExtractingRef.current) return

        try {
          isExtractingRef.current = true
          const [newWidth, newHeight] = calculateRenderedImageWidth(
            parsedMetadata?.szw || 1280,
            parsedMetadata?.szh || 1080
          )
          // Use getVideoFirstFrame helper function - it handles everything internally
          const result = await getVideoFirstFrame(videoSource, newWidth, newHeight, 0.8)

          if (!result) {
            isExtractingRef.current = false
            return
          }
          if (isPreview && setVideoIsReadyToSend) {
            setVideoIsReadyToSend(file.tid!)
          }

          const { frameBlobUrl, blob } = result

          try {
            // Cache the frame
            const response = new Response(blob, {
              headers: { 'Content-Type': 'image/jpeg' }
            })
            if (!isPreview) {
              setAttachmentToCache(frameCacheKey, response)
            }

            if (!isPreview) {
              dispatch(setUpdateMessageAttachmentAC(file.url, frameBlobUrl))
            }
          } catch (error) {
            console.error('Error processing extracted frame:', error)
            if (frameBlobUrl) {
              URL.revokeObjectURL(frameBlobUrl)
            }
          } finally {
            isExtractingRef.current = false
          }
        } catch (error) {
          console.error('Error extracting first frame:', error)
          hasExtractionFailedRef.current = true
          isExtractingRef.current = false
        }
      }

      // Check cache first, then extract if needed
      checkCache().then((cached) => {
        if (!cached && !isExtractingRef.current) {
          extractFirstFrame()
        }
      })
    }, [file.attachmentUrl, file.url, src, dispatch, attachmentVideoFirstFrame, isPreview, setVideoIsReadyToSend])

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
        <UploadInProgress
          isRepliedMessage={isRepliedMessage}
          src={
            attachmentVideoFirstFrame ||
            (attachmentThumb?.withPrefix
              ? `data:image/jpeg;base64,${attachmentThumb.thumbnail}`
              : attachmentThumb?.thumbnail)
          }
          width={parseInt(width)}
          height={parseInt(height)}
          withBorder={!isPreview && !isDetailsView}
          backgroundColor={backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : overlayBackground2}
          isDetailsView={isDetailsView}
          borderColor={border}
          loading='lazy'
          decoding='async'
          fetchpriority='high'
          isPreview={isPreview}
          borderRadius={borderRadius}
        />
        {onlyVideoImage && (
          <VideoIcon bg={overlayBackground2}>
            <VideoPlayerPlay />
          </VideoIcon>
        )}
        {!isRepliedMessage && !downloading && !onlyVideoImage && (
          <VideoControls className='video-controls'>
            {!isPreview && !isRepliedMessage && !uploading && !isDetailsView && (
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
  },
  (prev, next) =>
    prev.src === next.src &&
    prev.file.id === next.file.id &&
    prev.file.url === next.file.url &&
    prev.file.metadata === next.file.metadata &&
    prev.uploading === next.uploading &&
    prev.downloading === next.downloading &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.borderRadius === next.borderRadius &&
    prev.isRepliedMessage === next.isRepliedMessage
)

export default VideoPreview

const VideoControls = styled.div`
  position: absolute;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6;
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
  min-width: ${(props) => !props.isRepliedMessage && !props.isPreview && !props.isDetailsView && '100%'};

  ${(props) => props.isRepliedMessage && 'margin-right: 8px'};
  /*width: 100vw;
  background-color: transparent;
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
  backgroundColor?: string
  border?: string
  borderColor: string
}>`
  display: flex;
  position: relative;
  align-items: center;
  padding: 6px 12px;
  width: 350px;
  height: 70px;
  background: ${(props) => props.backgroundColor || '#ffffff'};
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

const UploadInProgress = styled.img<{
  withPrefix?: boolean
  width?: number
  height?: number
  borderRadius?: string
  backgroundColor?: string
  borderColor?: string
  isRepliedMessage?: boolean
  isPreview?: boolean
  isDetailsView?: boolean
  withBorder?: boolean
  fileAttachment?: boolean
  imageMinWidth?: string
  fetchpriority?: string
}>`
  width: ${(props) =>
    props.fileAttachment || props.isRepliedMessage ? '40px' : props.width ? `${props.width}px` : '100%'};
  height: ${(props) =>
    props.fileAttachment || props.isRepliedMessage ? '40px' : props.height ? `${props.height}px` : '100%'};
  min-width: ${(props) =>
    !props.fileAttachment && !props.isRepliedMessage && !props.isPreview ? props.imageMinWidth || '100%' : null};
  min-height: ${(props) =>
    !props.fileAttachment && !props.isRepliedMessage && !props.isDetailsView && !props.isPreview && '165px'};
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  border-radius: ${(props) =>
    props.fileAttachment ? '8px' : props.borderRadius ? props.borderRadius : props.isRepliedMessage ? '4px' : '8px'};
  cursor: pointer;
  border: ${(props) =>
    props.isRepliedMessage
      ? '0.5px solid rgba(0, 0, 0, 0.1)'
      : props.withBorder && `2px solid ${props.backgroundColor}`};
  box-sizing: border-box;
  ${(props) =>
    props.isDetailsView &&
    `
    width: 100%;
    height: 100%;
    min-width: inherit;
  `}
  object-fit: cover;
`

const VideoIcon = styled.div<{ bg: string }>`
  position: absolute;
  z-index: 1;
  left: 0px;
  top: 0px;
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ bg }) => bg}66;

  & > svg {
    width: 16px;
    height: 16px;
  }
`
