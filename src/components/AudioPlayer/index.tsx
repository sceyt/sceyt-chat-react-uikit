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
// Helpers
import { THEME_COLORS } from '../../UIHelper/constants'
import { IAttachment } from '../../types'
import { formatAudioVideoTime } from '../../helpers'
import { markVoiceMessageAsPlayedAC } from 'store/channel/actions'
// Components
import Waveform from 'components/Waveform'

// interface Recording {
//   recordingSeconds: number
//   recordingMilliseconds: number
//   initRecording: boolean
//   mediaStream: null | MediaStream
//   mediaRecorder: null | MediaRecorder
//   audio?: string
// }
interface AudioPlayerProps {
  url: string
  file: IAttachment
  messagePlayed: boolean | undefined
  channelId?: string
  incoming?: boolean
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, file, messagePlayed, channelId, incoming }) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections
  } = useColor()
  const dispatch = useDispatch()
  const playingAudioId = useSelector(playingAudioIdSelector)
  const [playAudio, setPlayAudio] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<string>('')
  const [audioRate, setAudioRate] = useState<number>(1)
  const [duration, setDuration] = useState<number>(0)
  const [progress, setProgress] = useState<number>(0)
  const [peaks, setPeaks] = useState<number[]>([])

  const audioRef = useRef<HTMLAudioElement>(null)
  const intervalRef = useRef<any>(null)

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

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play()
        setPlayAudio(true)
        dispatch(setPlayingAudioIdAC(`player_${file.id}`))
        if (!messagePlayed && incoming) {
          dispatch(markVoiceMessageAsPlayedAC(channelId!, [file.messageId]))
        }
      } else {
        audioRef.current.pause()
        setPlayAudio(false)
        if (playingAudioId === file.id) {
          dispatch(setPlayingAudioIdAC(null))
        }
      }
    }
  }

  const handleSeek = (seekProgress: number) => {
    if (audioRef.current && duration) {
      audioRef.current.currentTime = seekProgress * duration
      setProgress(seekProgress)
    }
  }

  useEffect(() => {
    setProgress(0)
    setPlayAudio(false)

    let metadata = file.metadata
    if (typeof metadata === 'string') {
      if (metadata.trim() === '') {
        metadata = null
      } else {
        try {
          metadata = JSON.parse(metadata)
        } catch (e) {
          metadata = null
        }
      }
    }

    if (metadata) {
      if (metadata.dur) {
        setDuration(metadata.dur)
        setCurrentTime(formatAudioVideoTime(metadata.dur))
      }
      if (metadata.tmb && Array.isArray(metadata.tmb) && metadata.tmb.length > 0) {
        const maxVal = Math.max(...metadata.tmb.filter((n: number) => isFinite(n)))

        if (maxVal > 0 && isFinite(maxVal)) {
          const normalizedPeaks = metadata.tmb.map((peak: number) => {
            return peak / maxVal
          })

          setPeaks(normalizedPeaks)
        } else {
          setPeaks(Array(50).fill(0.5))
        }
      } else {
        setPeaks(Array(50).fill(0.5))
      }
    } else {
      setPeaks(Array(50).fill(0.5))
    }
  }, [url, file.id, file.metadata])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      const audioDuration = audio.duration
      if (audioDuration && isFinite(audioDuration)) {
        setDuration(audioDuration)
        if (!file.metadata?.dur) {
          setCurrentTime(formatAudioVideoTime(audioDuration))
        }
      }
    }

    const handleTimeUpdate = () => {
      if (audio.duration && isFinite(audio.duration)) {
        const currentProgress = audio.currentTime / audio.duration
        setProgress(currentProgress)
        setCurrentTime(formatAudioVideoTime(audio.currentTime))
      }
    }

    const handleEnded = () => {
      setPlayAudio(false)
      setProgress(0)
      audio.currentTime = 0
      setCurrentTime(formatAudioVideoTime(duration || audio.duration))
      if (playingAudioId === file.id) {
        dispatch(setPlayingAudioIdAC(null))
      }
    }

    const handlePause = () => {
      setPlayAudio(false)
    }

    const handlePlay = () => {
      setPlayAudio(true)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('play', handlePlay)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('play', handlePlay)
      clearInterval(intervalRef.current)
    }
  }, [url, duration, file.id, file.metadata?.dur, playingAudioId, dispatch])

  useEffect(() => {
    if (playAudio && playingAudioId && playingAudioId !== `player_${file.id}` && audioRef.current) {
      audioRef.current.pause()
      setPlayAudio(false)
    }
  }, [playingAudioId, playAudio, file.id])

  return (
    <Container>
      <audio ref={audioRef} src={url} preload='metadata' style={{ display: 'none' }} />
      <PlayPause onClick={handlePlayPause} iconColor={accentColor}>
        {playAudio ? <PauseIcon /> : <PlayIcon />}
      </PlayPause>
      <WaveContainer>
        <AudioVisualization>
          <Waveform
            peaks={peaks}
            progress={progress}
            waveColor={textSecondary}
            progressColor={accentColor}
            barWidth={1}
            barGap={2}
            barRadius={1.5}
            height={20}
            onSeek={handleSeek}
          />
        </AudioVisualization>
        <AudioRate color={textSecondary} onClick={handleSetAudioRate} backgroundColor={backgroundSections}>
          {audioRate}
          <span>X</span>
        </AudioRate>
      </WaveContainer>
      <Timer color={textSecondary}>{currentTime}</Timer>
    </Container>
  )
}

export default AudioPlayer

const Container = styled.div`
  position: relative;
  display: flex;
  align-items: flex-start;
  width: 230px;
  padding: 8px 12px;
`

const PlayPause = styled.div<{ iconColor: string }>`
  cursor: pointer;

  & > svg {
    color: ${(props) => props.iconColor};
    display: flex;
    width: 40px;
    height: 40px;
  }
`

const AudioVisualization = styled.div`
  width: 100%;
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
  margin-left: 14px;
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
