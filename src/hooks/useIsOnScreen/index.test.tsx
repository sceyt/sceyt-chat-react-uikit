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

it('keeps a scrolling row visible for two seconds after it leaves the screen', () => {
  jest.useFakeTimers()
  const view = render(<Row />)
  const row = screen.getByTestId('presence-row')
  act(() => (global as any).__setMockIntersection(row, true))
  expect(row).toHaveTextContent('visible')
  act(() => (global as any).__setMockIntersection(row, false))
  act(() => jest.advanceTimersByTime(1999))
  expect(row).toHaveTextContent('visible')
  act(() => jest.advanceTimersByTime(1))
  expect(row).toHaveTextContent('hidden')
  view.unmount()
  jest.useRealTimers()
})
