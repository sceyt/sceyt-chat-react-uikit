import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { ReactComponent as PlayIcon } from '../../assets/svg/videoPlayerPlay.svg'
import { ReactComponent as PauseIcon } from '../../assets/svg/videoPlayerPause.svg'
import { ReactComponent as VolumeIcon } from '../../assets/svg/volume.svg'
import { ReactComponent as VolumeMuteIcon } from '../../assets/svg/volumeMute.svg'
import { ReactComponent as FullScreenIcon } from '../../assets/svg/fullscreen.svg'
import { ReactComponent as FullScreenExitIcon } from '../../assets/svg/fullscreenExit.svg'
import { colors } from '../../UIHelper/constants'
import { UploadingIcon } from '../../UIHelper'
import { formatAudioVideoTime } from '../../helpers'

interface IVideoPlayerProps {
  src: string
  videoFileId?: string
  activeFileId?: string
  onMouseDown?: (e: React.MouseEvent) => void
}
let timerInterval: any
const VideoPlayer = ({ src, videoFileId, activeFileId, onMouseDown }: IVideoPlayerProps) => {
  const containerRef = useRef<HTMLVideoElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLVideoElement>(null)
  const volumeRef = useRef<HTMLVideoElement>(null)
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
      videoRef.current && videoRef.current.play()
      setPlaying(true)
    } else if (control === 'pause') {
      videoRef.current && videoRef.current.pause()
      setPlaying(false)
    }
  }
  const handleProgressInputChange = (e: any) => {
    const target = e.target

    const val = target.value
    setProgress(val)
    if (videoRef.current) {
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
  const handleVolumeInputChange = (e: any) => {
    const target = e.target
    const val = target.value
    if (val === '0') {
      setIsMuted(true)
    } else {
      setIsMuted(false)
    }
    setVolume(val)
    if (videoRef.current) {
      videoRef.current.volume = parseFloat(val)
    }
  }
  const handleOpenFullScreen = () => {
    if (containerRef.current) {
      if (isFullScreen) {
        document.exitFullscreen().then(() => {
          setIsFullScreen(false)
        })
      } else {
        containerRef.current.requestFullscreen().then(() => {
          setIsFullScreen(true)
        })
      }
    }
  }
  const handleVideoProgress = (e: any) => {
    if (e.currentTarget.readyState >= 2) {
      setIsLoaded(true)
    }
  }
  /* const fastForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += 5
    }
  }

  const revert = () => {
    if (videoRef.current) {
      videoRef.current.currentTime -= 5
    }
  } */

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
    if (playing) {
      const videoDuration = videoRef.current ? videoRef.current.duration : ''
      timerInterval = setInterval(() => {
        if (videoRef.current && videoDuration) {
          setCurrentTime(videoRef.current?.currentTime)
          setProgress((videoRef.current?.currentTime / videoDuration) * 100)
          if (videoRef.current.paused) {
            videoRef.current.currentTime = 0
            setProgress(0)
            setCurrentTime(videoRef.current.currentTime)
            setPlaying(false)
            clearInterval(timerInterval)
          }
        }
      }, 100)
    } else {
      clearInterval(timerInterval)
    }
  }, [playing])

  useEffect(() => {
    if (videoFileId !== activeFileId) {
      if (videoRef.current) {
        videoRef.current.pause()
        setPlaying(false)
      }
    }
  }, [activeFileId])

  useEffect(() => {
    let checkVideoInterval: any
    if (videoRef.current) {
      checkVideoInterval = setInterval(() => {
        if (videoRef.current && videoRef.current.readyState > 0) {
          setVideoTime(videoRef.current.duration)
          setVolume(videoRef.current.volume)
          setPlaying(true)
          videoRef.current.play()
          clearInterval(checkVideoInterval)
        }
      }, 500)
    }
    return () => {
      clearInterval(timerInterval)
      clearInterval(checkVideoInterval)
    }
  }, [])
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
        // src='https://res.cloudinary.com/dssvrf9oz/video/upload/v1635662987/pexels-pavel-danilyuk-5359634_1_gmixla.mp4'
        src={src}
        onLoadedData={handleVideoProgress}
      ></video>
      {isLoaded ? (
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

          <ControlTime>
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
      ) : (
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
  & > video {
    ${(props) =>
      props.fullScreen &&
      `
        max-width: inherit !important;
        max-height: inherit !important;
        width: 100%;
        height: 100%;
        object-fit: contain;
    `}
  }

  &::after {
    content: ${(props) => props.loaded && ''};
    position: absolute;
    bottom: 0;
    height: 70px;
    width: 100%;
    background: linear-gradient(360deg, rgba(23, 25, 28, 0.8) 0%, rgba(23, 25, 28, 0) 100%);
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
const ControlTime = styled.span`
  color: ${colors.white};
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
