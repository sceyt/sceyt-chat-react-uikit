import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

// @ts-ignore
import MicRecorder from 'mic-recorder-to-mp3'

import { ReactComponent as PlayIcon } from '../../assets/svg/playRecord.svg'
import { ReactComponent as PauseIcon } from '../../assets/svg/pauseRecord.svg'
import { ReactComponent as CancelRecordIcon } from '../../assets/svg/close.svg'
import { ReactComponent as SendIcon } from '../../assets/svg/send.svg'
import { ReactComponent as StopIcon } from '../../assets/svg/stopRecord.svg'
import { ReactComponent as RecordIcon } from '../../assets/svg/recordButton.svg'
import { colors } from '../../UIHelper/constants'
import { useDidUpdate } from '../../hooks'
import { formatAudioVideoTime } from '../../helpers'

interface AudioPlayerProps {
  // eslint-disable-next-line no-unused-vars
  sendRecordedFile: (data: { file: File; objectUrl: string; thumb: number[]; dur: number }) => void
  // eslint-disable-next-line no-unused-vars
  setShowRecording: (start: boolean) => void
  showRecording: boolean
}
let shouldDraw = false
let WaveSurfer: any
// @ts-ignore
const AudioRecord: React.FC<AudioPlayerProps> = ({ sendRecordedFile, setShowRecording, showRecording }) => {
  const [recording, setStartRecording] = useState<any>(null)
  const [recorder, setRecorder] = useState<any>(null)
  const [recordedFile, setRecordedFile] = useState<any>(null)
  const [recordingIsReadyToPlay, setRecordingIsReadyToPlay] = useState<any>(false)
  const [currentTime, setCurrentTime] = useState<any>(0)

  const [playAudio, setPlayAudio] = useState<any>(false)
  const wavesurfer = useRef<any>(null)
  const wavesurferContainer = useRef<any>(null)
  const intervalRef = useRef<any>(null)
  const recordButtonRef = useRef<any>(null)

  async function startRecording() {
    const permissionStatus = await navigator.permissions.query({ name: 'microphone' } as any)
    if (permissionStatus.state === 'granted') {
      setShowRecording(true)
    } else {
      recordButtonRef.current.style.pointerEvents = 'none'
    }
    if (recording) {
      stopRecording(true)
    } else if (recordedFile) {
      sendRecordedFile(recordedFile)
      setRecordedFile(null)
      setPlayAudio(false)
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
      }
      setStartRecording(false)
      setShowRecording(false)
    } else {
      recorder
        .start()
        .then(() => {
          recordButtonRef.current.style.pointerEvents = 'initial'
          setShowRecording(true)
          setStartRecording(true)
          shouldDraw = true
          const stream = recorder.activeStream

          const obj: any = {}
          function init() {
            obj.canvas = document.getElementById('waveform')
            obj.ctx = obj.canvas.getContext('2d')
            obj.width = 360
            obj.height = 28
            obj.canvas.width = obj.width
            obj.canvas.height = obj.height
            obj.canvas.style.width = obj.width + 'px'
            obj.canvas.style.height = obj.height + 'px'
          }

          const timeOffset = 100
          // @ts-ignore
          let now = parseInt(performance.now()) / timeOffset

          function loop() {
            if (!shouldDraw) {
              obj.x = 0 // reset x to start drawing from the start again
              // @ts-ignore
              obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height) // clear the canvas

              return
            }
            obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height)
            let max = 0

            // @ts-ignore
            if (parseInt(performance.now() / timeOffset) > now) {
              // @ts-ignore
              now = parseInt(performance.now() / timeOffset)
              obj.analyser.getFloatTimeDomainData(obj.frequencyArray)
              for (let i = 0; i < obj.frequencyArray.length; i++) {
                if (obj.frequencyArray[i] > max) {
                  max = obj.frequencyArray[i]
                }
              }
              let freq = Math.floor(max * 90)
              if (freq === 0) {
                freq = 1
              }
              obj.bars.push({
                x: obj.width,
                y: obj.height / 2 - freq / 2,
                height: freq,
                width: 3
              })
            }
            draw()
            requestAnimationFrame(loop)
          }
          obj.bars = []

          function draw() {
            for (let i = 0; i < obj.bars.length; i++) {
              const bar = obj.bars[i]
              obj.ctx.fillStyle = colors.textColor2
              obj.ctx.fillRect(bar.x, bar.y, bar.width, bar.height)
              bar.x = bar.x - 1 // spacing between bars

              if (bar.x < 1) {
                obj.bars.splice(i, 1)
              }
            }
          }

          function soundAllowed(stream: any) {
            // @ts-ignore
            const AudioContext = window.AudioContext || window.webkitAudioContext
            const audioContent = new AudioContext()
            const streamSource = audioContent.createMediaStreamSource(stream)

            obj.analyser = audioContent.createAnalyser()
            streamSource.connect(obj.analyser)
            obj.analyser.fftSize = 512
            obj.frequencyArray = new Float32Array(obj.analyser.fftSize)
            init()
            loop()
          }

          soundAllowed(stream)
          /* const analyser = audioContext.createAnalyser()

          const source = audioContext.createMediaStreamSource(stream)
          source.connect(analyser)
          source.connect(analyser)

          analyser.fftSize = 2048
          const bufferLength = analyser.frequencyBinCount // half the FFT value
          const dataArray = new Uint8Array(bufferLength) // Uint8Array should be the same length as the frequencyBinCount

          const canvas = document.getElementById('waveform')
          if (canvas) {
            // @ts-ignore
            canvas.width = 300
            // @ts-ignore
            canvas.height = 32
          }
          // @ts-ignore
          const canvasCtx = canvas.getContext('2d')
          let x = 0 // the initial drawing position
          let draws = 0

          const framesToSkip = 2 // Skip drawing for this many frames
          let frameCounter = 0
          const browser = detectBrowser()
          async function drawWaveform() {
            draws++
            // console.log('drawWaveform. . .. . .  .', shouldDraw)
            if (!shouldDraw) {
              x = 0 // reset x to start drawing from the start again
              // @ts-ignore
              canvasCtx.clearRect(0, 0, canvas.width, canvas.height) // clear the canvas

              return
            }

            requestAnimationFrame(drawWaveform)

            // Draw only every few frames
            if (frameCounter % framesToSkip !== 0) {
              frameCounter++
              return
            }
            frameCounter = 1

            analyser.getByteFrequencyData(dataArray)
            if (draws >= 40) {
              // @ts-ignore
              const barWidth = (canvas.width / bufferLength) * 2.5 // Increase width of each bar
              const barSpacing = barWidth * 0.2 // spacing between bars
              let barHeight
              let renderHeight

              // clear only the part of the canvas where the next bar will be drawn
              // @ts-ignore
              canvasCtx.clearRect(x, 0, barWidth + barSpacing, canvas.height) // clear space includes barSpacing
              // let r = 0
              console.log('dataArray..         ... . . ', dataArray)
              for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i]
                // r++
                // skip the drawing, so the drawing became slower
                if (i !== 1) continue
                if (barHeight === 0) {
                  barHeight = 1
                }
                canvasCtx.fillStyle = colors.textColor2
                if (browser !== 'Safari') {
                  console.log(
                    'make it half the height of the canvas to start from the middle >>>>>>>................ ..>>>>>>'
                  )
                  renderHeight = -(barHeight / 2)
                } else {
                  renderHeight = -barHeight
                }
                // make it half the height of the canvas to start from the middle
                // console.log('renderHeight', -renderHeight)
                // @ts-ignore
                canvasCtx.fillRect(x, canvas.height / 2 + renderHeight / 2, 1, -renderHeight)

                x += barWidth + 2 // add barSpacing to the increment

                // if we've reached or exceeded the end of the canvas, loop back
                // @ts-ignore
                if (x + barWidth + barSpacing > canvas.width) {
                  x = 0
                  // @ts-ignore
                  canvasCtx.clearRect(0, 0, canvas.width, canvas.height) // clear the canvas
                }
              }
            }
          } */
          // drawWaveform()
        })
        .catch((e: any) => {
          console.error(e)
        })
    }
  }

  function cancelRecording() {
    if (recordedFile) {
      setRecordedFile(null)
      setPlayAudio(false)
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
      }
    } else {
      shouldDraw = false
      recorder.stop()
    }
    setRecordingIsReadyToPlay(false)
    setStartRecording(false)
    setCurrentTime(0)
    setShowRecording(false)
  }
  function stopRecording(send?: boolean) {
    shouldDraw = false
    recorder
      .stop()
      .getMp3()
      .then(([buffer, blob]: any) => {
        setCurrentTime(0)
        console.log(buffer, blob)
        const file = new File(buffer, 'record.mp3', {
          type: blob.type,
          lastModified: Date.now()
        })

        // @ts-ignore
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const reader = new FileReader()

        reader.onload = function (event) {
          audioContext.decodeAudioData(
            // @ts-ignore
            event.target.result,
            function (audioBuffer) {
              // Number of segments to split the audio buffer into.
              // This number should be adjusted based on the desired "resolution" of the final waveform data.
              const numberOfSegments = 50

              // Determine the size of each segment in terms of audio samples.
              const segmentSize = Math.floor(audioBuffer.length / numberOfSegments)

              const waveform = []

              for (let i = 0; i < numberOfSegments; i++) {
                // Calculate the start and end points for this segment.
                const start = i * segmentSize
                const end = start + segmentSize

                // Extract the segment of audio data from the buffer.
                const segment = audioBuffer.getChannelData(0).slice(start, end)

                // Find the peak amplitude for this segment.
                // @ts-ignore
                const maxAmplitude = Math.max(...segment.map(Math.abs))

                // Convert the peak amplitude to a value in your desired range (e.g., 0-1000) and add it to the waveform array.
                waveform.push(Math.floor(maxAmplitude * 1000))
              }
              setStartRecording(false)
              const objectUrl = URL.createObjectURL(blob)
              if (send) {
                sendRecordedFile({ file, objectUrl, thumb: waveform, dur: audioBuffer.duration })
                setShowRecording(false)
              } else {
                setRecordedFile({ file, objectUrl, thumb: waveform, dur: audioBuffer.duration })
              }
            },
            function (e: any) {
              // Handle decoding error
              console.log('Error decoding audio data: ' + e.err)
            }
          )
        }
        reader.readAsArrayBuffer(blob)
      })
      .catch((e: any) => {
        console.error(e)
      })
  }

  const handlePlayPause = () => {
    if (wavesurfer.current) {
      if (!wavesurfer.current.isPlaying()) {
        setPlayAudio(true)
        intervalRef.current = setInterval(() => {
          const currentTime = wavesurfer.current.getCurrentTime()
          if (currentTime >= 0) {
            setCurrentTime(currentTime)
          }
        }, 10)
      }
      wavesurfer.current.playPause()
    }
  }

  useEffect(() => {
    const MAX_RECORDER_TIME = 250
    let recordingInterval: any = null

    if (recording) {
      setTimeout(() => {
        recordingInterval = setInterval(() => {
          setCurrentTime((prevState: any) => {
            if (prevState.recordingSeconds === MAX_RECORDER_TIME) {
              clearInterval(recordingInterval)
              stopRecording()
              return 0
            }
            return prevState + 1
          })
        }, 1000)
      }, 150)
    } else clearInterval(recordingInterval)

    return () => clearInterval(recordingInterval)
  }, [recording])
  useDidUpdate(() => {
    if (recordedFile) {
      const initWaveSurfer = async () => {
        if (!WaveSurfer) {
          WaveSurfer = await import('wavesurfer.js')
        }
        if (wavesurfer.current) {
          wavesurfer.current.destroy()
        }
        wavesurfer.current = WaveSurfer.default.create({
          container: wavesurferContainer.current,
          waveColor: colors.textColor2,
          skipLength: 0,
          progressColor: colors.primary,
          barWidth: 1,
          barHeight: 2,
          audioRate: 1,
          hideScrollbar: true,
          barRadius: 1.5,
          cursorWidth: 0,
          barGap: 2.5,
          barMinHeight: 1.5,
          height: 28
        })

        wavesurfer.current.load(recordedFile.objectUrl)
        // wavesurfer.current.loadBlob(recordedFile.file)

        wavesurfer.current.on('ready', () => {
          setRecordingIsReadyToPlay(true)
          const audioDuration = wavesurfer.current.getDuration()
          setCurrentTime(audioDuration)
        })
        wavesurfer.current.on('finish', () => {
          setPlayAudio(false)
          wavesurfer.current.seekTo(0)
          const audioDuration = wavesurfer.current.getDuration()
          setCurrentTime(audioDuration)
          clearInterval(intervalRef.current)
        })

        wavesurfer.current.on('pause', () => {
          setPlayAudio(false)
          clearInterval(intervalRef.current)
        })

        wavesurfer.current.on('interaction', () => {
          const currentTime = wavesurfer.current.getCurrentTime()
          setCurrentTime(currentTime)
        })
      }
      initWaveSurfer()
    } else {
      setRecordingIsReadyToPlay(false)
      clearInterval(intervalRef.current)
      wavesurfer.current = null
    }
    return () => {
      clearInterval(intervalRef.current)
    }
  }, [recordedFile])
  useEffect(() => {
    setRecorder(
      new MicRecorder({
        bitRate: 128
      })
    )
  }, [])

  return (
    <Container recording={showRecording}>
      {showRecording && (
        <PlayPause onClick={() => cancelRecording()}>
          <CancelRecordIcon />
        </PlayPause>
      )}

      <AudioWrapper recording={recording || recordedFile}>
        {recording && (
          <PlayPause onClick={() => stopRecording()}>
            <StopIcon />
          </PlayPause>
        )}
        <Canvas hide={recordedFile} id='waveform' recording={recording}></Canvas>

        {recording && <Timer>{formatAudioVideoTime(currentTime)}</Timer>}

        {recordingIsReadyToPlay && (
          <PlayPause onClick={handlePlayPause}>{playAudio ? <PauseIcon /> : <PlayIcon />}</PlayPause>
        )}
        <AudioVisualization ref={wavesurferContainer} show={recordedFile} />
        {recordingIsReadyToPlay && <Timer>{formatAudioVideoTime(currentTime)}</Timer>}
      </AudioWrapper>
      <RecordIconWrapper ref={recordButtonRef} onClick={() => startRecording()}>
        {showRecording ? <SendIcon /> : <RecordIcon />}
      </RecordIconWrapper>
    </Container>
  )
}

export default AudioRecord

const Container = styled.div<{ recording?: boolean }>`
  width: 32px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  ${(props) => props.recording && `width: 400px`};
  transition: all 0.3s ease-in-out;
`
const AudioWrapper = styled.div<{ recording?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  width: ${(props) => (props.recording ? 'calc(100% - 84px)' : '0')};
  overflow: hidden;
  margin: ${(props) => (props.recording ? '0 8px' : '0')};
  background-color: ${colors.backgroundColor};
  padding: ${(props) => (props.recording ? '0 12px 0 0' : '0')};
  border-radius: 20px;
`

const RecordIconWrapper = styled.span`
  display: flex;
  cursor: pointer;
`

const AudioVisualization = styled.div<{ show?: boolean }>`
  position: absolute;
  opacity: ${({ show }) => (show ? '1' : '0')};
  z-index: ${({ show }) => !show && '-1'};
  visibility: ${({ show }) => (show ? 'visible' : 'hidden')};
  width: 300px;
  height: 28px;
  max-width: calc(100% - 100px);
  left: 40px;
`

const PlayPause = styled.div`
  cursor: pointer;
  padding: 10px;
`
const Canvas = styled.canvas<{ recording?: boolean; hide?: any }>`
  height: 28px;
  width: ${({ recording }) => (recording ? '300px' : '0')};
  max-width: calc(100% - 110px);
  position: absolute;
  opacity: ${({ hide }) => (hide ? '0' : '1')};
  z-index: ${({ hide }) => hide && '-1'};
  left: 42px;
`

const Timer = styled.div`
  width: 40px;
  font-weight: 400;
  font-size: 16px;
  line-height: 12px;
  color: ${colors.textColor2};
  margin-left: auto;
`
