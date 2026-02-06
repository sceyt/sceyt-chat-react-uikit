import React, { useEffect } from 'react'
import styled from 'styled-components'
import { ReactComponent as LinkIcon } from '../../../../assets/svg/linkIcon.svg'
import { THEME_COLORS } from '../../../../UIHelper/constants'
import { useColor } from '../../../../hooks'

interface IProps {
  link: string
  linkPreviewIcon?: JSX.Element
  linkPreviewHoverIcon?: JSX.Element
  linkPreviewTitleColor?: string
  linkPreviewColor?: string
  linkPreviewHoverBackgroundColor?: string
}

const LinkItem = ({
  link,
  linkPreviewIcon,
  linkPreviewHoverIcon,
  // linkPreviewTitleColor,
  linkPreviewColor,
  linkPreviewHoverBackgroundColor
}: IProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.SURFACE_1]: surface1
  } = useColor()

  // const [title, setTitle] = useState('')
  // const [imageSrc, setImageSrc] = useState('')
  // const [loading, setLoading] = useState(true)

  useEffect(() => {
    // .then(process.exit)
    /*    urlMetadata(link).then(
      function (metadata) {
        // success handler
        log.info('metadata for url ... ', link, 'metadata ---- ', metadata)
      },
      function (error) {
        // failure handler
        log.info('error on get metadata ... ', error)
      }
    ) */
  }, [])
  return (
    <FileItem draggable={false} hoverBackgroundColor={linkPreviewHoverBackgroundColor || backgroundHovered}>
      <a draggable={false} href={link.startsWith('http') ? link : `https://${link}`} target='_blank' rel='noreferrer'>
        {/* {loading ? (
          <Loading />
        ) : imageSrc ? (
          <LinkMetaImage src={imageSrc} />
        ) : ( */}
        <React.Fragment>
          <LinkIconCont iconColor={accentColor} fillColor={surface1}>
            {linkPreviewIcon || <LinkIcon />}
          </LinkIconCont>
          <LinkHoverIconCont iconColor={accentColor} fillColor={surface1}>
            {linkPreviewHoverIcon || <LinkIcon />}
          </LinkHoverIconCont>
        </React.Fragment>
        {/* )} */}
        <LinkInfoCont>
          {/* <AttachmentPreviewTitle color={linkPreviewTitleColor}>{title}</AttachmentPreviewTitle> */}
          {/* <AttachmentPreviewTitle color={linkPreviewTitleColor}>Link</AttachmentPreviewTitle> */}
          <LinkUrl color={linkPreviewColor || textPrimary}>{link}</LinkUrl>
        </LinkInfoCont>
      </a>
    </FileItem>
  )
}

export default LinkItem

const LinkIconCont = styled.span<{ iconColor?: string; fillColor?: string }>`
  display: inline-flex;
  > svg {
    color: ${(props) => props.iconColor};
    rect {
      fill: ${(props) => props.fillColor};
    }
  }
`
const LinkHoverIconCont = styled.span<{ iconColor?: string; fillColor?: string }>`
  display: none;
  > svg {
    color: ${(props) => props.iconColor};
    rect {
      fill: ${(props) => props.fillColor};
    }
  }
`
const LinkInfoCont = styled.div`
  margin-left: 12px;
  width: calc(100% - 40px);
`
const FileItem = styled.li<{ hoverBackgroundColor: string }>`
  padding: 9px 16px;
  a {
    display: flex;
    align-items: center;
    text-decoration: none;
  }
  &:hover {
    background-color: ${(props) => props.hoverBackgroundColor};
    & ${LinkIconCont} {
      display: none;
    }
    & ${LinkHoverIconCont} {
      display: inline-flex;
    }
  }
`

const LinkUrl = styled.span<{ color: string }>`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: calc(100% - 52px);
  font-style: normal;
  font-weight: normal;
  font-size: 13px;
  line-height: 16px;
  text-decoration: underline;
  color: ${(props) => props.color};
`
