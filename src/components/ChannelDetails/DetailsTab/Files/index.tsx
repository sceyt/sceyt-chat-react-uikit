import React, { useEffect, useMemo, useState } from 'react'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
import styled from 'styled-components'
import { CircularProgressbar } from 'react-circular-progressbar'
// Store
import { activeTabAttachmentsSelector } from '../../../../store/message/selector'
import { getAttachmentsAC } from '../../../../store/message/actions'
// Assets
import { ReactComponent as FileIcon } from '../../../../assets/svg/document_icon.svg'
import { ReactComponent as Download } from '../../../../assets/svg/downloadFile.svg'
// Helpers
import { bytesToSize, downloadFile, formatLargeText, formatChannelDetailsDate } from '../../../../helpers'
import { isJSON } from 'helpers/message'
import { base64ToDataURL } from 'helpers/resizeImage'
import { IAttachment } from '../../../../types'
import { channelDetailsTabs } from '../../../../helpers/constants'
import { AttachmentPreviewTitle } from '../../../../UIHelper'
import { THEME_COLORS } from '../../../../UIHelper/constants'
import { useColor } from '../../../../hooks'

interface IProps {
  channelId: string
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
    [THEME_COLORS.BACKGROUND]: background,
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
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.file, 35))
  }, [channelId])

  const groups = useMemo(() => {
    const result: { key: string; date: Date; items: IAttachment[] }[] = []
    attachments.forEach((att: IAttachment) => {
      const date = new Date(att.createdAt)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      const existing = result.find((g) => g.key === key)
      if (existing) {
        existing.items.push(att)
      } else {
        result.push({ key, date, items: [att] })
      }
    })
    return result
  }, [attachments])

  return (
    <Container>
      {groups.map((group) => (
        <MonthSection key={group.key}>
          <StickyMonthHeader color={textSecondary} background={background}>
            {group.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </StickyMonthHeader>
          {group.items.map((file: IAttachment) => {
            const metas = file.metadata && isJSON(file.metadata) ? JSON.parse(file.metadata) : file.metadata
            let withPrefix = true
            let attachmentThumb = ''

            if (metas && metas.tmb) {
              if (metas.tmb.length < 70) {
                attachmentThumb = base64ToDataURL(metas.tmb)
                withPrefix = false
              } else {
                attachmentThumb = metas.tmb
              }
            }

            return (
              <FileItem key={file.id} hoverBackgroundColor={filePreviewHoverBackgroundColor || backgroundHovered}>
                {metas && metas.tmb ? (
                  <FileThumb
                    draggable={false}
                    loading='lazy'
                    decoding='async'
                    src={`${withPrefix ? 'data:image/jpeg;base64,' : ''}${attachmentThumb}`}
                  />
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
          })}
        </MonthSection>
      ))}
    </Container>
  )
}

export default Files

const Container = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  transition: all 0.2s;
`

const MonthSection = styled.div`
  width: 100%;
`

const StickyMonthHeader = styled.div<{ color: string; background: string }>`
  position: sticky;
  top: 44px;
  z-index: 10;
  background: ${(props) => props.background};
  padding: 9px 14px;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};
  text-transform: capitalize;
`

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

const FileIconCont = styled.span<{ iconColor: string; fillColor: string }>`
  display: inline-flex;
  & > svg {
    width: 40px;
    height: 40px;
    color: ${(props) => props.iconColor};
    rect {
      fill: ${(props) => props.fillColor};
    }
  }
`
const FileHoverIconCont = styled.span<{ iconColor: string; fillColor: string }>`
  display: none;
  & > svg {
    width: 40px;
    height: 40px;
    color: ${(props) => props.iconColor};
    rect {
      fill: ${(props) => props.fillColor};
    }
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
