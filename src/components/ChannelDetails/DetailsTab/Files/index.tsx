import React, { useEffect } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import { ReactComponent as FileIcon } from '../../../../assets/svg/file_icon.svg'
import { ReactComponent as Download } from '../../../../assets/svg/downloadFile.svg'
import { bytesToSize, downloadFile } from '../../../../helpers'
import { colors } from '../../../../UIHelper/constants'
import { activeTabAttachmentsSelector } from '../../../../store/message/selector'
import { IAttachment } from '../../../../types'
import { getAttachmentsAC } from '../../../../store/message/actions'
import { channelDetailsTabs } from '../../../../helpers/constants'
import { AttachmentPreviewTitle } from '../index'

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
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []

  useEffect(() => {
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.file))
  }, [channelId])
  return (
    <Container>
      {attachments.map((file: IAttachment) => (
        // <FileItemWrapper >
        <FileItem
          key={file.url}
          onMouseEnter={(e: any) => e.currentTarget.classList.add('isHover')}
          onMouseLeave={(e: any) => e.currentTarget.classList.remove('isHover')}
          hoverBackgroundColor={filePreviewHoverBackgroundColor}
        >
          <FileIconCont>{filePreviewIcon || <FileIcon />}</FileIconCont>
          <FileHoverIconCont>{filePreviewHoverIcon || <FileIcon />}</FileHoverIconCont>
          <div>
            <AttachmentPreviewTitle color={filePreviewTitleColor}>{file.name}</AttachmentPreviewTitle>
            <FileSizeAndDate color={filePreviewSizeColor}>{bytesToSize(file.fileSize)}</FileSizeAndDate>
          </div>
          <DownloadWrapper onClick={() => downloadFile(file)}>
            {filePreviewDownloadIcon || <Download />}
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
  }
  &.isHover {
    & ${FileIconCont} {
      display: none;
    }
    & ${FileHoverIconCont} {
      display: inline-flex;
    }
  }
`
const FileSizeAndDate = styled.span`
  display: block;
  font-family: Roboto, sans-serif;
  font-style: normal;
  font-weight: normal;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color || colors.gray6};
  margin-top: 2px;
`
