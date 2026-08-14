import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import useProgressiveMediaSource from './useProgressiveMediaSource'

const MediaSource = ({ preferredSource, fallbackSource }: { preferredSource?: string; fallbackSource?: string }) => {
  const { displayedSource, previousSource, pendingSource, markPreferredSourceLoaded } = useProgressiveMediaSource(
    preferredSource,
    fallbackSource
  )

  return (
    <React.Fragment>
      <img data-testid='visible-media' alt='' src={displayedSource} />
      {previousSource && <img data-testid='previous-media' alt='' src={previousSource} />}
      {pendingSource && (
        <img data-testid='pending-media' alt='' src={pendingSource} onLoad={markPreferredSourceLoaded} />
      )}
    </React.Fragment>
  )
}

describe('useProgressiveMediaSource', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('keeps the metadata thumbnail visible until the preferred image finishes loading', () => {
    render(<MediaSource fallbackSource='blob:metadata-thumb' preferredSource='blob:full-image' />)

    expect(screen.getByTestId('visible-media')).toHaveAttribute('src', 'blob:metadata-thumb')
    expect(screen.getByTestId('pending-media')).toHaveAttribute('src', 'blob:full-image')

    fireEvent.load(screen.getByTestId('pending-media'))

    expect(screen.getByTestId('visible-media')).toHaveAttribute('src', 'blob:full-image')
    expect(screen.getByTestId('previous-media')).toHaveAttribute('src', 'blob:metadata-thumb')
    expect(screen.queryByTestId('pending-media')).not.toBeInTheDocument()

    act(() => jest.advanceTimersByTime(180))
    expect(screen.queryByTestId('previous-media')).not.toBeInTheDocument()
  })

  it('keeps the previously loaded image visible while a newer source preloads', () => {
    const { rerender } = render(<MediaSource fallbackSource='blob:metadata-thumb' preferredSource='blob:image-one' />)

    fireEvent.load(screen.getByTestId('pending-media'))
    rerender(<MediaSource fallbackSource='blob:metadata-thumb' preferredSource='blob:image-two' />)

    expect(screen.getByTestId('visible-media')).toHaveAttribute('src', 'blob:image-one')
    expect(screen.getByTestId('pending-media')).toHaveAttribute('src', 'blob:image-two')

    fireEvent.load(screen.getByTestId('pending-media'))

    expect(screen.getByTestId('visible-media')).toHaveAttribute('src', 'blob:image-two')
    expect(screen.getByTestId('previous-media')).toHaveAttribute('src', 'blob:image-one')

    act(() => jest.advanceTimersByTime(180))
    expect(screen.queryByTestId('previous-media')).not.toBeInTheDocument()
  })

  it('uses no image source until a preferred image loads when metadata has no thumbnail', () => {
    render(<MediaSource preferredSource='blob:video-thumb' />)

    expect(screen.getByTestId('visible-media')).not.toHaveAttribute('src')
    expect(screen.getByTestId('pending-media')).toHaveAttribute('src', 'blob:video-thumb')

    fireEvent.load(screen.getByTestId('pending-media'))

    expect(screen.getByTestId('visible-media')).toHaveAttribute('src', 'blob:video-thumb')
  })

  it('does not replay the cross-fade when a source has already loaded in this session', () => {
    const firstRender = render(
      <MediaSource fallbackSource='blob:metadata-thumb' preferredSource='blob:already-loaded' />
    )

    fireEvent.load(screen.getByTestId('pending-media'))
    act(() => jest.advanceTimersByTime(180))
    firstRender.unmount()

    render(<MediaSource fallbackSource='blob:metadata-thumb' preferredSource='blob:already-loaded' />)

    expect(screen.getByTestId('visible-media')).toHaveAttribute('src', 'blob:already-loaded')
    expect(screen.queryByTestId('previous-media')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pending-media')).not.toBeInTheDocument()
  })
})
