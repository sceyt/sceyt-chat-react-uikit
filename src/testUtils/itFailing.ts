/**
 * Helper for Jest 27 which doesn't have native it.failing.
 * Runs the test and passes ONLY if it throws an error.
 * If the test passes without error, it fails with a message to convert to a normal test.
 */
export const itFailing = (name: string, fn: () => void | Promise<void>) => {
  it(name, async () => {
    let testPassed = false
    try {
      await fn()
      testPassed = true
    } catch {
      // Test failed as expected - this is what we want for itFailing
      return
    }
    if (testPassed) {
      throw new Error('Bug fixed - convert to a normal test')
    }
  })
}
