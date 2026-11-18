import { planMediaImage } from './resizeImage'

// Images sent as media go at most 1600 px on their long edge, as JPEG; a wide screenshot was cut
// to 1280 px and a phone screenshot to 1080 px tall, which made their text unreadable.

const KB = 1024

describe('planMediaImage', () => {
  it('scales a wide laptop screenshot to 1600 px wide', () => {
    expect(planMediaImage(2880, 1800, 'image/png', 900 * KB)).toEqual({ width: 1600, height: 1000, encode: true })
  })

  it('scales a tall phone screenshot to 1600 px tall', () => {
    expect(planMediaImage(1170, 2532, 'image/png', 700 * KB)).toEqual({ width: 739, height: 1600, encode: true })
  })

  it('sends a compact JPEG that already fits as it is', () => {
    expect(planMediaImage(1200, 900, 'image/jpeg', 250 * KB)).toEqual({ width: 1200, height: 900, encode: false })
    expect(planMediaImage(1600, 1200, 'image/jpeg', 900 * KB)).toEqual({ width: 1600, height: 1200, encode: false })
  })

  it('encodes a JPEG that fits but is barely compressed', () => {
    // 1 MB for 1200×900 is about 7.8 bits per pixel.
    expect(planMediaImage(1200, 900, 'image/jpeg', 1024 * KB)).toEqual({ width: 1200, height: 900, encode: true })
  })

  it('encodes a PNG that already fits, as JPEG, without making it bigger', () => {
    expect(planMediaImage(800, 600, 'image/png', 50 * KB)).toEqual({ width: 800, height: 600, encode: true })
  })

  it('scales a large compact JPEG down', () => {
    expect(planMediaImage(4032, 3024, 'image/jpeg', 2 * 1024 * KB)).toEqual({ width: 1600, height: 1200, encode: true })
  })
})
