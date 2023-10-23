import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
// @ts-ignore

import { useDidUpdate } from '../../hooks'

import { ReactComponent as PlayIcon } from '../../assets/svg/play.svg'
import { ReactComponent as PauseIcon } from '../../assets/svg/pause.svg'
import { colors } from '../../UIHelper/constants'
import { IAttachment } from '../../types'
import { formatAudioVideoTime } from '../../helpers'
import { useDispatch, useSelector } from 'react-redux'
import { playingAudioIdSelector } from '../../store/message/selector'
import { setPlayingAudioIdAC } from '../../store/message/actions'

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
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, file }) => {
  // const AudioPlayer: React.FC<AudioPlayerProps> = ({ file }) => {
  const recordingInitialState = {
    recordingSeconds: 0,
    recordingMilliseconds: 0,
    initRecording: false,
    mediaStream: null,
    mediaRecorder: null,
    audio: undefined
  }
  const dispatch = useDispatch()
  const playingAudioId = useSelector(playingAudioIdSelector)
  const [recording, setRecording] = useState<Recording>(recordingInitialState)
  const [isRendered, setIsRendered] = useState<any>(false)
  const [playAudio, setPlayAudio] = useState<any>(false)
  // const [payingAudioId, setPayingAudioId] = useState<any>(false)

  const [currentTime, setCurrentTime] = useState<any>('')
  const [audioRate, setAudioRate] = useState<any>(1)
  // const [voiceUrl, setVoiceUrl] = useState<any>('')

  const wavesurfer = useRef<any>(null)
  const wavesurferContainer = useRef<any>(null)
  const intervalRef = useRef<any>(null)

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
    if (wavesurfer.current) {
      if (!wavesurfer.current.isPlaying()) {
        setPlayAudio(true)
        dispatch(setPlayingAudioIdAC(`player_${file.id}`))
        // const audioDuration = wavesurfer.current.getDuration()
        intervalRef.current = setInterval(() => {
          const currentTime = wavesurfer.current.getCurrentTime()
          if (currentTime >= 0) {
            setCurrentTime(formatAudioVideoTime(currentTime))
          }
          /*   setCurrentTime(() => {
            if (time <= 9) {
              return `00${wavesurfer.current.getCurrentTime().toFixed(0)}`
            }
            if (time <= 19) {
              return `0${wavesurfer.current.getCurrentTime().toFixed(0)}`
            }
            return `${wavesurfer.current.getCurrentTime().toFixed(0)}`
          }) */
        }, 10)
      } else {
        if (playingAudioId === file.id) {
          dispatch(setPlayingAudioIdAC(null))
        }
      }
      wavesurfer.current.playPause()
    }
  }
  useDidUpdate(() => {
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
    if (url && !isRendered) {
      const initWaveSurfer = async () => {
        const WaveSurfer = await import('wavesurfer.js')
        wavesurfer.current = WaveSurfer.default.create({
          container: wavesurferContainer.current,
          waveColor: colors.textColor2,
          skipLength: 0,
          progressColor: colors.primary,
          // audioContext,
          // cursorColor: 'transparent',
          // splitChannels: true,
          // barWidth: 1.5,
          audioRate,
          // barHeight: 3,

          barWidth: 1,
          barHeight: 1,

          hideScrollbar: true,
          barRadius: 1.5,
          cursorWidth: 0,
          barGap: 2,
          barMinHeight: 2,
          height: 20
        })
        /* .then((blob) => {
          // Here's where you get access to the blob
          // And you can use it for whatever you want
          // Like calling ref().put(blob)

          console.log('blob --- ', blob);
          // wavesurfer.current.loadBlob(blob);
          // Here, I use it to make an image appear on the page
          const objectURL = URL.createObjectURL(blob);

          console.log('object url ........ ', objectURL);
        }); */
        // wavesurfer.current.load(url);
        let peaks
        if (file.metadata && file.metadata.tmb) {
          const maxVal = Math.max(...file.metadata.tmb)
          const dec = maxVal / 100
          peaks = file.metadata.tmb.map((peak: number) => {
            return peak / dec / 100
          })
        }

        wavesurfer.current.load(url, peaks)

        wavesurfer.current.on('ready', () => {
          // wavesurfer.current.play();
          const audioDuration = wavesurfer.current.getDuration()
          // const currentTime = wavesurfer.current.getCurrentTime()
          setCurrentTime(formatAudioVideoTime(audioDuration))

          // const filters = wavesurfer.current.getFilters()
          wavesurfer.current.drawBuffer = (d: any) => {
            console.log('filters --- ', d)
          }
        })
        /* wavesurfer.current.drawBuffer = () => {
          return file.metadata.tmb
        } */
        wavesurfer.current.on('finish', () => {
          setPlayAudio(false)
          wavesurfer.current.seekTo(0)
          const audioDuration = wavesurfer.current.getDuration()
          // const currentTime = wavesurfer.current.getCurrentTime()
          setCurrentTime(formatAudioVideoTime(audioDuration))
          if (playingAudioId === file.id) {
            dispatch(setPlayingAudioIdAC(null))
          }
          clearInterval(intervalRef.current)
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
        })
        setIsRendered(true)
      }
      initWaveSurfer()
    }
    return () => {
      clearInterval(intervalRef.current)
    }
  }, [url])
  useEffect(() => {
    if (playAudio && playingAudioId && playingAudioId !== `player_${file.id}` && wavesurfer.current) {
      setPlayAudio(false)
      wavesurfer.current.pause()
    }
  }, [playingAudioId])

  return (
    <Container>
      <PlayPause onClick={handlePlayPause} iconColor={colors.primary}>
        {playAudio ? <PauseIcon /> : <PlayIcon />}
      </PlayPause>
      <WaveContainer>
        <AudioVisualization ref={wavesurferContainer} />
        <AudioRate onClick={handleSetAudioRate}>
          {audioRate}
          <span>X</span>
        </AudioRate>
      </WaveContainer>
      <Timer>{currentTime}</Timer>
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

const PlayPause = styled.div<{ iconColor?: string }>`
  cursor: pointer;

  & > svg {
    color: ${(props) => props.iconColor || colors.primary};
    display: flex;
    width: 40px;
    height: 40px;
  }
`

const AudioVisualization = styled.div`
  width: 100%;
`
const AudioRate = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${colors.white};
  width: 30px;
  min-width: 30px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 12px;
  line-height: 14px;
  color: ${colors.textColor2};
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

const Timer = styled.div`
  position: absolute;
  left: 59px;
  bottom: 12px;
  display: inline-block;
  font-weight: 400;
  font-size: 11px;
  line-height: 12px;
  color: ${colors.textColor2};
`
