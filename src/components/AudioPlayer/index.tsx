import React, { useEffect, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'store/hooks'
import styled from 'styled-components'
// Hooks
import { useColor } from '../../hooks'
// Store
import { playingAudioIdSelector } from '../../store/message/selector'
import { setPlayingAudioIdAC } from '../../store/message/actions'
// Assets
import { ReactComponent as PlayIcon } from '../../assets/svg/play.svg'
import { ReactComponent as PauseIcon } from '../../assets/svg/pause.svg'
import { ReactComponent as BadgeIcon } from '../../assets/svg/badge.svg'
// Helpers
import { THEME_COLORS } from '../../UIHelper/constants'
import { IAttachment } from '../../types'
import { formatAudioVideoTime } from '../../helpers'
import log from 'loglevel'
import WaveSurfer from 'wavesurfer.js'
import { markVoiceMessageAsPlayedAC } from 'store/channel/actions'
import AudioVisualization from './AudioVisualization'
import { convertAudioForSafari, isSafari } from '../../helpers/audioConversion'

interface Recording {
  recordingSeconds: number
  recordingMilliseconds: number
  initRecording: boolean
  mediaStream: null | MediaStream
  mediaRecorder: null | MediaRecorder
  audio?: string
}

interface AudioPlayerProps {
  url: string
  file: IAttachment
  messagePlayed: boolean | undefined
  channelId?: string
  incoming?: boolean
  viewOnce?: boolean
  setViewOnceVoiceModalOpen?: (open: boolean) => void
  bgColor?: string
  borderRadius?: string
  onClose?: () => void
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  url,
  file,
  messagePlayed,
  channelId,
  incoming,
  viewOnce,
  setViewOnceVoiceModalOpen,
  bgColor,
  borderRadius,
  onClose
}) => {
  const recordingInitialState = {
    recordingSeconds: 0,
    recordingMilliseconds: 0,
    initRecording: false,
    mediaStream: null,
    mediaRecorder: null,
    audio: undefined
  }
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections,
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND]: incomingMessageBackground,
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: outgoingMessageBackground
  } = useColor()
  const dispatch = useDispatch()
  const playingAudioId = useSelector(playingAudioIdSelector)
  const [recording, setRecording] = useState<Recording>(recordingInitialState)
  const [isRendered, setIsRendered] = useState<any>(false)
  const [playAudio, setPlayAudio] = useState<any>(false)

  const [currentTime, setCurrentTime] = useState<any>('')
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [audioRate, setAudioRate] = useState<any>(1)

  const wavesurfer = useRef<any>(null)
  const wavesurferContainer = useRef<any>(null)
  const intervalRef = useRef<any>(null)
  const convertedUrlRef = useRef<string | null>(null)

  const handleSetAudioRate = () => {
    if (wavesurfer.current) {
      if (audioRate === 1) {
        setAudioRate(1.5)
        wavesurfer.current.setPlaybackRate(1.5)
      } else if (audioRate === 1.5) {
        setAudioRate(2)
        wavesurfer.current.audioRate = 2
        wavesurfer.current.setPlaybackRate(2)
      } else {
        setAudioRate(1)
        wavesurfer.current.audioRate = 1
        wavesurfer.current.setPlaybackRate(1)
      }
    }
  }
  const handlePlayPause = () => {
    if (setViewOnceVoiceModalOpen) {
      setViewOnceVoiceModalOpen(true)
      return
    }
    if (wavesurfer.current) {
      if (!wavesurfer.current.isPlaying()) {
        setPlayAudio(true)
        dispatch(setPlayingAudioIdAC(`player_${file.id}`))
        // const audioDuration = wavesurfer.current.getDuration()
        intervalRef.current = setInterval(() => {
          const currentTime = wavesurfer.current.getCurrentTime()
          if (currentTime >= 0) {
            setCurrentTime(formatAudioVideoTime(currentTime))
            setCurrentTimeSeconds(currentTime)
          }
        }, 10)
      } else {
        if (playingAudioId === file.id) {
          dispatch(setPlayingAudioIdAC(null))
        }
      }
      wavesurfer.current.playPause()
      if (!messagePlayed && incoming) {
        dispatch(markVoiceMessageAsPlayedAC(channelId!, [file.messageId]))
      }
    }
  }
  useEffect(() => {
    if (recording.mediaStream) {
      setRecording({
        ...recording,
        mediaRecorder: new MediaRecorder(recording.mediaStream, {
          mimeType: 'audio/webm'
        })
      })
    }
  }, [recording.mediaStream])

  useEffect(() => {
    const MAX_RECORDER_TIME = 15
    let recordingInterval: any = null

    if (recording.initRecording) {
      recordingInterval = setInterval(() => {
        setRecording((prevState) => {
          if (prevState.recordingSeconds === MAX_RECORDER_TIME && prevState.recordingMilliseconds === 0) {
            clearInterval(recordingInterval)
            return prevState
          }

          if (prevState.recordingMilliseconds >= 0 && prevState.recordingMilliseconds < 99) {
            return {
              ...prevState,
              recordingMilliseconds: prevState.recordingMilliseconds + 1
            }
          }

          if (prevState.recordingMilliseconds === 99) {
            return {
              ...prevState,
              recordingSeconds: prevState.recordingSeconds + 1,
              recordingMilliseconds: 0
            }
          }

          return prevState
        })
      }, 10)
    } else clearInterval(recordingInterval)

    return () => clearInterval(recordingInterval)
  }, [recording.initRecording])

  useEffect(() => {
    if (url) {
      // Clean up previous converted URL if it exists
      if (convertedUrlRef.current) {
        URL.revokeObjectURL(convertedUrlRef.current)
        convertedUrlRef.current = null
      }

      if (url !== '_' && !isRendered && wavesurfer && wavesurfer.current) {
        wavesurfer.current.destroy()
      }
      const initWaveSurfer = async () => {
        try {
          // Check if we need to convert for Safari
          let audioUrl = url
          const needsConversion =
            isSafari() &&
            url &&
            url !== '_' &&
            (url.endsWith('.mp3') || file.name?.endsWith('.mp3') || file.type === 'audio/mpeg')

          if (needsConversion) {
            try {
              // Clean up any previous converted URL before creating a new one
              if (convertedUrlRef.current) {
                URL.revokeObjectURL(convertedUrlRef.current)
                convertedUrlRef.current = null
              }

              // Use a unique cache key based on file ID or URL to prevent reuse
              const cacheKey = file.id || url

              // Fetch the audio file with cache control to ensure fresh data
              const response = await fetch(url, {
                cache: 'no-store' // Prevent browser caching
              })

              if (!response.ok) {
                throw new Error(`Failed to fetch audio: ${response.statusText}`)
              }

              const blob = await response.blob()

              // Create a unique file name using file ID to prevent conflicts
              const uniqueFileName = `${file.id || Date.now()}_${file.name || 'audio.mp3'}`
              const audioFile = new File([blob], uniqueFileName, {
                type: blob.type || 'audio/mpeg',
                lastModified: Date.now()
              })

              // Convert to Safari-compatible format
              const convertedFile = await convertAudioForSafari(audioFile, file?.messageId)

              // Create blob URL from converted file
              const convertedBlobUrl = URL.createObjectURL(convertedFile)
              audioUrl = convertedBlobUrl
              convertedUrlRef.current = convertedBlobUrl

              log.info(`Converted audio for Safari: ${cacheKey} -> ${convertedBlobUrl}`)
            } catch (conversionError) {
              log.warn('Failed to convert audio for Safari, using original:', conversionError)
              // Fallback to original URL if conversion fails
              audioUrl = url
            }
          }

          wavesurfer.current = WaveSurfer.create({
            container: wavesurferContainer.current,
            waveColor: 'transparent',
            progressColor: 'transparent',
            audioRate,
            barWidth: 1,
            barHeight: 1,
            hideScrollbar: true,
            barRadius: 1.5,
            cursorWidth: 0,
            barGap: 2,
            height: 20
          })
          let peaks
          if (file.metadata) {
            if (file.metadata.dur) {
              setDuration(file.metadata.dur)
              setCurrentTime(formatAudioVideoTime(file.metadata.dur))
            }
            if (file.metadata.tmb) {
              const maxVal =
                Array.isArray(file.metadata.tmb) && file.metadata.tmb.length > 0
                  ? (file.metadata.tmb as number[]).reduce((acc: number, n: number) => (n > acc ? n : acc), -Infinity)
                  : 0
              const dec = maxVal / 100
              peaks = file.metadata.tmb.map((peak: number) => {
                return peak / dec / 100
              })
            }
          }

          wavesurfer.current.load(audioUrl, peaks)

          wavesurfer.current.on('ready', () => {
            const audioDuration = wavesurfer.current.getDuration()
            setDuration(file?.metadata?.dur || audioDuration)
            setCurrentTime(formatAudioVideoTime(file?.metadata?.dur || audioDuration))

            wavesurfer.current.drawBuffer = (d: any) => {
              log.info('filters --- ', d)
            }
          })
          /* wavesurfer.current.drawBuffer = () => {
           return file.metadata.tmb
         } */
          wavesurfer.current.on('finish', () => {
            setPlayAudio(false)
            wavesurfer.current.seekTo(0)
            const audioDuration = wavesurfer.current.getDuration()
            setDuration(file?.metadata?.dur || audioDuration)
            setCurrentTime(formatAudioVideoTime(file?.metadata?.dur || audioDuration))
            setCurrentTimeSeconds(0)
            if (playingAudioId === file.id) {
              dispatch(setPlayingAudioIdAC(null))
            }
            clearInterval(intervalRef.current)
            if (onClose) {
              onClose()
            }
          })

          wavesurfer.current.on('pause', () => {
            setPlayAudio(false)
            if (playingAudioId === file.id) {
              dispatch(setPlayingAudioIdAC(null))
            }
            clearInterval(intervalRef.current)
          })

          wavesurfer.current.on('interaction', () => {
            // const audioDuration = wavesurfer.current.getDuration()
            const currentTime = wavesurfer.current.getCurrentTime()
            setCurrentTime(formatAudioVideoTime(currentTime))
            setCurrentTimeSeconds(currentTime)
          })
          if (url !== '_') {
            setIsRendered(true)
          }
        } catch (e) {
          log.error('Failed to init wavesurfer', e)
        }
      }
      initWaveSurfer()
    }
    return () => {
      clearInterval(intervalRef.current)
      // Clean up converted blob URL if it exists
      if (convertedUrlRef.current) {
        URL.revokeObjectURL(convertedUrlRef.current)
        convertedUrlRef.current = null
      }
      // Destroy wavesurfer instance
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
        wavesurfer.current = null
      }
    }
  }, [url, file.id])

  useEffect(() => {
    if (playAudio && playingAudioId && playingAudioId !== `player_${file.id}` && wavesurfer.current) {
      setPlayAudio(false)
      wavesurfer.current.pause()
    }
  }, [playingAudioId])

  return (
    <Container backgroundColor={bgColor} borderRadius={borderRadius}>
      <PlayPause onClick={handlePlayPause} iconColor={accentColor}>
        {playAudio ? <PauseIcon /> : <PlayIcon />}
        {viewOnce && (
          <DisappearingMessagesBadge
            color={incoming ? incomingMessageBackground : outgoingMessageBackground}
            iconColor={accentColor}
          />
        )}
      </PlayPause>
      <WaveContainer>
        <VisualizationWrapper>
          <AudioVisualizationPlaceholder
            ref={wavesurferContainer}
            hidden={!!(file.metadata?.tmb && Array.isArray(file.metadata.tmb))}
          />
          {file.metadata?.tmb && Array.isArray(file.metadata.tmb) && (
            <AudioVisualization
              tmb={file.metadata.tmb}
              duration={duration || file.metadata.dur || 0}
              currentTime={currentTimeSeconds}
              waveColor={textSecondary}
              progressColor={accentColor}
              height={20}
              barWidth={1}
              barGap={2}
              barRadius={1.5}
            />
          )}
        </VisualizationWrapper>
        <AudioRate color={textSecondary} onClick={handleSetAudioRate} backgroundColor={backgroundSections}>
          {audioRate}
          <span>X</span>
        </AudioRate>
      </WaveContainer>
      <Timer color={textSecondary}>{currentTime || formatAudioVideoTime(file.metadata?.dur || 0)}</Timer>
    </Container>
  )
}

export default AudioPlayer

const Container = styled.div<{ backgroundColor?: string; borderRadius?: string }>`
  position: relative;
  display: flex;
  align-items: flex-start;
  width: 230px;
  padding: 8px 12px;
  ${(props) => props.backgroundColor && `background-color: ${props.backgroundColor};`}
  ${(props) => props.borderRadius && `border-radius: ${props.borderRadius};`}
`

const PlayPause = styled.div<{ iconColor: string }>`
  cursor: pointer;
  position: relative;
  & > svg {
    color: ${(props) => props.iconColor};
    display: flex;
    width: 40px;
    height: 40px;
  }
`

const VisualizationWrapper = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  position: relative;
`

const AudioVisualizationPlaceholder = styled.div<{ hidden?: boolean }>`
  width: 100%;
  position: ${(props) => (props.hidden ? 'absolute' : 'relative')};
  opacity: ${(props) => (props.hidden ? 0 : 1)};
  pointer-events: ${(props) => (props.hidden ? 'none' : 'auto')};
`
const AudioRate = styled.div<{ color: string; backgroundColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.backgroundColor};
  width: 30px;
  min-width: 30px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 12px;
  line-height: 14px;
  color: ${(props) => props.color};
  height: 18px;
  box-sizing: border-box;
  margin-left: auto;
  cursor: pointer;

  & > span {
    margin-top: auto;
    line-height: 16px;
    font-size: 9px;
  }
`

const WaveContainer = styled.div`
  width: 100%;
  display: flex;
  margin-left: 8px;
`

const Timer = styled.div<{ color: string }>`
  position: absolute;
  left: 59px;
  bottom: 12px;
  display: inline-block;
  font-weight: 400;
  font-size: 11px;
  line-height: 12px;
  color: ${(props) => props.color};
`
export const DisappearingMessagesBadge = styled(BadgeIcon)<{ color: string; iconColor: string }>`
  position: absolute;
  bottom: -3px;
  right: -8px;
  width: 24px !important;
  height: 24px !important;
  transform: scale(0.875);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  color: ${(props) => props.color};
  & > path:nth-child(1) {
    stroke: ${(props) => props.color};
    fill: ${(props) => props.iconColor};
  }
  g {
    path {
      stroke: ${(props) => props.color};
    }
  }
`
