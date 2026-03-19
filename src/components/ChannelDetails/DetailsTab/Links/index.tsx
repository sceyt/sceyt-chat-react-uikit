import React, { useEffect, useMemo } from 'react'
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
import { THEME_COLORS } from '../../../../UIHelper/constants'
import { useColor } from '../../../../hooks'

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
  const { [THEME_COLORS.BACKGROUND]: background, [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()
  const dispatch = useDispatch()
  const attachments = useSelector(activeTabAttachmentsSelector, shallowEqual) || []

  useEffect(() => {
    dispatch(getAttachmentsAC(channelId, channelDetailsTabs.link, 35))
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
          {group.items.map((file: IAttachment) => (
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
        </MonthSection>
      ))}
    </Container>
  )
}

export default Links

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
