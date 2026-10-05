import React from 'react'
import { render } from '@testing-library/react'
import { useChannelReorderAnimation } from './useChannelReorderAnimation'

const ChannelRows = ({ ids }: { ids: string[] }) => {
  const ref = useChannelReorderAnimation(ids.map((id) => ({ id })))
  return (
    <div ref={ref}>
      {ids.map((id) => (
        <div key={id} data-channel-row-id={id}>
          {id}
        </div>
      ))}
    </div>
  )
}

describe('channel reorder animation', () => {
  const originalAnimate = HTMLElement.prototype.animate
  const originalMatchMedia = window.matchMedia
  const originalGetComputedStyle = window.getComputedStyle
  const originalOffsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')

  let animate: jest.Mock

  beforeEach(() => {
    animate = jest.fn(() => ({ cancel: jest.fn(), onfinish: null }))
    HTMLElement.prototype.animate = animate
    window.matchMedia = jest.fn(() => ({ matches: false })) as any
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get() {
        return Array.from(this.parentElement?.children || []).indexOf(this) * 60
      }
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 60 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 })
  })

  afterEach(() => {
    HTMLElement.prototype.animate = originalAnimate
    window.matchMedia = originalMatchMedia
    window.getComputedStyle = originalGetComputedStyle
    if (originalOffsetTop) Object.defineProperty(HTMLElement.prototype, 'offsetTop', originalOffsetTop)
    if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
    if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight)
  })

  it('moves existing rows from their old positions when channels are sorted', () => {
    const view = render(<ChannelRows ids={['a', 'b', 'c']} />)
    expect(animate).not.toHaveBeenCalled()

    view.rerender(<ChannelRows ids={['c', 'a', 'b']} />)
    expect(animate).toHaveBeenCalledTimes(3)
    expect(animate.mock.calls[0][0]).toEqual([
      { transform: 'translateY(120px)', zIndex: 1 },
      { transform: 'translateY(0)', zIndex: 1 }
    ])
    expect(animate.mock.calls[1][0][0]).toEqual({ transform: 'translateY(-60px)', zIndex: 0 })

    view.rerender(<ChannelRows ids={['c', 'a', 'b']} />)
    expect(animate).toHaveBeenCalledTimes(3)
  })

  it('does not re-measure rows when re-rendered with the same channels array', () => {
    const channels = [{ id: 'a' }, { id: 'b' }]
    const Rows = ({ tick }: { tick: number }) => {
      const ref = useChannelReorderAnimation(channels)
      return (
        <div ref={ref} data-tick={tick}>
          {channels.map(({ id }) => (
            <div key={id} data-channel-row-id={id} />
          ))}
        </div>
      )
    }
    const offsetTop = jest.fn(() => 0)
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', { configurable: true, get: offsetTop })
    const view = render(<Rows tick={0} />)
    const reads = offsetTop.mock.calls.length
    view.rerender(<Rows tick={1} />)
    expect(offsetTop.mock.calls.length).toBe(reads)
  })

  it('does not animate when the user prefers reduced motion', () => {
    window.matchMedia = jest.fn(() => ({ matches: true })) as any
    const view = render(<ChannelRows ids={['a', 'b']} />)
    view.rerender(<ChannelRows ids={['b', 'a']} />)
    expect(animate).not.toHaveBeenCalled()
  })

  it('moves existing rows when a new chat enters at the top', () => {
    const view = render(<ChannelRows ids={['a', 'b']} />)
    view.rerender(<ChannelRows ids={['new', 'a', 'b']} />)

    expect(animate).toHaveBeenCalledTimes(2)
    expect(animate.mock.instances.every((element: HTMLElement) => element.dataset.channelRowId !== 'new')).toBe(true)
  })

  it("continues from a row's visible position during consecutive reorders", () => {
    const view = render(<ChannelRows ids={['a', 'b', 'c']} />)
    view.rerender(<ChannelRows ids={['c', 'a', 'b']} />)
    const firstAnimation = animate.mock.results[0].value

    window.getComputedStyle = jest.fn((element: Element) => ({
      transform: element.getAttribute('data-channel-row-id') === 'c' ? 'matrix(1, 0, 0, 1, 0, 30)' : 'none'
    })) as any
    view.rerender(<ChannelRows ids={['b', 'c', 'a']} />)

    expect(firstAnimation.cancel).toHaveBeenCalled()
    const cCall = animate.mock.instances.findIndex(
      (element: HTMLElement, index: number) => index >= 3 && element.dataset.channelRowId === 'c'
    )
    expect(animate.mock.calls[cCall][0][0]).toEqual({ transform: 'translateY(-30px)', zIndex: 0 })
  })

  // C2: rows that start AND end below the visible area are not animated; a row moving
  // from below into view slides in (intended).
  it('skips rows that stay outside the viewport but animates a row entering it', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 120 })

    const view = render(<ChannelRows ids={['a', 'b', 'c', 'd', 'e', 'f']} />)
    view.rerender(<ChannelRows ids={['f', 'a', 'b', 'c', 'd', 'e']} />)

    const animatedIds = animate.mock.instances.map((el: HTMLElement) => el.dataset.channelRowId)
    // f: 300px -> 0px enters the 120px viewport; a, b shift down inside it
    expect(animatedIds).toEqual(expect.arrayContaining(['f', 'a', 'b']))
    // d: 180 -> 240, e: 240 -> 300 are below the viewport before and after
    expect(animatedIds).not.toContain('d')
    expect(animatedIds).not.toContain('e')
  })

  // C3: unmounting during an animation cancels it. React 18 runs the unmount cleanup
  // asynchronously, so wait a tick before asserting.
  it('cancels running animations on unmount', async () => {
    const view = render(<ChannelRows ids={['a', 'b', 'c']} />)
    view.rerender(<ChannelRows ids={['c', 'a', 'b']} />)

    const animations = animate.mock.results.map((r) => r.value)
    expect(animations.length).toBe(3)

    // Unmount the component
    view.unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // All animations should have been cancelled
    animations.forEach((animation) => {
      expect(animation.cancel).toHaveBeenCalled()
    })
  })

  // C4: Fallback when Element.animate is not available (old browsers / jsdom without mock)
  it('does not crash when Element.animate is not available (C4)', () => {
    // Remove the animate mock
    delete (HTMLElement.prototype as any).animate

    // Should not throw
    expect(() => {
      const view = render(<ChannelRows ids={['a', 'b', 'c']} />)
      view.rerender(<ChannelRows ids={['c', 'a', 'b']} />)
    }).not.toThrow()

    // Restore for other tests
    HTMLElement.prototype.animate = animate
  })
})
