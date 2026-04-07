import '@testing-library/jest-dom/extend-expect'

jest.mock('./services/indexedDB/metadataService', () => ({
  cleanupOldMonthsMetadata: jest.fn()
}))

jest.mock('store', () => ({
  getState: () => ({
    MessageReducer: {
      pendingPollActions: {}
    }
  }),
  dispatch: jest.fn()
}))

export type RectInput = {
  top?: number
  left?: number
  width?: number
  height?: number
  right?: number
  bottom?: number
}

export type ScrollMetrics = {
  scrollTop?: number
  scrollHeight?: number
  clientHeight?: number
  offsetTop?: number
  offsetHeight?: number
}

const DEFAULT_TEST_USER = {
  id: 'current-user',
  firstName: 'Current',
  lastName: 'User',
  state: 'active'
}

const { setClient } = require('./common/client') as {
  setClient: (client: any) => void
}
const requireWithFallback = <T>(moduleName: string, fallbackPath: string): T => {
  try {
    return require(moduleName) as T
  } catch (error) {
    return require(fallbackPath) as T
  }
}

const ReactDOM = requireWithFallback<any>('react-dom', '../examples/sceyt-livechat-demo/node_modules/react-dom')
const ReactDOMClient = requireWithFallback<{
  createRoot: (container: Element | DocumentFragment) => {
    render: (children: any) => void
    unmount: () => void
  }
}>('react-dom/client', '../examples/sceyt-livechat-demo/node_modules/react-dom/client')

const reactRoots = new Map<Element | DocumentFragment, ReturnType<typeof ReactDOMClient.createRoot>>()

if (typeof ReactDOM.render !== 'function') {
  ReactDOM.render = (children: any, container: Element | DocumentFragment, callback?: () => void) => {
    let root = reactRoots.get(container)
    if (!root) {
      root = ReactDOMClient.createRoot(container)
      reactRoots.set(container, root)
    }
    if (typeof ReactDOM.flushSync === 'function') {
      ReactDOM.flushSync(() => {
        root!.render(children)
      })
    } else {
      root.render(children)
    }
    callback?.()
    return children
  }
}

if (typeof ReactDOM.unmountComponentAtNode !== 'function') {
  ReactDOM.unmountComponentAtNode = (container: Element | DocumentFragment) => {
    const root = reactRoots.get(container)
    if (!root) {
      return false
    }
    if (typeof ReactDOM.flushSync === 'function') {
      ReactDOM.flushSync(() => {
        root.unmount()
      })
    } else {
      root.unmount()
    }
    reactRoots.delete(container)
    return true
  }
}

if (!ReactDOM.default) {
  ReactDOM.default = ReactDOM
} else {
  ReactDOM.default.render = ReactDOM.render
  ReactDOM.default.unmountComponentAtNode = ReactDOM.unmountComponentAtNode
}

const elementRects = new WeakMap<Element, DOMRect>()
let lastScrollIntoViewTarget: Element | null = null
let animationFrameId = 1
const animationFrames = new Map<number, FrameRequestCallback>()

type TestGlobalHelpers = typeof globalThis & {
  __setMockElementRect: (element: Element, rect: RectInput) => DOMRect
  __setMockScrollMetrics: (element: HTMLElement, metrics: ScrollMetrics) => void
  __setMockIntersection: (element: Element, isIntersecting: boolean) => void
  __flushAnimationFrames: () => void
  __getLastScrollIntoViewTarget: () => Element | null
  __resetDomTestState: () => void
}

const testGlobal = global as TestGlobalHelpers

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const originalConsoleError = console.error

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const [firstArg] = args
    if (
      typeof firstArg === 'string' &&
      (firstArg.includes('ReactDOMTestUtils.act') || firstArg.includes('not wrapped in act('))
    ) {
      return
    }

    originalConsoleError(...args)
  })
})

const createRect = (input: RectInput = {}): DOMRect => {
  const top = input.top ?? 0
  const left = input.left ?? 0
  const width = input.width ?? 0
  const height = input.height ?? 0
  const right = input.right ?? left + width
  const bottom = input.bottom ?? top + height

  return {
    x: left,
    y: top,
    width,
    height,
    top,
    right,
    bottom,
    left,
    toJSON: () => ({ top, left, width, height, right, bottom })
  } as DOMRect
}

const defineMutableNumber = (element: HTMLElement, key: keyof ScrollMetrics, value: number) => {
  Object.defineProperty(element, key, {
    configurable: true,
    writable: true,
    value
  })
}

class MockIntersectionObserver implements IntersectionObserver {
  static instances = new Set<MockIntersectionObserver>()

  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly thresholds: ReadonlyArray<number>

  private readonly callback: IntersectionObserverCallback
  private readonly elements = new Set<Element>()

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.root = options?.root ?? null
    this.rootMargin = options?.rootMargin ?? '0px'
    this.thresholds = Array.isArray(options?.threshold)
      ? options?.threshold
      : [typeof options?.threshold === 'number' ? options.threshold : 0]
    MockIntersectionObserver.instances.add(this)
  }

  disconnect() {
    this.elements.clear()
    MockIntersectionObserver.instances.delete(this)
  }

  observe = (element: Element) => {
    this.elements.add(element)
    this.notify(element, false)
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  unobserve = (element: Element) => {
    this.elements.delete(element)
  }

  has(element: Element) {
    return this.elements.has(element)
  }

  notify(element: Element, isIntersecting: boolean) {
    const rect = elementRects.get(element) || createRect()
    const entry = {
      target: element,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: rect,
      intersectionRect: isIntersecting ? rect : createRect(),
      rootBounds: this.root instanceof Element ? this.root.getBoundingClientRect() : null,
      time: Date.now()
    } as IntersectionObserverEntry

    this.callback([entry], this)
  }
}

testGlobal.__setMockElementRect = (element: Element, rect: RectInput) => {
  const nextRect = createRect(rect)
  elementRects.set(element, nextRect)
  return nextRect
}

testGlobal.__setMockScrollMetrics = (element: HTMLElement, metrics: ScrollMetrics) => {
  defineMutableNumber(element, 'scrollTop', metrics.scrollTop ?? element.scrollTop ?? 0)
  defineMutableNumber(element, 'scrollHeight', metrics.scrollHeight ?? element.scrollHeight ?? 0)
  defineMutableNumber(element, 'clientHeight', metrics.clientHeight ?? element.clientHeight ?? 0)
  defineMutableNumber(element, 'offsetTop', metrics.offsetTop ?? element.offsetTop ?? 0)
  defineMutableNumber(element, 'offsetHeight', metrics.offsetHeight ?? element.offsetHeight ?? 0)
}

testGlobal.__setMockIntersection = (element: Element, isIntersecting: boolean) => {
  MockIntersectionObserver.instances.forEach((observer) => {
    if (observer.has(element)) {
      observer.notify(element, isIntersecting)
    }
  })
}

testGlobal.__flushAnimationFrames = () => {
  const queuedFrames = Array.from(animationFrames.entries())
  animationFrames.clear()
  queuedFrames.forEach(([id, callback]) => {
    if (animationFrames.has(id)) {
      return
    }
    callback(Date.now())
  })
}

testGlobal.__getLastScrollIntoViewTarget = () => lastScrollIntoViewTarget

testGlobal.__resetDomTestState = () => {
  lastScrollIntoViewTarget = null
  animationFrames.clear()
  animationFrameId = 1
  Array.from(reactRoots.keys()).forEach((container) => {
    ReactDOM.unmountComponentAtNode(container)
  })
  MockIntersectionObserver.instances.forEach((observer) => observer.disconnect())
  MockIntersectionObserver.instances.clear()
}

Object.defineProperty(window, 'IntersectionObserver', {
  configurable: true,
  writable: true,
  value: MockIntersectionObserver
})

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: function getBoundingClientRect() {
    return elementRects.get(this) || createRect()
  }
})

const scrollIntoViewMock = jest.fn(function scrollIntoView(this: Element) {
  lastScrollIntoViewTarget = this
  let parent = this.parentElement

  while (parent) {
    if (parent.id === 'scrollableDiv') {
      defineMutableNumber(parent, 'scrollTop', Math.max(parent.scrollTop || 0, 120))
      break
    }
    parent = parent.parentElement
  }
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  configurable: true,
  value: scrollIntoViewMock
})

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: scrollIntoViewMock
})

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: function scrollTo(this: HTMLElement, optionsOrX?: ScrollToOptions | number, y?: number) {
    if (typeof optionsOrX === 'number') {
      this.scrollTop = y ?? 0
      return
    }

    if (typeof optionsOrX?.top === 'number') {
      this.scrollTop = optionsOrX.top
    }
  }
})

Object.defineProperty(window, 'requestAnimationFrame', {
  configurable: true,
  writable: true,
  value: (callback: FrameRequestCallback) => {
    const id = animationFrameId++
    animationFrames.set(id, callback)
    return id
  }
})

Object.defineProperty(window, 'cancelAnimationFrame', {
  configurable: true,
  writable: true,
  value: (id: number) => {
    animationFrames.delete(id)
  }
})

beforeEach(() => {
  setClient({ user: { ...DEFAULT_TEST_USER } })
  testGlobal.__resetDomTestState()
})

afterEach(() => {
  jest.clearAllMocks()
  testGlobal.__resetDomTestState()
})

afterAll(() => {
  ;(console.error as jest.Mock).mockRestore?.()
})
