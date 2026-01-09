import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
// Hooks
import { useColor } from '../../hooks'
// Assets
import { ReactComponent as PlayIcon } from '../../assets/svg/playRecord.svg'
import { ReactComponent as PauseIcon } from '../../assets/svg/pauseRecord.svg'
import { ReactComponent as CancelRecordIcon } from '../../assets/svg/close.svg'
import { ReactComponent as SendIcon } from '../../assets/svg/send.svg'
import { ReactComponent as StopIcon } from '../../assets/svg/stopRecord.svg'
import { ReactComponent as RecordIcon } from '../../assets/svg/recordButton.svg'
import { ReactComponent as ViewOnceNotSelectedIcon } from '../../assets/svg/view_once_not_selected.svg'
import { ReactComponent as ViewOnceSelectedIcon } from '../../assets/svg/view_once_selected.svg'
// Helpers
import { THEME_COLORS } from '../../UIHelper/constants'
import { formatAudioVideoTime } from '../../helpers'
import log from 'loglevel'
import WaveSurfer from 'wavesurfer.js'
import MicRecorder from 'mic-recorder-to-mp3'
import { useDispatch } from 'store/hooks'
import { sendRecordingAC, setChannelDraftMessageIsRemovedAC } from '../../store/channel/actions'
import { getAudioRecordingFromMap, removeAudioRecordingFromMap, setAudioRecordingToMap } from 'helpers/messagesHalper'
import { ViewOnceToggleCont } from 'UIHelper'

const fieldsObject = {
  channelId: '',
  currentRecordedFile: null,
  recording: null,
  recorder: null,
  wavesurferContainer: null
}

interface AudioPlayerProps {
  // eslint-disable-next-line no-unused-vars
  sendRecordedFile: (data: { file: File; objectUrl: string; thumb: number[]; dur: number }, id?: string) => void
  // eslint-disable-next-line no-unused-vars
  setShowRecording: (start: boolean) => void
  showRecording: boolean
  isSelfChannel: boolean
  channelId: string
  maxRecordingDuration?: number
  showViewOnceToggle: boolean
  viewOnce: boolean
  setViewOnce: (viewOnce: boolean) => void
  ViewOnceSelectedSVGIcon: React.ReactNode
  ViewOnceNotSelectedSVGIcon: React.ReactNode
}
let shouldDraw = false
const DEFAULT_MAX_RECORDING_DURATION = 600

// @ts-ignore
const AudioRecord: React.FC<AudioPlayerProps> = ({
  sendRecordedFile,
  setShowRecording,
  showRecording,
  isSelfChannel,
  channelId,
  maxRecordingDuration = DEFAULT_MAX_RECORDING_DURATION,
  showViewOnceToggle,
  viewOnce,
  setViewOnce,
  ViewOnceSelectedSVGIcon,
  ViewOnceNotSelectedSVGIcon
}) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.WARNING]: warningColor,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary
  } = useColor()

  const [recording, setStartRecording] = useState<any>(null)
  const [recorder, setRecorder] = useState<any>(null)
  const [recordedFile, setRecordedFile] = useState<any>(null)
  const [recordingIsReadyToPlay, setRecordingIsReadyToPlay] = useState<any>(false)
  const [currentTime, setCurrentTime] = useState<any>(0)
  const [sendingInterval, setSendingInterval] = useState<any>(null)
  const [currentChannelId, setCurrentChannelId] = useState<string>('')
  const [playAudio, setPlayAudio] = useState<any>(false)
  const wavesurferContainer = useRef<any>(null)
  const recordButtonRef = useRef<any>(null)
  const wavesurfer = useRef<any>({})
  const intervalRef = useRef<any>({})

  const currentRecordedFile = useMemo(() => {
    const current = getAudioRecordingFromMap(currentChannelId) || recordedFile
    return current
  }, [recordedFile, currentChannelId])

  useEffect(() => {
    if (currentRecordedFile) {
      setRecordedFile(currentRecordedFile)
    }
  }, [currentRecordedFile])

  const dispatch = useDispatch()

  const handleStartRecording = () => {
    dispatch(sendRecordingAC(true, currentChannelId))
    if (sendingInterval) {
      clearInterval(sendingInterval)
      setSendingInterval(null)
      return
    }
    const interval = setInterval(() => {
      dispatch(sendRecordingAC(true, currentChannelId))
    }, 1000)
    setSendingInterval(interval)
  }

  const handleStopRecording = () => {
    dispatch(sendRecordingAC(false, currentChannelId))
    if (sendingInterval) {
      clearInterval(sendingInterval)
      setSendingInterval(null)
    }
  }

  const startRecording = async (cId?: string) => {
    const id = cId || currentChannelId
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' } as any)
      if (permissionStatus.state === 'granted') {
        setShowRecording(true)
      } else {
        recordButtonRef.current.style.pointerEvents = 'none'
      }
      if (recording) {
        stopRecording(true, id, false, recorder)
      } else if (currentRecordedFile) {
        removeAudioRecordingFromMap(id)
        setRecordedFile(null)
        setPlayAudio(false)
        if (wavesurfer.current?.[id]) {
          wavesurfer.current[id].destroy()
        }
        setStartRecording(false)
        setShowRecording(false)
        dispatch(setChannelDraftMessageIsRemovedAC(id))
        sendRecordedFile(currentRecordedFile, id)
      } else {
        handleStartRecording()
        setAudioRecordingToMap(id, {
          file: null,
          objectUrl: null,
          thumb: null,
          dur: 0
        })
        recorder
          .start()
          .then(() => {
            recordButtonRef.current.style.pointerEvents = 'initial'
            setShowRecording(true)
            setStartRecording(true)
            shouldDraw = true
            const stream = recorder.activeStream

            const obj: any = {}
            const init = () => {
              obj.canvas = document.getElementById(`waveform-${id}`)
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

            const loop = () => {
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

            const draw = () => {
              for (let i = 0; i < obj.bars.length; i++) {
                const bar = obj.bars[i]
                obj.ctx.fillStyle = textSecondary
                obj.ctx.fillRect(bar.x, bar.y, bar.width, bar.height)
                bar.x = bar.x - 1 // spacing between bars

                if (bar.x < 1) {
                  obj.bars.splice(i, 1)
                }
              }
            }

            const soundAllowed = (stream: any) => {
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
          })
          .catch((e: any) => {
            handleStopRecording()
            log.error(e)
          })
      }
    } catch (e) {
      handleStopRecording()
      log.error(e)
    }
  }

  const cancelRecording = useCallback(() => {
    handleStopRecording()
    if (currentRecordedFile) {
      dispatch(setChannelDraftMessageIsRemovedAC(currentChannelId))
      setRecordedFile(null)
      setPlayAudio(false)
      if (wavesurfer.current?.[currentChannelId]) {
        wavesurfer.current[currentChannelId].destroy()
      }
    } else {
      shouldDraw = false
      recorder?.stop()
    }
    removeAudioRecordingFromMap(currentChannelId)
    setRecordingIsReadyToPlay(false)
    setStartRecording(false)
    setCurrentTime(0)
    setShowRecording(false)
  }, [currentRecordedFile, currentChannelId, wavesurfer, setShowRecording, setRecordedFile])

  const initWaveSurfer = async (draft?: boolean, cId?: string, audioRecording?: any, container?: any) => {
    try {
      if (draft) {
        return
      }
      const id = cId || currentChannelId
      if (wavesurfer.current?.[id]) {
        setRecordingIsReadyToPlay(true)
        const audioDuration = wavesurfer.current[id].getDuration()
        setCurrentTime(audioDuration)
      }

      if (!wavesurfer.current?.[id]) {
        // Validate container before creating WaveSurfer
        const containerElement = wavesurferContainer.current || container
        if (!containerElement) {
          // Retry after a short delay in case container is not ready yet
          setTimeout(() => initWaveSurfer(draft, cId, audioRecording, container), 100)
          return
        }

        // Check if container has valid dimensions
        const rect = containerElement.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) {
          // Retry after a short delay in case container dimensions are not set yet
          setTimeout(() => initWaveSurfer(draft, cId, audioRecording, container), 100)
          return
        }

        const ws = WaveSurfer.create({
          container: containerElement,
          waveColor: textSecondary,
          progressColor: accentColor,
          barWidth: 1,
          barHeight: 2,
          audioRate: 1,
          hideScrollbar: true,
          barRadius: 1.5,
          cursorWidth: 0,
          barGap: 2.5,
          height: 28
        })
        let peaks: number[] = []
        if ((audioRecording || currentRecordedFile)?.thumb) {
          const thumbData = (audioRecording || currentRecordedFile)?.thumb
          // Validate thumb data is an array and has valid length
          if (Array.isArray(thumbData) && thumbData.length > 0) {
            const maxVal = thumbData.reduce((acc: number, n: number) => (n > acc ? n : acc), -Infinity)
            // Check if maxVal is a valid number and not zero
            if (maxVal > 0 && isFinite(maxVal)) {
              const dec = maxVal / 100
              peaks = thumbData
                .map((peak: number) => {
                  const normalizedPeak = peak / dec / 100
                  // Ensure each peak is a valid finite number
                  return isFinite(normalizedPeak) ? normalizedPeak : 0
                })
                .filter((peak: number) => isFinite(peak)) // Remove any invalid values

              // Ensure peaks array is not empty after filtering
              if (peaks.length === 0) {
                peaks = []
              }
            }
          }
        }
        wavesurfer.current[id] = ws
        try {
          // Only pass peaks if it's a valid non-empty array
          const validPeaks = peaks.length > 0 ? peaks : undefined
          await wavesurfer.current[id].loadBlob(audioRecording?.file || currentRecordedFile?.file, validPeaks)
        } catch (error) {
          // Fallback: try loading without peaks if there's an error
          try {
            await wavesurfer.current[id].loadBlob(audioRecording?.file || currentRecordedFile?.file)
          } catch (fallbackError) {
            console.error('Failed to load audio completely:', fallbackError)
            throw fallbackError
          }
        }
      }

      setCurrentTime(wavesurfer.current[id]?.decodedData?.duration || 0)
      wavesurfer.current[id].on('ready', () => {
        setRecordingIsReadyToPlay(true)
        const audioDuration = wavesurfer.current[id].getDuration()
        setCurrentTime(audioDuration)
      })
      wavesurfer.current[id].on('finish', () => {
        setPlayAudio(false)
        wavesurfer.current[id].seekTo(0)
        const audioDuration = wavesurfer.current[id].getDuration()
        setCurrentTime(audioDuration)
        clearInterval(intervalRef.current[id])
      })

      wavesurfer.current[id].on('pause', () => {
        setPlayAudio(false)
        clearInterval(intervalRef.current[id])
      })

      wavesurfer.current[id].on('interaction', () => {
        const currentTime = wavesurfer.current[id].getCurrentTime()
        setCurrentTime(currentTime)
      })
    } catch (e) {
      log.error('Failed to init wavesurfer', e)
    }
  }

  const stopRecording = useCallback(
    (send?: boolean, cId?: string, draft?: boolean, recorder?: any, container?: any) => {
      handleStopRecording()
      shouldDraw = false
      const id = cId || channelId
      recorder
        ?.stop()
        .getMp3()
        .then(([buffer, blob]: any) => {
          const file = new File(buffer, 'record.mp3', {
            type: blob.type,
            lastModified: Date.now()
          })

          // @ts-ignore
          const audioContext = new (window.AudioContext || window.webkitAudioContext)()
          const reader = new FileReader()

          reader.onload = (event: any) => {
            audioContext.decodeAudioData(
              // @ts-ignore
              event.target.result,
              (audioBuffer: any) => {
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

                  // Find the peak amplitude for this segment without spreading large arrays
                  let maxAmplitude = 0
                  for (let j = 0; j < segment.length; j++) {
                    const val = segment[j]
                    const absVal = val < 0 ? -val : val
                    if (absVal > maxAmplitude) {
                      maxAmplitude = absVal
                    }
                  }

                  // Convert the peak amplitude to a value in your desired range (e.g., 0-1000) and add it to the waveform array.
                  waveform.push(Math.floor(maxAmplitude * 1000))
                }
                setStartRecording(false)
                const objectUrl = URL.createObjectURL(blob)
                const durationInt = Math.round(audioBuffer.duration)
                if (send) {
                  sendRecordedFile({ file, objectUrl, thumb: waveform, dur: durationInt }, id)
                  setShowRecording(false)
                  removeAudioRecordingFromMap(id)
                  dispatch(setChannelDraftMessageIsRemovedAC(id))
                } else {
                  if (!draft) {
                    setRecordedFile({ file, objectUrl, thumb: waveform, dur: durationInt })
                  }
                  const audioRecording = {
                    file,
                    objectUrl,
                    thumb: waveform,
                    dur: durationInt
                  }
                  setAudioRecordingToMap(id, audioRecording)
                  if (draft) {
                    initWaveSurfer(draft, id, audioRecording, container)
                  }
                }
              },
              (e: any) => {
                // Handle decoding error
                log.info('Error decoding audio data: ' + e.err)
              }
            )
          }
          reader.readAsArrayBuffer(blob)
        })
        .catch((e: any) => {
          handleStopRecording()
          log.error(e)
        })
    },
    [sendRecordedFile, setShowRecording, setAudioRecordingToMap, setRecordedFile, handleStopRecording, channelId]
  )

  const handlePlayPause = (cId?: string) => {
    if (wavesurfer.current?.[cId || currentChannelId]) {
      if (!wavesurfer.current[cId || currentChannelId].isPlaying()) {
        setPlayAudio(true)
        intervalRef.current[cId || currentChannelId] = setInterval(() => {
          const currentTime = wavesurfer.current[cId || currentChannelId].getCurrentTime()
          if (currentTime >= 0) {
            setCurrentTime(currentTime)
          }
        }, 10)
      }
      wavesurfer.current[cId || currentChannelId].playPause()
    }
  }

  useEffect(() => {
    let recordingInterval: any = null
    let backupTimeout: any = null

    if (recording) {
      backupTimeout = setTimeout(
        () => {
          stopRecording(false, currentChannelId, false, recorder)
        },
        (maxRecordingDuration + 0.5) * 1000
      )

      recordingInterval = setInterval(() => {
        setCurrentTime((prevState: any) => {
          if (prevState >= maxRecordingDuration) {
            clearInterval(recordingInterval)
            clearTimeout(backupTimeout)
            stopRecording(false, currentChannelId, false, recorder)
            return 0
          }
          return prevState + 1
        })
      }, 1000)
    } else {
      clearInterval(recordingInterval)
      clearTimeout(backupTimeout)
    }

    return () => {
      if (sendingInterval) {
        clearInterval(sendingInterval)
      }
      if (recordingInterval) {
        clearInterval(recordingInterval)
      }
      if (backupTimeout) {
        clearTimeout(backupTimeout)
      }
    }
  }, [recording, maxRecordingDuration])

  // Keep refs updated with latest values
  useEffect(() => {
    fieldsObject.channelId = channelId
  }, [channelId])

  useEffect(() => {
    fieldsObject.recorder = recorder
  }, [recorder])

  useEffect(() => {
    fieldsObject.currentRecordedFile = currentRecordedFile
  }, [currentRecordedFile])

  useEffect(() => {
    fieldsObject.recording = recording
  }, [recording])

  useEffect(() => {
    fieldsObject.wavesurferContainer = wavesurferContainer.current
  }, [wavesurferContainer.current])

  useEffect(() => {
    return () => {
      if (
        fieldsObject.channelId &&
        (!fieldsObject.currentRecordedFile || !(fieldsObject.currentRecordedFile as any)?.file) &&
        fieldsObject.recorder &&
        fieldsObject.recording
      ) {
        stopRecording(false, fieldsObject.channelId, true, fieldsObject.recorder, fieldsObject.wavesurferContainer)
        handleStopRecording()
      }
    }
  }, [])

  useEffect(() => {
    if (currentRecordedFile) {
      initWaveSurfer()
    } else {
      setRecordingIsReadyToPlay(false)
      if (intervalRef.current[currentChannelId]) {
        clearInterval(intervalRef.current[currentChannelId])
        intervalRef.current[currentChannelId] = null
      }
      if (wavesurfer.current?.[currentChannelId]) {
        wavesurfer.current[currentChannelId].destroy()
        wavesurfer.current[currentChannelId] = null
      }
    }
    return () => {
      for (const key in intervalRef.current) {
        if (intervalRef.current[key]) {
          clearInterval(intervalRef.current[key])
          intervalRef.current[key] = null
        }
      }
      for (const key in wavesurfer.current) {
        if (wavesurfer.current[key]) {
          wavesurfer.current[key].destroy()
          wavesurfer.current[key] = null
        }
      }
    }
  }, [currentRecordedFile, currentChannelId])

  useEffect(() => {
    if (!currentRecordedFile) {
      ;(async () => {
        if (!recorder) {
          try {
            const newRecorder = new MicRecorder({
              bitRate: 128
            })
            setRecorder(newRecorder)
          } catch (e) {
            log.error('Failed to init mic-recorder-to-mp3', e)
          }
        }
      })()
    }
  }, [currentRecordedFile])

  useEffect(() => {
    if (!showRecording) {
      setCurrentTime(0)
    }
    return () => {
      handleStopRecording()
      setCurrentTime(0)
    }
  }, [showRecording])

  useEffect(() => {
    if (channelId && (showRecording || currentRecordedFile)) {
      if (!currentRecordedFile) {
        stopRecording(false, currentChannelId, true, recorder, wavesurferContainer.current)
      }
      if (playAudio) {
        handlePlayPause(channelId)
      }
      for (const key in intervalRef.current) {
        clearInterval(intervalRef.current[key])
        intervalRef.current[key] = null
      }
      for (const key in wavesurfer.current) {
        wavesurfer.current[key]?.destroy()
        wavesurfer.current[key] = null
      }
      setShowRecording(false)
      setStartRecording(false)
      setPlayAudio(false)
      const audioRecording = getAudioRecordingFromMap(channelId)
      setRecordedFile(audioRecording || null)
      setRecordingIsReadyToPlay(!!audioRecording)
    }
    setCurrentTime(0)
    handleStopRecording()

    setCurrentChannelId(channelId)
  }, [channelId])

  return (
    <Container recording={showRecording || currentRecordedFile}>
      {(showRecording || currentRecordedFile) && (
        <PlayPause iconColor={iconPrimary}>
          {(showRecording || currentRecordedFile) && showViewOnceToggle && !isSelfChannel && (
            <ViewOnceToggleCont
              key='view-once'
              onClick={() => setViewOnce(!viewOnce)}
              color={viewOnce ? accentColor : iconInactive}
              textColor={viewOnce ? textOnPrimary : iconInactive}
            >
              {viewOnce
                ? ViewOnceSelectedSVGIcon || <ViewOnceSelectedIcon />
                : ViewOnceNotSelectedSVGIcon || <ViewOnceNotSelectedIcon />}
            </ViewOnceToggleCont>
          )}
          <CancelRecordIcon onClick={() => cancelRecording()} style={{ padding: '4px' }} />
        </PlayPause>
      )}

      <AudioWrapper backgroundColor={surface1} recording={recording || currentRecordedFile}>
        {recording && (
          <PlayPause iconColor={warningColor} onClick={() => stopRecording(false, currentChannelId, false, recorder)}>
            <StopIcon />
          </PlayPause>
        )}
        <Canvas hide={currentRecordedFile} id={`waveform-${channelId}`} recording={recording}></Canvas>

        {recording && <Timer color={textSecondary}>{formatAudioVideoTime(currentTime)}</Timer>}

        {(recordingIsReadyToPlay || currentRecordedFile) && (
          <PlayPause iconColor={accentColor} onClick={() => handlePlayPause(channelId)}>
            {playAudio ? <PauseIcon /> : <PlayIcon />}
          </PlayPause>
        )}
        <AudioVisualization ref={wavesurferContainer} show={currentRecordedFile} />
        {(recordingIsReadyToPlay || currentRecordedFile) && (
          <Timer color={textSecondary}>{formatAudioVideoTime(currentTime)}</Timer>
        )}
      </AudioWrapper>
      <RecordIconWrapper ref={recordButtonRef} onClick={() => startRecording(currentChannelId)} iconColor={accentColor}>
        {showRecording || currentRecordedFile ? <SendIcon /> : <RecordIcon />}
      </RecordIconWrapper>
    </Container>
  )
}

export default memo(AudioRecord, (prevProps, nextProps) => {
  return (
    prevProps.channelId === nextProps.channelId &&
    prevProps.showRecording === nextProps.showRecording &&
    prevProps.maxRecordingDuration === nextProps.maxRecordingDuration &&
    prevProps.showViewOnceToggle === nextProps.showViewOnceToggle &&
    prevProps.viewOnce === nextProps.viewOnce &&
    prevProps.ViewOnceSelectedSVGIcon === nextProps.ViewOnceSelectedSVGIcon &&
    prevProps.ViewOnceNotSelectedSVGIcon === nextProps.ViewOnceNotSelectedSVGIcon
  )
})

const Container = styled.div<{ recording?: boolean }>`
  width: 32px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  ${(props) =>
    props.recording &&
    `width: 400px;
    transition: all 0.3s ease-in-out;
    `}
`
const AudioWrapper = styled.div<{ backgroundColor: string; recording?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  width: ${(props) => (props.recording ? 'calc(100% - 84px)' : '0')};
  overflow: hidden;
  margin: ${(props) => (props.recording ? '0 8px' : '0')};
  background-color: ${(props) => props.backgroundColor};
  padding: ${(props) => (props.recording ? '0 12px 0 0' : '0')};
  border-radius: 20px;
`

const RecordIconWrapper = styled.span<{ iconColor?: string }>`
  display: flex;
  cursor: pointer;
  > svg {
    color: ${(props) => props.iconColor};
  }
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
  background-color: ${(props) => props.color};
`

const PlayPause = styled.div<{ iconColor?: string }>`
  padding: 10px 0 10px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  > svg {
    cursor: pointer;
    color: ${(props) => props.iconColor};
  }
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

const Timer = styled.div<{ color: string }>`
  width: 40px;
  font-weight: 400;
  font-size: 16px;
  line-height: 12px;
  color: ${(props) => props.color};
  margin-left: auto;
`
