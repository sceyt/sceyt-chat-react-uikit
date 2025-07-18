import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import moment from 'moment/moment'
// Store
import { contactsMapSelector, userSelector } from '../../../../store/user/selector'
import { playingAudioIdSelector } from '../../../../store/message/selector'
import { setPlayingAudioIdAC } from '../../../../store/message/actions'
// Hooks
import { useColor, useDidUpdate } from '../../../../hooks'
// Assets
import { ReactComponent as VoicePlayIcon } from '../../../../assets/svg/voicePreview.svg'
import { ReactComponent as VoicePauseIcon } from '../../../../assets/svg/voicePreviewPause.svg'
import { ReactComponent as VoicePlayHoverIcon } from '../../../../assets/svg/voicePreviewHoverIcon.svg'
import { ReactComponent as VoicePauseHoverIcon } from '../../../../assets/svg/voicePreviewPauseHover.svg'
// Helpers
import { getCustomDownloader } from '../../../../helpers/customUploader'
import { formatAudioVideoTime } from '../../../../helpers'
import { makeUsername } from '../../../../helpers/message'
import { getShowOnlyContactUsers } from '../../../../helpers/contacts'
import { colors, THEME_COLORS } from '../../../../UIHelper/constants'
import { IAttachment } from '../../../../types'

interface IProps {
  file: IAttachment
  voicePreviewPlayIcon?: JSX.Element
  voicePreviewPlayHoverIcon?: JSX.Element
  voicePreviewPauseIcon?: JSX.Element
  voicePreviewPauseHoverIcon?: JSX.Element
  voicePreviewTitleColor?: string
  voicePreviewDateAndTimeColor?: string
  voicePreviewHoverBackgroundColor?: string
}

const VoiceItem = ({
  file,
  voicePreviewPlayIcon,
  voicePreviewPlayHoverIcon,
  voicePreviewPauseIcon,
  voicePreviewPauseHoverIcon,
  voicePreviewTitleColor,
  voicePreviewDateAndTimeColor,
  voicePreviewHoverBackgroundColor
}: IProps) => {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.HOVER_BACKGROUND]: hoverBackground,
    [THEME_COLORS.BACKGROUND]: backgroundColor
  } = useColor()

  const dispatch = useDispatch()
  const playingAudioId = useSelector(playingAudioIdSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const [fileUrl, setFileUrl] = useState('')
  const [audioIsPlaying, setAudioIsPlaying] = useState<any>(false)
  const [currentTime, setCurrentTime] = useState('')
  const customDownloader = getCustomDownloader()
  const contactsMap = useSelector(contactsMapSelector)
  const user = useSelector(userSelector)
  const audioRef = useRef<HTMLAudioElement>()
  const intervalRef = useRef<any>(null)

  const handlePlayPause = () => {
    if (audioRef && audioRef.current) {
      if (audioRef.current.paused) {
        let audioDuration: number | undefined = audioRef.current?.duration
        dispatch(setPlayingAudioIdAC(`voice_${file.id}`))
        intervalRef.current = setInterval(() => {
          const audioCurrentTime = audioRef.current?.currentTime
          if (audioDuration) {
            if ((audioCurrentTime || audioCurrentTime === 0) && audioDuration - audioCurrentTime > 0) {
              setCurrentTime(formatAudioVideoTime(audioCurrentTime))
            } else {
              setCurrentTime(formatAudioVideoTime(audioCurrentTime || 0))
              setAudioIsPlaying(false)
              audioRef.current?.pause()
              audioRef.current && (audioRef.current.currentTime = 0)
              clearInterval(intervalRef.current)
            }
          } else {
            audioDuration = audioRef.current?.duration
          }
        }, 100)
        setAudioIsPlaying(true)
        audioRef.current?.play()
      } else {
        clearInterval(intervalRef.current)
        dispatch(setPlayingAudioIdAC(null))
        setAudioIsPlaying(false)
        audioRef.current?.pause()
      }
    }
  }

  useDidUpdate(() => {
    if (audioIsPlaying && playingAudioId && playingAudioId !== `voice_${file.id}` && audioRef.current) {
      setAudioIsPlaying(false)
      audioRef.current.pause()
    }
  }, [playingAudioId])
  useEffect(() => {
    if (customDownloader) {
      customDownloader(file.url, false).then((url) => {
        setFileUrl(url)
      })
    } else {
      setFileUrl(file.url)
    }

    return () => {
      clearInterval(intervalRef.current)
    }
  }, [])
  return (
    <FileItem
      onMouseEnter={(e: any) => e.currentTarget.classList.add('isHover')}
      onMouseLeave={(e: any) => e.currentTarget.classList.remove('isHover')}
      hoverBackgroundColor={voicePreviewHoverBackgroundColor || hoverBackground}
    >
      {audioIsPlaying ? (
        <React.Fragment>
          <FileIconCont onClick={handlePlayPause} fill={hoverBackground}>
            {voicePreviewPauseIcon || <VoicePauseIcon />}
          </FileIconCont>
          <FileHoverIconCont onClick={handlePlayPause} fill={backgroundColor}>
            {voicePreviewPauseHoverIcon || <VoicePauseHoverIcon />}
          </FileHoverIconCont>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <FileIconCont onClick={handlePlayPause} fill={hoverBackground}>
            {voicePreviewPlayIcon || <VoicePlayIcon />}
          </FileIconCont>
          <FileHoverIconCont onClick={handlePlayPause} fill={backgroundColor}>
            {voicePreviewPlayHoverIcon || <VoicePlayHoverIcon />}
          </FileHoverIconCont>
        </React.Fragment>
      )}
      <AudioInfo>
        <AudioTitle color={voicePreviewTitleColor || textPrimary}>
          {file.user &&
            (file.user.id === user.id ? 'You' : makeUsername(contactsMap[file.user.id], file.user, getFromContacts))}
        </AudioTitle>
        <AudioDate color={voicePreviewDateAndTimeColor || textSecondary}>
          {moment(file.createdAt).format('DD MMMM, YYYY')}
        </AudioDate>
        <AudioSendTime color={textSecondary}>
          {currentTime || (file.metadata.dur ? formatAudioVideoTime(file.metadata.dur) : '')}
        </AudioSendTime>
      </AudioInfo>

      <Audio controls ref={audioRef} src={fileUrl}>
        <source src={fileUrl} type='audio/ogg' />
        <source src={fileUrl} type='audio/mpeg' />
      </Audio>
    </FileItem>
  )
}

export default VoiceItem

const FileIconCont = styled.span<{ fill?: string }>`
  cursor: pointer;
  display: inline-flex;
  fill: ${(props) => props.fill || 'transparent'};
  rect {
    fill: ${(props) => props.fill || 'transparent'};
  }
`
const FileHoverIconCont = styled.span<{ fill?: string }>`
  cursor: pointer;
  display: none;
  fill: ${(props) => props.fill || 'transparent'};
  rect {
    fill: ${(props) => props.fill || 'transparent'};
  }
`
const FileItem = styled.li<any>`
  padding: 9px 16px;
  display: flex;
  align-items: center;
  text-decoration: none;

  &:hover {
    background-color: ${(props) => props.hoverBackgroundColor || colors.gray0};
  }
  div {
    margin-left: 12px;
    width: 100%;
  }
  img {
    width: 42px;
    height: 42px;
    border: 0.5px solid rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
    border-radius: 6px;
  }

  &.isHover {
    & ${FileIconCont} {
      display: none;
    }
    & ${FileHoverIconCont} {
      display: inline-flex;
    }
  }
`

const AudioInfo = styled.div`
  position: relative;
`
const AudioTitle = styled.span<{ color?: string }>`
  display: block;
  font-style: normal;
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: calc(100% - 72px);
  color: ${(props) => props.color};
`

const AudioDate = styled.span<{ color: string }>`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: calc(100% - 72px);
  font-style: normal;
  font-weight: normal;
  font-size: 12px;
  line-height: 16px;
  color: ${(props) => props.color};
`

const AudioSendTime = styled.span<{ color: string }>`
  position: absolute;
  right: 0;
  top: 11px;
  color: ${(props) => props.color};
  font-size: 12px;
  line-height: 16px;
`

const Audio = styled.audio<any>`
  display: none;
`
