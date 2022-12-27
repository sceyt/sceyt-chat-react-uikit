import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import moment from 'moment'
// @ts-ignore
import Carousel, { consts } from 'react-elastic-carousel'
import { colors } from '../../../UIHelper/constants'
import { ReactComponent as DownloadIcon } from '../../../assets/svg/downloadIcon.svg'
import { ReactComponent as CloseIcon } from '../../../assets/svg/close.svg'
import { ReactComponent as RightArrow } from '../../../assets/svg/carusel_right_arrow.svg'
import { ReactComponent as LeftArrow } from '../../../assets/svg/carousel_left_arrow.svg'
import { bytesToSize, downloadFile, getFileExtension } from '../../../helpers'
import { IMedia } from '../../../types'
import { getCustomUploader } from '../../../helpers/customUploader'

interface IProps {
  setIsSliderOpen: (state: any) => void
  mediaFiles: IMedia[]
  currentMediaFile: IMedia
}

const SliderPopup = ({ setIsSliderOpen, mediaFiles, currentMediaFile }: IProps) => {
  const [currentFile, setCurrentFile] = useState(currentMediaFile)
  const [downloadedFiles, setDownloadedFiles] = useState<{ [key: number]: any }>({})
  const customUploader = getCustomUploader()
  const attachmentUser = currentFile.user
    ? `${currentFile.user.firstName} ${currentFile.user.lastName && `${currentFile.user.lastName[0]}.`}`
    : 'Deleted user'

  useEffect(() => {
    if (customUploader) {
      if (!downloadedFiles[currentFile.url]) {
        console.log('download image .......')
        customUploader
          .download(currentFile)
          .then((src) => setDownloadedFiles({ ...downloadedFiles, [currentFile.url]: src }))
      }
    }
  }, [currentFile])
  return (
    <Container>
      <SliderHeader>
        <FileInfo>
          <FileName>{currentFile.name}</FileName>
          <FileSize>{bytesToSize(currentFile.fileSize)}</FileSize>
          <FileDate>{moment(currentFile.updatedAt).format('DD MMMM YYYY')}</FileDate>
          <UserName>{attachmentUser}</UserName>
        </FileInfo>
        <Actions>
          <ActionDownload onClick={() => downloadFile(currentFile)}>
            <DownloadIcon />
          </ActionDownload>
          <ActionItem onClick={() => setIsSliderOpen(null)}>
            <CloseIcon />
          </ActionItem>
        </Actions>
      </SliderHeader>
      <SliderBody>
        {/* @ts-ignore */}
        <Carousel
          initialActiveIndex={mediaFiles.findIndex((item) => item.url === currentFile.url)}
          onChange={(_currentItem: any, pageIndex: any) => {
            setCurrentFile(mediaFiles[pageIndex])
          }}
          renderArrow={({ type, onClick, isEdge }: any) => {
            const pointer = type === consts.PREV ? <LeftArrow /> : <RightArrow />
            return (
              <ArrowButton type='button' onClick={onClick} disabled={isEdge}>
                {pointer}
              </ArrowButton>
            )
          }}
          isRTL={false}
        >
          {mediaFiles.map((file) => (
            <CarouselItem key={file.url}>
              {downloadedFiles[file.url] ? (
                <React.Fragment>
                  {file.type === 'image' ? (
                    <img src={downloadedFiles[file.url]} alt={file.name} />
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
                <React.Fragment>Loading</React.Fragment>
              )}
            </CarouselItem>
          ))}
        </Carousel>
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
  background: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
`
const SliderBody = styled.div`
  width: 100%;
  height: 100%;
  background: rgba(6, 10, 38, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
`
const FileInfo = styled.div`
  width: 40%;
  font-family: Roboto, sans-serif;
  font-style: normal;
  font-weight: normal;
  font-size: 14px;
  line-height: 14px;
  color: ${colors.gray6};
`
const Actions = styled.div`
  width: 64px;
  display: flex;
  justify-content: space-between;
  color: ${colors.gray6};
`
const FileName = styled.span`
  display: block;
  font-family: Roboto, sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 15px;
  line-height: 16px;
  color: ${colors.blue6};
  margin-bottom: 4px;
`
const FileSize = styled.span`
  padding-right: 6px;
  border-right: 1px solid ${colors.gray1};
`
const FileDate = styled.span`
  padding: 0 6px;
  border-right: 1px solid ${colors.gray1};
`
const UserName = styled.span`
  padding-left: 6px;
`
const ActionItem = styled.span`
  cursor: pointer;
`
const ActionDownload = styled.div`
  cursor: pointer;
  color: ${colors.gray6};

  &:hover {
    color: blue;
  }
`
const CarouselItem = styled.span`
  img {
    max-width: 100%;
    max-height: calc(100vh - 200px);
  }
`
const ArrowButton = styled.button`
  width: 36px;
  height: 36px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  border-radius: 50%;
  line-height: 1px;
  align-self: center;
  outline: none;
  cursor: pointer;
`
