import React, { useRef } from 'react'
import { act, render } from '@testing-library/react'
import useOnScreenUserIds from './index'
import { presenceRegistry } from '../../helpers/presence/registry'

const List = ({ ids }: { ids: string[] }) => {
  const ref = useRef<HTMLUListElement>(null)
  useOnScreenUserIds(ref, ids)
  return (
    <ul ref={ref}>
      {ids.map((id) => (
        <li data-presence-user-id={id} key={id}>
          {id}
        </li>
      ))}
    </ul>
  )
}

it('subscribes only intersecting rows and observes newly added rows', async () => {
  jest.useFakeTimers()
  const getUsers = jest.fn().mockResolvedValue([])
  presenceRegistry.configure(jest.fn(), { getUsers })
  presenceRegistry.setAvailability(true, true)
  const view = render(<List ids={['a']} />)
  const find = (id: string) => view.container.querySelector(`[data-presence-user-id="${id}"]`) as Element
  act(() => (global as any).__setMockIntersection(find('a'), true))
  act(() => jest.advanceTimersByTime(150))
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(getUsers).toHaveBeenCalledWith(['a'])

  view.rerender(<List ids={['a', 'b']} />)
  act(() => {
    ;(global as any).__setMockIntersection(find('a'), true)
    ;(global as any).__setMockIntersection(find('b'), true)
  })
  act(() => jest.advanceTimersByTime(150))
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(getUsers).toHaveBeenLastCalledWith(['b'])
  view.unmount()
  presenceRegistry.dispose()
  jest.useRealTimers()
})
