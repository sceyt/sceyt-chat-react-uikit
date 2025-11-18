import React, { useEffect, useState } from 'react'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
import styled from 'styled-components'
import { CircularProgressbar } from 'react-circular-progressbar'
// Store
import { activeTabAttachmentsSelector } from '../../../../store/message/selector'
import { getAttachmentsAC } from '../../../../store/message/actions'
// Assets
import { ReactComponent as FileIcon } from '../../../../assets/svg/file_icon.svg'
import { ReactComponent as Download } from '../../../../assets/svg/downloadFile.svg'
// Helpers
import { bytesToSize, downloadFile, formatLargeText, formatChannelDetailsDate } from '../../../../helpers'
import { isJSON } from '../../../../helpers/message'
import { base64ToToDataURL } from '../../../../helpers/resizeImage'
import { IAttachment } from '../../../../types'
import { channelDetailsTabs } from '../../../../helpers/constants'
import { AttachmentPreviewTitle } from '../../../../UIHelper'
import { THEME_COLORS } from '../../../../UIHelper/constants'
import { useColor } from '../../../../hooks'

interface IProps {
  channelId: string
  theme?: string
  filePreviewIcon?: JSX.Element
  filePreviewHoverIcon?: JSX.Element
  filePreviewTitleColor?: string
  filePreviewSizeColor?: string
  filePreviewHoverBackgroundColor?: string
  filePreviewDownloadIcon?: JSX.Element
  fileNameFontSize?: string
  fileNameLineHeight?: string
  fileSizeFontSize?: string
  fileSizeLineHeight?: string
}

const Files = ({
  channelId,
  filePreviewIcon,
  filePreviewHoverIcon,
  filePreviewTitleColor,
  filePreviewSizeColor,
  filePreviewHoverBackgroundColor,
  filePreviewDownloadIcon,
  fileNameFontSize,
  fileNameLineHeight,
  fileSizeFontSize,
  fileSizeLineHeight
}: IProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.OVERLAY_BACKGROUND_2]: overlayBackground2
  } = useColor()

  const dispatch = useDispatch()
  const [downloadingFilesMap, setDownloadingFilesMap] = useState<{ [key: string]: { uploadPercent: number } }>({})
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []
  const nameSizeNum = fileNameFontSize && Number(fileNameFontSize.slice(0, -2))
  const nameMaxLength = nameSizeNum ? 32 - (nameSizeNum - 15) * (nameSizeNum < 20 ? 2 : 1) : 32
  const handleCompleteDownload = (attachmentId: string) => {
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

  useEffect(() => {
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.file))
  }, [channelId])

  return (
    <Container>
      {attachments.map(
        (file: IAttachment) => {
          const metas = file.metadata && isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata
          let withPrefix = true
          let attachmentThumb = ''

          if (metas && metas.tmb) {
            if (metas.tmb.length < 70) {
              attachmentThumb = base64ToToDataURL(metas.tmb)
              withPrefix = false
            } else {
              attachmentThumb = metas.tmb
            }
          }
          return (
            <FileItem
              key={file.id}
              // onMouseEnter={(e: any) => e.currentTarget.classList.add('isHover')}
              // onMouseLeave={(e: any) => e.currentTarget.classList.remove('isHover')}
              hoverBackgroundColor={filePreviewHoverBackgroundColor || backgroundHovered}
            >
              {metas && metas.tmb ? (
                <FileThumb draggable={false} src={`${withPrefix ? 'data:image/jpeg;base64,' : ''}${attachmentThumb}`} />
              ) : (
                <React.Fragment>
                  <FileIconCont iconColor={accentColor} fillColor={surface1}>
                    {filePreviewIcon || <FileIcon />}
                  </FileIconCont>
                  <FileHoverIconCont iconColor={accentColor} fillColor={surface1}>
                    {filePreviewHoverIcon || <FileIcon />}
                  </FileHoverIconCont>
                </React.Fragment>
              )}
              <div>
                <AttachmentPreviewTitle
                  fontSize={fileNameFontSize}
                  lineHeight={fileNameLineHeight}
                  color={filePreviewTitleColor || textPrimary}
                >
                  {formatLargeText(file.name, nameMaxLength)}
                </AttachmentPreviewTitle>
                <FileSizeAndDate
                  fontSize={fileSizeFontSize}
                  lineHeight={fileSizeLineHeight}
                  color={filePreviewSizeColor || textSecondary}
                >
                  {file.size
                    ? `${bytesToSize(file.size)} • ${formatChannelDetailsDate(file.createdAt)}`
                    : formatChannelDetailsDate(file.createdAt)}
                </FileSizeAndDate>
              </div>
              <DownloadWrapper
                visible={!!downloadingFilesMap[file.id!]}
                iconColor={accentColor}
                onClick={() => handleDownloadFile(file)}
              >
                {downloadingFilesMap[file.id!] ? (
                  <ProgressWrapper>
                    <CircularProgressbar
                      minValue={0}
                      maxValue={100}
                      value={downloadingFilesMap[file.id!].uploadPercent || 0}
                      backgroundPadding={6}
                      background={true}
                      text=''
                      styles={{
                        background: {
                          fill: `${overlayBackground2}66`
                        },
                        path: {
                          stroke: accentColor,
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
                  filePreviewDownloadIcon || <Download />
                )}
              </DownloadWrapper>
            </FileItem>
          )
        }
        // <FileItemWrapper >

        // </FileItemWrapper>
      )}
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
const DownloadWrapper = styled.a<{ visible?: boolean; iconColor?: string }>`
  text-decoration: none;
  visibility: ${(props) => (props.visible ? 'visible' : 'hidden')};
  padding: 5px 6px;
  position: absolute;
  top: 25%;
  right: 16px;
  cursor: pointer;
  & > svg {
    & path {
      fill: ${(props) => props.iconColor};
    }
    color: ${(props) => props.iconColor};
  }
`
const ProgressWrapper = styled.span`
  display: inline-block;
  width: 20px;
  height: 20px;
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
/* const FileItemWrapper = styled.li`
  padding: 0 16px;
  &:hover {
    background-color: ${colors.gray0};
    ${DownloadWrapper} {
      visibility: visible;
    }
  }
` */

const FileIconCont = styled.span<{ iconColor: string; fillColor: string }>`
  display: inline-flex;

  & > svg {
    width: 40px;
    height: 40px;
    color: ${(props) => props.iconColor};
    fill: ${(props) => props.fillColor};
  }
`
const FileHoverIconCont = styled.span<{ iconColor: string; fillColor: string }>`
  display: none;
  & > svg {
    color: ${(props) => props.iconColor};
    width: 40px;
    height: 40px;
    fill: ${(props) => props.fillColor};
  }
`
const FileThumb = styled.img`
  width: 40px;
  height: 40px;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  object-fit: cover;
`
const FileItem = styled.div<{ hoverBackgroundColor: string }>`
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
    background-color: ${(props) => props.hoverBackgroundColor};
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
const FileSizeAndDate = styled.span<{ fontSize?: string; lineHeight?: string; color: string }>`
  display: block;
  font-style: normal;
  font-weight: normal;
  font-size: ${(props) => props.fontSize || '13px'};
  line-height: ${(props) => props.lineHeight || '16px'};
  color: ${(props) => props.color};
  margin-top: 2px;
`
