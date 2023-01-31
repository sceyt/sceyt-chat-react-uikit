import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { ReactComponent as VoicePlayIcon } from '../../../../assets/svg/voicePreview.svg'
import { ReactComponent as VoicePlayHoverIcon } from '../../../../assets/svg/voicePreviewHoverIcon.svg'
import { colors } from '../../../../UIHelper/constants'
import { IAttachment } from '../../../../types'
import { getCustomDownloader } from '../../../../helpers/customUploader'
import { useSelector } from 'react-redux'
import { contactsMapSelector, userSelector } from '../../../../store/user/selector'
import { formatAudioVideoTime, makeUserName } from '../../../../helpers'
import moment from 'moment/moment'
import { getUserDisplayNameFromContact } from '../../../../helpers/contacts'

interface IProps {
  file: IAttachment
  voicePreviewIcon?: JSX.Element
  voicePreviewHoverIcon?: JSX.Element
  voicePreviewTitleColor?: string
  voicePreviewDateAndTimeColor?: string
  voicePreviewHoverBackgroundColor?: string
}

const VoiceItem = ({
  file,
  voicePreviewIcon,
  voicePreviewHoverIcon,
  voicePreviewTitleColor,
  voicePreviewDateAndTimeColor,
  voicePreviewHoverBackgroundColor
}: IProps) => {
  const getFromContacts = getUserDisplayNameFromContact()
  const [fileUrl, setFileUrl] = useState('')
  const [audioIsPlaying, setAudioIsPlaying] = useState(false)
  const customDownloader = getCustomDownloader()
  const contactsMap = useSelector(contactsMapSelector)
  const audioRef = useRef<HTMLAudioElement>()
  const user = useSelector(userSelector)

  const handlePlayPause = () => {
    if (audioRef && audioRef.current) {
      if (audioRef.current.paused) {
        setAudioIsPlaying(true)
        audioRef.current?.play()
      } else {
        setAudioIsPlaying(false)
        audioRef.current?.pause()
      }
    }
  }

  useEffect(() => {
    if (customDownloader) {
      customDownloader(file.url).then((url) => {
        console.log('set url ,,, ', url)
        setFileUrl(url)
      })
    } else {
      setFileUrl(file.url)
    }
  }, [])
  return (
    <FileItem
      onMouseEnter={(e: any) => e.currentTarget.classList.add('isHover')}
      onMouseLeave={(e: any) => e.currentTarget.classList.remove('isHover')}
      hoverBackgroundColor={voicePreviewHoverBackgroundColor}
    >
      {audioIsPlaying ? (
        <React.Fragment>
          <FileIconCont onClick={handlePlayPause}>{voicePreviewIcon || <VoicePlayIcon />}</FileIconCont>
          <FileHoverIconCont onClick={handlePlayPause}>
            {voicePreviewHoverIcon || <VoicePlayHoverIcon />}
          </FileHoverIconCont>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <FileIconCont onClick={handlePlayPause}>{voicePreviewIcon || <VoicePlayIcon />}</FileIconCont>
          <FileHoverIconCont onClick={handlePlayPause}>
            {voicePreviewHoverIcon || <VoicePlayHoverIcon />}
          </FileHoverIconCont>
        </React.Fragment>
      )}
      <AudioInfo>
        <AudioTitle color={voicePreviewTitleColor}>
          {file.user.id === user.id ? 'You' : makeUserName(contactsMap[file.user.id], file.user, getFromContacts)}
        </AudioTitle>
        <AudioDate color={voicePreviewDateAndTimeColor}>{moment(file.createdAt).format('DD MMMM, YYYY')}</AudioDate>
        <AudioSendTime>{formatAudioVideoTime(file.metadata.dur, 0)}</AudioSendTime>
      </AudioInfo>

      <Audio controls ref={audioRef} src={fileUrl}>
        <source src={fileUrl} type='audio/ogg' />
        <source src={fileUrl} type='audio/mpeg' />
      </Audio>
    </FileItem>
  )
}

export default VoiceItem

const FileIconCont = styled.span`
  cursor: pointer;
  display: inline-flex;
`
const FileHoverIconCont = styled.span`
  cursor: pointer;
  display: none;
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
  color: ${(props) => props.color || colors.gray6};
`

const AudioDate = styled.span<{ color?: string }>`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: calc(100% - 72px);
  font-style: normal;
  font-weight: normal;
  font-size: 12px;
  line-height: 16px;
  color: ${(props) => props.color || colors.gray9};
`

const AudioSendTime = styled.span<{ color?: string }>`
  position: absolute;
  right: 0;
  top: 11px;
  color: ${(props) => props.color || colors.gray9};
  font-size: 12px;
  line-height: 16px;
`

const Audio = styled.audio<any>`
  display: none;
`
