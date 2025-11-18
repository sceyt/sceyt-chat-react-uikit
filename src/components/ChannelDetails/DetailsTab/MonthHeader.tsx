import React from 'react'
import styled from 'styled-components'
import { IAttachment } from '../../../types'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'

interface IProps {
  file: IAttachment
  index: number
  attachments: IAttachment[]
  padding?: string
  fullWidth?: boolean
}

const MonthHeader = ({ file, index, attachments, padding, fullWidth }: IProps) => {
  const { [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()

  let monthComponent: React.ReactNode = null

  if (index === 0) {
    monthComponent = (
      <MonthHeaderContainer color={textSecondary} padding={padding} fullWidth={fullWidth}>
        {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </MonthHeaderContainer>
    )
  } else if (
    index > 0 &&
    new Date(file.createdAt).getMonth() !== new Date(attachments[index - 1].createdAt).getMonth()
  ) {
    monthComponent = (
      <MonthHeaderContainer color={textSecondary} padding={padding} fullWidth={fullWidth}>
        {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </MonthHeaderContainer>
    )
  }

  return <>{monthComponent}</>
}

export default MonthHeader

const MonthHeaderContainer = styled.div<{ color: string; padding?: string; fullWidth?: boolean }>`
  padding: ${(props) => props.padding || '11px 16px'};
  width: ${(props) => (props.fullWidth ? '100%' : 'auto')};
  font-style: normal;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};
  text-transform: uppercase;
`
