import React, { useEffect } from 'react'
import styled from 'styled-components'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
// Store
import { getAttachmentsAC } from '../../../../store/message/actions'
import { activeTabAttachmentsSelector } from '../../../../store/message/selector'
// Helpers
import { IAttachment } from '../../../../types'
import { channelDetailsTabs } from '../../../../helpers/constants'
// Components
import LinkItem from './linkItem'
// Shared Components & Hooks
import { MonthHeader, useGroupedAttachments } from '../shared'

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
  }, [channelId, dispatch])

  const groupedAttachments = useGroupedAttachments(attachments)

  return (
    <Container>
      {groupedAttachments.map((group) => (
        <React.Fragment key={group.monthKey}>
          <MonthHeader month={group.monthHeader} />
          {group.files.map((file: IAttachment) => (
            <LinkItem
              key={file.id}
              link={file.url}
              linkPreviewColor={linkPreviewColor}
              linkPreviewHoverBackgroundColor={linkPreviewHoverBackgroundColor}
              linkPreviewHoverIcon={linkPreviewHoverIcon}
              linkPreviewTitleColor={linkPreviewTitleColor}
              linkPreviewIcon={linkPreviewIcon}
            />
          ))}
        </React.Fragment>
      ))}
    </Container>
  )
}

export default Links

const Container = styled.ul`
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  transition: all 0.2s;
`
