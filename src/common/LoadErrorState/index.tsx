import React from 'react'
import styled from 'styled-components'
import { useColor } from '../../hooks'
import { THEME_COLORS } from '../../UIHelper/constants'

export interface ILoadErrorStateProps {
  title: string
  description: string
  onRetry: () => void
  retryText?: string
}

/** Props passed to an app-provided replacement (CustomLoadErrorState). */
export type CustomLoadErrorStateComponent = React.FC<ILoadErrorStateProps>

/**
 * Shown when the first load of a list (channels, messages, channel details tabs) timed out
 * and there is nothing to show. Centered title, one-line description and a Retry button.
 */
const LoadErrorState = ({ title, description, onRetry, retryText = 'Retry' }: ILoadErrorStateProps) => {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_1]: surface1
  } = useColor()

  return (
    <Container role='alert' data-testid='load-error-state'>
      <Title color={textPrimary}>{title}</Title>
      <Description color={textSecondary}>{description}</Description>
      <RetryButton type='button' onClick={onRetry} color={textPrimary} backgroundColor={surface1}>
        {retryText}
      </RetryButton>
    </Container>
  )
}

/** Renders the app's custom component when given, otherwise the default view. */
export const renderLoadErrorState = (
  props: ILoadErrorStateProps,
  CustomLoadErrorState?: CustomLoadErrorStateComponent
) => (CustomLoadErrorState ? <CustomLoadErrorState {...props} /> : <LoadErrorState {...props} />)

export default LoadErrorState

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  padding: 24px 16px;
  box-sizing: border-box;
  text-align: center;
`

const Title = styled.h3<{ color: string }>`
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 500;
  line-height: 26px;
  color: ${(props) => props.color};
`

const Description = styled.p<{ color: string }>`
  margin: 0 0 16px;
  max-width: 320px;
  font-size: 15px;
  line-height: 20px;
  color: ${(props) => props.color};
`

const RetryButton = styled.button<{ color: string; backgroundColor: string }>`
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  color: ${(props) => props.color};
  background-color: ${(props) => props.backgroundColor};

  &:focus-visible {
    outline: 2px solid ${(props) => props.color};
    outline-offset: 2px;
  }
`
