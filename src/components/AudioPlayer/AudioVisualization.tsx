import React, { useMemo } from 'react'
import styled from 'styled-components'

interface AudioVisualizationProps {
  tmb: number[]
  duration: number
  currentTime: number
  waveColor: string
  progressColor: string
  height?: number
  barWidth?: number
  barGap?: number
  barRadius?: number
}

const AudioVisualization: React.FC<AudioVisualizationProps> = ({
  tmb,
  duration,
  currentTime,
  waveColor,
  progressColor,
  height = 20,
  barWidth = 1,
  barGap = 2,
  barRadius = 1.5
}) => {
  const normalizedBars = useMemo(() => {
    if (!tmb || tmb.length === 0) return []

    // Find the maximum value for normalization
    const maxVal = Math.max(...tmb)
    if (maxVal === 0) return []

    // Normalize values to fit within the height (0 to height)
    return tmb.map((value) => {
      // Normalize to 0-1 range, then scale to height
      // Use a minimum height of 2px for visibility
      const normalized = (value / maxVal) * height
      return Math.max(2, normalized)
    })
  }, [tmb, height])

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  // Find the index of the last played bar (the bar currently being played)
  const lastPlayedBarIndex = useMemo(() => {
    if (progressPercentage === 0) return -1
    const barIndex = Math.floor((progressPercentage / 100) * normalizedBars.length)
    return Math.min(barIndex, normalizedBars.length - 1)
  }, [progressPercentage, normalizedBars.length])

  return (
    <Container height={height}>
      {normalizedBars.map((barHeight, index) => {
        const barPosition = (index / normalizedBars.length) * 100
        const isPlayed = barPosition < progressPercentage
        const isLastPlayed = index === lastPlayedBarIndex

        const finalHeight = isLastPlayed ? Math.min(barHeight * 1.3, height) : barHeight

        return (
          <Bar
            key={index}
            height={finalHeight}
            width={barWidth}
            gap={barGap}
            radius={barRadius}
            color={isPlayed ? progressColor : waveColor}
            isBold={isLastPlayed}
          />
        )
      })}
    </Container>
  )
}

export default AudioVisualization

const Container = styled.div<{ height: number }>`
  display: flex;
  align-items: center;
  height: ${(props) => props.height}px;
  width: 100%;
  gap: 2px;
`

const Bar = styled.div<{
  height: number
  width: number
  gap: number
  radius: number
  color: string
  isBold?: boolean
}>`
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  background-color: ${(props) => props.color};
  border-radius: ${(props) => props.radius}px;
  min-height: 2px;
  transition:
    background-color 0.1s ease,
    height 0.1s ease,
    opacity 0.1s ease;
  opacity: ${(props) => (props.isBold ? 1 : 0.8)};
  ${(props) =>
    props.isBold
      ? `
    box-shadow: 0 0 4px ${props.color};
    filter: brightness(1.2);
  `
      : ''}
`
