import styled from 'styled-components'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { CircularProgressbar } from 'react-circular-progressbar'
// Store
import { attachmentCompilationStateSelector, attachmentsUploadProgressSelector } from '../../store/message/selector'
import { connectionStatusSelector } from '../../store/user/selector'
import { themeSelector } from '../../store/theme/selector'
import {
  pauseAttachmentUploadingAC,
  resumeAttachmentUploadingAC,
  setUpdateMessageAttachmentAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC
} from '../../store/message/actions'
// Hooks
import { useDidUpdate, useColor } from '../../hooks'
// Assets
import { ReactComponent as CancelIcon } from '../../assets/svg/cancel.svg'
import { ReactComponent as FileIcon } from '../../assets/svg/fileIcon.svg'
import { ReactComponent as RemoveAttachment } from '../../assets/svg/deleteUpload.svg'
import { ReactComponent as UploadIcon } from '../../assets/svg/upload.svg'
import { ReactComponent as DownloadIcon } from '../../assets/svg/download.svg'
// Helpers
import {
  bytesToSize,
  calculateRenderedImageWidth,
  cancelDownloadFile,
  downloadFile,
  formatLargeText,
  setDownloadFilePromise
} from '../../helpers'
import { attachmentTypes, MESSAGE_STATUS, THEME, UPLOAD_STATE } from '../../helpers/constants'
import { THEME_COLORS } from '../../UIHelper/constants'
import { getCustomDownloader, getCustomUploader } from '../../helpers/customUploader'
import { AttachmentIconCont, UploadProgress, UploadPercent, CancelResumeWrapper } from '../../UIHelper'
import { getAttachmentUrlFromCache, setAttachmentToCache } from '../../helpers/attachmentsCache'
import { base64ToToDataURL } from '../../helpers/resizeImage'
import { getPendingAttachment, updateMessageOnAllMessages, updateMessageOnMap } from '../../helpers/messagesHalper'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { IAttachment } from '../../types'
// Components
import VideoPreview from '../VideoPreview'
import AudioPlayer from '../AudioPlayer'
import log from 'loglevel'
import { isJSON } from 'helpers/message'

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
  imageMinWidth?: string
  // eslint-disable-next-line no-unused-vars
  closeMessageActions?: (state: boolean) => void
  fileAttachmentWidth?: number
  imageAttachmentMaxWidth?: number
  imageAttachmentMaxHeight?: number
  videoAttachmentMaxWidth?: number
  videoAttachmentMaxHeight?: number
  messageType?: string | null | undefined
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
  imageMinWidth,
  closeMessageActions,
  fileAttachmentWidth,
  imageAttachmentMaxWidth,
  imageAttachmentMaxHeight,
  videoAttachmentMaxWidth,
  videoAttachmentMaxHeight,
  messageType
}: AttachmentPops) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.WARNING]: errorColor,
    [THEME_COLORS.OVERLAY_BACKGROUND_2]: overlayBackground2,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.BORDER]: borderColor,
    [THEME_COLORS.BACKGROUND]: background
  } = useColor()

  const dispatch = useDispatch()
  const attachmentCompilationState = useSelector(attachmentCompilationStateSelector) || {}
  const attachmentsUploadProgress = useSelector(attachmentsUploadProgressSelector) || {}
  const connectionStatus = useSelector(connectionStatusSelector)
  const theme = useSelector(themeSelector)
  // const attachmentUploadProgress = useSelector(attachmentUploadProgressSelector) || {}
  const imageContRef = useRef<HTMLDivElement>(null)
  const [imageLoading, setImageLoading] = useState(!attachment.attachmentUrl)
  const [downloadingFile, setDownloadingFile] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [failTimeout, setFailTimeout]: any = useState()
  const [progress, setProgress] = useState(3)
  const [sizeProgress, setSizeProgress] = useState<{ loaded: number; total: number } | undefined>({
    loaded: 0,
    total: attachment?.size || 0
  })
  const [isCached, setIsCached] = useState(true)
  // const [linkTitle, setLinkTitle] = useState('')
  // const [linkDescription, setLinkDescription] = useState('')
  // const [linkImage, setLinkImage] = useState('')
  const [downloadIsCancelled, setDownloadIsCancelled] = useState(false)
  const fileNameRef: any = useRef(null)
  const customDownloader = getCustomDownloader()
  const previewFileType = isPreview && attachment.data.type.split('/')[0]

  const [renderWidth, renderHeight] = useMemo(() => {
    let attachmentData = null
    if (attachment.metadata && typeof attachment.metadata === 'string') {
      attachmentData = isJSON(attachment.metadata) ? JSON.parse(attachment.metadata) : attachment.metadata
    } else if (attachment.metadata && attachment.metadata.szw && attachment.metadata.szh) {
      attachmentData = attachment.metadata
    }

    return attachmentData && attachmentData.szw && attachmentData.szh
      ? calculateRenderedImageWidth(
          attachmentData.szw,
          attachmentData.szh,
          attachment.type === attachmentTypes.image ? imageAttachmentMaxWidth : videoAttachmentMaxWidth,
          attachment.type === attachmentTypes.image ? imageAttachmentMaxHeight || 400 : videoAttachmentMaxHeight
        )
      : []
  }, [])

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
      log.error('error on get attachmentThumb', e)
    }
  }

  const downloadImage = (url: string) => {
    const image = new Image()
    image.src = url
    image.onload = () => {
      setAttachmentUrl(url)
      setDownloadingFile(false)
    }
    image.onerror = () => {
      log.error('Error on download image', url)
    }
  }
  const handlePauseResumeDownload = (e: Event) => {
    e.stopPropagation()
    if (downloadIsCancelled) {
      setDownloadIsCancelled(false)
      if (customDownloader) {
        customDownloader(
          attachment.url,
          false,
          (progress) => {
            const loadedRes = progress.loaded && progress.loaded / progress.total
            const uploadPercent = loadedRes && loadedRes * 100
            setSizeProgress({ loaded: progress.loaded || 0, total: progress.total || 0 })
            setProgress(uploadPercent)
          },
          messageType
        ).then((url) => {
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
    if (attachmentId === attachment.id) {
      setDownloadingFile(false)
    }
  }
  const handleStopStartDownloadFile = (att?: IAttachment) => {
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
    downloadFile(
      attachment,
      true,
      handleCompleteDownload,
      (progress) => {
        const loadedRes = progress.loaded && progress.loaded / progress.total
        const uploadPercent = loadedRes && loadedRes * 100
        setProgress(uploadPercent > 3 ? uploadPercent : 3)
        setSizeProgress({ loaded: progress.loaded || 0, total: progress.total || 0 })
      },
      messageType
    )
  }

  const handleDeleteSelectedAttachment = (attachmentTid: string) => {
    if (removeSelected) {
      removeSelected(attachmentTid)
    }
  }

  const handleDownloadFile = async () => {
    if (customDownloader) {
      if (!attachment.attachmentUrl) {
        setDownloadingFile(true)
      }
      const urlPromise = customDownloader(
        attachment.url,
        true,
        (progress) => {
          const loadedRes = progress.loaded && progress.loaded / progress.total
          const uploadPercent = loadedRes && loadedRes * 100
          setSizeProgress({ loaded: progress.loaded || 0, total: progress.total || 0 })
          setProgress(uploadPercent)
        },
        messageType
      )
      setDownloadFilePromise(attachment.id!, urlPromise)
      const result = await urlPromise
      const url = URL.createObjectURL(result.Body)
      setSizeProgress(undefined)
      const response = await fetch(url)
      setAttachmentToCache(attachment.url, response)
      setIsCached(true)
      setDownloadingFile(false)
      setAttachmentUrl(url)
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
      !attachment.attachmentUrl &&
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
              dispatch(setUpdateMessageAttachmentAC(attachment.url, attachment.messageId, { attachmentUrl: cachedUrl }))
              setIsCached(true)
            } else {
              setIsCached(false)
              setDownloadingFile(true)
              if (customDownloader) {
                customDownloader(
                  attachment.url,
                  false,
                  (progress) => {
                    const loadedRes = progress.loaded && progress.loaded / progress.total
                    const uploadPercent = loadedRes && loadedRes * 100
                    setSizeProgress({ loaded: progress.loaded || 0, total: progress.total || 0 })
                    setProgress(uploadPercent)
                  },
                  messageType
                ).then(async (url) => {
                  downloadImage(url)
                  const response = await fetch(url)
                  setAttachmentToCache(attachment.url, response)
                  setIsCached(true)
                  setDownloadingFile(false)
                })
              } else {
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
              if (attachment.type === attachmentTypes.voice) {
                setAttachmentUrl('_')
              }
              handleDownloadFile()
            }
          }
        })
        .catch((e: any) => {
          log.info('error on get attachment url from cache. .. ', e)
          if (customDownloader) {
            setDownloadingFile(true)
            customDownloader(
              attachment.url,
              true,
              (progress) => {
                const loadedRes = progress.loaded && progress.loaded / progress.total
                const uploadPercent = loadedRes && loadedRes * 100
                setSizeProgress({ loaded: progress.loaded || 0, total: progress.total || 0 })
                setProgress(uploadPercent)
              },
              messageType
            ).then(async (url) => {
              // if (attachment.type === attachmentTypes.video) {
              const response = await fetch(url)
              setAttachmentToCache(attachment.url, response)
              // }
              setAttachmentUrl(url)
              setDownloadingFile(false)
            })
          } else {
            setAttachmentUrl(attachment.url)
          }
        })
    }
  }, [])

  useDidUpdate(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED && isInUploadingState) {
      setFailTimeout(
        setTimeout(() => {
          const pendingAttachment = getPendingAttachment(attachment.tid!)
          dispatch(updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, attachment.tid))

          if (pendingAttachment && pendingAttachment.messageTid && pendingAttachment.channelId) {
            updateMessageOnMap(pendingAttachment.channelId, {
              messageId: pendingAttachment.messageTid,
              params: { state: MESSAGE_STATUS.FAILED }
            })
            updateMessageOnAllMessages(pendingAttachment.messageTid, { state: MESSAGE_STATUS.FAILED })
            dispatch(updateMessageAC(pendingAttachment.messageTid, { state: MESSAGE_STATUS.FAILED }))
          }
          // }
        }, 20000)
      )
    }
    return () => clearTimeout(failTimeout)
  }, [connectionStatus])
  useEffect(() => {
    const attachmentIndex = attachment.tid || attachment.id
    if (attachmentIndex && attachmentsUploadProgress[attachmentIndex]) {
      if (failTimeout) {
        clearTimeout(failTimeout)
        setFailTimeout()
      }
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

  return (
    <React.Fragment>
      {attachment.type === 'image' ? (
        <AttachmentImgCont
          draggable={false}
          onClick={() =>
            handleMediaItemClick && !isInUploadingState && !downloadingFile && handleMediaItemClick(attachment)
          }
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
          <AttachmentImg
            draggable={false}
            src={attachment.attachmentUrl || attachmentUrl}
            borderRadius={borderRadius}
            imageMinWidth={imageMinWidth}
            isPreview={isPreview}
            isRepliedMessage={isRepliedMessage}
            withBorder={!isPreview && !isDetailsView}
            fitTheContainer={isDetailsView}
            imageMaxHeight={
              `${renderHeight || 400}px`
              // attachment.metadata && (attachment.metadata.szh > 400 ? '400px' : `${attachment.metadata.szh}px`)
            }
            onLoad={() => setImageLoading(false)}
          />
          {!isPreview && (isInUploadingState || imageLoading) ? (
            <UploadProgress
              backgroundImage={attachmentThumb}
              isRepliedMessage={isRepliedMessage}
              width={renderWidth}
              height={renderHeight}
              withBorder={!isPreview && !isDetailsView}
              backgroundColor={backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : overlayBackground2}
              isDetailsView={isDetailsView}
              imageMinWidth={imageMinWidth}
              withPrefix={withPrefix}
              borderColor={borderColor}
            >
              {!isPreview &&
                (isInUploadingState || downloadingFile) &&
                sizeProgress &&
                sizeProgress.loaded < sizeProgress.total && (
                  <UploadPercent
                    isRepliedMessage={isRepliedMessage}
                    isDetailsView={isDetailsView}
                    backgroundColor={overlayBackground2}
                  >
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
                              background: {
                                fill: `${overlayBackground2}66`
                              },
                              path: {
                                // Path color
                                stroke: textOnPrimary,
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
                          <SizeProgress color={textOnPrimary}>
                            {bytesToSize(sizeProgress.loaded, 1)} / {bytesToSize(sizeProgress.total, 1)}
                          </SizeProgress>
                        )}
                      </React.Fragment>
                    )}
                  </UploadPercent>
                )}
            </UploadProgress>
          ) : null}
          {isPreview && (
            <RemoveChosenFile
              backgroundColor={background}
              color={iconInactive}
              onClick={() => handleDeleteSelectedAttachment(attachment.tid!)}
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
                  backgroundImage={attachmentThumb || ''}
                  zIndex={9}
                  borderColor={borderColor}
                >
                  <UploadPercent
                    isRepliedMessage={isRepliedMessage}
                    isDetailsView={isDetailsView}
                    backgroundColor={overlayBackground2}
                  >
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
                                fill: `${overlayBackground2}66`
                              },
                              path: {
                                stroke: textOnPrimary,
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
                          <SizeProgress color={textOnPrimary}>
                            {bytesToSize(sizeProgress.loaded, 1)} / {bytesToSize(sizeProgress.total, 1)}
                          </SizeProgress>
                        )}
                      </React.Fragment>
                    )}
                  </UploadPercent>
                </UploadProgress>
              ) : null}
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
                  backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : overlayBackground2
                }
              />
            </VideoCont>
          ) : (
            <AttachmentImgCont isPreview={isPreview} backgroundColor={overlayBackground2}>
              {/* <PlayIcon /> */}
              <VideoPreview
                width='48px'
                height='48px'
                file={attachment}
                src={attachment.attachmentUrl || attachmentUrl}
                borderRadius={borderRadius}
                setVideoIsReadyToSend={setVideoIsReadyToSend}
                backgroundColor={
                  backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : overlayBackground2
                }
                isPreview
              />
              <RemoveChosenFile
                backgroundColor={background}
                color={iconPrimary}
                onClick={() => handleDeleteSelectedAttachment(attachment.tid!)}
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
          borderRadius={isRepliedMessage ? '50%' : borderRadius}
          background={backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : overlayBackground2}
          isRepliedMessage={isRepliedMessage}
          border={selectedFileAttachmentsBoxBorder || (theme === THEME.DARK ? 'none' : '')}
          width={fileAttachmentWidth}
          borderColor={borderColor}
        >
          {attachmentThumb ? (
            <FileThumbnail src={withPrefix ? `data:image/jpeg;base64,${attachmentThumb}` : attachmentThumb} />
          ) : (
            // <FileThumbnail src={base64ToToDataURL(attachment.metadata.tmb)} />
            <AttachmentIconCont backgroundColor={accentColor} className='icon-warpper'>
              {previewFileType && previewFileType === 'video' ? (
                <VideoPreview
                  file={attachment}
                  backgroundColor={
                    backgroundColor && backgroundColor !== 'inherit' ? backgroundColor : overlayBackground2
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
              backgroundColor={attachmentThumb ? overlayBackground2 : accentColor}
              onClick={() => handleStopStartDownloadFile(attachment)}
              onMouseEnter={() => handleMouseEvent(true)}
              onMouseLeave={() => handleMouseEvent(false)}
            >
              {!downloadingFile && <DownloadIcon />}
            </DownloadFile>
          )}

          {!isRepliedMessage && !isPreview && (isInUploadingState || downloadingFile) ? (
            <UploadProgress fileAttachment isDetailsView={isDetailsView} borderColor={borderColor}>
              <UploadPercent
                fileAttachment
                borderRadius={!(attachmentThumb || (attachment.attachmentUrl && isPreview)) ? '50%' : undefined}
                isDetailsView={isDetailsView}
                backgroundColor={overlayBackground2}
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
                          fill: `${overlayBackground2}66`
                        },
                        path: {
                          stroke: textOnPrimary,
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
          ) : null}
          {!isRepliedMessage && (
            <AttachmentFileInfo isPreview={isPreview}>
              {/* @ts-ignore */}
              <AttachmentName color={selectedFileAttachmentsTitleColor || textPrimary} ref={fileNameRef}>
                {formatLargeText(
                  isPreview ? attachment.data.name : attachment.name,
                  fileAttachmentWidth ? fileAttachmentWidth / 12.5 : isPreview ? 18 : 30
                )}
              </AttachmentName>
              <AttachmentSize color={selectedFileAttachmentsSizeColor || textSecondary} errorColor={errorColor}>
                {(isInUploadingState || downloadingFile) && sizeProgress
                  ? `${bytesToSize(sizeProgress.loaded, 1)} • ${bytesToSize(sizeProgress.total, 1)}`
                  : ((attachment.data && attachment.data.size) || attachment.size) &&
                    bytesToSize(isPreview ? attachment.data.size : +attachment.size)}
              </AttachmentSize>
            </AttachmentFileInfo>
          )}
          {isPreview && (
            <RemoveChosenFile
              backgroundColor={background}
              color={iconPrimary}
              onClick={() => handleDeleteSelectedAttachment(attachment.tid!)}
            />
          )}
        </AttachmentFile>
      )}
    </React.Fragment>
  )
}

export default React.memo(Attachment, (prevProps, nextProps) => {
  // Custom comparison function to check if only 'messages' prop has changed
  return (
    prevProps.attachment.url === nextProps.attachment.url &&
    prevProps.handleMediaItemClick === nextProps.handleMediaItemClick &&
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
  margin-right: ${(props) => (props.isPreview ? '16px' : props.isRepliedMessage ? '8px' : '')};
  min-width: ${(props) => !props.isRepliedMessage && !props.fitTheContainer && '165px'};
  height: ${(props) => props.fitTheContainer && '100%'};
  width: ${(props) =>
    props.fitTheContainer ? '100%' : props.isRepliedMessage ? '40px' : props.width && `${props.width}px`};
  max-width: 100%;
  height: ${(props) =>
    props.fitTheContainer ? '100%' : props.isRepliedMessage ? '40px' : props.height && `${props.height}px`};
  max-height: 400px;
  min-height: ${(props) => props.height && '165px'};
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

const DownloadFile = styled.span<{ backgroundColor: string; widthThumb?: boolean }>`
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: ${(props) => props.backgroundColor};
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
export const SizeProgress = styled.span<{ color: string }>`
  position: absolute;
  bottom: -26px;
  background-color: rgba(0, 0, 0, 0.4);
  color: ${(props) => props.color};
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
  borderColor: string
}>`
  display: flex;
  position: relative;
  align-items: center;
  padding: ${(props) => !props.isRepliedMessage && '8px 12px;'};
  //width: ${(props) => !props.isRepliedMessage && (props.width ? `${props.width}px` : '350px')};
  min-width: ${(props) => !props.isRepliedMessage && (props.width || (props.isUploading ? '260px' : '205px'))};
  transition: all 0.1s;
  //height: 70px;
  background: ${(props) => props.background};
  border: ${(props) => props.border || `1px solid  ${props.borderColor}`};
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

const RemoveChosenFile = styled(RemoveAttachment)<{ backgroundColor: string; color: string }>`
  position: absolute;
  width: 20px;
  height: 20px !important;
  top: -11px;
  right: -11px;
  padding: 2px;
  cursor: pointer;
  color: ${(props) => props.color};
  z-index: 4;
  circle {
    stroke: ${(props) => props.backgroundColor};
  }
  path {
    stroke: ${(props) => props.backgroundColor};
  }
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

const AttachmentName = styled.h3<{ color: string }>`
  font-size: 15px;
  font-weight: 500;
  line-height: 18px;
  color: ${(props) => props.color};
  max-width: 275px;
  white-space: nowrap;
  margin: 0;
`
const AttachmentSize = styled.span<{ color: string; errorColor: string }>`
  font-size: 13px;
  color: ${(props) => props.color};
  & > span {
    color: ${(props) => props.errorColor};
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
  imageMinWidth?: string
  imageMaxHeight?: string
}>`
  position: ${(props) => props.absolute && 'absolute'};
  border-radius: ${(props) => (props.isRepliedMessage ? '4px' : props.borderRadius || '6px')};
  padding: ${(props) => (props.isRepliedMessage ? '0.5px' : props.withBorder && `2px`)};
  box-sizing: border-box;
  max-width: 100%;
  max-height: ${(props) => props.imageMaxHeight || '400px'};
  width: ${(props) =>
    props.isRepliedMessage ? '40px' : props.isPreview ? '48px' : props.fitTheContainer ? '100%' : ''};
  height: ${(props) =>
    props.isRepliedMessage ? '40px' : props.isPreview ? '48px' : props.fitTheContainer ? '100%' : ''};
  min-height: ${(props) =>
    !props.isRepliedMessage && !props.isPreview && !props.fitTheContainer
      ? '165px'
      : props.isRepliedMessage
        ? '40px'
        : ''};
  min-width: ${(props) =>
    !props.isRepliedMessage && !props.isPreview && !props.fitTheContainer
      ? props.imageMinWidth || '165px'
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
