import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import LoadErrorState, { renderLoadErrorState } from './index'

jest.mock('../../hooks', () => ({
  useColor: () => {
    const { THEME_COLORS } = require('../../UIHelper/constants')
    return {
      [THEME_COLORS.TEXT_PRIMARY]: '#111111',
      [THEME_COLORS.TEXT_SECONDARY]: '#666666',
      [THEME_COLORS.SURFACE_1]: '#f0f0f0'
    }
  }
}))

const props = {
  title: 'Unable to load channels',
  description: "We couldn't load your channels. Please try again.",
  onRetry: jest.fn()
}

describe('LoadErrorState', () => {
  beforeEach(() => props.onRetry.mockClear())

  it('renders the title, description and a Retry button as a status region', () => {
    render(<LoadErrorState {...props} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Unable to load channels')).toBeInTheDocument()
    expect(screen.getByText("We couldn't load your channels. Please try again.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('calls onRetry when Retry is clicked', () => {
    render(<LoadErrorState {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(props.onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders as a list item placed like the tab empty state when inList is set', () => {
    render(
      <ul>
        <>{renderLoadErrorState(props, undefined, { inList: true })}</>
      </ul>
    )
    expect(screen.getByTestId('load-error-state').tagName).toBe('LI')
    expect(screen.getByTestId('load-error-state')).toHaveStyle('margin-top: 100px')
  })

  it('uses theme colors', () => {
    render(<LoadErrorState {...props} />)
    expect(screen.getByText('Unable to load channels')).toHaveStyle('color: #111111')
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveStyle('background-color: #f0f0f0')
  })

  it('renderLoadErrorState uses the app component when provided and passes onRetry', () => {
    const Custom = ({ title, onRetry }: any) => (
      <button type='button' onClick={onRetry}>
        custom: {title}
      </button>
    )
    render(<>{renderLoadErrorState(props, Custom)}</>)
    expect(screen.queryByTestId('load-error-state')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('custom: Unable to load channels'))
    expect(props.onRetry).toHaveBeenCalledTimes(1)
  })

  it('renderLoadErrorState falls back to the default view', () => {
    render(<>{renderLoadErrorState(props)}</>)
    expect(screen.getByTestId('load-error-state')).toBeInTheDocument()
  })
})
