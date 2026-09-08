import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
import styled from 'styled-components'
import moment from 'moment'
import Carousel, { RenderArrowProps } from '../../Carousel'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { ReactComponent as DownloadIcon } from '../../../assets/svg/download.svg'
import { ReactComponent as CloseIcon } from '../../../assets/svg/cancel.svg'
import { ReactComponent as RightArrow } from '../../../assets/svg/sliderButtonRight.svg'
import { ReactComponent as LeftArrow } from '../../../assets/svg/sliderButtonLeft.svg'
import { ReactComponent as ForwardIcon } from '../../../assets/svg/forward.svg'
import { ReactComponent as DeleteIcon } from '../../../assets/svg/deleteChannel.svg'
import { bytesToSize, downloadFile } from '../../../helpers'
import { isJSON, makeUsername } from '../../../helpers/message'
import { base64ToDataURL } from '../../../helpers/resizeImage'
import { IAttachment, IChannel, IMedia, IMessage } from '../../../types'
import { getCustomDownloader } from '../../../helpers/customUploader'
import {
  attachmentForPopupLoadingStateSelector,
  attachmentsForPopupSelector,
  attachmentUpdatedMapSelector,
  attachmentsForPopupHasPrevSelector,
  attachmentsForPopupHasNextSelector
} from '../../../store/message/selector'
import {
  deleteMessageAC,
  forwardMessageAC,
  getAttachmentsAC,
  loadMoreAttachmentsAC,
  removeAttachmentAC,
  setUpdateMessageAttachmentAC,
  setAttachmentsForPopupAC
} from '../../../store/message/actions'
import {
  DEFAULT_CHANNEL_TYPE,
  channelDetailsTabs,
  MESSAGE_DELIVERY_STATUS,
  LOADING_STATE
} from '../../../helpers/constants'
import { queryDirection } from '../../../store/message/constants'
import { useColor } from '../../../hooks'
import { Avatar } from '../../../components'
import { connectionStatusSelector, contactsMapSelector } from '../../../store/user/selector'
import { UploadingIcon } from '../../../UIHelper'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { getClient } from '../../client'
import {
  getAttachmentUrlFromCache,
  getAttachmentURLWithVersion,
  setAttachmentToCache
} from '../../../helpers/attachmentsCache'
import { releaseAllOriginalBlobUrls } from '../../../helpers/attachmentBlobUrls'
import VideoPlayer from '../../../components/VideoPlayer'
import { CircularProgressbar } from 'react-circular-progressbar'
import ForwardMessagePopup, { IForwardMessageNote } from '../forwardMessage'
import { getMessagesFromMap } from '../../../helpers/messagesHalper'
import { getChannelFromMap } from '../../../helpers/channelHalper'
import ConfirmPopup from '../delete'
import { IAttachmentProperties } from '../../../components/Message/Message.types'
import log from 'loglevel'

interface IProps {
  channel: IChannel
  setIsSliderOpen: (state: boolean) => void
  mediaFiles?: IMedia[]
  currentMediaFile: IMedia
  allowEditDeleteIncomingMessage?: boolean
  attachmentsPreview?: IAttachmentProperties
  messageType?: string | null | undefined
}

const getMediaThumbnailSource = (file: IMedia): string | undefined => {
  const metadata = isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata
  const thumbnail = metadata?.tmb
  if (!thumbnail || typeof thumbnail !== 'string') return undefined

  try {
    return thumbnail.length < 70 ? base64ToDataURL(thumbnail) : `data:image/jpeg;base64,${thumbnail}`
  } catch {
    return undefined
  }
}

const SliderPopup: React.FC<IProps> = ({
  channel,
  setIsSliderOpen,
  currentMediaFile,
  allowEditDeleteIncomingMessage,
  attachmentsPreview,
  messageType
}) => {
  const { [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary, [THEME_COLORS.OVERLAY_BACKGROUND_2]: overlayBackground2 } =
    useColor()

  const dispatch = useDispatch()

  const getFromContacts = getShowOnlyContactUsers()
  const connectionStatus = useSelector(connectionStatusSelector)
  const ChatClient = getClient()
  const { user } = ChatClient
  const [currentFile, setCurrentFile] = useState<IMedia>({ ...currentMediaFile })
  const [downloadingFilesMap, setDownloadingFilesMap] = useState<{ [key: string]: { uploadPercent: number } }>({})
  const [playedVideo, setPlayedVideo] = useState<string | undefined>()
  const [nextButtonDisabled, setNextButtonDisabled] = useState(true)
  const [prevButtonDisabled, setPrevButtonDisabled] = useState(true)
  const [forwardPopupOpen, setForwardPopupOpen] = useState(false)
  const [readyToPlay, setReadyToPlay] = useState(true)
  const [messageToDelete, setMessageToDelete] = useState<IMessage | undefined>()
  const attachmentLoadingStateForPopup = useSelector(attachmentForPopupLoadingStateSelector)
  const attachmentsForPopupHasPrev = useSelector(attachmentsForPopupHasPrevSelector)
  const attachmentsForPopupHasNext = useSelector(attachmentsForPopupHasNextSelector)
  const attachmentUpdatedMap = useSelector(attachmentUpdatedMapSelector) || {}

  const [itemsLoadedMap, setItemsLoadedMap] = useState<{ [key: string]: boolean }>(() => {
    if (currentMediaFile.id && currentMediaFile.type === 'image') {
      const imageKey = getAttachmentURLWithVersion(currentMediaFile.url + '_original_image_url')
      if (attachmentUpdatedMap[imageKey]) {
        return { [currentMediaFile.id]: true }
      }
    }
    return {}
  })

  const prefixUrl = useMemo(() => {
    return currentFile?.type === 'image'
      ? '_original_image_url'
      : currentFile?.type === 'video'
        ? '_original_video_url'
        : ''
  }, [currentFile?.type])

  const customDownloader = getCustomDownloader()
  const contactsMap = useSelector(contactsMapSelector)
  const attachmentsList = useSelector(attachmentsForPopupSelector, shallowEqual) || []
  const attachmentUserName = currentFile
    ? currentFile.user &&
      makeUsername(
        contactsMap[currentFile.user.id],
        currentFile.user,
        getFromContacts && user.id !== currentFile.user.id
      )
    : ''
  const handleClosePopup = () => {
    setIsSliderOpen(false)
  }

  useEffect(() => {
    return () => {
      // The slider is the only consumer of full-size originals — drop them on
      // close so the biggest blobs don't stay pinned; they re-mint from the
      // attachments cache on next open.
      releaseAllOriginalBlobUrls()
    }
  }, [])

  const downloadImage = (src: string, setToDownloadedFiles?: boolean, type?: string) => {
    if (setToDownloadedFiles && currentFile) {
      const url = currentFile.url + (type === 'image' ? '_original_image_url' : '_original_video_url')
      dispatch(setUpdateMessageAttachmentAC(url, src))
    }
  }

  const handleCompleteDownload = (attachmentId: string, failed?: boolean) => {
    if (failed) {
      log.info('file download failed!')
    }
    const stateCopy = { ...downloadingFilesMap }
    delete stateCopy[attachmentId]
    setDownloadingFilesMap(stateCopy)
  }
  const handleDownloadFile = (attachment: IAttachment, messageType: string | null | undefined) => {
    if (attachment.id) {
      setDownloadingFilesMap((prevState) => ({ ...prevState, [attachment.id!]: { uploadPercent: 1 } }))
    }
    downloadFile(
      attachment,
      true,
      handleCompleteDownload,
      (progress) => {
        const loadedRes = progress.loaded && progress.loaded / progress.total
        const uploadPercent = loadedRes && loadedRes * 100
        setDownloadingFilesMap((prevState) => ({ ...prevState, [attachment.id!]: { uploadPercent } }))
      },
      messageType
    )
  }

  const handleClicks = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!target.closest('.custom_carousel_item') && !target.closest('.custom_carousel_arrow')) {
      handleClosePopup()
    }
  }, [])

  const handleForwardMessage = useCallback(
    async (channelIds: string[], accompanyingMessage?: IForwardMessageNote) => {
      try {
        let message = Object.values(getMessagesFromMap(channel.id) || {}).find(
          (message) => message.id === currentFile.messageId
        )
        if (!message) {
          let channelInstance = getChannelFromMap(channel.id)
          if (!channelInstance) {
            channelInstance = await ChatClient.getChannelById(channel.id)
          }
          const messages = await channelInstance.getMessagesById([currentFile.messageId])
          if (!messages || messages.length === 0) {
            log.error('Message not found for forwarding')
            return
          }
          message = messages[0]
        }
        if (channelIds && channelIds.length && message) {
          channelIds.forEach((channelId) => {
            dispatch(forwardMessageAC(message, channelId, connectionStatus, true, accompanyingMessage))
          })
        }
        setIsSliderOpen(false)
      } catch (error) {
        log.error('Error forwarding message:', error)
      }
    },
    [currentFile.messageId, channel.id, connectionStatus, dispatch]
  )

  const handleToggleForwardMessagePopup = () => {
    setForwardPopupOpen(!forwardPopupOpen)
  }

  const forwardPreviewMessage = currentFile
    ? Object.values(getMessagesFromMap(channel.id) || {}).find((message) => message.id === currentFile.messageId)
    : undefined

  const handleToggleDeleteMessagePopup = useCallback(async () => {
    if (!messageToDelete) {
      try {
        let message = Object.values(getMessagesFromMap(channel.id) || {}).find(
          (message) => message.id === currentFile.messageId
        )
        if (!message) {
          let channelInstance = getChannelFromMap(channel.id)
          if (!channelInstance) {
            channelInstance = await ChatClient.getChannelById(channel.id)
          }
          const messages = await channelInstance.getMessagesById([currentFile.messageId])
          if (!messages || messages.length === 0) {
            log.error('Message not found for deletion')
            return
          }
          message = messages[0]
        }
        if (!message.deliveryStatus || message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
          dispatch(deleteMessageAC(channel.id, message.id || message.tid!, 'forEveryone'))
          if (currentFile.id) {
            dispatch(removeAttachmentAC(currentFile.id))
          }
          setIsSliderOpen(false)
        } else {
          setMessageToDelete(message)
        }
      } catch (error) {
        log.error('Error fetching message for deletion:', error)
      }
    } else {
      setMessageToDelete(undefined)
    }
  }, [messageToDelete, currentFile.id, currentFile.messageId, channel.id, dispatch, setIsSliderOpen])

  const handleDeleteMessage = (deleteOption: 'forMe' | 'forEveryone') => {
    dispatch(deleteMessageAC(channel.id, currentFile.messageId, deleteOption))
    if (currentFile.id) {
      dispatch(removeAttachmentAC(currentFile.id))
    }

    setMessageToDelete(undefined)
    setIsSliderOpen(false)
  }

  useEffect(() => {
    if (playedVideo) {
      const videoElem = document.getElementById(playedVideo) as HTMLVideoElement | null
      if (videoElem) {
        videoElem.pause()
      }
    }
    if (currentFile && currentFile.id) {
      const attachmentKey = currentFile.url + prefixUrl
      const attachmentKeyWithVersion = getAttachmentURLWithVersion(attachmentKey)
      const hasAttachment = !!attachmentUpdatedMap[attachmentKeyWithVersion]

      // If attachment is already loaded, check if it's ready
      if (!hasAttachment) {
        getAttachmentUrlFromCache(attachmentKey)
          .then((cachedUrl: string | false) => {
            if (cachedUrl) {
              if (currentFile.type === 'image') {
                downloadImage(cachedUrl as string, true, 'image')
              } else {
                dispatch(setUpdateMessageAttachmentAC(attachmentKey, cachedUrl))
                setPlayedVideo(currentFile.id)
              }
            } else {
              if (customDownloader) {
                customDownloader(currentFile.url, false, () => {}, messageType)
                  .then(async (url) => {
                    try {
                      const response = await fetch(url)
                      setAttachmentToCache(attachmentKey, response)
                      if (currentFile.type === 'image') {
                        downloadImage(url, true, 'image')
                      } else {
                        dispatch(setUpdateMessageAttachmentAC(attachmentKey, url))
                        setPlayedVideo(currentFile.id)
                      }
                    } catch (error) {
                      log.error('Error fetching attachment:', error)
                    }
                  })
                  .catch((e) => {
                    log.error('Failed to download attachment:', e)
                  })
              } else {
                if (currentFile.type === 'image') {
                  downloadImage(currentFile.url as string, true, 'image')
                } else {
                  dispatch(setUpdateMessageAttachmentAC(attachmentKey, currentFile.url))
                  setPlayedVideo(currentFile.id)
                }
              }
            }
          })
          .catch((e) => {
            log.error('Error getting attachment from cache:', e)
          })
      }
    }
  }, [
    currentFile,
    playedVideo,
    attachmentUpdatedMap,
    customDownloader,
    messageType,
    downloadImage,
    dispatch,
    prefixUrl
  ])

  useEffect(() => {
    if (currentFile && currentFile.id) {
      const currentMedia = attachmentsList.find((att: IMedia) => att.id === currentFile.id)
      if (currentMedia) {
        const indexOnList = attachmentsList.findIndex((item: IMedia) => item.id === currentFile.id)
        setNextButtonDisabled(!attachmentsList[indexOnList + 1])
        setPrevButtonDisabled(!attachmentsList[indexOnList - 1])
      }
    }
  }, [attachmentsList])

  useEffect(() => {
    // Always replace the shared popup list before querying near the selected
    // attachment. Keeping a previous channel's list here creates a carousel
    // index mismatch and causes the visible item to blink or never load.
    dispatch(setAttachmentsForPopupAC([currentMediaFile]))
    dispatch(getAttachmentsAC(channel.id, channelDetailsTabs.media, 34, queryDirection.NEAR, currentMediaFile.id, true))
  }, [channel.id, currentMediaFile, dispatch])

  const activeFileIndex = useMemo(() => {
    if (!currentFile?.id) return -1
    const index = attachmentsList.findIndex((item: IMedia) => item.id === currentFile.id)
    // eslint-disable-next-line no-console
    console.log(
      '[MEDIA_OPEN] 5.activeIndex ' +
        JSON.stringify({ index, attId: currentFile.id, name: currentFile.name, listLen: attachmentsList.length })
    )
    return index
  }, [attachmentsList, currentFile])

  // Replace the selected item with the latest query result without changing
  // its identity. Carousel tracks the matching id via activeFileIndex.
  useEffect(() => {
    const latestCurrentFile = attachmentsList.find((file: IMedia) => file.id === currentFile.id)
    if (latestCurrentFile && latestCurrentFile !== currentFile) {
      setCurrentFile(latestCurrentFile)
    }
  }, [attachmentsList, currentFile])

  const handleCarouselItemMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      e.stopPropagation()
    }
  }, [])

  const loadNextMoreAttachments = useCallback(() => {
    if (
      activeFileIndex > attachmentsList.length - 5 &&
      attachmentLoadingStateForPopup === LOADING_STATE.LOADED &&
      attachmentsForPopupHasNext
    ) {
      dispatch(loadMoreAttachmentsAC(34, queryDirection.NEXT, attachmentsList[attachmentsList.length - 1].id, true))
    }
  }, [activeFileIndex, attachmentLoadingStateForPopup, attachmentsForPopupHasNext, attachmentsList, dispatch])

  const loadPrevMoreAttachments = useCallback(() => {
    if (activeFileIndex < 5 && attachmentLoadingStateForPopup === LOADING_STATE.LOADED && attachmentsForPopupHasPrev) {
      dispatch(loadMoreAttachmentsAC(34, queryDirection.PREV, attachmentsList[0].id, true))
    }
  }, [activeFileIndex, attachmentLoadingStateForPopup, attachmentsForPopupHasPrev, attachmentsList, dispatch])

  // Check if carousel is loading (attachments list is being fetched)
  const isCarouselLoading = !attachmentsList.length || activeFileIndex < 0

  // Helper function to check if a specific item is loading
  const isItemLoading = useCallback(
    (fileId: string | undefined) => {
      if (!fileId) return false
      return !itemsLoadedMap[fileId]
    },
    [itemsLoadedMap]
  )

  return createPortal(
    <Container draggable={false}>
      <SliderHeader>
        <FileInfo>
          <Avatar
            name={attachmentUserName}
            setDefaultAvatar
            size={36}
            image={currentFile && currentFile.user && currentFile.user.avatarUrl}
          />
          <Info>
            <UserName color={textOnPrimary}>{attachmentUserName}</UserName>
            <FileDateAndSize color={textOnPrimary}>
              {moment(currentFile && currentFile.createdAt).format('DD.MM.YYYY HH:mm')}{' '}
              <FileSize color={textOnPrimary}>
                {currentFile && currentFile.size && currentFile.size > 0 ? bytesToSize(currentFile.size, 1) : ''}
              </FileSize>
            </FileDateAndSize>
          </Info>
        </FileInfo>
        <ActionsWrapper>
          <IconWrapper onClick={() => handleDownloadFile(currentFile, messageType)} color={textOnPrimary}>
            {currentFile && currentFile.id && downloadingFilesMap[currentFile.id] ? (
              <ProgressWrapper>
                <CircularProgressbar
                  minValue={0}
                  maxValue={100}
                  value={downloadingFilesMap[currentFile.id!].uploadPercent || 0}
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
                      strokeWidth: '6px',
                      transition: 'stroke-dashoffset 0.5s ease 0s',
                      transform: 'rotate(0turn)',
                      transformOrigin: 'center center'
                    }
                  }}
                />
              </ProgressWrapper>
            ) : (
              <DownloadIcon color={textOnPrimary} />
            )}
          </IconWrapper>
          {attachmentsPreview?.canForward && (
            <IconWrapper hideInMobile margin='0 32px' onClick={handleToggleForwardMessagePopup} color={textOnPrimary}>
              <ForwardIcon color={textOnPrimary} />
            </IconWrapper>
          )}
          {attachmentsPreview?.canDelete && (
            <IconWrapper hideInMobile onClick={handleToggleDeleteMessagePopup} color={textOnPrimary}>
              <DeleteIcon color={textOnPrimary} />
            </IconWrapper>
          )}
        </ActionsWrapper>
        <ClosePopupWrapper color={textOnPrimary}>
          <IconWrapper onClick={handleClosePopup} color={textOnPrimary}>
            <CloseIcon color={textOnPrimary} />
          </IconWrapper>
        </ClosePopupWrapper>
      </SliderHeader>
      <SliderBody
        onClick={handleClicks}
        onMouseDown={(e: React.MouseEvent) => {
          if (e.button === 2) {
            e.stopPropagation()
            e.preventDefault()
            return false
          }
          return true
        }}
      >
        {isCarouselLoading && (
          <UploadCont className='upload_cont'>
            <UploadingIcon color={textOnPrimary} />
          </UploadCont>
        )}
        {activeFileIndex >= 0 && attachmentsList && attachmentsList.length && (
          <Carousel
            pagination={false}
            className='custom_carousel'
            initialActiveIndex={activeFileIndex >= 0 ? activeFileIndex : 0}
            onNextStart={() => {
              setReadyToPlay(false)
              loadNextMoreAttachments()
            }}
            onPrevStart={() => {
              setReadyToPlay(false)
              loadPrevMoreAttachments()
            }}
            onChange={(pageIndex: number) => {
              const timeout = setTimeout(() => {
                setReadyToPlay(true)
                clearTimeout(timeout)
              }, 400)
              if (pageIndex >= 0 && pageIndex < attachmentsList.length) {
                // eslint-disable-next-line no-console
                console.log(
                  '[MEDIA_OPEN] 7.carousel-change ' +
                    JSON.stringify({
                      pageIndex,
                      attId: attachmentsList[pageIndex]?.id,
                      name: attachmentsList[pageIndex]?.name
                    })
                )
                setCurrentFile(attachmentsList[pageIndex])
                setNextButtonDisabled(!attachmentsList[pageIndex + 1])
                setPrevButtonDisabled(!attachmentsList[pageIndex - 1])
              }
            }}
            renderArrow={({ type, onClick, isEdge }: RenderArrowProps) => {
              const pointer = type === 'PREV' ? <LeftArrow /> : <RightArrow />
              const disabled =
                type === 'PREV'
                  ? prevButtonDisabled && !attachmentsForPopupHasPrev
                  : nextButtonDisabled && !attachmentsForPopupHasNext
              const isEdgeButton = isEdge || (type === 'PREV' ? prevButtonDisabled : nextButtonDisabled)
              return (
                <ArrowButton
                  className='custom_carousel_arrow'
                  leftButton={type === 'PREV'}
                  type='button'
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault()
                    onClick()
                  }}
                  disabled={isEdgeButton}
                  hide={disabled}
                  color={textOnPrimary}
                >
                  {pointer}
                </ArrowButton>
              )
            }}
            isRTL={false}
          >
            {attachmentsList.map((file: IMedia) => (
              <CarouselItem
                className='custom_carousel_item'
                key={file.id}
                draggable={false}
                onMouseDown={handleCarouselItemMouseDown}
                onContextMenu={(e: React.MouseEvent) => {
                  e.stopPropagation()
                }}
              >
                {isItemLoading(file.id) && file.type === 'image' && (
                  <ItemLoadingCont>
                    <UploadingIcon color={textOnPrimary} />
                  </ItemLoadingCont>
                )}
                {file.type === 'image' ? (
                  <React.Fragment>
                    {(attachmentUpdatedMap[getAttachmentURLWithVersion(file.url + '_original_image_url')] ||
                      getMediaThumbnailSource(file)) && (
                      <img
                        loading='eager'
                        decoding='async'
                        draggable={false}
                        src={
                          attachmentUpdatedMap[getAttachmentURLWithVersion(file.url + '_original_image_url')] ||
                          getMediaThumbnailSource(file)
                        }
                        alt={file.name || 'Attachment'}
                        onMouseDown={(e) => {
                          if (e.button === 2) {
                            e.stopPropagation()
                          }
                        }}
                        style={{ position: 'relative', zIndex: 2, opacity: 1 }}
                        onLoad={() => {
                          const fileId = file.id
                          if (fileId) {
                            setItemsLoadedMap((prev) => ({ ...prev, [fileId]: true }))
                          }
                        }}
                        onError={() => {
                          const fileId = file.id
                          if (fileId) {
                            setItemsLoadedMap((prev) => ({ ...prev, [fileId]: false }))
                          }
                        }}
                      />
                    )}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    {attachmentUpdatedMap[getAttachmentURLWithVersion(file.url + '_original_video_url')] && (
                      <VideoPlayer
                        readyToPlay={readyToPlay}
                        activeFileId={currentFile?.id || ''}
                        videoFileId={file.id || ''}
                        src={attachmentUpdatedMap[getAttachmentURLWithVersion(file.url + '_original_video_url')]}
                        onMouseDown={(e: React.MouseEvent) => {
                          if (e.button === 2) {
                            e.stopPropagation()
                          }
                        }}
                      />
                    )}
                  </React.Fragment>
                )}
              </CarouselItem>
            ))}
          </Carousel>
        )}
      </SliderBody>
      {forwardPopupOpen && (
        <ForwardMessagePopup
          handleForward={handleForwardMessage}
          togglePopup={handleToggleForwardMessagePopup}
          title='Forward message'
          forwardMessages={forwardPreviewMessage ? [forwardPreviewMessage] : []}
        />
      )}
      {messageToDelete && (
        <ConfirmPopup
          handleFunction={handleDeleteMessage}
          togglePopup={handleToggleDeleteMessagePopup}
          buttonText='Delete'
          description='Who do you want to remove this message for?'
          isDeleteMessage
          isIncomingMessage={messageToDelete.incoming}
          myRole={channel.userRole}
          allowDeleteIncoming={allowEditDeleteIncomingMessage}
          isDirectChannel={channel.type === DEFAULT_CHANNEL_TYPE.DIRECT}
          title='Delete message'
        />
      )}
    </Container>,
    document.body
  ) as unknown as React.ReactElement
}

export default SliderPopup

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100vh;
  z-index: 199;
`
const ProgressWrapper = styled.span`
  display: inline-block;
  width: 35px;
  height: 35px;
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
const SliderHeader = styled.div`
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  background-color: rgba(0, 0, 0, 0.8);
`
const SliderBody = styled.div`
  width: 100%;
  height: calc(100% - 60px);
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;

  & .custom_carousel {
    height: 100%;

    & .rec.rec-carousel,
    & .rec.rec-slider {
      height: 100% !important;
    }
  }

  & .rec-carousel-item {
    display: flex;
    align-items: center;
  }
`
const FileInfo = styled.div`
  display: flex;
  align-items: center;
  width: 40%;
  font-style: normal;
  font-weight: normal;
  font-size: 14px;
  line-height: 14px;
  min-width: 230px;
`
const Info = styled.div`
  margin-left: 12px;
`
const ClosePopupWrapper = styled.div<{ color: string }>`
  width: 40%;
  display: flex;
  justify-content: flex-end;
  color: ${(props) => props.color};
`

const FileDateAndSize = styled.span<{ color: string }>`
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.078px;
  color: ${(props) => props.color};
`

const FileSize = styled.span<{ color: string }>`
  position: relative;
  margin-left: 12px;

  &:after {
    content: '';
    position: absolute;
    left: -10px;
    top: 6px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: ${(props) => props.color};
  }
`

const UserName = styled.h4<{ color: string }>`
  margin: 0;
  color: ${(props) => props.color};
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
`
const ActionsWrapper = styled.div`
  display: flex;
`
const IconWrapper = styled.span<{ margin?: string; hideInMobile?: boolean; color: string }>`
  display: flex;
  cursor: pointer;
  color: ${(props) => props.color};
  margin: ${(props) => props.margin};

  & > svg {
    width: 28px;
    height: 28px;
  }

  ${(props) =>
    props.hideInMobile &&
    `
    @media (max-width: 550px) {
      display: none;
    }
  `}
`
const CarouselItem = styled.div`
  position: relative;
  display: flex;
  width: calc(100% - 200px);
  height: calc(100% - 80px);
  max-width: calc(100% - 200px);
  max-height: calc(100vh - 140px);
  align-items: center;
  justify-content: center;
  z-index: 2;

  img,
  video {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    object-fit: contain;
    @media (max-width: 480px) {
      width: 100%;
    }
  }
  @media (max-width: 480px) {
    width: calc(100% - 100px);
    height: calc(100% - 48px);
    max-width: calc(100% - 100px);
  }

  img {
    display: block;
  }
`
const UploadCont = styled.div`
  left: calc((100vw - 100%) / -2);
  top: calc((100vh - 100%) / -2);
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  z-index: 1;
`

const ItemLoadingCont = styled.div`
  position: absolute;
  left: calc((100vw - 100%) / -2);
  top: calc((100vh - 100% + 60px) / -2);
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
`

const ArrowButton = styled.button<{ leftButton?: boolean; hide?: boolean; color: string }>`
  min-width: 60px;
  max-width: 60px;
  height: 60px;
  margin-right: ${(props) => !props.leftButton && '24px'};
  margin-left: ${(props) => props.leftButton && '24px'};
  border: none;
  color: ${(props) => props.color};
  background: transparent;
  box-sizing: border-box;
  border-radius: 50%;
  line-height: 1px;
  align-self: center;
  outline: none;
  cursor: pointer;
  visibility: ${(props) => props.hide && 'hidden'};
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: ${(props) => props.leftButton && '0'};
  right: ${(props) => !props.leftButton && '0'};
  & > svg {
    width: 40px;
    height: 40px;
  }
  @media (max-width: 768px) {
    min-width: 36px;
    max-width: 36px;
    height: 36px;
    margin-right: ${(props) => !props.leftButton && '4px'};
    margin-left: ${(props) => props.leftButton && '4px'};

    & > svg {
      width: 22px;
      height: 22px;
    }
  }
  @media (max-width: 450px) {
    min-width: 32px;
    max-width: 32px;
    height: 32px;

    & > svg {
      width: 20px;
      height: 20px;
    }
  }
`
