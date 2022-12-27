import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
// @ts-ignore
import WaveSurfer from 'wavesurfer.js'

import { useDidUpdate } from '../../hooks'

import { ReactComponent as PlayIcon } from '../../assets/svg/play.svg'
import { ReactComponent as PauseIcon } from '../../assets/svg/pause.svg'
import { colors } from '../../UIHelper/constants'

const Container = styled.div`
  display: flex;
  align-items: center;
  width: 230px;
`

const PlayPause = styled.div`
  cursor: pointer;
`

const AudioVisualization = styled.div`
  width: 100%;
`

const WaveContainer = styled.div`
  width: 100%;
  margin-left: 8px;
`

const Timer = styled.div`
  display: inline-block;
  font-weight: 400;
  font-size: 10px;
  line-height: 12px;
  color: ${colors.gray9};
`

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
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ url }) => {
  const recordingInitialState = {
    recordingSeconds: 0,
    recordingMilliseconds: 0,
    initRecording: false,
    mediaStream: null,
    mediaRecorder: null,
    audio: undefined
  }
  const [recording, setRecording] = useState<Recording>(recordingInitialState)
  const [audioIsPlying, setAudioIsPlying] = useState<any>(false)
  const [currentTime, setCurrentTime] = useState<any>(null)

  const wavesurfer = useRef<any>(null)
  const wavesurferContainer = useRef<any>(null)
  const intervalRef = useRef<any>(null)

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
    wavesurfer.current = WaveSurfer.create({
      container: wavesurferContainer.current,
      waveColor: colors.gray9,
      progressColor: '#0DBD8B',
      // cursorColor: 'transparent',
      barWidth: 1,
      barHeight: 3,
      barRadius: 1,
      cursorWidth: 0,
      barGap: 2,
      barMinHeight: 2,
      height: 25
    })
    console.log('load url ... ', url)
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
    wavesurfer.current.load(url)
    wavesurfer.current.on('ready', () => {
      console.log('should play =------')
      // wavesurfer.current.play();
    })
    wavesurfer.current.on('finish', () => {
      setAudioIsPlying(false)
      clearInterval(intervalRef.current)
    })

    wavesurfer.current.on('pause', () => {
      setAudioIsPlying(false)
      clearInterval(intervalRef.current)
    })

    wavesurfer.current.on('interaction', () => {
      setCurrentTime(wavesurfer.current.getCurrentTime().toFixed(0))
    })

    return () => {
      clearInterval(intervalRef.current)
    }
  }, [])
  const handlePlayPause = () => {
    if (wavesurfer.current) {
      if (!wavesurfer.current.isPlaying()) {
        setAudioIsPlying(true)
        intervalRef.current = setInterval(() => {
          console.log('interval is going. .. ', wavesurfer.current.getCurrentTime())
          const time = wavesurfer.current.getCurrentTime().toFixed(0)
          setCurrentTime(() => {
            if (time <= 9) {
              return `00${wavesurfer.current.getCurrentTime().toFixed(0)}`
            }
            if (time <= 19) {
              return `0${wavesurfer.current.getCurrentTime().toFixed(0)}`
            }
            return `${wavesurfer.current.getCurrentTime().toFixed(0)}`
          })
        }, 10)
      }
      wavesurfer.current.playPause()
    }
  }

  console.log('currentTime . .. . ', currentTime)
  return (
    <Container>
      <PlayPause onClick={handlePlayPause}>{audioIsPlying ? <PauseIcon /> : <PlayIcon />}</PlayPause>
      <WaveContainer>
        <AudioVisualization ref={wavesurferContainer} />

        <Timer>{currentTime}</Timer>
      </WaveContainer>
    </Container>
  )
}

export default AudioPlayer
