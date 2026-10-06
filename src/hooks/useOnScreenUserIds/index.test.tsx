import React, { useRef } from 'react'
import { act, render } from '@testing-library/react'
import useOnScreenUserIds from './index'
import { presenceRegistry } from '../../helpers/presence/registry'

type Row = { key: string; id: string }

const List = ({ rows }: { rows: Row[] }) => {
  const ref = useRef<HTMLUListElement>(null)
  useOnScreenUserIds(
    ref,
    rows.map((row) => row.id)
  )
  return (
    <ul ref={ref}>
      {rows.map((row) => (
        <li data-presence-user-id={row.id} data-row-key={row.key} key={row.key}>
          {row.id}
        </li>
      ))}
    </ul>
  )
}

const rowsFor = (ids: string[]) => ids.map((id) => ({ key: id, id }))
const setIntersecting = (element: Element, isIntersecting: boolean) =>
  act(() => (global as any).__setMockIntersection(element, isIntersecting))
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms))

describe('useOnScreenUserIds', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    presenceRegistry.dispose()
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('subscribes only intersecting rows and observes newly added rows', async () => {
    const getUsers = jest.fn().mockResolvedValue([])
    presenceRegistry.configure(jest.fn(), { getUsers })
    presenceRegistry.setAvailability(true, true)
    const view = render(<List rows={rowsFor(['a'])} />)
    const find = (id: string) => view.container.querySelector(`[data-presence-user-id="${id}"]`) as Element
    setIntersecting(find('a'), true)
    advance(300)
    advance(150)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(getUsers).toHaveBeenCalledWith(['a'])

    view.rerender(<List rows={rowsFor(['a', 'b'])} />)
    setIntersecting(find('a'), true)
    setIntersecting(find('b'), true)
    advance(300)
    advance(150)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(getUsers).toHaveBeenLastCalledWith(['b'])
    view.unmount()
  })

  describe('with a recorded registry', () => {
    let subscribed: Map<string, number>

    beforeEach(() => {
      subscribed = new Map()
      jest.spyOn(presenceRegistry, 'subscribe').mockImplementation((ids: string[]) => {
        ids.forEach((id) => subscribed.set(id, (subscribed.get(id) || 0) + 1))
        return () =>
          ids.forEach((id) => {
            const count = (subscribed.get(id) || 0) - 1
            if (count > 0) subscribed.set(id, count)
            else subscribed.delete(id)
          })
      })
    })

    it('never subscribes a row that leaves the screen before 300 ms', () => {
      const view = render(<List rows={rowsFor(['a'])} />)
      const row = view.container.querySelector('[data-presence-user-id="a"]') as Element
      setIntersecting(row, true)
      advance(299)
      setIntersecting(row, false)
      advance(5000)
      expect(presenceRegistry.subscribe).not.toHaveBeenCalled()
      view.unmount()
    })

    it('keeps a user ID while any of its rows is visible and drops it after the grace', () => {
      const rows = [
        { key: 'first', id: 'a' },
        { key: 'second', id: 'a' }
      ]
      const view = render(<List rows={rows} />)
      const first = view.container.querySelector('[data-row-key="first"]') as Element
      const second = view.container.querySelector('[data-row-key="second"]') as Element
      setIntersecting(first, true)
      setIntersecting(second, true)
      advance(300)
      expect(subscribed.get('a')).toBe(1)

      setIntersecting(first, false)
      advance(5000)
      expect(subscribed.get('a')).toBe(1)

      setIntersecting(second, false)
      advance(1999)
      expect(subscribed.get('a')).toBe(1)
      advance(1)
      expect(subscribed.has('a')).toBe(false)
      view.unmount()
    })

    it('counts removed rows the same way as rows that leave the screen', () => {
      const rows = [
        { key: 'first', id: 'a' },
        { key: 'second', id: 'a' }
      ]
      const view = render(<List rows={rows} />)
      setIntersecting(view.container.querySelector('[data-row-key="first"]') as Element, true)
      setIntersecting(view.container.querySelector('[data-row-key="second"]') as Element, true)
      advance(300)

      view.rerender(<List rows={[rows[1], { key: 'other', id: 'b' }]} />)
      advance(5000)
      expect(subscribed.get('a')).toBe(1)

      view.rerender(<List rows={[{ key: 'other', id: 'b' }]} />)
      advance(1999)
      expect(subscribed.get('a')).toBe(1)
      advance(1)
      expect(subscribed.has('a')).toBe(false)
      view.unmount()
    })
  })
})
