const MOCK_SERVER_DELAY_MIN_MS = 10
const MOCK_SERVER_DELAY_MAX_MS = 400
const MOCK_SERVER_DELAY_RANGE = MOCK_SERVER_DELAY_MAX_MS - MOCK_SERVER_DELAY_MIN_MS + 1
const DEFAULT_MOCK_SERVER_DELAY_SEED = 20260403

let delaySeed = DEFAULT_MOCK_SERVER_DELAY_SEED >>> 0

export const resetMockServerDelay = (seed = DEFAULT_MOCK_SERVER_DELAY_SEED) => {
  delaySeed = seed >>> 0
}

export const nextMockServerDelayMs = () => {
  delaySeed = (delaySeed * 1664525 + 1013904223) >>> 0
  return MOCK_SERVER_DELAY_MIN_MS + (delaySeed % MOCK_SERVER_DELAY_RANGE)
}

export const resolveWithMockServerDelay = <T>(value: T, delayMs = nextMockServerDelayMs()) =>
  new Promise<T>((resolve) => {
    setTimeout(() => resolve(value), delayMs)
  })

export const rejectWithMockServerDelay = <T = never>(error: unknown, delayMs = nextMockServerDelayMs()) =>
  new Promise<T>((_resolve, reject) => {
    setTimeout(() => reject(error), delayMs)
  })

export { DEFAULT_MOCK_SERVER_DELAY_SEED, MOCK_SERVER_DELAY_MAX_MS, MOCK_SERVER_DELAY_MIN_MS }
