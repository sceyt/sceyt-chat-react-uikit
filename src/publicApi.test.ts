/**
 * Public API contract for sceyt-chat-react-uikit.
 *
 * Every name exported from src/index.tsx is part of what apps (e.g. WAAFI Web)
 * import. Renaming or removing one is a breaking change. If this snapshot
 * changes, the change must be intentional: update it with
 * `yarn test:unit -u src/publicApi.test.ts` and call it out in the PR and changelog.
 */
import * as uikit from './index'

const describeExport = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'function') return 'function'
  if (typeof value === 'object') {
    // React.memo / forwardRef components are objects with $$typeof
    const tag = (value as any).$$typeof
    if (tag) return `react:${String(tag.toString()).replace(/^Symbol\(|\)$/g, '')}`
    return 'object'
  }
  return typeof value
}

describe('public API', () => {
  it('exports the same names with the same kinds', () => {
    const shape = Object.keys(uikit)
      .sort()
      .reduce<Record<string, string>>((acc, name) => {
        acc[name] = describeExport((uikit as any)[name])
        return acc
      }, {})

    expect(shape).toMatchSnapshot()
  })
})
