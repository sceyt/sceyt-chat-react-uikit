import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { ReactComponent as PlayIcon } from '../../assets/svg/videoPlayerPlay.svg'
import { ReactComponent as PauseIcon } from '../../assets/svg/videoPlayerPause.svg'
import { ReactComponent as VolumeIcon } from '../../assets/svg/volume.svg'
import { ReactComponent as VolumeMuteIcon } from '../../assets/svg/volumeMute.svg'
import { ReactComponent as FullScreenIcon } from '../../assets/svg/fullscreen.svg'
import { ReactComponent as FullScreenExitIcon } from '../../assets/svg/fullscreenExit.svg'
import { UploadingIcon } from '../../UIHelper'
import { formatAudioVideoTime } from '../../helpers'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'

interface IVideoPlayerProps {
  src: string
  videoFileId?: string
  activeFileId?: string
  onMouseDown?: (e: React.MouseEvent) => void
}

const VideoPlayer = ({ src, videoFileId, activeFileId, onMouseDown }: IVideoPlayerProps) => {
  const { [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary } = useColor()
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLInputElement>(null)
  const volumeRef = useRef<HTMLInputElement>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const checkVideoIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoTime, setVideoTime] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(0)
  const [volumePrevValue, setVolumePrevValue] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)

  const videoHandler = (control: string) => {
    if (control === 'play') {
      videoRef.current
        ?.play()
        .then(() => {
          setPlaying(true)
        })
        .catch((error) => {
          console.error('Error playing video:', error)
          setPlaying(false)
        })
    } else if (control === 'pause') {
      videoRef.current?.pause()
      setPlaying(false)
    }
  }
  const handleProgressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setProgress(val)
    if (videoRef.current && videoTime > 0) {
      videoRef.current.currentTime = (val / 100) * videoTime
    }
  }
  const handleMuteUnmute = () => {
    if (videoRef.current) {
      if (!isMuted) {
        setVolumePrevValue(volume)
        videoRef.current.volume = 0
        setVolume(0)
      } else {
        videoRef.current.volume = volumePrevValue
        setVolume(volumePrevValue)
      }
      setIsMuted(!isMuted)
    }
  }
  const handleVolumeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (val === 0) {
      setIsMuted(true)
    } else {
      setIsMuted(false)
    }
    setVolume(val)
    if (videoRef.current) {
      videoRef.current.volume = val
    }
  }
  const handleOpenFullScreen = () => {
    if (containerRef.current) {
      if (isFullScreen) {
        document
          .exitFullscreen()
          .then(() => {
            setIsFullScreen(false)
          })
          .catch((error) => {
            console.error('Error exiting fullscreen:', error)
          })
      } else {
        containerRef.current
          .requestFullscreen()
          .then(() => {
            setIsFullScreen(true)
          })
          .catch((error) => {
            console.error('Error entering fullscreen:', error)
          })
      }
    }
  }
  const handleVideoProgress = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    if (video.readyState >= 2) {
      setIsLoaded(true)
      if (video.duration && !videoTime) {
        setVideoTime(video.duration)
      }
      if (video.volume !== undefined && volume === 0) {
        setVolume(video.volume)
      }
    }
  }

  const handleVideoEnded = () => {
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
    }
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('Video error:', e)
    setIsLoaded(false)
    setPlaying(false)
  }
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.backgroundSize = `${progress}%`
    }
  }, [progress])
  useEffect(() => {
    if (volumeRef.current) {
      volumeRef.current.style.backgroundSize = `${volume * 100}%`
    }
  }, [volume])
  useEffect(() => {
    if (playing && videoTime > 0) {
      timerIntervalRef.current = setInterval(() => {
        if (videoRef.current && videoTime > 0) {
          const current = videoRef.current.currentTime
          setCurrentTime(current)
          setProgress((current / videoTime) * 100)
          if (videoRef.current.paused) {
            setPlaying(false)
          }
        }
      }, 100)
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [playing, videoTime])

  useEffect(() => {
    if (videoFileId !== activeFileId) {
      if (videoRef.current) {
        videoRef.current.pause()
        setPlaying(false)
      }
      // Clear intervals when switching videos
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [activeFileId, videoFileId])

  // Handle fullscreen changes (e.g., user presses ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Initialize video when src changes
  useEffect(() => {
    if (videoRef.current && src) {
      // Reset state when src changes
      setIsLoaded(false)
      setPlaying(false)
      setCurrentTime(0)
      setProgress(0)
      setVideoTime(0)

      // Check if video is ready
      if (videoRef.current.readyState >= 2) {
        setIsLoaded(true)
        if (videoRef.current.duration) {
          setVideoTime(videoRef.current.duration)
        }
        if (videoRef.current.volume !== undefined) {
          setVolume(videoRef.current.volume)
        }
      } else {
        // Wait for video to load
        checkVideoIntervalRef.current = setInterval(() => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            setIsLoaded(true)
            if (videoRef.current.duration) {
              setVideoTime(videoRef.current.duration)
            }
            if (videoRef.current.volume !== undefined) {
              setVolume(videoRef.current.volume)
            }
            if (checkVideoIntervalRef.current) {
              clearInterval(checkVideoIntervalRef.current)
              checkVideoIntervalRef.current = null
            }
          }
        }, 500)
      }
    }

    return () => {
      if (checkVideoIntervalRef.current) {
        clearInterval(checkVideoIntervalRef.current)
        checkVideoIntervalRef.current = null
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [src])
  return (
    <Component
      ref={containerRef}
      loaded={isLoaded}
      fullScreen={isFullScreen}
      className='custom_video_player'
      onMouseDown={onMouseDown}
    >
      <video
        onClick={() => videoHandler(playing ? 'pause' : 'play')}
        id='video1'
        ref={videoRef}
        className='video'
        src={src}
        onLoadedData={handleVideoProgress}
        onLoadedMetadata={handleVideoProgress}
        onEnded={handleVideoEnded}
        onError={handleVideoError}
        playsInline
        preload='metadata'
      />

      {isLoaded && (
        <ControlsContainer>
          {/*  <span onClick={revert} className='controlsIcon'>
          Revert
        </span>
        <span className='controlsIcon' onClick={fastForward}>
          Forward
        </span>
*/}
          <ProgressBlock>
            <Progress
              ref={progressRef}
              onMouseDown={(e: any) => e.stopPropagation()}
              onChange={handleProgressInputChange}
              type='range'
              value={progress}
              min='0'
              max='100'
            />
          </ProgressBlock>
          {playing ? (
            <PlayPauseWrapper onClick={() => videoHandler('pause')}>
              <PauseIcon />
            </PlayPauseWrapper>
          ) : (
            <PlayPauseWrapper onClick={() => videoHandler('play')}>
              <PlayIcon />
            </PlayPauseWrapper>
          )}

          <ControlTime color={textOnPrimary}>
            {formatAudioVideoTime(currentTime)} / {formatAudioVideoTime(videoTime)}
          </ControlTime>
          <VolumeController>
            <VolumeIconWrapper onClick={handleMuteUnmute}>
              {isMuted ? <VolumeMuteIcon /> : <VolumeIcon />}
            </VolumeIconWrapper>
            <VolumeSlide
              ref={volumeRef}
              onMouseDown={(e: any) => e.stopPropagation()}
              onChange={handleVolumeInputChange}
              type='range'
              value={volume}
              min='0'
              max='1'
              step='any'
            />
          </VolumeController>
          <FullScreenWrapper onClick={handleOpenFullScreen}>
            {isFullScreen ? <FullScreenExitIcon /> : <FullScreenIcon />}
          </FullScreenWrapper>
        </ControlsContainer>
      )}
      {!isLoaded && (
        <UploadCont>
          <UploadingIcon />
        </UploadCont>
      )}

      {/*  <div className='timecontrols'>
           <p className='controlsTime'>
          {Math.floor(currentTime / 60) + ':' + ('0' + Math.floor(currentTime % 60)).slice(-2)}
        </p>
        <div className='time_progressbarContainer'>
          <div style={{ width: `${progress}%` }} className='time_progressBar'></div>
        </div>
         <p className='controlsTime'>
          {Math.floor(videoTime / 60) + ':' + ('0' + Math.floor(videoTime % 60)).slice(-2)}
        </p>
      </div> */}
    </Component>
  )
}

export default VideoPlayer

const Component = styled.div<{ fullScreen?: boolean; loaded?: boolean; ref?: any }>`
  position: relative;
  display: inline-flex;
  width: 100%;
  height: 100%;
  & > video {
    display: block;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    background-color: #000;
    ${(props) =>
      props.fullScreen &&
      `
        max-width: inherit !important;
        max-height: inherit !important;
    `}
  }

  &::after {
    content: ${(props) => props.loaded && ''};
    position: absolute;
    bottom: 0;
    height: 70px;
    width: 100%;
    background: linear-gradient(360deg, rgba(23, 25, 28, 0.8) 0%, rgba(23, 25, 28, 0.8) 100%);
  }
`

const UploadCont = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  min-height: 100px;
  min-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
`
const PlayPauseWrapper = styled.span`
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 16px;
  cursor: pointer;
  @media (max-width: 768px) {
    margin-right: 8px;
    width: 18px;
    height: 18px;
    & > svg {
      width: 18px;
      height: 18px;
    }
  }
  @media (max-width: 480px) {
    margin-right: 8px;
    width: 16px;
    height: 16px;
    & > svg {
      width: 16px;
      height: 16px;
    }
  }
`
const ControlsContainer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  width: calc(100% - 32px);
  background: linear-gradient(360deg, rgba(23, 25, 28, 0.8) 0%, rgba(23, 25, 28, 0) 100%);
  padding: 10px 16px 16px;
  z-index: 20;

  @media (max-width: 768px) {
    width: calc(100% - 20px);
    padding: 0 10px;
  }
`
const ControlTime = styled.span<{ color: string }>`
  color: ${(props) => props.color};
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  @media (max-width: 768px) {
    font-size: 14px;
  }
  @media (max-width: 480px) {
    font-size: 12px;
  }
`
const ProgressBlock = styled.div`
  //background-color: rgba(255, 255, 255, 0.4);
  margin-bottom: 6px;
  border-radius: 15px;
  width: 100%;
  //height: 4px;
  z-index: 30;
  position: relative;
`
const VolumeController = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
`
const VolumeIconWrapper = styled.span`
  display: flex;
  cursor: pointer;
  @media (max-width: 768px) {
    & > svg {
      width: 18px;
      height: 18px;
    }
  }
  @media (max-width: 768px) {
    & > svg {
      width: 16px;
      height: 16px;
    }
  }
`
const VolumeSlide = styled.input<any>`
  -webkit-appearance: none;
  margin-left: 8px;
  width: 60px;
  height: 4px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 5px;
  background-image: linear-gradient(#fff, #fff);
  //background-size: 70% 100%;
  background-repeat: no-repeat;
  cursor: pointer;

  &::-webkit-slider-thumb {
    visibility: hidden;
    -webkit-appearance: none;
    height: 1px;
    width: 1px;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 0 2px 0 #555;
    transition: all 0.3s ease-in-out;
  }
  &::-moz-range-thumb {
    visibility: hidden;
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 0 2px 0 #555;
    transition: all 0.3s ease-in-out;
  }

  &::-ms-thumb {
    visibility: hidden;
    -webkit-appearance: none;
    height: 1px;
    width: 1px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 0 2px 0 #555;
    transition: all 0.3s ease-in-out;
  }
  &::-webkit-slider-runnable-track {
    -webkit-appearance: none;
    box-shadow: none;
    border: none;
    background: transparent;
    transition: all 0.3s ease-in-out;
  }

  &::-moz-range-track {
    -webkit-appearance: none;
    box-shadow: none;
    border: none;
    background: transparent;
    transition: all 0.3s ease-in-out;
  }
  &::-ms-track {
    -webkit-appearance: none;
    box-shadow: none;
    border: none;
    background: transparent;
    transition: all 0.3s ease-in-out;
  }

  @media (max-width: 768px) {
    width: 50px;
  }
`
const Progress = styled.input<any>`
  -webkit-appearance: none;
  margin-right: 15px;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 5px;
  background-image: linear-gradient(#fff, #fff);
  //background-size: 70% 100%;
  background-repeat: no-repeat;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 0 2px 0 #555;
    transition: all 0.3s ease-in-out;
  }
  &::-moz-range-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 0 2px 0 #555;
    transition: all 0.3s ease-in-out;
  }

  &::-ms-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 0 2px 0 #555;
    transition: all 0.3s ease-in-out;
  }

  &::-webkit-slider-thumb:hover {
    background: #fff;
  }
  &::-moz-range-thumb:hover {
    background: #fff;
  }
  &::-ms-thumb:hover {
    background: #fff;
  }

  &::-webkit-slider-runnable-track {
    -webkit-appearance: none;
    box-shadow: none;
    border: none;
    background: transparent;
    transition: all 0.3s ease-in-out;
  }

  &::-moz-range-track {
    -webkit-appearance: none;
    box-shadow: none;
    border: none;
    background: transparent;
    transition: all 0.3s ease-in-out;
  }
  &::-ms-track {
    -webkit-appearance: none;
    box-shadow: none;
    border: none;
    background: transparent;
    transition: all 0.3s ease-in-out;
  }
`
const FullScreenWrapper = styled.div`
  display: flex;
  margin-left: 16px;
  cursor: pointer;
  @media (max-width: 768px) {
    margin-left: 12px;
    & > svg {
      width: 18px;
      height: 18px;
    }
  }
  @media (max-width: 480px) {
    margin-left: auto;
    & > svg {
      width: 16px;
      height: 16px;
    }
  }
`
