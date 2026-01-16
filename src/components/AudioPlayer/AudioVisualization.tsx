import React, { useMemo, memo } from 'react'
import styled from 'styled-components'

interface AudioVisualizationProps {
  tmb: number[]
  duration: number
  currentTime: number
  waveColor: string
  progressColor: string
  height?: number
  barWidth?: number
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

  const containerWidth = 148

  // Calculate spacing for space-between distribution
  // First bar at 0, last bar at (containerWidth - barWidth)
  // Equal spacing between all bars
  const calculatedGap = useMemo(() => {
    if (normalizedBars.length <= 1) return 0
    // Total space available for gaps
    const totalBarWidth = normalizedBars.length * barWidth
    const totalGapSpace = containerWidth - totalBarWidth
    // Equal spacing between all bars (normalizedBars.length - 1 gaps)
    return totalGapSpace / (normalizedBars.length - 1)
  }, [normalizedBars.length, barWidth, containerWidth])

  const exactIndex = duration > 0 ? (currentTime / duration) * normalizedBars.length : 0
  const floorIndex = Math.floor(exactIndex)
  const fractionalPart = exactIndex - floorIndex

  if (normalizedBars.length === 0) {
    return <Container style={{ height: `${height}px`, width: `${containerWidth}px` }} />
  }

  return (
    <Container style={{ height: `${height}px`, width: `${containerWidth}px` }}>
      <SVG width={containerWidth} height={height}>
        {normalizedBars.map((barHeight, index) => {
          // Calculate x position for space-between distribution
          let x: number
          if (normalizedBars.length === 1) {
            x = 0
          } else {
            x = index * (barWidth + calculatedGap)
          }

          // Ensure last bar aligns with right edge
          if (index === normalizedBars.length - 1) {
            x = containerWidth - barWidth
          }

          const centerY = height / 2
          const barTop = centerY - barHeight / 2
          const progressRatio = index < floorIndex ? 1 : index === floorIndex ? fractionalPart : 0
          const barOpacity = progressRatio > 0 ? 0.8 + progressRatio * 0.2 : 0.8

          return (
            <g key={index}>
              {/* Background bar */}
              <rect
                x={x}
                y={barTop}
                width={barWidth}
                height={barHeight}
                rx={barRadius}
                ry={barRadius}
                fill={waveColor}
                opacity={barOpacity}
              />
              {/* Progress overlay */}
              {progressRatio > 0 && (
                <rect
                  x={x}
                  y={barTop}
                  width={barWidth * progressRatio}
                  height={barHeight}
                  rx={barRadius}
                  ry={barRadius}
                  fill={progressColor}
                />
              )}
            </g>
          )
        })}
      </SVG>
    </Container>
  )
}

export default memo(AudioVisualization)

const Container = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: flex-start;
  margin-right: 4px;
  position: relative;
`

const SVG = styled.svg`
  display: block;
`
