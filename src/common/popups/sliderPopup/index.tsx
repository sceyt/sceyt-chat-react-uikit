import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import moment from 'moment'
// @ts-ignore
import Carousel from 'react-elastic-carousel'
import { colors } from '../../../UIHelper/constants'
import { ReactComponent as DownloadIcon } from '../../../assets/svg/download.svg'
import { ReactComponent as CloseIcon } from '../../../assets/svg/close.svg'
import { ReactComponent as RightArrow } from '../../../assets/svg/sliderButtonRight.svg'
import { ReactComponent as LeftArrow } from '../../../assets/svg/sliderButtonLeft.svg'
import { bytesToSize, downloadFile, makeUserName } from '../../../helpers'
import { IMedia } from '../../../types'
import { getCustomDownloader, getCustomUploader } from '../../../helpers/customUploader'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { attachmentsForPopupSelector } from '../../../store/message/selector'
import { getAttachmentsAC } from '../../../store/message/actions'
import { channelDetailsTabs } from '../../../helpers/constants'
import { queryDirection } from '../../../store/message/constants'
import { useDidUpdate } from '../../../hooks'
import { Avatar } from '../../../components'
import { contactsMapSelector } from '../../../store/user/selector'
import { UploadingIcon } from '../../../UIHelper'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { getClient } from '../../client'
import { getAttachmentUrlFromCache, setAttachmentToCache } from '../../../helpers/attachmentsCache'
import VideoPlayer from '../../../components/VideoPlayer'

interface IProps {
  channelId: string
  setIsSliderOpen: (state: any) => void
  mediaFiles?: IMedia[]
  currentMediaFile: IMedia
}

const SliderPopup = ({ channelId, setIsSliderOpen, mediaFiles, currentMediaFile }: IProps) => {
  const dispatch = useDispatch()
  const getFromContacts = getShowOnlyContactUsers()
  const ChatClient = getClient()
  const { user } = ChatClient
  const [currentFile, setCurrentFile] = useState<any>({ ...currentMediaFile })
  const [attachmentsList, setAttachmentsList] = useState<IMedia[]>([])
  const [imageLoading, setImageLoading] = useState(true)
  const [downloadedFiles, setDownloadedFiles] = useState<{ [key: number]: any }>({})
  const [playedVideo, setPlayedVideo] = useState<string | undefined>()
  const [nextButtonDisabled, setNextButtonDisabled] = useState(true)
  const [prevButtonDisabled, setPrevButtonDisabled] = useState(true)
  const [visibleSlide, setVisibleSlide] = useState(false)
  const customUploader = getCustomUploader()
  const customDownloader = getCustomDownloader()
  const contactsMap = useSelector(contactsMapSelector)
  const attachments = useSelector(attachmentsForPopupSelector, shallowEqual) || []
  const visibilityTimeout = useRef<any>()
  // const attachmentsHasNext = useSelector(attachmentsForPopupHasNextSelector, shallowEqual) || []
  const attachmentUserName = currentFile
    ? currentFile.user &&
      makeUserName(
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
      if (setToDownloadedFiles) {
        setDownloadedFiles({ ...downloadedFiles, [currentFile.id]: src })
        visibilityTimeout.current = setTimeout(() => {
          setVisibleSlide(true)
        }, 100)
      }
      setImageLoading(false)
      // setCurrentFileUrl(src)
    }
  }

  const handleClicks = (e: any) => {
    if (!e.target.closest('.custom_carousel_item') && !e.target.closest('.custom_carousel_arrow')) {
      handleClosePopup()
    }
  }
  useDidUpdate(() => {
    if (customUploader && currentFile) {
      if (playedVideo) {
        const videoElem: any = document.getElementById(playedVideo)
        if (videoElem) {
          videoElem.pause()
        }
      }

      getAttachmentUrlFromCache(currentFile.id).then((cachedUrl) => {
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
          }
          if (currentFile.type === 'image') {
            downloadImage(cachedUrl as string)
          } else {
            setVisibleSlide(true)
          }
        } else {
          if (customDownloader) {
            customDownloader(currentFile.url).then(async (url) => {
              const response = await fetch(url)
              setAttachmentToCache(currentFile.id, response)
              if (currentFile.type === 'image') {
                downloadImage(url)
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
          } else {
            if (currentFile.type === 'image') {
              downloadImage(currentFile.url)
            } else {
              clearTimeout(visibilityTimeout.current)
              setDownloadedFiles({ ...downloadedFiles, [currentFile.id]: currentFile.url })
              setPlayedVideo(currentFile.id)
              visibilityTimeout.current = setTimeout(() => {
                setVisibleSlide(true)
              }, 100)
            }
          }
        }
      })
    }
  }, [currentFile])

  useDidUpdate(() => {
    const currentMedia = attachmentsList.find((att: any) => att.id === currentMediaFile.id)
    setCurrentFile(currentMedia)
    if (currentMedia) {
      const indexOnList = attachmentsList.findIndex((item: any) => item.id === currentMedia.id)
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
  }, [attachmentsList])

  useDidUpdate(() => {
    setAttachmentsList(attachments || [])
  }, [attachments])

  useEffect(() => {
    if (customDownloader && currentMediaFile) {
      getAttachmentUrlFromCache(currentMediaFile.id!).then((cachedUrl) => {
        if (cachedUrl) {
          if (currentMediaFile.type === 'image') {
            downloadImage(cachedUrl as string)
          } else {
            setDownloadedFiles({ ...downloadedFiles, [currentMediaFile.id!]: cachedUrl })
            setPlayedVideo(currentMediaFile.id)
          }
        } else {
          if (customDownloader) {
            customDownloader(currentMediaFile.url).then(async (url) => {
              const response = await fetch(url)
              setAttachmentToCache(currentMediaFile.id!, response)
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
          getAttachmentsAC(channelId, channelDetailsTabs.media, 35, queryDirection.NEAR, currentMediaFile.id, true)
        )
      }
    }

    return () => {
      setAttachmentsList([])
    }
  }, [])
  return (
    <Container>
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
            <FileDateAndSize>
              {moment(currentFile && currentFile.createdAt).format('DD.MM.YYYY HH:mm')}{' '}
              <FileSize>
                {currentFile && currentFile.fileSize && currentFile.fileSize > 0
                  ? bytesToSize(currentFile.fileSize, 1)
                  : ''}
              </FileSize>
            </FileDateAndSize>
          </Info>
        </FileInfo>
        <ActionDownload onClick={() => downloadFile(currentFile)}>
          <DownloadIcon />
        </ActionDownload>
        <Actions>
          <ActionItem onClick={handleClosePopup}>
            <CloseIcon />
          </ActionItem>
        </Actions>
      </SliderHeader>
      <SliderBody onClick={handleClicks}>
        {!!(attachmentsList && attachmentsList.length) && (
          // @ts-ignore
          <Carousel
            draggable={false}
            pagination={false}
            className='custom_carousel'
            initialActiveIndex={currentFile && attachmentsList.findIndex((item) => item.id === currentFile.id)}
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
                  onClick={(e) => {
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
                {downloadedFiles[file.id!] ? (
                  <React.Fragment>
                    {file.type === 'image' ? (
                      <React.Fragment>
                        {imageLoading ? (
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
                          activeFileId={currentFile.id}
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
                ) : (
                  <UploadingIcon />
                )}
              </CarouselItem>
            ))}
          </Carousel>
        )}
      </SliderBody>
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
const SliderHeader = styled.div`
  height: 60px;
  background: ${colors.gray6};
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
  color: ${colors.white};
`
const Info = styled.div`
  margin-left: 12px;
`
const Actions = styled.div`
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

const FileDateAndSize = styled.span`
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.078px;
  color: ${colors.gray9};
`

const FileSize = styled.span`
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
    background-color: ${colors.gray9};
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
const ActionItem = styled.span`
  cursor: pointer;
`
const ActionDownload = styled.div`
  cursor: pointer;
  color: ${colors.white};

  & > svg {
    width: 28px;
    height: 28px;
  }
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
  position: absolute;
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
const ArrowButton = styled.button<{ leftButton?: boolean; hide?: boolean }>`
  min-width: 60px;
  max-width: 60px;
  height: 60px;
  margin-right: ${(props) => !props.leftButton && '24px'};
  margin-left: ${(props) => props.leftButton && '24px'};
  background: ${colors.gray6};
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