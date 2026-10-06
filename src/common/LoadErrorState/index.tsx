import React from 'react'
import styled from 'styled-components'
import { useColor } from '../../hooks'
import { THEME_COLORS } from '../../UIHelper/constants'
import { Button } from '../../UIHelper'

export interface ILoadErrorStateProps {
  title: string
  description: string
  onRetry: () => void
}

/** Props passed to an app-provided replacement (CustomLoadErrorState). */
export type CustomLoadErrorStateComponent = React.FC<ILoadErrorStateProps>

interface ILoadErrorStateLayout {
  /** Rendered inside a list (<ul>) of a channel details tab: an <li> placed like the tab's empty state. */
  inList?: boolean
}

/**
 * Shown when the first load of a list (channels, messages, channel details tabs) failed with a retryable error
 * and there is nothing to show. Centered title, one-line description and a Retry button.
 */
const LoadErrorState = ({ title, description, onRetry, inList }: ILoadErrorStateProps & ILoadErrorStateLayout) => {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_1]: surface1
  } = useColor()

  return (
    <Container as={inList ? 'li' : 'div'} $inList={inList} role='status' data-testid='load-error-state'>
      <Title color={textPrimary}>{title}</Title>
      <Description color={textSecondary}>{description}</Description>
      <RetryButton type='button' onClick={onRetry} color={textPrimary} backgroundColor={surface1} borderRadius='8px'>
        Retry
      </RetryButton>
    </Container>
  )
}

/** Renders the app's custom component when given, otherwise the default view. */
export const renderLoadErrorState = (
  props: ILoadErrorStateProps,
  CustomLoadErrorState?: CustomLoadErrorStateComponent,
  layout?: ILoadErrorStateLayout
) => (CustomLoadErrorState ? <CustomLoadErrorState {...props} /> : <LoadErrorState {...props} {...layout} />)

export default LoadErrorState

const Container = styled.div<{ $inList?: boolean }>`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: ${(props) => (props.$inList ? 'auto' : '100%')};
  min-height: ${(props) => (props.$inList ? '0' : '200px')};
  margin-top: ${(props) => (props.$inList ? '100px' : '0')};
  padding: ${(props) => (props.$inList ? '0 16px' : '24px 16px')};
  box-sizing: border-box;
  text-align: center;
  list-style: none;
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

const RetryButton = styled(Button)`
  padding: 10px 24px;

  &:focus-visible {
    outline: 2px solid ${(props) => props.color};
    outline-offset: 2px;
  }
`
