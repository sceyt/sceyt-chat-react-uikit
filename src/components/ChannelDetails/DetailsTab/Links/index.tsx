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
import { THEME_COLORS } from '../../../../UIHelper/constants'
import { useColor } from '../../../../hooks'
// Components
import LinkItem from './linkItem'

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
  const { [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()

  useEffect(() => {
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.link))
  }, [channelId])
  return (
    <Container>
      {attachments.map((file: IAttachment, index: number) => {
        let monthComponent: React.ReactNode = null

        if (index === 0) {
          monthComponent = (
            <MonthHeader color={textSecondary}>
              {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </MonthHeader>
          )
        } else if (
          index > 0 &&
          new Date(file.createdAt).getMonth() !== new Date(attachments[index - 1].createdAt).getMonth()
        ) {
          monthComponent = (
            <MonthHeader color={textSecondary}>
              {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </MonthHeader>
          )
        }

        return (
          <React.Fragment key={file.id}>
            {monthComponent}
            <LinkItem
              link={file.url}
              linkPreviewColor={linkPreviewColor}
              linkPreviewHoverBackgroundColor={linkPreviewHoverBackgroundColor}
              linkPreviewHoverIcon={linkPreviewHoverIcon}
              linkPreviewTitleColor={linkPreviewTitleColor}
              linkPreviewIcon={linkPreviewIcon}
            />
          </React.Fragment>
        )
      })}
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
const MonthHeader = styled.div<{ color: string }>`
  padding: 9px 16px;
  font-style: normal;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};
  text-transform: uppercase;
`
