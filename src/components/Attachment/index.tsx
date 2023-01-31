import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ReactComponent as CancelIcon } from '../../assets/svg/cancel.svg'
// import { ReactComponent as DownloadFileIcon } from '../../assets/svg/download.svg'
import { ReactComponent as FileIcon } from '../../assets/svg/fileIcon.svg'
import { ReactComponent as RemoveAttachment } from '../../assets/svg/deleteUpload.svg'
import { ReactComponent as RemoveFaledAttachment } from '../../assets/svg/deleteFailed.svg'
// import { ReactComponent as PlayIcon } from '../../assets/svg/video-call.svg'
import { ReactComponent as UploadIcon } from '../../assets/svg/upload.svg'
import { ReactComponent as DownloadIcon } from '../../assets/svg/download.svg'
import {
  bytesToSize,
  calculateRenderedImageWidth,
  downloadFile,
  formatLargeText,
  getFileExtension
} from '../../helpers'
import { attachmentCompilationStateSelector } from '../../store/message/selector'
import { IAttachment } from '../../types'
import { attachmentTypes, UPLOAD_STATE } from '../../helpers/constants'
import { colors } from '../../UIHelper/constants'
import VideoPlayer from '../VideoPlayer'
import { getCustomDownloader } from '../../helpers/customUploader'
import { pauseAttachmentUploadingAC, resumeAttachmentUploadingAC } from '../../store/message/actions'
import AudioPlayer from '../AudioPlayer'
import { AttachmentIconCont, UploadProgress, UploadingIcon, UploadPercent } from '../../UIHelper'

interface AttachmentPops {
  attachment: IAttachment
  isPrevious?: boolean
  isRepliedMessage?: boolean
  isDetailsView?: boolean
  removeSelected?: (attachmentUrl: string) => void
  setVideoIsReadyToSend?: (attachmentId: string) => void
  handleMediaItemClick?: (attachment: IAttachment) => void
  attachments?: IAttachment[]
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
  setVideoIsReadyToSend,
  selectedFileAttachmentsIcon,
  backgroundColor,
  selectedFileAttachmentsBoxBorder,
  selectedFileAttachmentsTitleColor,
  selectedFileAttachmentsSizeColor,
  isDetailsView
}: AttachmentPops) => {
  const dispatch = useDispatch()
  const attachmentCompilationState = useSelector(attachmentCompilationStateSelector) || {}
  // const attachmentUploadProgress = useSelector(attachmentUploadProgressSelector) || {}
  const imageContRef = useRef<HTMLDivElement>(null)
  const [imgIsLoaded, setImgIsLoaded] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState('')
  // const [linkTitle, setLinkTitle] = useState('')
  // const [linkDescription, setLinkDescription] = useState('')
  // const [linkImage, setLinkImage] = useState('')
  const [downloadIsCancelled, setDownloadIsCancelled] = useState(false)
  // const [progress, setProgress] = useState(0)
  const fileNameRef: any = useRef(null)
  const customDownloader = getCustomDownloader()
  const [renderWidth, renderHeight] =
    attachment.metadata && attachment.metadata.szw && attachment.metadata.szh
      ? calculateRenderedImageWidth(attachment.metadata.szw, attachment.metadata.szh)
      : []
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
        customDownloader(attachment.url).then((url) => {
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
    /* if (attachment.type === 'link' && !isPrevious) {
      getMetadataFromUrl(attachment.url).then((res) => {
        if (res) {
          if (res.title) {
            setLinkTitle(res.title)
          }
          if (res.description) {
            setLinkDescription(res.description)
          }
          if (res.image) {
            setLinkImage(res.image)
          }
        }
      })
    } */
    if (attachment.type === 'image' && !isPrevious) {
      if (customDownloader) {
        customDownloader(attachment.url).then((url) => {
          downloadImage(url)
        })
      } else {
        downloadImage(attachment.url)
      }
    } else {
      if (customDownloader) {
        customDownloader(attachment.url).then((url) => {
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

  // console.log('attachment ... ', attachment)
  // console.log('attachmentCompilationState  ... ', attachmentCompilationState[attachment.attachmentId!])
  // @ts-ignore
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
          fitTheContainer={isDetailsView}
        >
          {(attachment.attachmentUrl || attachmentUrl) && (
            <AttachmentImg
              backgroundColor={backgroundColor}
              // absolute={attachment.metadata && attachment.metadata.tmb}
              src={attachment.attachmentUrl || attachmentUrl}
              borderRadius={borderRadius}
              isPrevious={isPrevious}
              isRepliedMessage={isRepliedMessage}
              withBorder={!isPrevious && !isDetailsView}
              fitTheContainer={isDetailsView}
              onLoad={() => setImgIsLoaded(true)}
            />
          )}

          {!isPrevious && !(attachment.attachmentUrl || attachmentUrl) && (
            <UploadProgress
              positionStatic
              backgroundImage={attachment.metadata.tmb}
              isRepliedMessage={isRepliedMessage}
              onClick={handlePauseResumeDownload}
              width={renderWidth}
              height={renderHeight}
              withBorder={!isPrevious && !isDetailsView}
              backgroundColor={backgroundColor}
            >
              <UploadPercent isRepliedMessage={isRepliedMessage}>
                {downloadIsCancelled ? <DownloadIcon /> : <CancelIcon />}
              </UploadPercent>
              {!downloadIsCancelled && <UploadingIcon isRepliedMessage={isRepliedMessage} className='rotate_cont' />}
            </UploadProgress>
          )}
          {/* {!imgIsLoaded && ( */}
          {/*    {!isPrevious && attachment.metadata && attachment.metadata.tmb && (
            <ImageThumbnail
              src={attachment.metadata.tmb}
              fitTheContainer={isDetailsView}
              width={attachment.metadata.szw}
              height={attachment.metadata.szh}
              isRepliedMessage={isRepliedMessage}
              borderRadius={borderRadius}
              isLoaded={!imgIsLoaded}
            />
          )} */}

          {/* )} */}
          {!isPrevious &&
          attachmentCompilationState[attachment.attachmentId!] &&
          attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING ? (
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
          ) : /* attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.FAIL ? (
            <React.Fragment>
              <RemoveChosenFile onClick={() => removeSelected(attachment.attachmentId!)} />
              <UploadProgress isFailedAttachment>
                <ErrorIcon />
              </UploadProgress>
            </React.Fragment>
          ) : */ null}
          {isPrevious && (
            <RemoveChosenFile onClick={() => removeSelected && removeSelected(attachment.attachmentId!)} />
          )}
        </AttachmentImgCont>
      ) : ext === 'mp4' || ext === 'mov' || ext === 'avi' || ext === 'wmv' || ext === 'flv' || ext === 'webm' ? (
        <React.Fragment>
          {!isPrevious ? (
            <VideoCont
              onClick={() =>
                handleMediaItemClick &&
                (attachmentCompilationState[attachment.attachmentId!]
                  ? attachmentCompilationState[attachment.attachmentId!] !== UPLOAD_STATE.FAIL ||
                    attachmentCompilationState[attachment.attachmentId!] !== UPLOAD_STATE.UPLOADING
                  : true) &&
                handleMediaItemClick(attachment)
              }
              isDetailsView={isDetailsView}
            >
              {attachmentCompilationState[attachment.attachmentId!] &&
              (attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING ||
                attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.PAUSED) ? (
                <UploadProgress isRepliedMessage={isRepliedMessage} onClick={handlePauseResumeUpload}>
                  <UploadPercent isRepliedMessage={isRepliedMessage}>
                    {attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING ? (
                      <CancelIcon />
                    ) : (
                      <UploadIcon />
                    )}
                  </UploadPercent>
                  {attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING && (
                    <UploadingIcon isRepliedMessage={isRepliedMessage} className='rotate_cont' />
                  )}
                </UploadProgress> /* : attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.FAIL ? (
                <React.Fragment>
                  <UploadProgress isFailedAttachment>
                    <ErrorIcon />
                  </UploadProgress>
                </React.Fragment>
              ) */
              ) : null}
              <VideoPlayer
                maxWidth={isRepliedMessage ? '40px' : isDetailsView ? '100%' : '320px'}
                maxHeight={isRepliedMessage ? '40px' : isDetailsView ? '100%' : '240px'}
                file={attachment}
                src={attachmentUrl}
                uploading={
                  attachmentCompilationState[attachment.attachmentId!] &&
                  (attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.UPLOADING ||
                    attachmentCompilationState[attachment.attachmentId!] === UPLOAD_STATE.PAUSED)
                }
                borderRadius={isRepliedMessage ? '4px' : borderRadius}
                isRepliedMessage={isRepliedMessage}
                isDetailsView={isDetailsView}
                backgroundColor={backgroundColor}
              />
            </VideoCont>
          ) : (
            <AttachmentImgCont isPrevious={isPrevious} backgroundColor={colors.defaultAvatarBackground}>
              {/* <PlayIcon /> */}
              <VideoPlayer
                maxWidth='48px'
                maxHeight='48px'
                file={attachment}
                src={attachment.attachmentUrl || attachmentUrl}
                borderRadius={borderRadius}
                setVideoIsReadyToSend={setVideoIsReadyToSend}
                backgroundColor={backgroundColor}
                isPreview
              />
              <RemoveChosenFile onClick={() => removeSelected && removeSelected(attachment.attachmentId!)} />
            </AttachmentImgCont>
          )}
        </React.Fragment>
      ) : attachment.type === attachmentTypes.voice ? (
        <AudioPlayer url={attachment.attachmentUrl || attachmentUrl} file={attachment} />
      ) : attachment.type === attachmentTypes.link ? null : (
        /* <LinkAttachmentCont href={attachment.url} target='_blank' rel='noreferrer'>
          {linkTitle ? (
            <React.Fragment>
              <LinkTitle>{linkTitle}</LinkTitle>
              <LinkDescription>{linkDescription}</LinkDescription>
              <LinkImage src={linkImage} />
            </React.Fragment>
          ) : (
            <div />
          )}
        </LinkAttachmentCont> */
        <AttachmentFile
          isPrevious={isPrevious}
          borderRadius={borderRadius}
          background={backgroundColor}
          isRepliedMessage={isRepliedMessage}
          border={selectedFileAttachmentsBoxBorder}
        >
          {attachment.metadata && attachment.metadata.tmb ? (
            <FileThumbnail src={`data:image/jpeg;base64,${attachment.metadata.tmb}`} />
          ) : (
            <AttachmentIconCont>{selectedFileAttachmentsIcon || <FileIcon />}</AttachmentIconCont>
          )}
          {!isRepliedMessage && !isPrevious && (
            <DownloadFile onClick={() => downloadFile(attachment)}>
              <DownloadIcon />
            </DownloadFile>
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
                <RemoveFailed onClick={() => removeSelected && removeSelected(attachment.attachmentId!)} />
                {/* <ErrorIcon /> */}
              </UploadProgress>
            </React.Fragment>
          ) : null}
          {!isRepliedMessage && (
            <AttachmentFileInfo isPrevious={isPrevious}>
              {/* @ts-ignore */}
              <AttachmentName color={selectedFileAttachmentsTitleColor} ref={fileNameRef}>
                {formatLargeText(isPrevious ? attachment.data.name : attachment.name, 28)}
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
              <RemoveChosenFile onClick={() => removeSelected && removeSelected(attachment.attachmentId!)} />
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
  fitTheContainer?: boolean
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  //flex-direction: column;
  margin-right: ${(props) => (props.isPrevious ? '16px' : props.isRepliedMessage ? '8px' : '')};
  //max-width: 420px;
  //max-height: 400px;
  min-width: ${(props) => !props.isRepliedMessage && !props.fitTheContainer && '130px'};
  height: ${(props) => props.fitTheContainer && '100%'};

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
      width: 40px;
      height: 40px;
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
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 8px;
`

const DownloadFile = styled.span<any>`
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: ${colors.primary};
  min-width: 40px;
  max-width: 40px;
  height: 40px;
  border-radius: 50%;

  & > svg {
    width: 20px;
    height: 20px;
  }
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

  ${(props) =>
    !props.isRepliedMessage &&
    !props.isPrevious &&
    `
      &:hover ${DownloadFile} {
        display: flex;
      }

      &:hover ${FileThumbnail} {
        display: none;
      }
        &:hover ${AttachmentIconCont} {
    display: none;
  }
  `}

  & > ${AttachmentIconCont} svg {
    width: 40px;
    height: 40px;
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
  fitTheContainer?: boolean
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
  width: ${(props) =>
    props.isRepliedMessage ? '40px' : props.isPrevious ? '48px' : props.fitTheContainer ? '100%' : ''};
  height: ${(props) =>
    props.isRepliedMessage ? '40px' : props.isPrevious ? '48px' : props.fitTheContainer ? '100%' : ''};
  min-width: ${(props) =>
    !props.isRepliedMessage && !props.isPrevious && !props.fitTheContainer
      ? '130px'
      : props.isRepliedMessage
      ? '40px'
      : ''};
  object-fit: cover;
  z-index: 2;
`

const VideoCont = styled.div<{ isDetailsView?: boolean }>`
  cursor: pointer;
  height: ${(props) => props.isDetailsView && '100%'};
`

/* const LinkAttachmentCont = styled.a<{ isDetailsView?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  height: 248px;
  text-decoration: none;
`

const LinkTitle = styled.h4`
  margin: 0 12px 4px;
  color: ${colors.gray6};
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
`

const LinkDescription = styled.p`
  margin: 0 12px 10px;
  color: ${colors.gray6};
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.078px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

const LinkImage = styled.img<any>`
  width: 320px;
  height: 180px;
  object-fit: cover;
  border-radius: 4px 4px 14px 14px;
` */
