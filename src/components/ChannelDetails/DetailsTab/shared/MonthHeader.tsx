import React from 'react'
import styled from 'styled-components'
import { THEME_COLORS } from '../../../../UIHelper/constants'
import { useColor } from '../../../../hooks'

interface MonthHeaderProps {
  month: string
  className?: string
  leftPadding?: number
}

const MonthHeader: React.FC<MonthHeaderProps> = ({ month, className, leftPadding = 16 }) => {
  const { [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()

  return (
    <Header className={className} color={textSecondary} leftPadding={leftPadding}>
      {month}
    </Header>
  )
}

export default MonthHeader

const Header = styled.div<{ color: string; leftPadding: number }>`
  padding: 12px 0 6px ${(props) => props.leftPadding}px;
  margin: 0;
  font-style: normal;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};
  text-transform: uppercase;
`
