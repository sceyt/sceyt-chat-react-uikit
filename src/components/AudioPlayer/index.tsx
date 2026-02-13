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
import { markVoiceMessageAsPlayedAC } from 'store/channel/actions'
import AudioVisualization from './AudioVisualization'
import { convertAudioForSafari, isSafari } from '../../helpers/audioConversion'

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
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections,
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND]: incomingMessageBackground,
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: outgoingMessageBackground
  } = useColor()
  const dispatch = useDispatch()
  const playingAudioId = useSelector(playingAudioIdSelector)
  const [playAudio, setPlayAudio] = useState(false)

  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [realDuration, setRealDuration] = useState<number>(0)
  const [audioRate, setAudioRate] = useState<number>(1)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<any>(null)
  const convertedUrlRef = useRef<string | null>(null)
  const visualizationRef = useRef<HTMLDivElement>(null)

  const handleSetAudioRate = () => {
    if (audioRef.current) {
      if (audioRate === 1) {
        setAudioRate(1.5)
        audioRef.current.playbackRate = 1.5
      } else if (audioRate === 1.5) {
        setAudioRate(2)
        audioRef.current.playbackRate = 2
      } else {
        setAudioRate(1)
        audioRef.current.playbackRate = 1
      }
    }
  }

  const startTimeTracking = () => {
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      if (audioRef.current) {
        const time = audioRef.current.currentTime
        if (time >= 0) {
          setCurrentTime(formatAudioVideoTime(time))
          setCurrentTimeSeconds(time)
        }
      }
    }, 10)
  }

  const handlePlayPause = () => {
    if (setViewOnceVoiceModalOpen) {
      setViewOnceVoiceModalOpen(true)
      return
    }
    if (audioRef.current) {
      if (audioRef.current.paused) {
        setPlayAudio(true)
        dispatch(setPlayingAudioIdAC(`player_${file.id}`))
        startTimeTracking()
        audioRef.current.play().catch((e) => {
          log.error('Audio play failed:', e)
          setPlayAudio(false)
        })
      } else {
        audioRef.current.pause()
        if (playingAudioId === file.id) {
          dispatch(setPlayingAudioIdAC(null))
        }
      }
      if (!messagePlayed && incoming) {
        dispatch(markVoiceMessageAsPlayedAC(channelId!, [file.messageId]))
      }
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !visualizationRef.current) return
    const rect = visualizationRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, clickX / rect.width))
    const audioDuration = audioRef.current.duration
    if (audioDuration && isFinite(audioDuration)) {
      audioRef.current.currentTime = ratio * audioDuration
      setCurrentTime(formatAudioVideoTime(audioRef.current.currentTime))
      setCurrentTimeSeconds(audioRef.current.currentTime)
    }
  }

  useEffect(() => {
    if (url && url !== '_') {
      // Clean up previous converted URL
      if (convertedUrlRef.current) {
        URL.revokeObjectURL(convertedUrlRef.current)
        convertedUrlRef.current = null
      }

      const audio = new Audio()
      audioRef.current = audio
      audio.playbackRate = audioRate
      audio.preload = 'metadata'

      // Set duration from metadata if available
      if (file.metadata?.dur) {
        setDuration(file.metadata.dur)
        setCurrentTime(formatAudioVideoTime(file.metadata.dur))
      }

      audio.addEventListener('loadedmetadata', () => {
        const audioDuration = audio.duration
        if (audioDuration && isFinite(audioDuration)) {
          setRealDuration(audioDuration)
          setDuration(file?.metadata?.dur || audioDuration)
          setCurrentTime(formatAudioVideoTime(file?.metadata?.dur || audioDuration))
        }
      })

      audio.addEventListener('ended', () => {
        setPlayAudio(false)
        audio.currentTime = 0
        const audioDuration = audio.duration
        if (audioDuration && isFinite(audioDuration)) {
          setRealDuration(audioDuration)
          setDuration(file?.metadata?.dur || audioDuration)
          setCurrentTime(formatAudioVideoTime(file?.metadata?.dur || audioDuration))
        }
        setCurrentTimeSeconds(0)
        if (playingAudioId === file.id) {
          dispatch(setPlayingAudioIdAC(null))
        }
        clearInterval(intervalRef.current)
        if (onClose) {
          onClose()
        }
      })

      audio.addEventListener('pause', () => {
        setPlayAudio(false)
        if (playingAudioId === file.id) {
          dispatch(setPlayingAudioIdAC(null))
        }
        clearInterval(intervalRef.current)
      })

      audio.addEventListener('error', () => {
        log.error('Audio element error:', audio.error?.message, 'code:', audio.error?.code)
        // On Safari, try converting unsupported formats
        if (isSafari() && !convertedUrlRef.current) {
          log.info('Attempting Safari audio conversion fallback...')
          fetch(url)
            .then((response) => response.blob())
            .then((blob) => {
              const audioFile = new File([blob], file.name || 'audio', {
                type: blob.type || 'audio/mpeg',
                lastModified: Date.now()
              })
              return convertAudioForSafari(audioFile, file?.messageId)
            })
            .then((convertedFile) => {
              const blobUrl = URL.createObjectURL(convertedFile)
              convertedUrlRef.current = blobUrl
              audio.src = blobUrl
            })
            .catch((conversionError) => {
              log.error('Safari audio conversion fallback failed:', conversionError)
            })
        }
      })

      audio.src = url
    }

    return () => {
      clearInterval(intervalRef.current)
      if (convertedUrlRef.current) {
        URL.revokeObjectURL(convertedUrlRef.current)
        convertedUrlRef.current = null
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [url, file.id])

  // Pause when another audio starts playing
  useEffect(() => {
    if (playAudio && playingAudioId && playingAudioId !== `player_${file.id}` && audioRef.current) {
      setPlayAudio(false)
      audioRef.current.pause()
    }
  }, [playingAudioId])

  return (
    <Container backgroundColor={bgColor} borderRadius={borderRadius}>
      <PlayPause onClick={handlePlayPause} iconColor={accentColor}>
        {playAudio ? <PauseIcon /> : <PlayIcon />}
        {viewOnce && (
          <DisappearingMessagesBadge
            color={incoming ? incomingMessageBackground : outgoingMessageBackground}
            $iconColor={accentColor}
          />
        )}
      </PlayPause>
      <WaveContainer>
        <VisualizationWrapper ref={visualizationRef} onClick={handleSeek}>
          {file.metadata?.tmb && Array.isArray(file.metadata.tmb) && (
            <AudioVisualization
              tmb={file.metadata.tmb}
              duration={realDuration || duration || file.metadata.dur || 0}
              currentTime={currentTimeSeconds}
              waveColor={textSecondary}
              progressColor={accentColor}
              height={20}
              barWidth={1}
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
  cursor: pointer;
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
export const DisappearingMessagesBadge = styled(BadgeIcon)<{ color: string; $iconColor: string }>`
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
    fill: ${(props) => props.$iconColor};
  }
  g {
    path {
      stroke: ${(props) => props.color};
    }
  }
`
