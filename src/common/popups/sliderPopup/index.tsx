import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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
import { makeUsername } from '../../../helpers/message'
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
  setUpdateMessageAttachmentAC
} from '../../../store/message/actions'
import {
  DEFAULT_CHANNEL_TYPE,
  channelDetailsTabs,
  MESSAGE_DELIVERY_STATUS,
  LOADING_STATE
} from '../../../helpers/constants'
import { queryDirection } from '../../../store/message/constants'
import { useColor, useDidUpdate } from '../../../hooks'
import { Avatar } from '../../../components'
import { connectionStatusSelector, contactsMapSelector } from '../../../store/user/selector'
import { UploadingIcon } from '../../../UIHelper'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { getClient } from '../../client'
import { getAttachmentUrlFromCache, setAttachmentToCache } from '../../../helpers/attachmentsCache'
import VideoPlayer from '../../../components/VideoPlayer'
import { CircularProgressbar } from 'react-circular-progressbar'
import ForwardMessagePopup from '../forwardMessage'
import { deletePendingMessage, getAllMessages } from '../../../helpers/messagesHalper'
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

const SliderPopup = ({
  channel,
  setIsSliderOpen,
  currentMediaFile,
  allowEditDeleteIncomingMessage,
  attachmentsPreview,
  messageType
}: IProps) => {
  const { [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary, [THEME_COLORS.OVERLAY_BACKGROUND_2]: overlayBackground2 } =
    useColor()

  const dispatch = useDispatch()

  const getFromContacts = getShowOnlyContactUsers()
  const connectionStatus = useSelector(connectionStatusSelector)
  const ChatClient = getClient()
  const { user } = ChatClient
  const [currentFile, setCurrentFile] = useState<IMedia>({ ...currentMediaFile })
  const [downloadingFilesMap, setDownloadingFilesMap] = useState<{ [key: string]: { uploadPercent: number } }>({})
  const [imageLoading, setImageLoading] = useState(true)
  const [playedVideo, setPlayedVideo] = useState<string | undefined>()
  const [nextButtonDisabled, setNextButtonDisabled] = useState(true)
  const [prevButtonDisabled, setPrevButtonDisabled] = useState(true)
  const [visibleSlide, setVisibleSlide] = useState(false)
  const [forwardPopupOpen, setForwardPopupOpen] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<IMessage | undefined>()
  const attachmentLoadingStateForPopup = useSelector(attachmentForPopupLoadingStateSelector)
  const attachmentsForPopupHasPrev = useSelector(attachmentsForPopupHasPrevSelector)
  const attachmentsForPopupHasNext = useSelector(attachmentsForPopupHasNextSelector)
  const attachmentUpdatedMap = useSelector(attachmentUpdatedMapSelector) || {}
  const prefixUrl = useMemo(() => {
    return currentFile?.type === 'image' ? '_original_image_url' : ''
  }, [currentFile?.type])

  const customDownloader = getCustomDownloader()
  const contactsMap = useSelector(contactsMapSelector)
  const attachmentsList = useSelector(attachmentsForPopupSelector, shallowEqual) || []
  const visibilityTimeout = useRef<NodeJS.Timeout | null>(null)
  const previousListLengthRef = useRef<number>(attachmentsList.length)
  const currentFileIdRef = useRef<string | undefined>(currentFile?.id)
  const [skipTransition, setSkipTransition] = useState(false)
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

  const downloadImage = (src: string, setToDownloadedFiles?: boolean, type?: string) => {
    if (visibilityTimeout.current) {
      clearTimeout(visibilityTimeout.current)
    }
    const image = new Image()
    image.src = src
    image.onload = () => {
      if (setToDownloadedFiles && currentFile) {
        dispatch(setUpdateMessageAttachmentAC(currentFile.url + (type === 'image' ? '_original_image_url' : ''), src))
        visibilityTimeout.current = setTimeout(() => {
          setVisibleSlide(true)
        }, 100)
      }
      setImageLoading(false)
      // setCurrentFileUrl(src)
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
    async (channelIds: string[]) => {
      try {
        let message = getAllMessages().find((message) => message.id === currentFile.messageId)
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
            dispatch(forwardMessageAC(message, channelId, connectionStatus))
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

  const handleToggleDeleteMessagePopup = useCallback(async () => {
    if (!messageToDelete) {
      try {
        let message = getAllMessages().find((message) => message.id === currentFile.messageId)
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
          deletePendingMessage(channel.id, message)
        } else {
          setMessageToDelete(message)
        }
      } catch (error) {
        log.error('Error fetching message for deletion:', error)
      }
    } else {
      setMessageToDelete(undefined)
    }
  }, [messageToDelete, currentFile.messageId, channel.id])

  const handleDeleteMessage = (deleteOption: 'forMe' | 'forEveryone') => {
    dispatch(deleteMessageAC(channel.id, currentFile.messageId, deleteOption))
    if (currentFile.id) {
      dispatch(removeAttachmentAC(currentFile.id))
    }

    setMessageToDelete(undefined)
    setIsSliderOpen(false)
  }
  useDidUpdate(() => {
    if (playedVideo) {
      const videoElem = document.getElementById(playedVideo) as HTMLVideoElement | null
      if (videoElem) {
        videoElem.pause()
      }
    }
    if (currentFile) {
      getAttachmentUrlFromCache(currentFile.url + prefixUrl)
        .then((cachedUrl) => {
          if (cachedUrl) {
            if (!attachmentUpdatedMap[currentFile.url + prefixUrl]) {
              setVisibleSlide(false)
              if (currentFile.type === 'image') {
                downloadImage(cachedUrl as string, true, 'image')
              } else {
                if (visibilityTimeout.current) {
                  clearTimeout(visibilityTimeout.current)
                }
                dispatch(setUpdateMessageAttachmentAC(currentFile.url + prefixUrl, cachedUrl))
                setPlayedVideo(currentFile.id)
                visibilityTimeout.current = setTimeout(() => {
                  setVisibleSlide(true)
                }, 100)
              }
            }
          } else {
            if (customDownloader) {
              customDownloader(currentFile.url, false, () => {}, messageType)
                .then(async (url) => {
                  try {
                    const response = await fetch(url)
                    setAttachmentToCache(currentFile.url + prefixUrl, response)
                    if (currentFile.type === 'image') {
                      downloadImage(url, true, 'image')
                    } else {
                      if (visibilityTimeout.current) {
                        clearTimeout(visibilityTimeout.current)
                      }
                      dispatch(setUpdateMessageAttachmentAC(currentFile.url + prefixUrl, url))
                      setPlayedVideo(currentFile.id)
                      visibilityTimeout.current = setTimeout(() => {
                        setVisibleSlide(true)
                      }, 100)
                    }
                  } catch (error) {
                    log.error('Error fetching attachment:', error)
                  }
                })
                .catch((e) => {
                  log.error('Failed to download attachment:', e)
                })
            } else {
              if (!attachmentUpdatedMap[currentFile.url + prefixUrl]) {
                setVisibleSlide(false)
                if (currentFile.type === 'image') {
                  downloadImage(currentFile.url as string, true, 'image')
                } else {
                  if (visibilityTimeout.current) {
                    clearTimeout(visibilityTimeout.current)
                  }
                  dispatch(setUpdateMessageAttachmentAC(currentFile.url + prefixUrl, currentFile.url))
                  setPlayedVideo(currentFile.id)
                  visibilityTimeout.current = setTimeout(() => {
                    setVisibleSlide(true)
                  }, 100)
                }
              }
            }
          }
        })
        .catch((e) => log.error('Error getting attachment from cache:', e))
    }
  }, [currentFile, playedVideo, attachmentUpdatedMap, customDownloader, messageType, downloadImage, dispatch])

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
    setImageLoading(true)
    if (customDownloader && currentMediaFile) {
      const attachmentUrl = currentMediaFile.url + (currentMediaFile.type === 'image' ? '_original_image_url' : '')
      getAttachmentUrlFromCache(attachmentUrl)
        .then((cachedUrl) => {
          if (cachedUrl) {
            if (currentMediaFile.type === 'image') {
              downloadImage(cachedUrl as string, false, 'image')
            } else {
              dispatch(setUpdateMessageAttachmentAC(attachmentUrl, cachedUrl))
              setPlayedVideo(currentMediaFile.id)
            }
          } else {
            if (customDownloader) {
              customDownloader(currentMediaFile.url, false, () => {}, messageType)
                .then(async (url) => {
                  try {
                    const response = await fetch(url)
                    setAttachmentToCache(attachmentUrl, response)
                    if (currentMediaFile.type === 'image') {
                      downloadImage(url, false, 'image')
                    } else {
                      dispatch(setUpdateMessageAttachmentAC(attachmentUrl, url))
                      setPlayedVideo(currentMediaFile.id)
                    }
                  } catch (error) {
                    log.error('Error fetching initial attachment:', error)
                  }
                })
                .catch((error) => {
                  log.error('Error downloading initial attachment:', error)
                })
            } else {
              downloadImage(attachmentUrl, false, 'image')
            }
          }
        })
        .catch((error) => {
          log.error('Error getting initial attachment from cache:', error)
        })
    }
    if (currentMediaFile && !attachmentsList.find((item: IMedia) => item.id === currentMediaFile.id)) {
      dispatch(
        getAttachmentsAC(channel.id, channelDetailsTabs.media, 34, queryDirection.NEAR, currentMediaFile.id, true)
      )
    }

    return () => {
      if (visibilityTimeout.current) {
        clearTimeout(visibilityTimeout.current)
      }
    }
  }, [])

  const activeFileIndex = useMemo(() => {
    if (!currentFile?.id) return -1
    return attachmentsList.findIndex((item: IMedia) => item.id === currentFile.id)
  }, [attachmentsList, currentFile])

  // Handle when attachmentsList increases - maintain current element position instantly
  useEffect(() => {
    const currentFileId = currentFile?.id
    const previousLength = previousListLengthRef.current
    const newLength = attachmentsList.length

    let timeoutId: NodeJS.Timeout | null = null

    // If list increased and we have a current file, update carousel to maintain position
    if (newLength > previousLength && currentFileId) {
      // Set skipTransition synchronously BEFORE any state updates to prevent blinking
      // This must happen in the same render cycle to prevent visual glitches
      setSkipTransition(true)

      // Calculate the new index of the current file
      const newIndex = attachmentsList.findIndex((item: IMedia) => item.id === currentFileId)

      // If current file is found in the new list
      if (newIndex >= 0) {
        // If index changed (items prepended), update currentFile to trigger position update
        // The activeFileIndex will recalculate, and Carousel will update via initialActiveIndex prop
        if (newIndex !== activeFileIndex) {
          const newFile = attachmentsList[newIndex]
          if (newFile) {
            // Batch the state update to happen after skipTransition is set
            // React will batch these updates, but skipTransition will be set first
            setCurrentFile(newFile)
          }
        }

        // Reset skipTransition after position update completes
        // Use multiple requestAnimationFrame calls to ensure all DOM updates are complete
        timeoutId = setTimeout(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setSkipTransition(false)
            })
          })
        }, 150)
      } else {
        // If current file not found, reset skipTransition after a delay
        timeoutId = setTimeout(() => {
          setSkipTransition(false)
        }, 150)
      }
    }

    // Update refs
    previousListLengthRef.current = newLength
    currentFileIdRef.current = currentFileId

    // Return cleanup function that clears timeout if it was set
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [attachmentsList.length, currentFile?.id, activeFileIndex, attachmentsList])

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

  return (
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
        {activeFileIndex >= 0 && attachmentsList && attachmentsList.length ? (
          <Carousel
            pagination={false}
            className='custom_carousel'
            initialActiveIndex={activeFileIndex >= 0 ? activeFileIndex : 0}
            skipTransition={skipTransition}
            onNextStart={() => {
              if (activeFileIndex + 1 < attachmentsList.length) {
                const nextFile = attachmentsList[activeFileIndex + 1]
                if (
                  nextFile &&
                  !attachmentUpdatedMap[nextFile.url + (nextFile.type === 'image' ? '_original_image_url' : '')]
                ) {
                  setImageLoading(true)
                }
              }
              loadNextMoreAttachments()
            }}
            onPrevStart={() => {
              if (activeFileIndex - 1 >= 0) {
                const prevFile = attachmentsList[activeFileIndex - 1]
                if (
                  prevFile &&
                  !attachmentUpdatedMap[prevFile.url + (prevFile.type === 'image' ? '_original_image_url' : '')]
                ) {
                  setImageLoading(true)
                }
              }
              loadPrevMoreAttachments()
            }}
            onChange={(pageIndex: number) => {
              if (pageIndex >= 0 && pageIndex < attachmentsList.length) {
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
                visibleSlide={
                  visibleSlide || attachmentUpdatedMap[file.url + (file.type === 'image' ? '_original_image_url' : '')]
                }
                onMouseDown={handleCarouselItemMouseDown}
                onContextMenu={(e: React.MouseEvent) => {
                  e.stopPropagation()
                }}
              >
                {file.type === 'image' ? (
                  <React.Fragment>
                    {attachmentLoadingStateForPopup !== LOADING_STATE.LOADED ||
                    (!attachmentUpdatedMap[file.url + (file.type === 'image' ? '_original_image_url' : '')] &&
                      imageLoading) ? (
                      <UploadCont>
                        <UploadingIcon color={textOnPrimary} />
                      </UploadCont>
                    ) : (
                      <img
                        draggable={false}
                        src={attachmentUpdatedMap[file.url + (file.type === 'image' ? '_original_image_url' : '')]}
                        alt={file.name || 'Attachment'}
                        onMouseDown={(e) => {
                          if (e.button === 2) {
                            e.stopPropagation()
                          }
                        }}
                      />
                    )}
                  </React.Fragment>
                ) : (
                  <VideoPlayer
                    activeFileId={currentFile?.id || ''}
                    videoFileId={file.id || ''}
                    src={attachmentUpdatedMap[file.url]}
                    onMouseDown={(e: React.MouseEvent) => {
                      if (e.button === 2) {
                        e.stopPropagation()
                      }
                    }}
                  />
                )}
              </CarouselItem>
            ))}
          </Carousel>
        ) : (
          <UploadingIcon color={textOnPrimary} />
        )}
      </SliderBody>
      {forwardPopupOpen && (
        <ForwardMessagePopup
          handleForward={handleForwardMessage}
          togglePopup={handleToggleForwardMessagePopup}
          buttonText='Forward'
          title='Forward message'
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
    </Container>
  )
}

export default SliderPopup

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100vh;
  z-index: 999;
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
const CarouselItem = styled.div<{ visibleSlide?: boolean }>`
  position: relative;
  display: flex;
  opacity: ${(props) => (props.visibleSlide ? 1 : 0)};
  max-width: calc(100% - 200px);

  img,
  video {
    min-width: 280px;
    max-width: 100%;
    margin: auto;
    object-fit: contain;
    max-height: calc(100vh - 200px);
    @media (max-width: 480px) {
      min-width: inherit;
    }
  }
  @media (max-width: 480px) {
    max-width: calc(100% - 100px);
  }

  img {
    min-width: inherit;
  }
`
const UploadCont = styled.div`
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  min-height: 100px;
  min-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
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
