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
  /** Shown in a channel details tab: placed like the tab's empty state instead of centered in its container. */
  inDetailsTab?: boolean
  /** Rendered inside a list (<ul>): an <li> instead of a <div>. */
  asListItem?: boolean
}

/**
 * Shown when the first load of a list (channels, messages, channel details tabs) failed with a retryable error
 * and there is nothing to show. Centered title, one-line description and a Retry button.
 */
const LoadErrorState = ({
  title,
  description,
  onRetry,
  inDetailsTab,
  asListItem
}: ILoadErrorStateProps & ILoadErrorStateLayout) => {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_1]: surface1
  } = useColor()

  return (
    <Container as={asListItem ? 'li' : 'div'} $inDetailsTab={inDetailsTab} role='status' data-testid='load-error-state'>
      <Title color={textPrimary}>{title}</Title>
      <Description color={textSecondary}>{description}</Description>
      <RetryButton type='button' onClick={onRetry} color={textPrimary} backgroundColor={surface1} borderRadius='8px'>
        Retry
      </RetryButton>
    </Container>
  )
}

/**
 * Renders the app's custom component when given, otherwise the default view.
 * In a details tab the custom component is wrapped so it keeps the tab's placement (and is a valid <li> in a list).
 */
export const renderLoadErrorState = (
  props: ILoadErrorStateProps,
  CustomLoadErrorState?: CustomLoadErrorStateComponent,
  layout?: ILoadErrorStateLayout
) => {
  if (!CustomLoadErrorState) {
    return <LoadErrorState {...props} {...layout} />
  }
  if (!layout?.inDetailsTab) {
    return <CustomLoadErrorState {...props} />
  }
  return (
    <CustomContainer as={layout.asListItem ? 'li' : 'div'}>
      <CustomLoadErrorState {...props} />
    </CustomContainer>
  )
}

export default LoadErrorState

// Same offset as the details tabs' empty state ("No shared files.")
const DETAILS_TAB_OFFSET = '100px'

const Container = styled.div<{ $inDetailsTab?: boolean }>`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: ${(props) => (props.$inDetailsTab ? 'auto' : '100%')};
  min-height: ${(props) => (props.$inDetailsTab ? '0' : '200px')};
  margin-top: ${(props) => (props.$inDetailsTab ? DETAILS_TAB_OFFSET : '0')};
  padding: ${(props) => (props.$inDetailsTab ? '0 16px' : '24px 16px')};
  box-sizing: border-box;
  text-align: center;
  list-style: none;
`

const CustomContainer = styled.div`
  margin-top: ${DETAILS_TAB_OFFSET};
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
