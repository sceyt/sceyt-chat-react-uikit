import React, { useEffect, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import { ReactComponent as FileIcon } from '../../../../assets/svg/file_icon.svg'
import { ReactComponent as Download } from '../../../../assets/svg/downloadFile.svg'
import { bytesToSize, downloadFile, formatLargeText } from '../../../../helpers'
import { colors } from '../../../../UIHelper/constants'
import { activeTabAttachmentsSelector } from '../../../../store/message/selector'
import { IAttachment } from '../../../../types'
import { getAttachmentsAC } from '../../../../store/message/actions'
import { channelDetailsTabs } from '../../../../helpers/constants'
import { AttachmentPreviewTitle, UploadingIcon } from '../../../../UIHelper'

interface IProps {
  channelId: string
  filePreviewIcon?: JSX.Element
  filePreviewHoverIcon?: JSX.Element
  filePreviewTitleColor?: string
  filePreviewSizeColor?: string
  filePreviewHoverBackgroundColor?: string
  filePreviewDownloadIcon?: JSX.Element
}

const Files = ({
  channelId,
  filePreviewIcon,
  filePreviewHoverIcon,
  filePreviewTitleColor,
  filePreviewSizeColor,
  filePreviewHoverBackgroundColor,
  filePreviewDownloadIcon
}: IProps) => {
  const dispatch = useDispatch()
  const [downloadingFilesMap, setDownloadingFilesMap] = useState({})
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []
  const handleCompleteDownload = (attachmentId: string) => {
    const stateCopy = { ...downloadingFilesMap }
    delete stateCopy[attachmentId]
    setDownloadingFilesMap(stateCopy)
  }
  const handleDownloadFile = (attachment: IAttachment) => {
    if (attachment.id) {
      setDownloadingFilesMap((prevState) => ({ ...prevState, [attachment.id!]: true }))
    }
    downloadFile(attachment, handleCompleteDownload)
  }

  useEffect(() => {
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.file))
  }, [channelId])

  return (
    <Container>
      {attachments.map((file: IAttachment) => (
        // <FileItemWrapper >
        <FileItem
          key={file.url}
          // onMouseEnter={(e: any) => e.currentTarget.classList.add('isHover')}
          // onMouseLeave={(e: any) => e.currentTarget.classList.remove('isHover')}
          hoverBackgroundColor={filePreviewHoverBackgroundColor}
        >
          {file.metadata && file.metadata.tmb ? (
            <FileThumb draggable={false} src={`data:image/jpeg;base64,${file.metadata.tmb}`} />
          ) : (
            <React.Fragment>
              <FileIconCont>{filePreviewIcon || <FileIcon />}</FileIconCont>
              <FileHoverIconCont>{filePreviewHoverIcon || <FileIcon />}</FileHoverIconCont>
            </React.Fragment>
          )}
          <div>
            <AttachmentPreviewTitle color={filePreviewTitleColor}>
              {formatLargeText(file.name, 32)}
            </AttachmentPreviewTitle>
            <FileSizeAndDate color={filePreviewSizeColor}>{file.size ? bytesToSize(file.size) : ''}</FileSizeAndDate>
          </div>
          <DownloadWrapper onClick={() => handleDownloadFile(file)}>
            {downloadingFilesMap[file.id!] ? (
              <UploadingIcon width='12px' height='12px' borderWidth='2px' color={colors.gray10} />
            ) : (
              filePreviewDownloadIcon || <Download />
            )}
          </DownloadWrapper>
        </FileItem>
        // </FileItemWrapper>
      ))}
    </Container>
  )
}

export default Files

const Container = styled.ul`
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  transition: all 0.2s;
`
// eslint-disable-next-line max-len
// ${(props) => (props.optionsMenuIsOpen ? 'height: calc(100vh - 495px)' : (props.noActions ? 'height: calc(100vh - 544px)' : 'height: calc(100vh - 445px)'))}
const DownloadWrapper = styled.a`
  text-decoration: none;
  visibility: hidden;
  padding: 5px 6px;
  position: absolute;
  top: 25%;
  right: 16px;
  cursor: pointer;
`

/* const FileItemWrapper = styled.li`
  padding: 0 16px;
  &:hover {
    background-color: ${colors.gray0};
    ${DownloadWrapper} {
      visibility: visible;
    }
  }
` */

const FileIconCont = styled.span`
  display: inline-flex;

  & > svg {
    width: 40px;
    height: 40px;
  }
`
const FileHoverIconCont = styled.span`
  display: none;
  & > svg {
    width: 40px;
    height: 40px;
  }
`
const FileThumb = styled.img`
  width: 40px;
  height: 40px;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  object-fit: cover;
`
const FileItem = styled.div<any>`
  position: relative;
  padding: 11px 16px;
  display: flex;
  align-items: center;
  font-size: 15px;
  transition: all 0.2s;
  div {
    margin-left: 7px;
    width: calc(100% - 48px);
  }
  &:hover {
    background-color: ${(props) => props.hoverBackgroundColor || colors.gray0};
    ${DownloadWrapper} {
      visibility: visible;
    }
    & ${FileIconCont} {
      display: none;
    }
    & ${FileHoverIconCont} {
      display: inline-flex;
    }
  }
  /*&.isHover {

  }*/
`
const FileSizeAndDate = styled.span`
  display: block;
  font-style: normal;
  font-weight: normal;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color || colors.gray6};
  margin-top: 2px;
`
