import React from 'react'
import styled, { keyframes } from 'styled-components'

const barColor = '#7B818A'

const wave = keyframes`
  0%, 100% {
    transform: scaleY(0.5);
    opacity: 0.6;
  }
  50% {
    transform: scaleY(1.2);
    opacity: 1;
  }
`

const Wrapper = styled.div`
  display: flex;
  align-items: flex-end;
  height: 8px;
  gap: 1.5px;
`

const Bar = styled.span<{ delay: number }>`
  display: block;
  width: 3px;
  height: 8px;
  border-radius: 2px;
  background: ${barColor};
  animation: ${wave} 1s infinite;
  animation-delay: ${({ delay }) => delay}s;
`

const RecordingAnimation: React.FC = () => (
  <Wrapper>
    <Bar delay={0} />
    <Bar delay={0.15} />
    <Bar delay={0.3} />
    <Bar delay={0.45} />
    <Bar delay={0.6} />
  </Wrapper>
)

export default RecordingAnimation 