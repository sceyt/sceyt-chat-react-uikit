import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

// @ts-ignore
import WaveSurfer from 'wavesurfer.js'
// @ts-ignore
import MicrophonePlugin from 'wavesurfer.js/dist/plugin/wavesurfer.microphone.js'

import { useDidUpdate } from '../../hooks'

import { ReactComponent as PlayIcon } from '../../assets/svg/playRecord.svg'
import { ReactComponent as PauseIcon } from '../../assets/svg/stopRecord.svg'
import { colors } from '../../UIHelper/constants'
import { formatAudioVideoTime } from '../../helpers'

interface Recording {
  recordingSeconds: number
  recordingMilliseconds: number
  initRecording: boolean
  mediaStream: null | MediaStream
  mediaRecorder: null | MediaRecorder
  audio?: string
}

interface AudioPlayerProps {
  recordTime: string
}

// @ts-ignore
const AudioRecord: React.FC<AudioPlayerProps> = () => {
  const recordingInitialState = {
    recordingSeconds: 0,
    recordingMilliseconds: 0,
    initRecording: false,
    mediaStream: null,
    mediaRecorder: null,
    audio: undefined
  }

  const [recording, setRecording] = useState<Recording>(recordingInitialState)
  const [isRendered, setIsRendered] = useState<any>(false)
  const [playAudio, setPlayAudio] = useState<any>(false)

  const [currentTime, setCurrentTime] = useState<any>('')
  // const [voiceUrl, setVoiceUrl] = useState<any>('')

  const wavesurfer = useRef<any>(null)
  const wavesurferContainer = useRef<any>(null)

  let context: AudioContext, processor: any
  const intervalRef = useRef<any>(null)

  const handlePlayPause = () => {
    if (wavesurfer.current) {
      if (!wavesurfer.current.isPlaying()) {
        setPlayAudio(true)
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
    if (!isRendered) {
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      // const microphone = MicrophonePlugin.create({ bufferSize: 1024 })
      /*    wavesurfer.current = WaveSurfer.create({
        container: wavesurferContainer.current,
        waveColor: 'black',
        interact: false,
        cursorWidth: 0,
        /!*   waveColor: colors.gray9,
        skipLength: 0,
        progressColor: colors.primary,
        // audioContext,
        // cursorColor: 'transparent',
        // splitChannels: true,
        // barWidth: 1.5,
        audioRate: 1,
        // barHeight: 3,

        barWidth: 1,
        barHeight: 3,

        hideScrollbar: true,
        barRadius: 1.5,
        cursorWidth: 0,
        barGap: 2,
        barMinHeight: 1,
        height: 20, *!/
        plugins: [microphone]
      })
      wavesurfer.current.microphone.on('deviceReady', function (stream: any) {
        console.log('Device ready!', stream)
        wavesurfer.current.microphone.play()
      })
      wavesurfer.current.microphone.on('deviceError', function (code: any) {
        console.warn('Device error: ' + code)
      })
      wavesurfer.current.microphone.start()
 */
      if (isSafari) {
        // Safari 11 or newer automatically suspends new AudioContext's that aren't
        // created in response to a user-gesture, like a click or tap, so create one
        // here (inc. the script processor)
        // @ts-ignore
        const AudioContext = window.AudioContext || window.webkitAudioContext
        context = new AudioContext()
        processor = context.createScriptProcessor(1024, 1, 1)
      }
      if (!wavesurfer.current) {
        wavesurfer.current = WaveSurfer.create({
          container: wavesurferContainer.current,
          waveColor: colors.black,
          interact: false,
          cursorWidth: 0,
          audioContext: context || null,
          audioScriptProcessor: processor || null,
          plugins: [
            MicrophonePlugin.create({
              bufferSize: 4096,
              numberOfInputChannels: 1,
              numberOfOutputChannels: 1,
              constraints: {
                video: false,
                audio: true
              }
            })
          ]
        })

        wavesurfer.current.microphone.on('deviceReady', function () {
          console.info('Device ready!')
        })
        wavesurfer.current.microphone.on('deviceError', function (code: any) {
          console.warn('Device error: ' + code)
        })
        wavesurfer.current.on('error', function (e: any) {
          console.warn(e)
        })
        wavesurfer.current.microphone.start()
      } else {
        console.log('stop recording -----------------------------')
        if (wavesurfer.current.microphone.active) {
          wavesurfer.current.microphone.stop()
        } else {
          wavesurfer.current.microphone.start()
        }
      }
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
      // wavesurfer.current.load(url)

      /* wavesurfer.current.on('ready', () => {
        // wavesurfer.current.play();
        const audioDuration = wavesurfer.current.getDuration()
        const currentTime = wavesurfer.current.getCurrentTime()
        setCurrentTime(formatAudioVideoTime(audioDuration, currentTime))

        // const filters = wavesurfer.current.getFilters()
        wavesurfer.current.drawBuffer = (d: any) => {
          console.log('filters --- ', d)
        }
      }) */
      /* wavesurfer.current.drawBuffer = () => {
        return file.metadata.tmb
      } */
      /*   wavesurfer.current.on('finish', () => {
        setPlayAudio(false)
        wavesurfer.current.seekTo(0)
        const audioDuration = wavesurfer.current.getDuration()
        const currentTime = wavesurfer.current.getCurrentTime()
        setCurrentTime(formatAudioVideoTime(audioDuration, currentTime))
        clearInterval(intervalRef.current)
      })
*/
      /*
      wavesurfer.current.on('pause', () => {
        setPlayAudio(false)
        clearInterval(intervalRef.current)
      })
*/

      /*   wavesurfer.current.on('interaction', () => {
        const audioDuration = wavesurfer.current.getDuration()
        const currentTime = wavesurfer.current.getCurrentTime()
        setCurrentTime(formatAudioVideoTime(audioDuration, currentTime))
      }) */
      setIsRendered(true)
    }

    return () => {
      clearInterval(intervalRef.current)
    }
  }, [])

  // console.log('currentTime . .. . ', currentTime)
  return (
    <Container>
      <PlayPause onClick={handlePlayPause}>{playAudio ? <PauseIcon /> : <PlayIcon />}</PlayPause>
      <WaveContainer>
        <AudioVisualization className='visuaisation' ref={wavesurferContainer} />
      </WaveContainer>
      <Timer>{currentTime}</Timer>
    </Container>
  )
}

export default AudioRecord

const Container = styled.div`
  position: relative;
  display: flex;
  align-items: flex-start;
  width: 230px;
  padding: 8px 12px;
`

const PlayPause = styled.div`
  cursor: pointer;
`

const AudioVisualization = styled.div`
  width: 100%;
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
