import React, { useEffect } from 'react'
import styled from 'styled-components'
import { ReactComponent as LinkIcon } from '../../../../assets/svg/linkIcon.svg'
import { colors } from '../../../../UIHelper/constants'
// import { AttachmentPreviewTitle } from '../../../../UIHelper'

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
  // const [title, setTitle] = useState('')
  // const [imageSrc, setImageSrc] = useState('')
  // const [loading, setLoading] = useState(true)

  useEffect(() => {
    // .then(process.exit)
    /*    urlMetadata(link).then(
      function (metadata) {
        // success handler
        console.log('metadata for url ... ', link, 'metadata ---- ', metadata)
      },
      function (error) {
        // failure handler
        console.log('error on get metadata ... ', error)
      }
    ) */
  }, [])
  return (
    <FileItem draggable={false} hoverBackgroundColor={linkPreviewHoverBackgroundColor || colors.hoverBackgroundColor}>
      <a draggable={false} href={link.startsWith('http') ? link : `https://${link}`} target='_blank' rel='noreferrer'>
        {/* {loading ? (
          <Loading />
        ) : imageSrc ? (
          <LinkMetaImage src={imageSrc} />
        ) : ( */}
        <React.Fragment>
          <LinkIconCont color={colors.primaryLight}>{linkPreviewIcon || <LinkIcon />}</LinkIconCont>
          <LinkHoverIconCont color={colors.primaryLight}>{linkPreviewHoverIcon || <LinkIcon />}</LinkHoverIconCont>
        </React.Fragment>
        {/* )} */}
        <LinkInfoCont>
          {/* <AttachmentPreviewTitle color={linkPreviewTitleColor}>{title}</AttachmentPreviewTitle> */}
          {/* <AttachmentPreviewTitle color={linkPreviewTitleColor}>Link</AttachmentPreviewTitle> */}
          <LinkUrl color={linkPreviewColor}>{link}</LinkUrl>
        </LinkInfoCont>
      </a>
    </FileItem>
  )
}

export default LinkItem

const LinkIconCont = styled.span<{ color?: string }>`
  display: inline-flex;
  color: ${(props) => props.color};
`
const LinkHoverIconCont = styled.span<{ color?: string }>`
  display: none;
  color: ${(props) => props.color};
`
const LinkInfoCont = styled.div`
  margin-left: 12px;
  width: calc(100% - 40px);
`
const FileItem = styled.li<any>`
  padding: 9px 16px;
  a {
    display: flex;
    align-items: center;
    text-decoration: none;
  }
  &:hover {
    background-color: ${(props) => props.hoverBackgroundColor || colors.gray0};
    & ${LinkIconCont} {
      display: none;
    }
    & ${LinkHoverIconCont} {
      display: inline-flex;
    }
  }
`

const LinkUrl = styled.span<{ color?: string }>`
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
  color: ${(props) => props.color || colors.textColor1};
`

/*
const LinkMetaImage = styled.img`
  width: 40px;
  height: 40px;
  object-fit: cover;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  border-radius: 6px;
`

const Loading = styled.div`
  width: 40px;
  height: 40px;
  min-width: 40px;
`
*/
