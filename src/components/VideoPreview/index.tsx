import styled from 'styled-components'
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ReactComponent as PlayIcon } from '../../assets/svg/playVideo.svg'
import { ReactComponent as VideoCamIcon } from '../../assets/svg/video-call.svg'
import { IAttachment } from '../../types'
import { AttachmentIconCont, UploadProgress } from '../../UIHelper'
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
import { attachmentUpdatedMapSelector } from 'store/message/selector'
import { calculateRenderedImageWidth } from 'helpers'

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
}

const VideoPreview = memo(function VideoPreview({
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
  setVideoIsReadyToSend
}: IVideoPreviewProps) {
  const {
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.OVERLAY_BACKGROUND_2]: overlayBackground2,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary
  } = useColor()
  const dispatch = useDispatch()

  const attachmentUpdatedMap = useSelector(attachmentUpdatedMapSelector)

  // Calculate initial duration from metadata
  const videoCurrentTime = useMemo(() => {
    if (file.metadata?.dur) {
      const mins = Math.floor(file.metadata.dur / 60)
      const seconds = Math.floor(file.metadata.dur % 60)
      return `${mins}:${seconds < 10 ? `0${seconds}` : seconds}`
    }
    return null
  }, [file.metadata?.dur])

  // Get cached frame from store
  const attachmentVideoFirstFrame = useMemo(
    () => attachmentUpdatedMap[getAttachmentURLWithVersion(file.url)],
    [attachmentUpdatedMap, file.url]
  )

  // Stable background image state - prevents blinking
  // Get thumbnail from metadata
  const attachmentThumb = useMemo(() => {
    if (file.metadata?.tmb) {
      if (file.metadata.tmb.length < 70) {
        return base64ToDataURL(file.metadata.tmb)
      }
      return file.metadata.tmb
    }
    return undefined
  }, [file.metadata?.tmb])

  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(
    attachmentVideoFirstFrame || attachmentThumb || undefined
  )
  const [backgroundWithPrefix, setBackgroundWithPrefix] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const isExtractingRef = useRef(false)
  const hasExtractionFailedRef = useRef(false)
  const extractedBlobUrlsRef = useRef<Set<string>>(new Set())
  const previousBackgroundImageRef = useRef<string | undefined>(undefined)

  const thumbnailWithPrefix = useMemo(() => {
    return !(file.metadata?.tmb && file.metadata.tmb.length < 70)
  }, [file.metadata?.tmb])

  // Initialize background image from thumbnail or cached frame
  useEffect(() => {
    // Prefer cached frame from store
    if (attachmentVideoFirstFrame && attachmentVideoFirstFrame !== backgroundImage) {
      setBackgroundImage(attachmentVideoFirstFrame)
      setBackgroundWithPrefix(false)
      return
    }

    // Fall back to thumbnail if available and no background image set
    if (attachmentThumb && !backgroundImage) {
      setBackgroundImage(attachmentThumb)
      setBackgroundWithPrefix(thumbnailWithPrefix)
    }
  }, [attachmentVideoFirstFrame, attachmentThumb, thumbnailWithPrefix, backgroundImage])

  // Track background image changes for smooth transitions
  useEffect(() => {
    if (backgroundImage !== undefined) {
      if (previousBackgroundImageRef.current === undefined) {
        // First image - no animation needed
        setShouldAnimate(false)
      } else if (previousBackgroundImageRef.current !== backgroundImage) {
        // Image changed - enable animation
        setShouldAnimate(true)
      }
      previousBackgroundImageRef.current = backgroundImage
    }
  }, [backgroundImage])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      extractedBlobUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      extractedBlobUrlsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const videoSource = src
    if (!videoSource || isExtractingRef.current || hasExtractionFailedRef.current) return

    // If we already have a cached frame from store, skip extraction
    if (attachmentVideoFirstFrame && !isPreview) return

    const frameCacheKey = file.url
    let isMounted = true

    // Reset extraction failed flag when source changes
    hasExtractionFailedRef.current = false

    const checkCache = async (): Promise<boolean> => {
      try {
        const cachedUrl = await getAttachmentUrlFromCache(frameCacheKey)
        if (cachedUrl && isMounted) {
          extractedBlobUrlsRef.current.add(cachedUrl)
          setBackgroundImage(cachedUrl)
          setBackgroundWithPrefix(false)
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
      if (isExtractingRef.current || !isMounted) return

      try {
        isExtractingRef.current = true
        const [newWidth, newHeight] = calculateRenderedImageWidth(
          file.metadata?.szw || 1280,
          file.metadata?.szh || 1080
        )
        // Use getVideoFirstFrame helper function - it handles everything internally
        const result = await getVideoFirstFrame(videoSource, newWidth, newHeight, 0.8)

        if (!result || !isMounted) {
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

          // Track blob URL for cleanup
          extractedBlobUrlsRef.current.add(frameBlobUrl)

          if (isMounted) {
            setBackgroundImage(frameBlobUrl)
            setBackgroundWithPrefix(false)
            if (!isPreview) {
              dispatch(setUpdateMessageAttachmentAC(file.url, frameBlobUrl))
            }
          } else {
            // Component unmounted, cleanup blob URL
            URL.revokeObjectURL(frameBlobUrl)
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
      if (!cached && isMounted && !isExtractingRef.current) {
        extractFirstFrame()
      }
    })

    return () => {
      isMounted = false
    }
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
      {!uploading && (
        <SmoothImageContainer>
          <SmoothUploadProgress
            $shouldAnimate={shouldAnimate}
            isPreview={isPreview}
            isDetailsView={isDetailsView}
            // onClick={handlePauseResumeDownload}
            isRepliedMessage={isRepliedMessage}
            borderRadius={borderRadius}
            backgroundImage={backgroundImage}
            withPrefix={backgroundWithPrefix}
            borderColor={border}
          />
        </SmoothImageContainer>
      )}
      {!isRepliedMessage && (
        <VideoControls className='video-controls'>
          {!isPreview && !isRepliedMessage && !uploading && !isDetailsView && (
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

// Container for smooth image transitions
const SmoothImageContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
`

// Extended UploadProgress with smooth background-image transition
const SmoothUploadProgress = styled(UploadProgress)<{ $shouldAnimate?: boolean }>`
  background-color: transparent !important;

  ${(props) =>
    props.$shouldAnimate &&
    `
    animation: fadeInImage 0.2s ease-in-out;
  `}

  @keyframes fadeInImage {
    from {
      opacity: 0.3;
    }
    to {
      opacity: 1;
    }
  }
`
