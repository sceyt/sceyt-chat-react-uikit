import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ReactComponent as CancelIcon } from '../../assets/svg/cancel.svg'
import { CircularProgressbar } from 'react-circular-progressbar'
// import 'react-circular-progressbar/dist/styles.css'
// import { ReactComponent as DownloadFileIcon } from '../../assets/svg/download.svg'
import { ReactComponent as FileIcon } from '../../assets/svg/fileIcon.svg'
import { ReactComponent as RemoveAttachment } from '../../assets/svg/deleteUpload.svg'
// import { ReactComponent as RemoveFaledAttachment } from '../../assets/svg/deleteFailed.svg'
// import { ReactComponent as PlayIcon } from '../../assets/svg/video-call.svg'
import { ReactComponent as UploadIcon } from '../../assets/svg/upload.svg'
import { ReactComponent as DownloadIcon } from '../../assets/svg/download.svg'
import {
  bytesToSize,
  calculateRenderedImageWidth,
  cancelDownloadFile,
  downloadFile,
  formatLargeText,
  setDownloadFilePromise
} from '../../helpers'
import { attachmentCompilationStateSelector, attachmentsUploadProgressSelector } from '../../store/message/selector'
import { IAttachment } from '../../types'
import { attachmentTypes, THEME, UPLOAD_STATE } from '../../helpers/constants'
import { colors } from '../../UIHelper/constants'
import VideoPreview from '../VideoPreview'
import { getCustomDownloader, getCustomUploader } from '../../helpers/customUploader'
import { pauseAttachmentUploadingAC, resumeAttachmentUploadingAC } from '../../store/message/actions'
import AudioPlayer from '../AudioPlayer'
import { AttachmentIconCont, UploadProgress, UploadPercent, CancelResumeWrapper } from '../../UIHelper'
import { getAttachmentUrlFromCache, setAttachmentToCache } from '../../helpers/attachmentsCache'
import { connectionStatusSelector } from '../../store/user/selector'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { themeSelector } from '../../store/theme/selector'
import { base64ToToDataURL } from '../../helpers/resizeImage'

interface AttachmentPops {
  attachment: IAttachment
  isPreview?: boolean
  isRepliedMessage?: boolean
  isDetailsView?: boolean
  // eslint-disable-next-line no-unused-vars
  removeSelected?: (attachmentUrl: string) => void
  // eslint-disable-next-line no-unused-vars
  setVideoIsReadyToSend?: (attachmentId: string) => void
  // eslint-disable-next-line no-unused-vars
  handleMediaItemClick?: (attachment: IAttachment) => void
  borderRadius?: string
  backgroundColor: string
  selectedFileAttachmentsBoxBorder?: string
  selectedFileAttachmentsTitleColor?: string
  selectedFileAttachmentsSizeColor?: string
  selectedFileAttachmentsIcon?: JSX.Element
  fileNameMaxLength?: number
  imageMinWidth?: string
  // eslint-disable-next-line no-unused-vars
  closeMessageActions?: (state: boolean) => void
  fileAttachmentWidth?: number
  imageAttachmentMaxWidth?: number
  imageAttachmentMaxHeight?: number
  videoAttachmentMaxWidth?: number
  videoAttachmentMaxHeight?: number
}

const Attachment = ({
  attachment,
  isPreview = false,
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
  isDetailsView,
  // fileNameMaxLength,
  imageMinWidth,
  closeMessageActions,
  fileAttachmentWidth,
  imageAttachmentMaxWidth,
  imageAttachmentMaxHeight,
  videoAttachmentMaxWidth,
  videoAttachmentMaxHeight
}: AttachmentPops) => {
  const dispatch = useDispatch()
  const attachmentCompilationState = useSelector(attachmentCompilationStateSelector) || {}
  const attachmentsUploadProgress = useSelector(attachmentsUploadProgressSelector) || {}
  const connectionStatus = useSelector(connectionStatusSelector)
  const theme = useSelector(themeSelector)
  // const attachmentUploadProgress = useSelector(attachmentUploadProgressSelector) || {}
  const imageContRef = useRef<HTMLDivElement>(null)
  const [imageLoading, setImageLoading] = useState(true)
  const [downloadingFile, setDownloadingFile] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [progress, setProgress] = useState(3)
  const [sizeProgress, setSizeProgress] = useState<{ loaded: number; total: number }>()
  const [isCached, setIsCached] = useState(true)
  // const [linkTitle, setLinkTitle] = useState('')
  // const [linkDescription, setLinkDescription] = useState('')
  // const [linkImage, setLinkImage] = useState('')
  const [downloadIsCancelled, setDownloadIsCancelled] = useState(false)
  const fileNameRef: any = useRef(null)
  const customDownloader = getCustomDownloader()
  const previewFileType = isPreview && attachment.data.type.split('/')[0]
  const [renderWidth, renderHeight] =
    attachment.metadata && attachment.metadata.szw && attachment.metadata.szh
      ? calculateRenderedImageWidth(
          attachment.metadata.szw,
          attachment.metadata.szh,
          attachment.type === attachmentTypes.image ? imageAttachmentMaxWidth : videoAttachmentMaxWidth,
          attachment.type === attachmentTypes.image ? imageAttachmentMaxHeight : videoAttachmentMaxHeight
        )
      : []
  const isInUploadingState =
    attachmentCompilationState[attachment.tid!] &&
    (attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ||
      attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.PAUSED)
  // const attachmentThumb = attachment.metadata && attachment.metadata.tmb

  let attachmentThumb
  let withPrefix = true
  if (
    attachment.type !== attachmentTypes.voice &&
    attachment.type !== attachmentTypes.link &&
    attachment.metadata &&
    attachment.metadata.tmb
  ) {
    try {
      if (attachment.metadata.tmb.length < 70) {
        attachmentThumb = base64ToToDataURL(attachment.metadata.tmb)
        withPrefix = false
      } else {
        attachmentThumb = attachment.metadata && attachment.metadata.tmb
      }
    } catch (e) {
      console.log('error on get attachmentThumb', e)
    }
  }
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
    image.onerror = () => {
      console.error('Error on download image', url)
    }
  }
  const handlePauseResumeDownload = (e: Event) => {
    e.stopPropagation()
    if (downloadIsCancelled) {
      setDownloadIsCancelled(false)
      if (customDownloader) {
        customDownloader(attachment.url, false).then((url) => {
          downloadImage(url)
        })
      } else {
        downloadImage(attachment.url)
      }
    } else {
      setAttachmentUrl('')
      console.log('set downlod is cancelled true')
      setDownloadIsCancelled(true)
    }
  }
  const handlePauseResumeUpload = (e: Event) => {
    e.stopPropagation()
    console.log('handlePauseResumeUpload. . . . .', handlePauseResumeUpload)
    if (downloadingFile) {
      handleStopStartDownloadFile(attachment)
    } else {
      if (attachmentCompilationState[attachment.tid!]) {
        if (attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING) {
          dispatch(pauseAttachmentUploadingAC(attachment.tid!))
        } else {
          dispatch(resumeAttachmentUploadingAC(attachment.tid!))
        }
      }
    }
  }

  const handleMouseEvent = (enter: boolean) => {
    if (closeMessageActions) {
      closeMessageActions(enter)
    }
  }

  // const ext = getFileExtension(attachment.name || (attachment.data ? attachment.data.name : ''))
  const handleCompleteDownload = (attachmentId: string) => {
    console.log('handle complete download .... ', attachmentId)
    console.log('attachment.id .... ', attachment.id)
    if (attachmentId === attachment.id) {
      setDownloadingFile(false)
    }
  }
  const handleStopStartDownloadFile = (att?: IAttachment) => {
    console.log('handleStopStartDownloadFile. . . . . downloadingFile . .', downloadingFile)
    console.log('handleStopStartDownloadFile. . . . . downloadIsCancelled . .', downloadIsCancelled)
    if (downloadingFile) {
      if (downloadIsCancelled) {
        setDownloadIsCancelled(false)
        if (att) {
          handleDownloadFileToDevice(att)
        } else {
          handleDownloadFile()
        }
      } else {
        setDownloadIsCancelled(true)
        const attachmentId = att ? att.id : attachment.id
        console.log('cancel download ..... .. ', attachmentId)
        cancelDownloadFile(attachmentId || '')
      }
    } else {
      setDownloadingFile(true)
      setDownloadIsCancelled(false)
      if (att) {
        handleDownloadFileToDevice(att)
      } else {
        handleDownloadFile()
      }
    }
  }
  const handleDownloadFileToDevice = (attachment: IAttachment) => {
    setDownloadingFile(true)
    setDownloadIsCancelled(false)
    downloadFile(attachment, true, handleCompleteDownload, (progress) => {
      const loadedRes = progress.loaded && progress.loaded / progress.total
      const uploadPercent = loadedRes && loadedRes * 100
      setProgress(uploadPercent > 3 ? uploadPercent : 3)
      setSizeProgress({ loaded: progress.loaded || 0, total: progress.total || 0 })
    })
  }

  const handleDownloadFile = async () => {
    if (customDownloader) {
      if (!attachment.attachmentUrl) {
        setDownloadingFile(true)
      }
      const urlPromise = customDownloader(attachment.url, true, (progress) => {
        const loadedRes = progress.loaded && progress.loaded / progress.total
        const uploadPercent = loadedRes && loadedRes * 100
        setSizeProgress({ loaded: progress.loaded || 0, total: progress.total || 0 })
        setProgress(uploadPercent)
      })
      setDownloadFilePromise(attachment.id!, urlPromise)
      const result = await urlPromise
      // customDownloader(attachment.url, true, (progress) => {}).then(async (data) => {
      // if (attachment.type === attachmentTypes.video) {
      const url = URL.createObjectURL(result.Body)
      setSizeProgress(undefined)
      const response = await fetch(url)
      setAttachmentToCache(attachment.url, response)
      setIsCached(true)
      // }
      setDownloadingFile(false)
      setAttachmentUrl(url)
      // })
    } else {
      setAttachmentUrl(attachment.url)
      fetch(attachment.url).then(async (response) => {
        setAttachmentToCache(attachment.url, response)
        setIsCached(true)
      })
    }
  }

  useEffect(() => {
    if (downloadIsCancelled) {
      setAttachmentUrl('')
    }
  }, [attachmentUrl])

  useEffect(() => {
    /* if (attachment.type === 'link' && !isPreview) {
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
    // setAttachmentUrl('')
    if (
      connectionStatus === CONNECTION_STATUS.CONNECTED &&
      attachment.id &&
      !(attachment.type === attachmentTypes.file || attachment.type === attachmentTypes.link)
    ) {
      getAttachmentUrlFromCache(attachment.url)
        .then(async (cachedUrl) => {
          if (attachment.type === 'image' && !isPreview) {
            if (cachedUrl) {
              // @ts-ignore
              // downloadImage(cachedUrl)
              setAttachmentUrl(cachedUrl)
              console.log('cachedUrl.  ...  . . . ', cachedUrl)
              setIsCached(true)
            } else {
              setIsCached(false)
              if (customDownloader) {
                // console.log('is not cached, download with custom downloader')
                customDownloader(attachment.url, false).then(async (url) => {
                  // console.log('image is downloaded. . . should load image', url)
                  downloadImage(url)
                  const response = await fetch(url)
                  setAttachmentToCache(attachment.url, response)
                  setIsCached(true)
                })
              } else {
                // console.log('is not cached, load attachment.url', attachment.url)
                // console.log('is not cached, load attachment.attachmentUrl', attachment.attachmentUrl)
                downloadImage(attachment.url)
                fetch(attachment.url).then(async (response) => {
                  setAttachmentToCache(attachment.url, response)
                  setIsCached(true)
                })
              }
            }
          } else {
            if (cachedUrl) {
              // @ts-ignore
              setAttachmentUrl(cachedUrl)
              setIsCached(true)
            } else {
              setIsCached(false)
              /* if (attachment.attachmentUrl) {
                setAttachmentUrl(attachment.attachmentUrl)
              } else { */
              handleDownloadFile()
              // }
            }
          }
        })
        .catch((e: any) => {
          console.log('error on get attachment url from cache. .. ', e)
          if (customDownloader) {
            customDownloader(attachment.url, false).then(async (url) => {
              // if (attachment.type === attachmentTypes.video) {
              const response = await fetch(url)
              setAttachmentToCache(attachment.url, response)
              // }
              setAttachmentUrl(url)
            })
          } else {
            setAttachmentUrl(attachment.url)
          }
        })
    }
  }, [attachment.id])
  /* useEffect(() => {
    console.log('START progress .. .. ', progress)

    const int = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(int)
          return prev
        }
        return prev + 2
      })
    }, 1200)
  }, []) */
  useEffect(() => {
    const attachmentIndex = attachment.tid || attachment.id
    if (attachmentIndex && attachmentsUploadProgress[attachmentIndex]) {
      const uploadProgress = attachmentsUploadProgress[attachmentIndex]
      if (getCustomUploader()) {
        const uploadPercent =
          uploadProgress.progress && uploadProgress.progress * 100 > 3 ? uploadProgress.progress * 100 : 3
        setProgress(uploadPercent)
        setSizeProgress({ loaded: uploadProgress.uploaded || 0, total: uploadProgress.total || 0 })
      } else {
        const uploadPercent = uploadProgress.progress > 3 ? uploadProgress.progress : 3
        setProgress(uploadPercent)
        setSizeProgress({ loaded: uploadProgress.uploaded || 0, total: uploadProgress.total || 0 })
      }
    }
  }, [attachmentsUploadProgress])
  /* useEffect(() => {
    console.log('isCached. . . . . . . ', attachment.name, isCached)
  }, [isCached])
  console.log(
    'should show loading 1..... ',
    attachment.name,
    '- - -- ',
    (attachmentCompilationState[attachment.tid!] &&
      (attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ||
        attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.PAUSED)) ||
      !isCached
  )
  console.log(
    'should show loading 2..... ',
    attachment.name,
    '- - -- ',
    attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING || !isCached
  ) */
  return (
    <React.Fragment>
      {/* {ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' ? ( */}
      {attachment.type === 'image' ? (
        <AttachmentImgCont
          draggable={false}
          onClick={() => handleMediaItemClick && handleMediaItemClick(attachment)}
          isPreview={isPreview}
          ref={imageContRef}
          borderRadius={borderRadius}
          backgroundImage={attachmentThumb}
          withPrefix={withPrefix}
          isRepliedMessage={isRepliedMessage}
          fitTheContainer={isDetailsView}
          width={!isPreview && !isRepliedMessage ? renderWidth : undefined}
          height={!isPreview && !isRepliedMessage && !isDetailsView ? renderHeight : undefined}
        >
          {/* {(attachment.attachmentUrl || attachmentUrl) && ( */}
          <AttachmentImg
            draggable={false}
            // hidden={imageLoading}
            backgroundColor={backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : colors.primaryLight}
            src={attachment.attachmentUrl || attachmentUrl}
            borderRadius={borderRadius}
            imageMinWidth={imageMinWidth}
            isPreview={isPreview}
            isRepliedMessage={isRepliedMessage}
            withBorder={!isPreview && !isDetailsView}
            fitTheContainer={isDetailsView}
            imageMaxHeight={
              attachment.metadata && (attachment.metadata.szh > 400 ? '400px' : `${attachment.metadata.szh}px`)
            }
            onLoad={() => setImageLoading(false)}
          />
          {/* )} */}

          {/* {!imgIsLoaded && ( */}
          {/*    {!isPreview && attachment.metadata && attachment.metadata.tmb && (
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
          {!isPreview && (isInUploadingState || imageLoading) ? (
            <UploadProgress
              backgroundImage={attachmentThumb}
              isRepliedMessage={isRepliedMessage}
              width={renderWidth}
              height={renderHeight}
              withBorder={!isPreview && !isDetailsView}
              backgroundColor={backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : colors.primaryLight}
              isDetailsView={isDetailsView}
              imageMinWidth={imageMinWidth}
              withPrefix={withPrefix}
            >
              <UploadPercent isRepliedMessage={isRepliedMessage}>
                {isInUploadingState ? (
                  <CancelResumeWrapper onClick={handlePauseResumeUpload}>
                    {attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ? (
                      <CancelIcon />
                    ) : (
                      <UploadIcon />
                    )}
                  </CancelResumeWrapper>
                ) : (
                  !isCached && (
                    <CancelResumeWrapper onClick={handlePauseResumeDownload}>
                      {downloadIsCancelled ? <DownloadIcon /> : <CancelIcon />}
                    </CancelResumeWrapper>
                  )
                )}

                {(!isCached || attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING) && (
                  <React.Fragment>
                    <ProgressWrapper>
                      <CircularProgressbar
                        minValue={0}
                        maxValue={100}
                        value={progress}
                        backgroundPadding={3}
                        background={true}
                        text=''
                        styles={{
                          // Rotation of path and trail, in number of turns (0-1)
                          // Whether to use rounded or flat corners on the ends - can use 'butt' or 'round'

                          // Text size
                          // textSize: '16px',
                          background: {
                            fill: 'rgba(23, 25, 28, 0.40)'
                          },
                          path: {
                            // Path color
                            stroke: colors.white,
                            // Whether to use rounded or flat corners on the ends - can use 'butt' or 'round'
                            strokeLinecap: 'butt',
                            strokeWidth: '4px',
                            // Customize transition animation
                            transition: 'stroke-dashoffset 0.5s ease 0s',
                            // Rotate the path
                            transform: 'rotate(0turn)',
                            transformOrigin: 'center center'
                          }
                          // How long animation takes to go from one percentage to another, in seconds
                          // pathTransitionDuration: 0.5,

                          // Can specify path transition in more detail, or remove it entirely
                          // pathTransition: 'none',

                          // Colors
                          // pathColor: '#fff',
                          // textColor: '#f88',
                          // trailColor: 'transparent'
                        }}
                      />
                    </ProgressWrapper>

                    {sizeProgress && (
                      <SizeProgress>
                        {bytesToSize(sizeProgress.loaded, 1)} / {bytesToSize(sizeProgress.total, 1)}
                      </SizeProgress>
                    )}
                  </React.Fragment>
                )}
              </UploadPercent>
            </UploadProgress>
          ) : /*  <UploadProgress onClick={handlePauseResumeUpload}>
              <UploadPercent>
                {attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ? (
                  <CancelIcon />
                ) : (
                  <UploadIcon />
                )}
              </UploadPercent>
              {attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING && (
                <UploadingIcon className='rotate_cont' />
              )}
            </UploadProgress> */
          /* attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.FAIL ? (
            <React.Fragment>
              <RemoveChosenFile onClick={() => removeSelected(attachment.tid!)} />
              <UploadProgress isFailedAttachment>
                <ErrorIcon />
              </UploadProgress>
            </React.Fragment>
          ) : */ null}
          {isPreview && (
            <RemoveChosenFile
              color={theme === THEME.DARK ? colors.backgroundColor : colors.textColor3}
              onClick={() => removeSelected && removeSelected(attachment.tid!)}
            />
          )}
        </AttachmentImgCont>
      ) : attachment.type === 'video' ? (
        <React.Fragment>
          {!isPreview ? (
            <VideoCont
              onClick={() =>
                handleMediaItemClick &&
                !downloadingFile &&
                !isInUploadingState &&
                (attachmentCompilationState[attachment.tid!]
                  ? attachmentCompilationState[attachment.tid!] !== UPLOAD_STATE.FAIL ||
                    attachmentCompilationState[attachment.tid!] !== UPLOAD_STATE.UPLOADING
                  : true) &&
                handleMediaItemClick(attachment)
              }
              isDetailsView={isDetailsView}
            >
              {isInUploadingState || downloadingFile ? (
                <UploadProgress
                  isDetailsView={isDetailsView}
                  isRepliedMessage={isRepliedMessage}
                  withPrefix={withPrefix}
                  backgroundImage={attachmentThumb ? attachment.metadata.tmb : ''}
                  zIndex={9}
                >
                  <UploadPercent isRepliedMessage={isRepliedMessage} backgroundColor={'rgba(23, 25, 28, 0.40)'}>
                    {isInUploadingState ? (
                      <CancelResumeWrapper onClick={handlePauseResumeUpload}>
                        {attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ? (
                          <CancelIcon />
                        ) : (
                          <UploadIcon />
                        )}
                      </CancelResumeWrapper>
                    ) : (
                      <CancelResumeWrapper onClick={() => handleStopStartDownloadFile()}>
                        {downloadIsCancelled ? <DownloadIcon /> : <CancelIcon />}
                      </CancelResumeWrapper>
                    )}
                    {(attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ||
                      (downloadingFile && !downloadIsCancelled)) && (
                      <React.Fragment>
                        <ProgressWrapper>
                          <CircularProgressbar
                            minValue={0}
                            maxValue={100}
                            value={progress}
                            backgroundPadding={3}
                            background={true}
                            text=''
                            styles={{
                              background: {
                                fill: 'rgba(23, 25, 28, 0)'
                              },
                              path: {
                                stroke: colors.white,
                                strokeLinecap: 'butt',
                                strokeWidth: '4px',
                                transition: 'stroke-dashoffset 0.5s ease 0s',
                                transform: 'rotate(0turn)',
                                transformOrigin: 'center center'
                              }
                            }}
                          />
                        </ProgressWrapper>
                        {sizeProgress && !isRepliedMessage && (
                          <SizeProgress>
                            {bytesToSize(sizeProgress.loaded, 1)} / {bytesToSize(sizeProgress.total, 1)}
                          </SizeProgress>
                        )}
                      </React.Fragment>
                    )}
                  </UploadPercent>
                </UploadProgress>
              ) : /* <UploadProgress
                  isDetailsView={isDetailsView}
                  isRepliedMessage={isRepliedMessage}
                  onClick={handlePauseResumeUpload}
                  backgroundImage={attachmentThumb ? attachment.metadata.tmb : ''}
                >
                  <React.Fragment>
                    <UploadPercent isRepliedMessage={isRepliedMessage}>
                      {attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ? (
                        <CancelIcon />
                      ) : (
                        <UploadIcon />
                      )}
                    </UploadPercent>
                    {attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING && (
                      <UploadingIcon isRepliedMessage={isRepliedMessage} className='rotate_cont' />
                    )}
                  </React.Fragment>
                </UploadProgress> */
              /* : attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.FAIL ? (
                <React.Fragment>
                  <UploadProgress isFailedAttachment>
                    <ErrorIcon />
                  </UploadProgress>
                </React.Fragment>
              ) */
              null}
              <VideoPreview
                theme={theme}
                width={
                  isRepliedMessage
                    ? '40px'
                    : isDetailsView
                    ? '100%'
                    : `${renderWidth || videoAttachmentMaxWidth || 420}px`
                }
                height={
                  isRepliedMessage
                    ? '40px'
                    : isDetailsView
                    ? '100%'
                    : `${renderHeight || videoAttachmentMaxHeight || 240}px`
                }
                file={attachment}
                src={attachmentUrl}
                isCachedFile={isCached}
                uploading={
                  attachmentCompilationState[attachment.tid!] &&
                  (attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ||
                    attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.PAUSED)
                }
                borderRadius={isRepliedMessage ? '4px' : borderRadius}
                isRepliedMessage={isRepliedMessage}
                isDetailsView={isDetailsView}
                backgroundColor={
                  backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : colors.primaryLight
                }
              />
            </VideoCont>
          ) : (
            <AttachmentImgCont isPreview={isPreview} backgroundColor={colors.defaultAvatarBackground}>
              {/* <PlayIcon /> */}
              <VideoPreview
                width='48px'
                height='48px'
                file={attachment}
                src={attachment.attachmentUrl || attachmentUrl}
                borderRadius={borderRadius}
                setVideoIsReadyToSend={setVideoIsReadyToSend}
                backgroundColor={
                  backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : colors.primaryLight
                }
                isPreview
              />
              <RemoveChosenFile
                color={theme === THEME.DARK ? colors.backgroundColor : colors.textColor3}
                onClick={() => removeSelected && removeSelected(attachment.tid!)}
              />
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
          draggable={false}
          isPreview={isPreview}
          isUploading={
            attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ||
            attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.PAUSED
          }
          borderRadius={borderRadius}
          background={backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : colors.primaryLight}
          isRepliedMessage={isRepliedMessage}
          border={selectedFileAttachmentsBoxBorder || (theme === THEME.DARK ? 'none' : '')}
          width={fileAttachmentWidth}
        >
          {attachmentThumb ? (
            <FileThumbnail src={withPrefix ? `data:image/jpeg;base64,${attachmentThumb}` : attachmentThumb} />
          ) : (
            // <FileThumbnail src={base64ToToDataURL(attachment.metadata.tmb)} />
            <AttachmentIconCont backgroundColor={colors.primary} className='icon-warpper'>
              {previewFileType && previewFileType === 'video' ? (
                <VideoPreview
                  file={attachment}
                  backgroundColor={
                    backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : colors.primaryLight
                  }
                  width='40px'
                  height='40px'
                  src={attachment.attachmentUrl}
                  setVideoIsReadyToSend={setVideoIsReadyToSend}
                  isPreview
                />
              ) : isPreview && attachment.attachmentUrl ? (
                <FileThumbnail src={attachment.attachmentUrl} />
              ) : (
                attachmentCompilationState[attachment.tid!] !== UPLOAD_STATE.UPLOADING &&
                attachmentCompilationState[attachment.tid!] !== UPLOAD_STATE.PAUSED &&
                (selectedFileAttachmentsIcon || <FileIcon />)
              )}
            </AttachmentIconCont>
          )}
          {/* <AttachmentIconCont backgroundColor={colors.primary} className='icon-warpper'>
            {attachmentCompilationState[attachment.tid!] !== UPLOAD_STATE.UPLOADING &&
              attachmentCompilationState[attachment.tid!] !== UPLOAD_STATE.PAUSED &&
              (selectedFileAttachmentsIcon || <FileIcon />)}
          </AttachmentIconCont> */}
          {!isRepliedMessage && !isPreview && (
            <DownloadFile
              // visible={downloadingFile}
              // absolutePosition={downloadingFile}
              widthThumb={!!attachmentThumb}
              backgroundColor={attachmentThumb ? 'rgba(0,0,0,0.4)' : colors.primary}
              onClick={() => handleStopStartDownloadFile(attachment)}
              onMouseEnter={() => handleMouseEvent(true)}
              onMouseLeave={() => handleMouseEvent(false)}
            >
              {!downloadingFile && <DownloadIcon />}
            </DownloadFile>
          )}

          {!isRepliedMessage && !isPreview && (isInUploadingState || downloadingFile) ? (
            <UploadProgress fileAttachment>
              <UploadPercent
                fileAttachment
                borderRadius={!(attachmentThumb || (attachment.attachmentUrl && isPreview)) ? '50%' : undefined}
                backgroundColor={
                  downloadingFile
                    ? ''
                    : attachment.attachmentUrl || attachmentThumb
                    ? 'rgba(0,0,0,0.4)'
                    : colors.primary
                }
              >
                {(isInUploadingState || downloadingFile) && (
                  <CancelResumeWrapper onClick={handlePauseResumeUpload}>
                    {attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING || downloadingFile ? (
                      <CancelIcon />
                    ) : (
                      isInUploadingState && <UploadIcon />
                    )}
                  </CancelResumeWrapper>
                )}
                {(attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING || downloadingFile) && (
                  <ProgressWrapper>
                    <CircularProgressbar
                      minValue={0}
                      maxValue={100}
                      value={progress}
                      backgroundPadding={6}
                      background={true}
                      text=''
                      styles={{
                        background: {
                          fill: 'transparent'
                        },
                        path: {
                          stroke: colors.white,
                          strokeLinecap: 'butt',
                          strokeWidth: '4px',
                          transition: 'stroke-dashoffset 0.5s ease 0s',
                          transform: 'rotate(0turn)',
                          transformOrigin: 'center center'
                        }
                      }}
                    />
                  </ProgressWrapper>
                )}
              </UploadPercent>
            </UploadProgress>
          ) : /* <UploadProgress fileAttachment onClick={handlePauseResumeUpload}>
              <UploadPercent
                fileAttachment
                borderRadius={attachment.metadata && attachment.metadata.tmb ? undefined : '50%'}
              >
                {attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.UPLOADING ? (
                  <CancelIcon />
                ) : (
                  <UploadIcon />
                )}
              </UploadPercent>
              <UploadingIcon fileAttachment className='rotate_cont' />
            </UploadProgress> */
          /*: attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.FAIL ? (
            <React.Fragment>
              <UploadProgress isFailedAttachment>
                <FailedFileIcon onClick={() => removeSelected && removeSelected(attachment.tid!)} />
              </UploadProgress>
            </React.Fragment>
          ) */
          null}
          {!isRepliedMessage && (
            <AttachmentFileInfo isPreview={isPreview}>
              {/* @ts-ignore */}
              <AttachmentName color={selectedFileAttachmentsTitleColor} ref={fileNameRef}>
                {formatLargeText(
                  isPreview ? attachment.data.name : attachment.name,
                  fileAttachmentWidth ? fileAttachmentWidth / 12.5 : isPreview ? 18 : 30
                )}
              </AttachmentName>
              <AttachmentSize color={selectedFileAttachmentsSizeColor}>
                {(isInUploadingState || downloadingFile) && sizeProgress
                  ? `${bytesToSize(sizeProgress.loaded, 1)} • ${bytesToSize(sizeProgress.total, 1)}`
                  : ((attachment.data && attachment.data.size) || attachment.size) &&
                    bytesToSize(isPreview ? attachment.data.size : +attachment.size)}
                {/* <span>
                  {attachmentCompilationState[attachment.tid!] === UPLOAD_STATE.FAIL && 'Upload error'}
                </span> */}
              </AttachmentSize>
            </AttachmentFileInfo>
          )}
          {
            isPreview && (
              <RemoveChosenFile
                color={theme === THEME.DARK ? colors.backgroundColor : colors.textColor3}
                onClick={() => removeSelected && removeSelected(attachment.tid!)}
              />
            ) /*: attachmentCompilationState[attachment.tid!] !== UPLOAD_STATE.FAIL &&
            attachmentCompilationState[attachment.tid!] !== UPLOAD_STATE.UPLOADING ? (
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

export default React.memo(Attachment, (prevProps, nextProps) => {
  // Custom comparison function to check if only 'messages' prop has changed
  return (
    prevProps.attachment.url === nextProps.attachment.url &&
    prevProps.attachment.id === nextProps.attachment.id &&
    prevProps.attachment.attachmentUrl === nextProps.attachment.attachmentUrl
  )
})

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
  isPreview: boolean
  backgroundColor?: string
  backgroundImage?: string
  ref?: any
  borderRadius?: string
  imgIsLoaded?: boolean
  isRepliedMessage?: boolean
  withPrefix?: boolean
  fitTheContainer?: boolean
  width?: number
  height?: number
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  //flex-direction: column;
  margin-right: ${(props) => (props.isPreview ? '16px' : props.isRepliedMessage ? '8px' : '')};
  //max-width: 420px;
  //max-height: 400px;
  min-width: ${(props) => !props.isRepliedMessage && !props.fitTheContainer && '130px'};
  height: ${(props) => props.fitTheContainer && '100%'};

  width: ${(props) =>
    props.fitTheContainer ? '100%' : props.isRepliedMessage ? '40px' : props.width && `${props.width}px`};
  max-width: 100%;
  height: ${(props) =>
    props.fitTheContainer ? '100%' : props.isRepliedMessage ? '40px' : props.height && `${props.height}px`};
  max-height: 400px;
  min-height: ${(props) => props.height && '130px'};
  cursor: pointer;

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
    props.isPreview &&
    `
      width: 48px;
      min-width: 48px;
      height: 48px;
  `}
`

const FileThumbnail = styled.img<any>`
  min-width: 40px;
  max-width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 8px;
`

const DownloadFile = styled.span<{ backgroundColor?: string; widthThumb?: boolean }>`
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: ${(props) => props.backgroundColor || colors.primary};
  min-width: 40px;
  max-width: 40px;
  height: 40px;
  position: ${(props) => props.widthThumb && 'absolute'};
  border-radius: ${(props) => (props.widthThumb ? '8px' : '50%')};

  & > svg {
    width: 20px;
    height: 20px;
  }
`

const ProgressWrapper = styled.span`
  width: 100%;
  height: 100%;
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
export const SizeProgress = styled.span`
  position: absolute;
  bottom: -26px;
  background-color: rgba(0, 0, 0, 0.4);
  color: ${colors.white};
  font-size: 12px;
  border-radius: 12px;
  padding: 3px 6px;
  white-space: nowrap;
`
export const AttachmentFile = styled.div<{
  isPreview?: boolean
  isRepliedMessage?: boolean
  isUploading?: boolean
  borderRadius?: string
  background?: string
  border?: string
  width?: number
}>`
  display: flex;
  position: relative;
  align-items: center;
  padding: ${(props) => !props.isRepliedMessage && '8px 12px;'};
  width: ${(props) => !props.isRepliedMessage && (props.width ? `${props.width}px` : '350px')};
  //height: 70px;
  background: ${(props) => props.background};
  border: ${(props) => props.border || `1px solid  ${colors.gray1}`};
  box-sizing: border-box;
  margin-right: ${(props) => (props.isPreview ? '16px' : props.isRepliedMessage ? '8px' : '')};
  border-radius: ${(props) => props.borderRadius || '6px'};

  ${(props) =>
    !props.isRepliedMessage &&
    !props.isPreview &&
    !props.isUploading &&
    `
      &:hover ${DownloadFile} {
        display: flex;
      }

      &:hover ${UploadPercent} {
        border-radius: 50%
      }

      &:hover ${FileThumbnail} {
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
  color: ${(props) => props.color || colors.textColor3};
  z-index: 4;
`
/*
const FailedFileIcon = styled(ErrorIcon)`
  position: absolute;
  top: -6px;
  right: -24px;
  width: 20px;
  height: 20px;
  padding: 2px;
  cursor: pointer;
` */

const AttachmentName = styled.h3<{ color?: string }>`
  font-size: 15px;
  font-weight: 500;
  line-height: 18px;
  color: ${(props) => props.color || colors.textColor1};
  max-width: 275px;
  white-space: nowrap;
  margin: 0;
`
const AttachmentSize = styled.span<{ color?: string }>`
  font-size: 13px;
  color: ${(props) => props.color || colors.textColor1};
  & > span {
    color: ${colors.red1};
    margin-left: 8px;
  }
`
const AttachmentFileInfo = styled.div<{ isPreview: boolean }>`
  margin-left: 12px;
  ${(props) =>
    props.isPreview &&
    `line-height: 14px;
      max-width: calc(100% - 44px);
  `}
`

export const AttachmentImg = styled.img<{
  absolute?: boolean
  borderRadius?: string
  ref?: any
  withBorder?: boolean
  isPreview?: boolean
  hidden?: boolean
  isRepliedMessage?: boolean
  fitTheContainer?: boolean
  backgroundColor: string
  imageMinWidth?: string
  imageMaxHeight?: string
}>`
  position: ${(props) => props.absolute && 'absolute'};
  border-radius: ${(props) => (props.isRepliedMessage ? '4px' : props.borderRadius || '6px')};
  border: ${(props) =>
    props.isRepliedMessage
      ? '0.5px solid rgba(0, 0, 0, 0.1)'
      : props.withBorder && `2px solid ${props.backgroundColor}`};
  box-sizing: border-box;
  max-width: 100%;
  max-height: ${(props) => props.imageMaxHeight || '400px'};
  width: ${(props) =>
    props.isRepliedMessage ? '40px' : props.isPreview ? '48px' : props.fitTheContainer ? '100%' : ''};
  height: ${(props) =>
    props.isRepliedMessage ? '40px' : props.isPreview ? '48px' : props.fitTheContainer ? '100%' : ''};
  min-height: ${(props) =>
    !props.isRepliedMessage && !props.isPreview && !props.fitTheContainer
      ? '130px'
      : props.isRepliedMessage
      ? '40px'
      : ''};
  min-width: ${(props) =>
    !props.isRepliedMessage && !props.isPreview && !props.fitTheContainer
      ? props.imageMinWidth || '130px'
      : props.isRepliedMessage
      ? '40px'
      : ''};
  object-fit: cover;
  visibility: ${(props) => props.hidden && 'hidden'};
  z-index: 2;
`

const VideoCont = styled.div<{ isDetailsView?: boolean }>`
  position: relative;
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
