import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import moment from 'moment'
// @ts-ignore
import Carousel from 'react-elastic-carousel'
import { colors } from '../../../UIHelper/constants'
import { ReactComponent as DownloadIcon } from '../../../assets/svg/download.svg'
import { ReactComponent as CloseIcon } from '../../../assets/svg/close.svg'
import { ReactComponent as RightArrow } from '../../../assets/svg/sliderButtonRight.svg'
import { ReactComponent as LeftArrow } from '../../../assets/svg/sliderButtonLeft.svg'
import { bytesToSize, downloadFile, getFileExtension, makeUserName } from '../../../helpers'
import { IMedia } from '../../../types'
import { getCustomUploader } from '../../../helpers/customUploader'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { attachmentsForPopupSelector } from '../../../store/message/selector'
import { getAttachmentsAC } from '../../../store/message/actions'
import { channelDetailsTabs } from '../../../helpers/constants'
import { queryDirection } from '../../../store/message/constants'
import { useDidUpdate } from '../../../hooks'
import { Avatar } from '../../../components'
import { contactsMapSelector } from '../../../store/user/selector'
import { UploadingIcon } from '../../../UIHelper'
import { getUserDisplayNameFromContact } from '../../../helpers/contacts'

interface IProps {
  channelId: string
  setIsSliderOpen: (state: any) => void
  mediaFiles?: IMedia[]
  currentMediaFile: IMedia
}

const SliderPopup = ({ channelId, setIsSliderOpen, mediaFiles, currentMediaFile }: IProps) => {
  const dispatch = useDispatch()

  const getFromContacts = getUserDisplayNameFromContact()
  const [currentFile, setCurrentFile] = useState<any>(currentMediaFile)
  const [attachmentsList, setAttachmentsList] = useState(mediaFiles || [])
  const [imageLoading, setImageLoading] = useState(true)
  const [downloadedFiles, setDownloadedFiles] = useState<{ [key: number]: any }>({})
  const customUploader = getCustomUploader()
  const contactsMap = useSelector(contactsMapSelector)
  const attachments = useSelector(attachmentsForPopupSelector, shallowEqual) || []
  // const attachmentsHasNext = useSelector(attachmentsForPopupHasNextSelector, shallowEqual) || []
  const attachmentUserName = currentFile
    ? currentFile.user && makeUserName(contactsMap[currentFile.user.id], currentFile.user, getFromContacts)
    : ''

  const handleClosePopup = () => {
    setAttachmentsList([])
    setIsSliderOpen(false)
  }
  useDidUpdate(() => {
    if (customUploader && currentFile) {
      if (!downloadedFiles[currentFile.url]) {
        customUploader.download(currentFile.url).then((src) => {
          setDownloadedFiles({ ...downloadedFiles, [currentFile.url]: src })
          if (currentFile.type === 'image') {
            const image = new Image()
            image.src = src
            image.onload = () => {
              setImageLoading(false)
            }
          }
        })
      } else {
        setImageLoading(false)
      }
    }
  }, [currentFile])

  useDidUpdate(() => {
    const currentMedia = attachments.find((att: any) => att.id === currentMediaFile.id)
    setCurrentFile(currentMedia)
    setAttachmentsList(attachments)
  }, [attachments])

  useEffect(() => {
    if (customUploader && currentMediaFile) {
      if (!downloadedFiles[currentMediaFile.url]) {
        customUploader.download(currentMediaFile.url).then((src) => {
          setDownloadedFiles({ ...downloadedFiles, [currentMediaFile.url]: src })
          if (currentMediaFile.type === 'image') {
            const image = new Image()
            image.src = src
            image.onload = () => {
              setImageLoading(false)
            }
          }
        })
      }
    }
    if (currentMediaFile && !mediaFiles) {
      dispatch(
        getAttachmentsAC(channelId, channelDetailsTabs.media, 35, queryDirection.NEAR, currentMediaFile.id, true)
      )
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
              {moment(currentFile && currentFile.updatedAt).format('DD.MM.YYYY HH:mm')}{' '}
              <FileSize> {currentFile && currentFile.fileSize ? bytesToSize(currentFile.fileSize, 1) : ''}</FileSize>
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
      <SliderBody>
        {!!(attachmentsList && attachmentsList.length) && (
          // @ts-ignore
          <Carousel
            pagination={false}
            className='custom_carousel'
            initialActiveIndex={currentFile && attachmentsList.findIndex((item) => item.url === currentFile.url)}
            onChange={(_currentItem: any, pageIndex: any) => {
              setImageLoading(true)
              setCurrentFile(attachmentsList[pageIndex])
            }}
            renderArrow={({ type, onClick, isEdge }: any) => {
              const pointer = type === 'PREV' ? <LeftArrow /> : <RightArrow />
              return (
                <ArrowButton leftButton={type === 'PREV'} type='button' onClick={onClick} disabled={isEdge}>
                  {pointer}
                </ArrowButton>
              )
            }}
            isRTL={false}
          >
            {attachmentsList.map((file) => (
              <CarouselItem key={file.url}>
                {downloadedFiles[file.url] ? (
                  <React.Fragment>
                    {file.type === 'image' ? (
                      imageLoading ? (
                        <UploadingIcon />
                      ) : (
                        <img src={downloadedFiles[file.url]} alt={file.name} />
                      )
                    ) : (
                      <video controls autoPlay src={downloadedFiles[file.url]}>
                        <source src={downloadedFiles[file.url]} type={`video/${getFileExtension(file.name)}`} />
                        <source src={downloadedFiles[file.url]} type='video/ogg' />
                        <track default kind='captions' srcLang='en' src='/media/examples/friday.vtt' />
                        Your browser does not support the video tag.
                      </video>
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
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;

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
const CarouselItem = styled.span`
  img,
  video {
    max-width: 100%;
    max-height: calc(100vh - 200px);
  }
  video {
    width: calc(100vw - 300px);
  }
`
const ArrowButton = styled.button<{ leftButton?: boolean }>`
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
`
