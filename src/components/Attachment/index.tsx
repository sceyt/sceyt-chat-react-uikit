import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ReactComponent as ErrorIcon } from '../../assets/svg/errorIcon.svg'
import { ReactComponent as CancelIcon } from '../../assets/svg/cancel.svg'
// import { ReactComponent as DownloadFileIcon } from '../../assets/svg/download.svg'
import { ReactComponent as FileIcon } from '../../assets/svg/fileIcon.svg'
import { ReactComponent as RemoveAttachment } from '../../assets/svg/deleteUpload.svg'
import { ReactComponent as RemoveFaledAttachment } from '../../assets/svg/deleteFailed.svg'
// import { ReactComponent as PlayIcon } from '../../assets/svg/video-call.svg'
import { ReactComponent as UploadIcon } from '../../assets/svg/upload.svg'
import { ReactComponent as DownloadIcon } from '../../assets/svg/download.svg'
import { bytesToSize, getFileExtension } from '../../helpers'
import { attachmentCompilationStateSelector } from '../../store/message/selector'
import { IAttachment, IUser } from '../../types'
import { UPLOAD_STATE } from '../../helpers/constants'
import { colors } from '../../UIHelper/constants'
import { AttachmentIconCont } from '../ChannelDetails/DetailsTab'
import VideoPlayer from '../VideoPlayer'
import ImageThumbnail from '../../common/imageThumbnail'
import { getCustomDownloader } from '../../helpers/customUploader'
import { pauseAttachmentUploadingAC, resumeAttachmentUploadingAC } from '../../store/message/actions'

interface AttachmentPops {
  attachment: IAttachment
  isPrevious?: boolean
  isRepliedMessage?: boolean
  removeSelected: (attachmentUrl: string) => void
  handleMediaItemClick?: (attachment: IAttachment) => void
  attachments?: IAttachment[]
  user?: IUser
  borderRadius?: string
  backgroundColor: string
  selectedFileAttachmentsBoxBorder?: string
  selectedFileAttachmentsTitleColor?: string
  selectedFileAttachmentsSizeColor?: string
  selectedFileAttachmentsIcon?: JSX.Element
}

const Attachment = ({
  attachment,
  isPrevious = false,
  removeSelected,
  isRepliedMessage,
  borderRadius,
  handleMediaItemClick,
  selectedFileAttachmentsIcon,
  backgroundColor,
  selectedFileAttachmentsBoxBorder,
  selectedFileAttachmentsTitleColor,
  selectedFileAttachmentsSizeColor
}: AttachmentPops) => {
  const dispatch = useDispatch()
  const attachmentCompilationState = useSelector(attachmentCompilationStateSelector) || {}
  // const attachmentUploadProgress = useSelector(attachmentUploadProgressSelector) || {}
  const imageContRef = useRef<HTMLDivElement>(null)
  const [imgIsLoaded, setImgIsLoaded] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [downloadIsCancelled, setDownloadIsCancelled] = useState(false)
  // const [progress, setProgress] = useState(0)
  const customDownloader = getCustomDownloader()
  // const sendAsSeparateMessage = getSendAttachmentsAsSeparateMessages()
  // TODO check after and remove in not nedded
  /* const [mediaFile, setMediaFile] = useState<IAttachment | null>(null)
  const sliderAttachments = attachments.filter(
    (a: IAttachment) => a.type === 'image' || a.type === 'video'
  )
  const handleMediaItemClick = () => {
    setMediaFile(attachment)
  } */

  /* const RenderAttachmentImage = () =>
    useMemo(
      () => (
        <AttachmentImg
          src={attachment.attachmentUrl || attachment.url}
          borderRadius={borderRadius}
          // onClick={handleMediaItemClick}
        />
      ),
      [attachment.url]
    ) */

  const downloadImage = (url: string) => {
    const image = new Image()
    image.src = url
    image.onload = () => {
      setAttachmentUrl(url)
    }
    image.onerror = () => {}
  }

  const handlePauseResumeDownload = (e: Event) => {
    e.stopPropagation()
    if (downloadIsCancelled) {
      setDownloadIsCancelled(false)
      if (customDownloader) {
        customDownloader(attachment).then((url) => {
          downloadImage(url)
        })
      } else {
        downloadImage(attachment.url)
      }
    } else {
      setAttachmentUrl('')
      setDownloadIsCancelled(true)
    }
  }
  const handlePauseResumeUpload = (e: Event) => {
    e.stopPropagation()
    if (attachmentCompilationState[attachment.attachmentId!]) {
      if (attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING) {
        dispatch(pauseAttachmentUploadingAC(attachment.attachmentId!))
      } else {
        dispatch(resumeAttachmentUploadingAC(attachment.attachmentId!))
      }
    }
  }
  const ext = getFileExtension(attachment.name || (attachment.data ? attachment.data.name : ''))

  useEffect(() => {
    if (downloadIsCancelled) {
      setAttachmentUrl('')
    }
  }, [attachmentUrl])

  useEffect(() => {
    if (attachment.type === 'image' && !isPrevious) {
      if (customDownloader) {
        customDownloader(attachment).then((url) => {
          downloadImage(url)
        })
      } else {
        downloadImage(attachment.url)
      }
    } else {
      if (customDownloader) {
        customDownloader(attachment).then((url) => {
          setAttachmentUrl(url)
        })
      } else {
        setAttachmentUrl(attachment.url)
      }
    }

    /* setInterval(() => {
      console.log('set progress... ', progress)
      setProgress((prevState) => prevState + 0.01)
    }, 100) */
  }, [])
  return (
    <React.Fragment>
      {/* {ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' ? ( */}
      {attachment.type === 'image' ? (
        <AttachmentImgCont
          onClick={() => handleMediaItemClick && handleMediaItemClick(attachment)}
          isPrevious={isPrevious}
          ref={imageContRef}
          borderRadius={borderRadius}
          isRepliedMessage={isRepliedMessage}
          imgIsLoaded={imgIsLoaded}
        >
          {(attachment.attachmentUrl || attachmentUrl) && (
            <AttachmentImg
              backgroundColor={backgroundColor}
              absolute={attachment.metadata && attachment.metadata.thumbnail}
              src={attachment.attachmentUrl || attachmentUrl}
              borderRadius={borderRadius}
              isPrevious={isPrevious}
              isRepliedMessage={isRepliedMessage}
              withBorder={!isPrevious}
              onLoad={() => setImgIsLoaded(true)}
            />
          )}

          {!isPrevious && !(attachment.attachmentUrl || attachmentUrl) && (
            <UploadProgress isRepliedMessage={isRepliedMessage} onClick={handlePauseResumeDownload}>
              <UploadPercent isRepliedMessage={isRepliedMessage}>
                {downloadIsCancelled ? <DownloadIcon /> : <CancelIcon />}
              </UploadPercent>
              {!downloadIsCancelled && <UploadingIcon isRepliedMessage={isRepliedMessage} className='rotate_cont' />}
            </UploadProgress>
          )}
          {/* {!imgIsLoaded && ( */}
          {!isPrevious && attachment.metadata && attachment.metadata.thumbnail && (
            <ImageThumbnail
              src={attachment.metadata.thumbnail}
              width={attachment.metadata.width}
              height={attachment.metadata.height}
              isRepliedMessage={isRepliedMessage}
              borderRadius={borderRadius}
              isLoaded={!imgIsLoaded}
            />
          )}

          {/* )} */}
          {!isPrevious &&
          attachmentCompilationState[attachment.attachmentId!] &&
          attachmentCompilationState[attachment.attachmentId!] !== UPLOAD_STATE.SUCCESS ? (
            <UploadProgress onClick={handlePauseResumeUpload}>
              <UploadPercent>
                {attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING ? (
                  <CancelIcon />
                ) : (
                  <UploadIcon />
                )}
              </UploadPercent>
              {attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING && (
                <UploadingIcon className='rotate_cont' />
              )}
            </UploadProgress>
          ) : attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.FAIL ? (
            <React.Fragment>
              <RemoveChosenFile onClick={() => removeSelected(attachment.attachmentId!)} />
              <UploadProgress isFailedAttachment>
                <ErrorIcon />
              </UploadProgress>
            </React.Fragment>
          ) : null}
          {isPrevious && <RemoveChosenFile onClick={() => removeSelected(attachment.attachmentId!)} />}
        </AttachmentImgCont>
      ) : ext === 'mp4' || ext === 'mov' || ext === 'avi' || ext === 'wmv' || ext === 'flv' || ext === 'webm' ? (
        <React.Fragment>
          {!isPrevious ? (
            <VideoCont onClick={() => handleMediaItemClick && handleMediaItemClick(attachment)}>
              {attachmentCompilationState[attachment.attachmentId!] &&
              attachmentCompilationState[attachment.attachmentId!] !== UPLOAD_STATE.SUCCESS ? (
                <UploadProgress isRepliedMessage onClick={handlePauseResumeUpload}>
                  <UploadPercent isRepliedMessage>
                    {attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING ? (
                      <CancelIcon />
                    ) : (
                      <UploadIcon />
                    )}
                  </UploadPercent>
                  {attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING && (
                    <UploadingIcon isRepliedMessage className='rotate_cont' />
                  )}
                </UploadProgress>
              ) : attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.FAIL ? (
                <React.Fragment>
                  <RemoveChosenFile onClick={() => removeSelected(attachment.attachmentId!)} />
                  <UploadProgress isFailedAttachment>
                    <ErrorIcon />
                  </UploadProgress>
                </React.Fragment>
              ) : null}
              <VideoPlayer
                maxWidth={isRepliedMessage ? '40px' : '320px'}
                maxHeight={isRepliedMessage ? '40px' : '240px'}
                file={attachment}
                src={attachmentUrl}
                borderRadius={borderRadius}
                isRepliedMessage={isRepliedMessage}
                backgroundColor={backgroundColor}
              />
            </VideoCont>
          ) : (
            <AttachmentImgCont isPrevious={isPrevious} backgroundColor={colors.gray3}>
              {/* <PlayIcon /> */}
              <VideoPlayer
                maxWidth='48px'
                maxHeight='48px'
                file={attachment}
                src={attachment.attachmentUrl || attachmentUrl}
                borderRadius={borderRadius}
                backgroundColor={backgroundColor}
                isPreview
              />
              {!isPrevious && attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING ? (
                <UploadProgress onClick={handlePauseResumeUpload}>
                  <UploadPercent>
                    <CancelIcon />
                  </UploadPercent>
                  <UploadingIcon className='rotate_cont' />
                </UploadProgress>
              ) : attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.FAIL ? (
                <React.Fragment>
                  <RemoveChosenFile onClick={() => removeSelected(attachment.attachmentId!)} />
                  <UploadProgress isFailedAttachment>
                    <ErrorIcon />
                  </UploadProgress>
                </React.Fragment>
              ) : null}
              {
                isPrevious && <RemoveChosenFile onClick={() => removeSelected(attachment.attachmentId!)} /> /*: (
                <DownloadImage onClick={() => downloadFile(attachment)}>
                  <DownloadFileIcon />
                </DownloadImage>
              ) */
              }
            </AttachmentImgCont>
          )}
        </React.Fragment>
      ) : (
        <AttachmentFile
          isPrevious={isPrevious}
          borderRadius={borderRadius}
          background={backgroundColor}
          isRepliedMessage={isRepliedMessage}
          border={selectedFileAttachmentsBoxBorder}
        >
          {attachment.metadata && attachment.metadata.thumbnail ? (
            <FileThumbnail src={`data:image/jpeg;base64,${attachment.metadata.thumbnail}`} />
          ) : (
            <AttachmentIconCont>{selectedFileAttachmentsIcon || <FileIcon />}</AttachmentIconCont>
          )}
          {!isPrevious && attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING ? (
            <UploadProgress fileAttachment>
              <UploadPercent fileAttachment>
                <CancelIcon />
              </UploadPercent>
              <UploadingIcon fileAttachment className='rotate_cont' />
            </UploadProgress>
          ) : attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.FAIL ? (
            <React.Fragment>
              <UploadProgress isFailedAttachment>
                <RemoveFailed onClick={() => removeSelected(attachment.attachmentId!)} />
                {/* <ErrorIcon /> */}
              </UploadProgress>
            </React.Fragment>
          ) : null}
          {!isRepliedMessage && (
            <AttachmentFileInfo isPrevious={isPrevious}>
              <AttachmentName color={selectedFileAttachmentsTitleColor}>
                {isPrevious ? attachment.data.name : attachment.name}
              </AttachmentName>
              <AttachmentSize color={selectedFileAttachmentsSizeColor}>
                {((attachment.data && attachment.data.size) || attachment.fileSize) &&
                  bytesToSize(isPrevious ? attachment.data.size : +attachment.fileSize)}
                <span>
                  {attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.FAIL && 'Upload error'}
                </span>
              </AttachmentSize>
            </AttachmentFileInfo>
          )}
          {
            isPrevious && (
              <RemoveChosenFile onClick={() => removeSelected(attachment.attachmentId!)} />
            ) /*: attachmentCompilationState[attachment.attachmentId!] !== UPLOAD_STATE.FAIL &&
            attachmentCompilationState[attachment.attachmentId!] !== UPLOAD_STATE.UPLOADING ? (
            <DownloadFile download={attachment.name} onClick={() => downloadFile(attachment)}>
              <DownloadFileIcon />
            </DownloadFile>
          ) : (
            ''
          ) */
          }
        </AttachmentFile>
      )}
      {/* eslint-disable-next-line max-len */}
      {/* {mediaFile && <SliderPopup setIsSliderOpen={setMediaFile} mediaFiles={sliderAttachments} currentMediaFile={mediaFile} user={user} />} */}
    </React.Fragment>
  )
}

export default Attachment

const DownloadImage = styled.div<any>`
  position: absolute;
  visibility: hidden;
  opacity: 0;
  width: 28px;
  height: 28px;
  top: 12px;
  right: 17px;
  border-radius: 50%;
  line-height: 35px;
  text-align: center;
  cursor: pointer;
  background: #ffffff;
  box-shadow: 0 4px 4px rgba(6, 10, 38, 0.2);
  transition: all 0.1s;

  & > svg {
    width: 16px;
  }
`
const AttachmentImgCont = styled.div<{
  isPrevious: boolean
  backgroundColor?: string
  ref?: any
  borderRadius?: string
  imgIsLoaded?: boolean
  isRepliedMessage?: boolean
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  //flex-direction: column;
  margin-right: ${(props) => (props.isPrevious ? '16px' : props.isRepliedMessage ? '8px' : '')};
  //max-width: 420px;
  //max-height: 400px;
  min-width: ${(props) => !props.isRepliedMessage && '130px'};
  cursor: pointer;
  & > img.thumbnail {
    position: ${(props) => props.imgIsLoaded && 'absolute'};
    object-fit: cover;
    max-width: 420px;
    max-height: 400px;
    min-width: 120px;
    border-radius: ${(props) => props.borderRadius || '4px'};
  }
  ${(props) =>
    props.backgroundColor &&
    `
    background-color: ${props.backgroundColor};
    border-radius: 8px;
    justify-content: center;
    align-items: center;
     & > svg:first-child {
      width: 36px;
      height: 36px;
      transform: translate(2px, 3px);
    }
  `}

  &:hover ${DownloadImage} {
    visibility: visible;
    opacity: 1;
  }

  ${(props) =>
    props.isPrevious &&
    `
      width: 48px;
      min-width: 48px;
      height: 48px;
  `}
`

const FileThumbnail = styled.img<any>`
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 8px;
`
const DownloadFile = styled.a<any>`
  visibility: hidden;
  opacity: 0;
  margin-left: auto;
  cursor: pointer;
  transition: all 0.1s;
`

export const AttachmentFile = styled.div<{
  isPrevious?: boolean
  isRepliedMessage?: boolean
  borderRadius?: string
  background?: string
  border?: string
}>`
  display: flex;
  position: relative;
  align-items: center;
  padding: ${(props) => !props.isRepliedMessage && '8px 12px;'};
  width: ${(props) => !props.isRepliedMessage && '350px'};
  //height: 70px;
  background: ${(props) => props.background || '#ffffff'};
  border: ${(props) => props.border || `1px solid  ${colors.gray1}`};
  box-sizing: border-box;
  margin-right: ${(props) => (props.isPrevious ? '16px' : props.isRepliedMessage ? '8px' : '')};
  border-radius: ${(props) => props.borderRadius || '6px'};

  &:hover ${DownloadFile} {
    visibility: visible;
    opacity: 1;
  }

  & > ${AttachmentIconCont} svg {
    width: 36px;
    height: 36px;
  }
`

export const UploadingIcon = styled.span<{ fileAttachment?: boolean; isRepliedMessage?: boolean }>`
  display: inline-block;
  border: ${(props) => (props.fileAttachment ? '2px' : '3px')} solid rgba(255, 255, 255, 0.8);
  border-top: ${(props) => (props.fileAttachment ? '2px' : '3px')} solid rgba(0, 0, 0, 0);
  border-radius: 50%;
  width: ${(props) => (props.fileAttachment ? '26px' : props.isRepliedMessage ? '28px' : '40px')};
  height: ${(props) => (props.fileAttachment ? '26px' : props.isRepliedMessage ? '28px' : '40px')};

  animation: preloader 1.5s linear infinite;

  @keyframes preloader {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`

const RemoveChosenFile = styled(RemoveAttachment)`
  position: absolute;
  width: 20px;
  height: 20px !important;
  top: -11px;
  right: -11px;
  padding: 2px;
  cursor: pointer;
  z-index: 4;
`

const RemoveFailed = styled(RemoveFaledAttachment)`
  position: absolute;
  top: calc(50% - 11px);
  right: 18px;
  padding: 2px;
  cursor: pointer;
`

export const UploadPercent = styled.span<{ fileAttachment?: boolean; isRepliedMessage?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  color: #fff;
  width: ${(props) => (props.fileAttachment ? '36px' : props.isRepliedMessage ? '40px' : '56px')};
  height: ${(props) => (props.fileAttachment ? '36px' : props.isRepliedMessage ? '40px' : '56px')};
  background-color: rgba(0,0,0,0.4);
  border-radius: ${(props) => (props.fileAttachment ? '8px' : props.isRepliedMessage ? '4px' : ' 50%')};
}
  ${(props) =>
    (props.fileAttachment || props.isRepliedMessage) &&
    `& > svg {
    width: 15px;
    height: 15px;
  }`}
`

export const UploadProgress = styled.div<{
  isFailedAttachment?: boolean
  whiteBackground?: boolean
  fileAttachment?: boolean
  isRepliedMessage?: boolean
  onClick?: any
  backgroundImage?: string
  borderRadius?: string
}>`
  position: absolute;
  top: ${(props) => (props.fileAttachment ? '9px' : '0')};
  left: ${(props) => (props.fileAttachment ? '12px' : '0')};
  width: ${(props) => (props.fileAttachment ? '36px' : props.isRepliedMessage ? '40px' : '100%')};
  height: ${(props) => (props.fileAttachment ? '36px' : props.isRepliedMessage ? '40px' : '100%')};
  display: flex;
  align-items: center;
  justify-content: center;
  //border-radius: ${(props) => (props.fileAttachment ? '8px' : props.isRepliedMessage ? '4px' : ' 50%')};
  background-image: url(${(props) => props.backgroundImage});
  background-size: cover;
  border-radius: ${(props) => props.borderRadius};
  z-index: 5;

  ${(props) => props.isFailedAttachment && 'background-color: rgba(237, 77, 96, 0.1);'}
  ${(props) =>
    props.whiteBackground &&
    `
    background-color: rgba(255,255,255,0.3);
    border: 1px solid  ${colors.gray1};

    ${UploadingIcon} {
        border: 4px solid rgba(238,238,238,0.8);
        border-top: 4px solid ${colors.cobalt1};
    }
  `}
`

const AttachmentName = styled.h3<{ color?: string }>`
  font-size: 15px;
  font-weight: 500;
  line-height: 18px;
  color: ${(props) => props.color || colors.blue6};
  max-width: 262px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
`
const AttachmentSize = styled.span<{ color?: string }>`
  font-size: 13px;
  color: ${(props) => props.color || colors.blue6};
  & > span {
    color: ${colors.red1};
    margin-left: 8px;
  }
`
const AttachmentFileInfo = styled.div<{ isPrevious: boolean }>`
  margin-left: 12px;
  ${(props) =>
    props.isPrevious &&
    `line-height: 14px;
      max-width: calc(100% - 44px);
  `}
`

export const AttachmentImg = styled.img<{
  absolute?: boolean
  borderRadius?: string
  ref?: any
  withBorder?: boolean
  isPrevious?: boolean
  isRepliedMessage?: boolean
  backgroundColor: string
}>`
  position: ${(props) => props.absolute && 'absolute'};
  border-radius: ${(props) => (props.isRepliedMessage ? '4px' : props.borderRadius || '6px')};
  border: ${(props) =>
    props.isRepliedMessage
      ? '0.5px solid rgba(0, 0, 0, 0.1)'
      : props.withBorder && `2px solid ${props.backgroundColor}`};
  box-sizing: border-box;
  max-width: 100%;
  max-height: 400px;
  width: ${(props) => (props.isRepliedMessage ? '40px' : props.isPrevious ? '48px' : '')};
  height: ${(props) => (props.isRepliedMessage ? '40px' : props.isPrevious ? '48px' : '')};
  min-width: ${(props) => !props.isRepliedMessage && !props.isPrevious && '130px'};
  object-fit: cover;
  z-index: 2;
`

const VideoCont = styled.div`
  cursor: pointer;
`
