## What changed

<!-- One or two sentences. Link the WAAF ticket. -->

Jira: WAAF-

## Type

- [ ] Fix
- [ ] Feature
- [ ] Refactor / chore
- [ ] Tests only

## Test that covers it

<!-- Name the test file(s) and what they check. A fix must include a test that fails before the fix and passes after it.
     Pure styling with nothing to assert? Add the `no-test-needed` label and say why here. -->

## Screenshots (UI changes)

| Light | Dark |
| ----- | ---- |
|       |      |

## Compatibility

- [ ] No public API change (exports from `src/index.tsx`, component props)
- [ ] Public API changed: updated `src/__snapshots__/publicApi.test.ts.snap` and described it in the changelog
- [ ] Requires a different chat SDK (sceyt-chat) version: `x.y.z`

## Checklist

- [ ] PR is small (aim for under 400 changed lines) or behind a flag
- [ ] Relevant `test-plans/` checked for the changed area
- [ ] CI is green
