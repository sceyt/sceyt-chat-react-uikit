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

    // Normalize values to fit within the height (0 to height)
    return tmb.map((value) => {
      // Normalize to 0-1 range, then scale to height
      // Use a minimum height of 2px for visibility
      const normalized = maxVal > 0 ? (value / maxVal) * height : 0
      return Math.max(2, normalized)
    })
  }, [tmb, height])

  const exactIndex = duration > 0 ? (currentTime / duration) * normalizedBars.length : 0
  const floorIndex = Math.floor(exactIndex)
  const fractionalPart = exactIndex - floorIndex

  return (
    <Container height={height}>
      {normalizedBars.map((barHeight, index) => {
        const progressRatio = index < floorIndex ? 1 : index === floorIndex ? fractionalPart : 0
        const barOpacity = progressRatio > 0 ? 0.8 + progressRatio * 0.2 : 0.8

        return (
          <Bar
            key={index}
            height={barHeight}
            width={barWidth}
            gap={barGap}
            radius={barRadius}
            waveColor={waveColor}
            progressColor={progressColor}
            progressRatio={progressRatio}
            barOpacity={barOpacity}
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
  justify-content: space-between;
  margin-right: 4px;
`

const Bar = styled.div<{
  height: number
  width: number
  gap: number
  radius: number
  waveColor: string
  progressColor: string
  progressRatio: number
  barOpacity: number
}>`
  position: relative;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  border-radius: ${(props) => props.radius}px;
  min-height: 2px;
  overflow: hidden;
  background-color: ${(props) => props.waveColor};
  opacity: ${(props) => props.barOpacity};

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: ${(props) => props.progressRatio * 100}%;
    height: 100%;
    background-color: ${(props) => props.progressColor};
    border-radius: inherit;
    will-change: width;
    transform: translateZ(0);
  }
`
