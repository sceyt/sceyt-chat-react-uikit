import React from 'react'
import styled, { keyframes } from 'styled-components'

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

const Bar = styled.span<{ delay: number; borderColor: string }>`
  display: block;
  width: 3px;
  height: 8px;
  border-radius: 2px;
  background: ${(props) => props.borderColor};
  animation: ${wave} 1s infinite;
  animation-delay: ${({ delay }) => delay}s;
`

const RecordingAnimation: React.FC<{ borderColor: string }> = ({ borderColor }) => (
  <Wrapper>
    <Bar delay={0} borderColor={borderColor} />
    <Bar delay={0.15} borderColor={borderColor} />
    <Bar delay={0.3} borderColor={borderColor} />
    <Bar delay={0.45} borderColor={borderColor} />
    <Bar delay={0.6} borderColor={borderColor} />
  </Wrapper>
)

export default RecordingAnimation
