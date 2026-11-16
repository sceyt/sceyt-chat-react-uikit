import { canPlayQuickTime, resetQuickTimeSupportForTests } from './videoContainer'

const FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:158.0) Gecko/20100101 Firefox/158.0'
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

describe('canPlayQuickTime', () => {
  const movie = () => new Blob(['quicktime'], { type: 'video/quicktime' })
  let videos: any[]

  const useBrowser = (userAgent: string) => {
    jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  }

  beforeEach(() => {
    jest.useFakeTimers()
    resetQuickTimeSupportForTests()
    videos = []
    URL.createObjectURL = jest.fn(() => 'blob:movie')
    URL.revokeObjectURL = jest.fn()
    const createElement = document.createElement.bind(document)
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName !== 'video') return createElement(tagName)
      const video: any = { style: {}, videoWidth: 0, removeAttribute: jest.fn() }
      videos.push(video)
      return video
    })
    jest.spyOn(document.body, 'appendChild').mockImplementation((node: any) => {
      node.parentNode = { removeChild: jest.fn() }
      return node
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('is true in other browsers, without loading the file', async () => {
    useBrowser(CHROME)

    await expect(canPlayQuickTime(movie())).resolves.toBe(true)
    expect(videos).toHaveLength(0)
  })

  it('in Firefox, is true when the file shows its first frame, labelled as MP4', async () => {
    useBrowser(FIREFOX)
    const result = canPlayQuickTime(movie())
    videos[0].videoWidth = 1280
    videos[0].onloadeddata()

    await expect(result).resolves.toBe(true)
    const loaded = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob
    expect(loaded.type).toBe('video/mp4')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:movie')
  })

  it('in Firefox, does not load another file once one has played', async () => {
    useBrowser(FIREFOX)
    const first = canPlayQuickTime(movie())
    videos[0].videoWidth = 1280
    videos[0].onloadeddata()
    await first

    await expect(canPlayQuickTime(movie())).resolves.toBe(true)
    expect(videos).toHaveLength(1)
  })

  it('in Firefox, is false when the file stalls without an error, and checks the next file again', async () => {
    useBrowser(FIREFOX)
    const result = canPlayQuickTime(movie())
    jest.advanceTimersByTime(3000)

    await expect(result).resolves.toBe(false)
    canPlayQuickTime(movie())
    expect(videos).toHaveLength(2)
  })

  it('in Firefox, is false when the file loads without a picture', async () => {
    useBrowser(FIREFOX)
    const result = canPlayQuickTime(movie())
    videos[0].onloadeddata()

    await expect(result).resolves.toBe(false)
  })

  it('in Firefox, is false when the file fails to load', async () => {
    useBrowser(FIREFOX)
    const result = canPlayQuickTime(movie())
    videos[0].onerror()

    await expect(result).resolves.toBe(false)
  })
})
