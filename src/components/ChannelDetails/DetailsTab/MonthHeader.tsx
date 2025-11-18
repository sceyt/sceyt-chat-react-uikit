import React, { useMemo } from 'react'
import styled from 'styled-components'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'

interface IProps {
  currentCreatedAt: string | number | Date
  previousCreatedAt?: string | number | Date
  isFirst: boolean
  padding?: string
  fullWidth?: boolean
}

const MonthHeader = ({ currentCreatedAt, previousCreatedAt, isFirst, padding, fullWidth }: IProps) => {
  const { [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()

  const monthComponent = useMemo(() => {
    const shouldShowHeader =
      isFirst || (previousCreatedAt && new Date(currentCreatedAt).getMonth() !== new Date(previousCreatedAt).getMonth())

    if (!shouldShowHeader) {
      return null
    }

    return (
      <MonthHeaderContainer color={textSecondary} padding={padding} fullWidth={fullWidth}>
        {new Date(currentCreatedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </MonthHeaderContainer>
    )
  }, [currentCreatedAt, previousCreatedAt, isFirst, textSecondary, padding, fullWidth])

  return monthComponent
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
