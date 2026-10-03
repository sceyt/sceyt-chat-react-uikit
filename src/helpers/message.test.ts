import { trimMessageBodyWithAttributes } from './message'
import { IBodyAttribute } from '../types'

const bold = (offset: number, length: number): IBodyAttribute => ({ type: 'bold', metadata: '', offset, length })

describe('trimMessageBodyWithAttributes', () => {
  it('shifts attribute offsets when leading whitespace is trimmed (paste from Notes)', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('\nHello', [bold(1, 5)])
    expect(body).toBe('Hello')
    expect(bodyAttributes).toEqual([bold(0, 5)])
  })

  it('keeps attributes unchanged when there is no surrounding whitespace', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('Hello world', [bold(0, 5)])
    expect(body).toBe('Hello world')
    expect(bodyAttributes).toEqual([bold(0, 5)])
  })

  it('shifts and clips an attribute covering the whole text including surrounding whitespace', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('  Hello  ', [bold(0, 9)])
    expect(body).toBe('Hello')
    expect(bodyAttributes).toEqual([bold(0, 5)])
  })

  it('clips an attribute running into trimmed trailing whitespace', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('Hello \n', [bold(0, 7)])
    expect(body).toBe('Hello')
    expect(bodyAttributes).toEqual([bold(0, 5)])
  })

  it('drops attributes located entirely inside trimmed whitespace', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('  Hello  ', [bold(0, 2), bold(7, 2)])
    expect(body).toBe('Hello')
    expect(bodyAttributes).toEqual([])
  })

  it('shifts mention attributes the same way and preserves metadata', () => {
    const mention: IBodyAttribute = { type: 'mention', metadata: 'user-1', offset: 3, length: 6 }
    const { body, bodyAttributes } = trimMessageBodyWithAttributes(' \nhi @user1', [mention])
    expect(body).toBe('hi @user1')
    expect(bodyAttributes).toEqual([{ type: 'mention', metadata: 'user-1', offset: 1, length: 6 }])
  })

  it('returns empty attributes for empty or missing input', () => {
    expect(trimMessageBodyWithAttributes('  ', [bold(0, 1)])).toEqual({ body: '', bodyAttributes: [] })
    expect(trimMessageBodyWithAttributes('Hello', undefined as unknown as IBodyAttribute[])).toEqual({
      body: 'Hello',
      bodyAttributes: []
    })
  })
})
