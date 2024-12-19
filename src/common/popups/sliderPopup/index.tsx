import React, { useEffect, useMemo, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import moment from 'moment'
// @ts-ignore
import Carousel from 'react-elastic-carousel'
import { colors, THEME_COLORS } from '../../../UIHelper/constants'
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
import { attachmentsForPopupSelector } from '../../../store/message/selector'
import { deleteMessageAC, forwardMessageAC, getAttachmentsAC, removeAttachmentAC } from '../../../store/message/actions'
import { DEFAULT_CHANNEL_TYPE, channelDetailsTabs, MESSAGE_DELIVERY_STATUS } from '../../../helpers/constants'
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

interface IProps {
  channel: IChannel
  // eslint-disable-next-line no-unused-vars
  setIsSliderOpen: (state: any) => void
  mediaFiles?: IMedia[]
  currentMediaFile: IMedia
  allowEditDeleteIncomingMessage?: boolean,
  attachmentsPreview?: IAttachmentProperties
}

const SliderPopup = ({
  channel,
  setIsSliderOpen,
  mediaFiles,
  currentMediaFile,
  allowEditDeleteIncomingMessage,
  attachmentsPreview
}: IProps) => {
  const { [THEME_COLORS.TEXT_PRIMARY]: textPrimary, [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary } = useColor()

  const dispatch = useDispatch()

  const getFromContacts = getShowOnlyContactUsers()
  const connectionStatus = useSelector(connectionStatusSelector)
  const ChatClient = getClient()
  const { user } = ChatClient
  const [currentFile, setCurrentFile] = useState<any>({ ...currentMediaFile })
  const [downloadingFilesMap, setDownloadingFilesMap] = useState({})
  const [attachmentsList, setAttachmentsList] = useState<IMedia[]>([])
  const [imageLoading, setImageLoading] = useState(true)
  const [downloadedFiles, setDownloadedFiles] = useState<{ [key: number]: any }>({})
  const [playedVideo, setPlayedVideo] = useState<string | undefined>()
  const [nextButtonDisabled, setNextButtonDisabled] = useState(true)
  const [prevButtonDisabled, setPrevButtonDisabled] = useState(true)
  const [visibleSlide, setVisibleSlide] = useState(false)
  const [forwardPopupOpen, setForwardPopupOpen] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<IMessage | undefined>()

  // const customUploader = getCustomUploader()
  const customDownloader = getCustomDownloader()
  const contactsMap = useSelector(contactsMapSelector)
  const attachments = useSelector(attachmentsForPopupSelector, shallowEqual) || []
  const visibilityTimeout = useRef<any>()
  // const attachmentsHasNext = useSelector(attachmentsForPopupHasNextSelector, shallowEqual) || []
  const attachmentUserName = currentFile
    ? currentFile.user &&
    makeUsername(
      contactsMap[currentFile.user.id],
      currentFile.user,
      getFromContacts && user.id !== currentFile.user.id
    )
    : ''
  const handleClosePopup = () => {
    setAttachmentsList([])
    setIsSliderOpen(false)
  }

  const downloadImage = (src: string, setToDownloadedFiles?: boolean) => {
    clearTimeout(visibilityTimeout.current)
    const image = new Image()
    image.src = src
    image.onload = () => {
      if (setToDownloadedFiles && currentFile) {
        setDownloadedFiles({ ...downloadedFiles, [currentFile?.id]: src })
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
      console.log('file download failed!')
    }
    const stateCopy = { ...downloadingFilesMap }
    delete stateCopy[attachmentId]
    setDownloadingFilesMap(stateCopy)
  }
  const handleDownloadFile = (attachment: IAttachment) => {
    if (attachment.id) {
      setDownloadingFilesMap((prevState) => ({ ...prevState, [attachment.id!]: { uploadPercent: 1 } }))
    }
    downloadFile(attachment, true, handleCompleteDownload, (progress) => {
      const loadedRes = progress.loaded && progress.loaded / progress.total
      const uploadPercent = loadedRes && loadedRes * 100
      setDownloadingFilesMap((prevState) => ({ ...prevState, [attachment.id!]: { uploadPercent } }))
    })
  }

  const handleClicks = (e: any) => {
    if (!e.target.closest('.custom_carousel_item') && !e.target.closest('.custom_carousel_arrow')) {
      handleClosePopup()
    }
  }

  const handleForwardMessage = async (channelIds: string[]) => {
    let message = getAllMessages().find((message) => message.id === currentFile.messageId)
    if (!message) {
      let channelInstance = getChannelFromMap(channel.id)
      if (!channelInstance) {
        channelInstance = await ChatClient.getChannelById(channel.id)
      }
      const messages = await channelInstance.getMessagesById([currentFile.messageId])
      message = messages[0]
    }
    if (channelIds && channelIds.length) {
      channelIds.forEach((channelId) => {
        dispatch(forwardMessageAC(message, channelId, connectionStatus))
      })
    }
    setIsSliderOpen(false)
  }

  const handleToggleForwardMessagePopup = () => {
    setForwardPopupOpen(!forwardPopupOpen)
  }

  const handleToggleDeleteMessagePopup = async () => {
    if (!messageToDelete) {
      let message = getAllMessages().find((message) => message.id === currentFile.messageId)
      if (!message) {
        let channelInstance = getChannelFromMap(channel.id)
        if (!channelInstance) {
          channelInstance = await ChatClient.getChannelById(channel.id)
        }
        const messages = await channelInstance.getMessagesById([currentFile.messageId])
        message = messages[0]
      }
      if (!message.deliveryStatus || message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
        deletePendingMessage(channel.id, message)
      } else {
        setMessageToDelete(message)
      }
    } else {
      setMessageToDelete(undefined)
    }
  }

  const handleDeleteMessage = (deleteOption: 'forMe' | 'forEveryone') => {
    dispatch(deleteMessageAC(channel.id, currentFile.messageId, deleteOption))
    dispatch(removeAttachmentAC(currentFile.id))

    setMessageToDelete(undefined)
    setIsSliderOpen(false)
  }
  useDidUpdate(() => {
    if (playedVideo) {
      const videoElem: any = document.getElementById(playedVideo)
      if (videoElem) {
        videoElem.pause()
      }
    }
    if (currentFile) {
      getAttachmentUrlFromCache(currentFile.url).then((cachedUrl) => {
        if (cachedUrl) {
          if (!downloadedFiles[currentFile.id]) {
            setVisibleSlide(false)
            if (currentFile.type === 'image') {
              downloadImage(cachedUrl as string, true)
            } else {
              clearTimeout(visibilityTimeout.current)
              setDownloadedFiles({ ...downloadedFiles, [currentFile.id]: cachedUrl })
              setPlayedVideo(currentFile.id)
              visibilityTimeout.current = setTimeout(() => {
                setVisibleSlide(true)
              }, 100)
            }
          } else {
            if (currentFile.type === 'image') {
              downloadImage(cachedUrl as string)
            } else {
              setVisibleSlide(true)
            }
          }
        } else {
          if (customDownloader) {
            customDownloader(currentFile.url, false)
              .then(async (url) => {
                const response = await fetch(url)
                setAttachmentToCache(currentFile.url, response)
                if (currentFile.type === 'image') {
                  downloadImage(url, true)
                } else {
                  clearTimeout(visibilityTimeout.current)
                  setDownloadedFiles({ ...downloadedFiles, [currentFile.id]: url })
                  // setCurrentFileUrl(url)
                  setPlayedVideo(currentFile.id)
                  visibilityTimeout.current = setTimeout(() => {
                    setVisibleSlide(true)
                  }, 100)
                }
              })
              .catch((e) => {
                console.log('fail to download image...... ', e)
              })
          } else {
            if (!downloadedFiles[currentFile.id]) {
              setVisibleSlide(false)
              if (currentFile.type === 'image') {
                downloadImage(currentFile.url as string, true)
              } else {
                clearTimeout(visibilityTimeout.current)
                setDownloadedFiles({ ...downloadedFiles, [currentFile.id]: currentFile.url })
                setPlayedVideo(currentFile.id)
                visibilityTimeout.current = setTimeout(() => {
                  setVisibleSlide(true)
                }, 100)
              }
            } else {
              if (currentFile.type === 'image') {
                downloadImage(cachedUrl as string)
              } else {
                setVisibleSlide(true)
              }
            }
          }
        }
      }).catch((e) => console.log(e))
    }
  }, [currentFile])

  useDidUpdate(() => {
    if (currentMediaFile) {
      const currentMedia = attachmentsList.find((att: any) => att.id === currentMediaFile.id)
      if (currentMedia) {
        setCurrentFile(currentMedia)
        const indexOnList = attachmentsList.findIndex((item: any) => item.id === currentMedia?.id)
        if (!attachmentsList[indexOnList + 1]) {
          setNextButtonDisabled(true)
        } else {
          setNextButtonDisabled(false)
        }
        if (!attachmentsList[indexOnList - 1]) {
          setPrevButtonDisabled(true)
        } else {
          setPrevButtonDisabled(false)
        }
      }
    }
  }, [attachmentsList])

  useDidUpdate(() => {
    setAttachmentsList(attachments || [])
  }, [attachments])

  useEffect(() => {
    setImageLoading(true)
    if (customDownloader && currentMediaFile) {
      getAttachmentUrlFromCache(currentMediaFile.url).then((cachedUrl) => {
        if (cachedUrl) {
          if (currentMediaFile.type === 'image') {
            downloadImage(cachedUrl as string)
          } else {
            setDownloadedFiles({ ...downloadedFiles, [currentMediaFile.id!]: cachedUrl })
            setPlayedVideo(currentMediaFile.id)
          }
        } else {
          if (customDownloader) {
            customDownloader(currentMediaFile.url, false).then(async (url) => {
              const response = await fetch(url)
              setAttachmentToCache(currentMediaFile.url, response)
              if (currentMediaFile.type === 'image') {
                downloadImage(url)
              } else {
                setDownloadedFiles({ ...downloadedFiles, [currentMediaFile.id!]: url })
                setPlayedVideo(currentMediaFile.id)
              }
            })
          } else {
            downloadImage(currentMediaFile.url)
          }
        }
      })
    }
    if (currentMediaFile) {
      if (mediaFiles) {
        setAttachmentsList(mediaFiles)
      } else {
        dispatch(
          getAttachmentsAC(channel.id, channelDetailsTabs.media, 35, queryDirection.NEAR, currentMediaFile.id, true)
        )
      }
    }

    return () => {
      setAttachmentsList([])
    }
  }, [])

  const activeFileIndex = useMemo(() => {
    return attachmentsList.findIndex((item) => item.id === currentFile.id)
  }, [attachmentsList, currentFile]);

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
            <UserName>{attachmentUserName}</UserName>
            {/* <FileName>{currentFile.name}</FileName> */}
            {/* <FileSize></FileSize> */}
            <FileDateAndSize color={textOnPrimary}>
              {moment(currentFile && currentFile.createdAt).format('DD.MM.YYYY HH:mm')}{' '}
              <FileSize color={textOnPrimary}>
                {currentFile && currentFile.size && currentFile.size > 0 ? bytesToSize(currentFile.size, 1) : ''}
              </FileSize>
            </FileDateAndSize>
          </Info>
        </FileInfo>
        <ActionsWrapper>
          <IconWrapper onClick={() => handleDownloadFile(currentFile)}>
            {currentFile && downloadingFilesMap[currentFile.id] ? (
              <ProgressWrapper>
                <CircularProgressbar
                  minValue={0}
                  maxValue={100}
                  value={downloadingFilesMap[currentFile.id].uploadPercent || 0}
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
                      strokeWidth: '6px',
                      transition: 'stroke-dashoffset 0.5s ease 0s',
                      transform: 'rotate(0turn)',
                      transformOrigin: 'center center'
                    }
                  }}
                />
              </ProgressWrapper>
            ) : (
              <DownloadIcon />
            )}
          </IconWrapper>
          {attachmentsPreview?.canForward &&
            <IconWrapper hideInMobile margin='0 32px' onClick={handleToggleForwardMessagePopup}>
              <ForwardIcon />
            </IconWrapper>
          }
          {attachmentsPreview?.canDelete &&
            <IconWrapper hideInMobile onClick={handleToggleDeleteMessagePopup}>
              <DeleteIcon />
            </IconWrapper>
          }
        </ActionsWrapper>
        <ClosePopupWrapper>
          <IconWrapper onClick={handleClosePopup}>
            <CloseIcon />
          </IconWrapper>
        </ClosePopupWrapper>
      </SliderHeader>
      <SliderBody onClick={handleClicks}>
        {activeFileIndex >= 0 && attachmentsList && attachmentsList.length ? (
          // @ts-ignore
          <Carousel
            draggable={false}
            pagination={false}
            className='custom_carousel'
            initialActiveIndex={currentFile && activeFileIndex}
            onChange={(_currentItem: any, pageIndex: any) => {
              setImageLoading(true)
              setCurrentFile(attachmentsList[pageIndex])
              if (!attachmentsList[pageIndex + 1]) {
                setNextButtonDisabled(true)
              } else {
                setNextButtonDisabled(false)
              }
              if (!attachmentsList[pageIndex - 1]) {
                setPrevButtonDisabled(true)
              } else {
                setPrevButtonDisabled(false)
              }
            }}
            renderArrow={({ type, onClick, isEdge }: any) => {
              const pointer = type === 'PREV' ? <LeftArrow /> : <RightArrow />
              const disabled = type === 'PREV' ? prevButtonDisabled : nextButtonDisabled
              return (
                <ArrowButton
                  className='custom_carousel_arrow'
                  leftButton={type === 'PREV'}
                  type='button'
                  backgroundColor={textPrimary}
                  onClick={(e) => {
                    setImageLoading(true)
                    e.preventDefault()
                    onClick()
                  }}
                  disabled={isEdge}
                  hide={disabled}
                >
                  {pointer}
                </ArrowButton>
              )
            }}
            isRTL={false}
          >
            {attachmentsList.map((file) => (
              <CarouselItem
                className='custom_carousel_item'
                key={file.id}
                draggable={false}
                visibleSlide={visibleSlide}
              >
                {/* {downloadedFiles[file.id!] ? ( */}
                <React.Fragment>
                  {file.type === 'image' ? (
                    <React.Fragment>
                      {!downloadedFiles[file.id!] && imageLoading ? (
                        <UploadCont>
                          <UploadingIcon />
                        </UploadCont>
                      ) : (
                        <img draggable={false} src={downloadedFiles[file.id!]} alt={file.name} />
                      )}
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <VideoPlayer
                        activeFileId={currentFile?.id || ''}
                        videoFileId={file.id}
                        src={downloadedFiles[file.id!]}
                      />
                      {/* <video controls autoPlay id={file.url} src={downloadedFiles[file.url]}>
                          <source src={downloadedFiles[file.url]} type={`video/${getFileExtension(file.name)}`} />
                          <source src={downloadedFiles[file.url]} type='video/ogg' />
                          <track default kind='captions' srcLang='en' src='/media/examples/friday.vtt' />
                          Your browser does not support the video tag.
                        </video> */}
                    </React.Fragment>
                  )}
                </React.Fragment>
                {/* ) : ( */}
                {/*  <UploadingIcon /> */}
                {/* )} */}
              </CarouselItem>
            ))}
          </Carousel>
        ) : (
          <UploadingIcon />
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
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
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
  color: ${colors.white};
`
const Info = styled.div`
  margin-left: 12px;
`
const ClosePopupWrapper = styled.div`
  width: 40%;
  display: flex;
  justify-content: flex-end;
  color: ${colors.white};
`
/* const FileName = styled.span`
  display: block;
  font-style: normal;
  font-weight: 500;
  font-size: 15px;
  line-height: 16px;
  color: ${colors.white};
  margin-bottom: 4px;
` */

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

const UserName = styled.h4`
  margin: 0;
  color: ${colors.white}
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
`
const ActionsWrapper = styled.div`
  display: flex;
`
const IconWrapper = styled.span<{ margin?: string; hideInMobile?: boolean }>`
  display: flex;
  cursor: pointer;
  color: ${colors.white};
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

  img,
  video {
    //max-width: calc(100vw - 300px);
    min-width: 280px;
    max-width: 100%;
    max-height: calc(100vh - 200px);
    height: 100%;
    @media (max-width: 480px) {
      min-width: inherit;
    }
  }

  img {
    min-width: inherit;
  }
`
const UploadCont = styled.div`
  //position: absolute;
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
const ArrowButton = styled.button<{ leftButton?: boolean; hide?: boolean; backgroundColor?: string }>`
  min-width: 60px;
  max-width: 60px;
  height: 60px;
  margin-right: ${(props) => !props.leftButton && '24px'};
  margin-left: ${(props) => props.leftButton && '24px'};
  background: ${(props) => props.backgroundColor};
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  border-radius: 50%;
  line-height: 1px;
  align-self: center;
  outline: none;
  cursor: pointer;
  visibility: ${(props) => props.hide && 'hidden'};
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
