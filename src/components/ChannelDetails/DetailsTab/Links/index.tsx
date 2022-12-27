import React, { useEffect } from 'react'
import styled from 'styled-components'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { ReactComponent as LinkIcon } from '../../../../assets/svg/linkIcon.svg'
import { colors } from '../../../../UIHelper/constants'
// import { getAttachments, loadMoreAttachments } from '../../../../../store/message/actions';
import { channelDetailsTabs } from '../../../../helpers/constants'
import { activeTabAttachmentsSelector } from '../../../../store/message/selector'
import { IAttachment } from '../../../../types'
import { getAttachmentsAC } from '../../../../store/message/actions'

interface IProps {
  channelId: string
  linkPreviewIcon?: JSX.Element
  linkPreviewHoverIcon?: JSX.Element
  linkPreviewTitleColor?: string
  linkPreviewColor?: string
  linkPreviewHoverBackgroundColor?: string
}

const Links = ({
  channelId,
  linkPreviewIcon,
  linkPreviewHoverIcon,
  linkPreviewTitleColor,
  linkPreviewColor,
  linkPreviewHoverBackgroundColor
}: IProps) => {
  const dispatch = useDispatch()
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []

  useEffect(() => {
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.link))
  }, [channelId])

  return (
    <Container>
      {attachments.map((file: IAttachment) => (
        <FileItem
          key={file.id}
          onMouseEnter={(e: any) => e.currentTarget.classList.add('isHover')}
          onMouseLeave={(e: any) => e.currentTarget.classList.remove('isHover')}
          hoverBackgroundColor={linkPreviewHoverBackgroundColor}
        >
          <a href={file.url} target='_blank' rel='noreferrer'>
            <LinkIconCont>{linkPreviewIcon || <LinkIcon />}</LinkIconCont>
            <LinkHoverIconCont>{linkPreviewHoverIcon || <LinkIcon />}</LinkHoverIconCont>
            <div>
              <LinkTitle color={linkPreviewTitleColor}>{file.title}</LinkTitle>
              <LinkUrl color={linkPreviewColor}>{file.url}</LinkUrl>
            </div>
          </a>
        </FileItem>
      ))}
    </Container>
  )
}

export default Links

const Container = styled.ul`
  margin: 0;
  padding: 11px 0 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  transition: all 0.2s;
`
const LinkIconCont = styled.span`
  display: inline-flex;
`
const LinkHoverIconCont = styled.span`
  display: none;
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
  }
  div {
    margin-left: 12px;
    width: 100%;
  }
  img {
    width: 42px;
    height: 42px;
    border: 0.5px solid rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
    border-radius: 6px;
  }

  &.isHover {
    & ${LinkIconCont} {
      display: none;
    }
    & ${LinkHoverIconCont} {
      display: inline-flex;
    }
  }
`
const LinkTitle = styled.span<{ color?: string }>`
  display: block;
  font-family: Roboto, sans-serif;
  font-style: normal;
  font-weight: normal;
  font-size: 15px;
  line-height: 20px;
  color: ${(props) => props.color || colors.blue10};
`

const LinkUrl = styled.span<{ color?: string }>`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: calc(100% - 52px);
  font-family: Roboto, sans-serif;
  font-style: normal;
  font-weight: normal;
  font-size: 13px;
  line-height: 16px;
  text-decoration: underline;
  color: ${(props) => props.color || colors.gray6};
`
