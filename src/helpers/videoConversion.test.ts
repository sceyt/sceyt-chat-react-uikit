import * as videoContainer from './videoContainer'
import { ensurePlayableVideoBlob } from './videoConversion'

const mockInitFFmpeg = jest.fn()

jest.mock('./audioConversion', () => ({
  initFFmpeg: () => mockInitFFmpeg(),
  beginFFmpegOp: () => undefined,
  endFFmpegOp: () => undefined
}))

jest.mock('@ffmpeg/util', () => ({
  fetchFile: async () => new Uint8Array([1])
}))

const FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0'

describe('ensurePlayableVideoBlob', () => {
  const movie = new Blob(['quicktime'], { type: 'video/quicktime' })

  beforeEach(() => {
    mockInitFFmpeg.mockResolvedValue({
      writeFile: jest.fn(),
      exec: jest.fn(),
      readFile: jest.fn(async () => new Uint8Array([1, 2, 3])),
      deleteFile: jest.fn()
    })
    jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(FIREFOX)
    jest
      .spyOn(videoContainer, 'inspectVideoBlob')
      .mockResolvedValue({ mimeType: 'video/mp4', isoBrand: 'qt  ', codecs: [] })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('keeps a QuickTime video that Firefox plays, without converting it', async () => {
    jest.spyOn(videoContainer, 'canPlayQuickTime').mockResolvedValue(true)

    const playable = await ensurePlayableVideoBlob(movie)

    expect(playable === movie).toBe(true)
    expect(mockInitFFmpeg).not.toHaveBeenCalled()
  })

  it('converts a QuickTime video that Firefox does not play to MP4', async () => {
    jest.spyOn(videoContainer, 'canPlayQuickTime').mockResolvedValue(false)

    const playable = await ensurePlayableVideoBlob(movie)

    expect(playable.type).toBe('video/mp4')
    expect(mockInitFFmpeg).toHaveBeenCalledTimes(1)
  })
})
