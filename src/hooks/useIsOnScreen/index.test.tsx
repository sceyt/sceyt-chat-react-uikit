import React, { useRef } from 'react'
import { act, render, screen } from '@testing-library/react'
import useIsOnScreen from './index'

const Row = () => {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useIsOnScreen(ref)
  return (
    <div ref={ref} data-testid='presence-row'>
      {visible ? 'visible' : 'hidden'}
    </div>
  )
}

const setIntersecting = (element: Element, isIntersecting: boolean) =>
  act(() => (global as any).__setMockIntersection(element, isIntersecting))

describe('useIsOnScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('becomes visible after 300 ms on screen and stays visible for two seconds after leaving', () => {
    const view = render(<Row />)
    const row = screen.getByTestId('presence-row')
    setIntersecting(row, true)
    act(() => jest.advanceTimersByTime(299))
    expect(row).toHaveTextContent('hidden')
    act(() => jest.advanceTimersByTime(1))
    expect(row).toHaveTextContent('visible')

    setIntersecting(row, false)
    act(() => jest.advanceTimersByTime(1999))
    expect(row).toHaveTextContent('visible')
    act(() => jest.advanceTimersByTime(1))
    expect(row).toHaveTextContent('hidden')
    view.unmount()
  })

  it('never becomes visible when the row leaves before 300 ms', () => {
    const view = render(<Row />)
    const row = screen.getByTestId('presence-row')
    setIntersecting(row, true)
    act(() => jest.advanceTimersByTime(299))
    setIntersecting(row, false)
    act(() => jest.advanceTimersByTime(5000))
    expect(row).toHaveTextContent('hidden')
    view.unmount()
  })

  it('keeps the row visible when it returns within the leave grace', () => {
    const view = render(<Row />)
    const row = screen.getByTestId('presence-row')
    setIntersecting(row, true)
    act(() => jest.advanceTimersByTime(300))
    setIntersecting(row, false)
    act(() => jest.advanceTimersByTime(1500))
    setIntersecting(row, true)
    act(() => jest.advanceTimersByTime(5000))
    expect(row).toHaveTextContent('visible')
    view.unmount()
  })
})
