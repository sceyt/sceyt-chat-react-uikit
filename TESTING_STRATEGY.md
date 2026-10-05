# Testing Strategy — sceyt-chat-react-uikit

_Last updated: 2026-10-02 · Baseline measured on branch HEAD `23f17943`_

## 1. Where we are today

**Stack:** Jest (via `react-scripts` 5) + jsdom, `@testing-library/react` 9, `redux-saga`'s `runSaga` for saga tests. Global DOM shims (IntersectionObserver, rects, scroll, rAF, ffmpeg) live in `src/setupTests.ts`; fixtures in `src/testUtils/` (`messageFixtures`, `messageListHarness`, `mockServerDelay`).

**Inventory:** 54 test files, ~28k lines. Heavily concentrated on the message pipeline:

| Area | Test lines | Notes |
|---|---|---|
| `MessageList` + `useChatController` | ~10,250 | Scroll anchoring, pagination, jump-to-message |
| `store/message` (saga, reducers, upload recovery, delivery sync) | ~7,900 | Strongest area |
| `store/evetns` | ~1,300 | Only ~23% of handler code exercised |
| `store/channel` saga | ~1,260 | Reducers have 2 tests |
| Media helpers (download coordinator, blob URLs, video frame/preview) | ~2,000 | Good, 90%+ on most |
| Everything else (ChannelList, ChannelDetails, popups, members, users, pins saga) | ~0 | See gaps |

**Measured coverage — `src/store` + `src/helpers` only** (344 tests, all passing):

| Module | Lines | Branches |
|---|---|---|
| store/message | 63% | 54% |
| helpers/messagesHalper | 81% | 66% |
| helpers/channelHalper | 54% | 37% |
| store/pinned (reducers 84%, **saga 0%**) | 32% | 19% |
| store/channel (**reducers 18%**, saga 21%) | 29% | 21% |
| store/evetns | 23% | 26% |
| store/user (**saga 0%**) | 23% | 0% |
| store/member (**saga 0%, reducers 5%**) | 15% | 0% |
| helpers/index.tsx, message.tsx, notifications, messagesIdb, resizeImage | 9–25% | <25% |
| **All store + helpers** | **45%** | **38%** |

> Component-level coverage wasn't measured here (full run exceeds a 3-min window). Get the full baseline with:
> `CI=1 NODE_PATH=examples/sceyt-livechat-demo/node_modules npx react-scripts test --env=jsdom --watchAll=false --coverage --collectCoverageFrom='src/**/*.{ts,tsx}' --collectCoverageFrom='!src/**/*.test.*' --collectCoverageFrom='!src/testUtils/**'`

**Infra observations**

- `.githooks/pre-push` runs `yarn test:all` — good, but it's opt-in per clone (`git config core.hooksPath .githooks`) and there's **no CI** for this repo (`.travis.yml` targets Node 10/12, which can't run this toolchain).
- No coverage thresholds configured, so coverage can silently regress.
- `@testing-library/react@9` / `jest-dom@4` are very old and need the ReactDOM 18 shim in `setupTests.ts`. Works, but it's fragile.
- No E2E, visual regression, or accessibility checks.

## 2. Target pyramid for a UI kit

A UI kit is consumed by other apps, so "correct" means: the state layer never corrupts data, the components render what the state says, and the public API doesn't break. E2E is the thinnest layer.

```
            E2E (Playwright vs. examples/sceyt-livechat-demo)    ~10 flows
        Component / interaction (RTL + real store + fake client)  per component
   Unit: reducers, sagas (runSaga), helpers, event handlers       the bulk
```

| Layer | What it covers | Tooling | Speed budget |
|---|---|---|---|
| Unit — pure helpers | ordering, caches, formatting, linkify, permissions | Jest | < 5 ms/test |
| Unit — reducers | every action type: state in → state out | Jest | < 5 ms/test |
| Unit — sagas | side effects vs. a fake `SceytChatClient`, dispatched actions, error paths, offline/reconnect | `runSaga` + fake client | < 50 ms/test |
| Integration — events | SDK event → `store/evetns` handler → reducers → selector output | real store + fake client emitting events | < 100 ms/test |
| Component | rendering, user interactions, theme/custom-render props, a11y roles | RTL + `messageListHarness` pattern | < 300 ms/test |
| Contract | public exports of `src/index.tsx` and prop types don't change by accident | Jest snapshot of export names + `tsc` on `dist/index.d.ts` | one test |
| E2E | real browser flows against the demo app with a mocked/sandbox backend | Playwright | ≤ 5 min total |
| A11y | axe on key components | `jest-axe` | — |

## 3. Priorities — what to test next

Ranked by (risk of user-visible bug × how cheap the test is).

### P0 — data integrity in the state layer (do first)

1. **`store/evetns` handlers — currently 23%.** 39 event cases; real-time events are where ordering/duplication bugs show up.
   Write one table-driven test per event type: given store state + event payload → expected dispatched actions.
   Must-have cases: `MESSAGE` for active vs. inactive channel (unread count, lastMessage); `MESSAGE` duplicate of a self-sent pending message (dedupe by `tid`); `EDIT_MESSAGE` / `DELETE_MESSAGE` for a message not in cache; `MESSAGE_MARKERS_RECEIVED` out of order (delivered after read must not downgrade); `CLEAR_HISTORY`; `KICK_MEMBERS` / `LEAVE` where the user is self (channel removed, active channel switched); `CONNECTION_STATUS_CHANGED` → reconnect triggers resends.
2. **`store/channel/reducers.ts` — 18%, 2 tests.** Each action type, especially list ordering after `updateChannel`, pin/unpin, hide/unhide, unread counts, search results staying in sync with main list.
3. **`store/pinned/saga.ts` — 0%.** Has an offline mutation queue (`queueMutation`, `resendPendingPinMutations`) — exactly the kind of logic that breaks silently. Cases: pin while offline → queued → reconnect → sent once; pin then unpin before reconnect → net no-op; server error → state rolled back; `applyPinnedMessagesEvent` from another device.
4. **`store/member` & `store/user` sagas — 0%.** Add/kick/block/role change: success updates store, failure surfaces error and doesn't mutate; pagination (`loadMoreMembers`, `loadMoreUsers`) doesn't duplicate or drop; block/unblock reflected in channel list + member list.
5. **`helpers/channelHalper` — 54%.** `setChannelsInMap`, `updateChannelMemberInAllChannels`, `getLastChannelFromMap(deletePending)` have no direct tests.

### P1 — persistence & helpers

6. **`helpers/messagesIdb.ts` — 25%.** Use `fake-indexeddb`. Persist → restore round-trip, schema/version mismatch, quota error is swallowed, drafts per channel isolated.
7. **`helpers/index.tsx` / `message.tsx` — ~10–20%.** Formatting (dates, sizes, durations), `checkArraysEqual`, mention/body parsing. Cheap table tests.
8. **`helpers/notifications.ts` — 15%.** Permission denied/granted/default, no notification for active+focused channel, muted channel.
9. **`messageUtils` linkify.** Already tested; add: only `http(s)` hrefs ever rendered (no `javascript:`), trailing punctuation, bare domains upgraded to https, invite links don't get `href`.

### P2 — components with zero tests

10. **`ChannelList`** (1,141 lines): renders from store, sorting, search, unread badge, infinite scroll trigger, custom `renderChannel` prop honored.
11. **`ChannelDetails` / `Actions`** (~1,900 lines): permission-gated actions (`usePermissions`) — owner vs. member vs. admin see the right buttons; destructive actions require confirm.
12. **`MessagesSearch`, `ChatHeader`, `Message/MessageActions`, `MessageBody`**: interaction tests (edit, reply, forward, copy, delete-for-me vs. everyone).
13. **Popups**: `createChannel`, `users`, `messageInfo`, `inviteLink`, `pollMessage`. Validation + submit dispatches the right action.
14. **`SendMessageInput` plugins**: `MentionsPlugin`, `FloatingTextFormatToolbarPlugin`, `EmojisPlugin`, `CreatePollPopup`.

### P3 — new layers

15. **Public API contract test** — snapshot `Object.keys(require('./index'))`; fails if an export disappears.
16. **Playwright E2E** against `examples/sceyt-livechat-demo` with a stubbed SDK: send text, send attachment, reply, react, edit, delete, jump to unread, open channel details, reconnect after offline.
17. **`jest-axe`** on SendMessageInput, MessageList, ChannelList, popups (focus trap, `aria-label`s on icon buttons).

### Skip

`Emojis/emojis.ts` (data), styled-component files, `UIHelper/constants.ts`, `types/`, theme reducer (33 lines), thumbhash vendor code, `audioConversion`/`videoConversion` internals (ffmpeg — test the wrapper contract only).

## 4. Coverage targets

Measure on `src/store` and `src/helpers` first — that's where bugs corrupt data. Components get behavior-based tests, not a percentage chase.

| Scope | Now (lines/branches) | Next 4 weeks | Steady state |
|---|---|---|---|
| store/message, helpers/messagesHalper | 63–81% / 54–66% | hold | 85% / 75% |
| store/channel, store/evetns | 23–29% / 21–26% | 60% / 50% | 80% / 70% |
| store/pinned, member, user sagas | 0% | 70% / 60% | 80% / 70% |
| helpers/* overall | 36% / 25% | 55% / 40% | 70% / 60% |
| Components | not measured | every component in P2 has ≥1 render + main-interaction test | — |

Enforce with a ratchet in `package.json` so numbers can only go up:

```json
"jest": {
  "coverageThreshold": {
    "./src/store/message/": { "lines": 60, "branches": 50 },
    "./src/helpers/messagesHalper/": { "lines": 78, "branches": 62 },
    "./src/store/channel/": { "lines": 25, "branches": 18 },
    "./src/store/evetns/": { "lines": 20, "branches": 22 }
  }
}
```

(Raise each value when the corresponding P0 work lands.)

## 5. Conventions

- **Co-locate** tests as `*.test.ts(x)` next to the source (already the convention).
- **Fixtures:** always use `src/testUtils/messageFixtures` (`makeUser`, `makeChannel`, `makeMessage`, `makePendingMessage`); add `makeMember`, `makeReaction`, `makePoll` there rather than inline objects. Call `resetMessageListFixtureIds()` in `beforeEach` when IDs matter.
- **Sagas:** use `runSaga` with a recorded `dispatch` and a stub `getState` (pattern in `store/channel/saga.test.ts`). Assert on dispatched actions, not on generator `.next()` steps — step tests break on harmless refactors.
- **Fake client:** extract the ad-hoc client mocks into `src/testUtils/fakeClient.ts` (channels, members, message queries, `emit(event)`) so events/sagas/components share one fake.
- **IDs:** message IDs are 64-bit snowflakes — use values > `Number.MAX_SAFE_INTEGER` in ordering tests (see `messagesHalper/ordering.test.ts`).
- **Module-level maps** (`messagesMap`, `channelsMap`, `activeSegment`): reset in `beforeEach` (`clearMessagesMap()`, `destroyChannelsMap()`, `clearActiveSegment()`), or tests leak state into each other.
- **Time:** `jest.useFakeTimers()` for debounce/batching (marker batcher, typing, presence); never real `setTimeout` waits.
- **Components:** query by role/label/text, not by styled-component class names.

## 6. Example test cases

### Event handler (P0-1)

```ts
it('MESSAGE for a non-active channel bumps unread count and lastMessage only', async () => {
  const active = makeChannel({ id: 'active' })
  const other = makeChannel({ id: 'other', newMessageCount: 2 })
  const msg = makeMessage({ id: '9000000000000000001', incoming: true })
  const actions = await emitEvent(CHANNEL_EVENT_TYPES.MESSAGE, { channel: other, message: msg }, { activeChannel: active })
  expect(actions).toContainEqual(expect.objectContaining({ type: UPDATE_CHANNEL_DATA,
    payload: expect.objectContaining({ channelId: 'other', config: expect.objectContaining({ newMessageCount: 3, lastMessage: msg }) }) }))
  expect(actions).not.toContainEqual(expect.objectContaining({ type: ADD_MESSAGE }))
})

it('MESSAGE_MARKERS_RECEIVED: a late "delivered" never downgrades a "read" message', …)
it('MESSAGE echo of own pending message (same tid) replaces it instead of duplicating', …)
```

### Pinned saga offline queue (P0-3)

```ts
it('pin then unpin while offline sends nothing on reconnect', async () => {
  setConnection(DISCONNECTED)
  await run(pinMessage, pinMessageAC('ch', '42'))
  await run(unpinMessage, unpinMessageAC('ch', '42'))
  setConnection(CONNECTED)
  await run(resendPendingPinMutations)
  expect(fakeClient.pinMessage).not.toHaveBeenCalled()
  expect(fakeClient.unpinMessage).not.toHaveBeenCalled()
})
```

### Member saga error path (P0-4)

```ts
it('kickMember failure leaves the member list untouched and reports the error', async () => {
  fakeChannel.kickMembers.mockRejectedValue(new Error('forbidden'))
  const actions = await run(kickMemberFromChannel, kickMemberAC('ch', 'u1'))
  expect(actions.map((a) => a.type)).not.toContain(REMOVE_MEMBER_FROM_LIST)
})
```

### Component permission gating (P2-11)

```tsx
it.each([
  ['owner', true], ['admin', true], ['participant', false]
])('%s sees "Delete channel": %s', (role, visible) => {
  renderWithStore(<Actions channel={makeChannel({ userRole: role })} />)
  expect(!!screen.queryByText(/delete channel/i)).toBe(visible)
})
```

### Already landed

`src/helpers/messagesHalper/ordering.test.ts` — 14 tests covering `compareMessageIds` (64-bit precision, numeric vs. lexical), `compareMessagesForList`, `messagesShareReference`, `shouldReplaceLastMessage` (pending → confirmed, out-of-order events), `getClosestConfirmedMessageId`. Use it as the template for P0/P1 helper tests.

## 7. Infra roadmap

1. **CI:** replace `.travis.yml` with a GitHub Actions workflow (Node 18): `yarn install --frozen-lockfile` → `yarn test:lint` → `yarn test:all --coverage` → `yarn build`. Upload the coverage summary as a PR comment.
2. **Ratchet thresholds** (section 4) in `package.json`.
3. **Shard the suite** (`--shard=1/3`) once it passes ~5 min; the `MessageList`/`useChatController` files are the long pole.
4. **Upgrade** `@testing-library/react` → 14+, `jest-dom` → 6, `user-event` → 14. That removes most of the ReactDOM shim in `setupTests.ts`.
5. **Flake policy:** a flaky test gets fixed or quarantined (`it.skip` + issue link) within a day. No retries in CI.
6. **Make the pre-push hook automatic** with a `postinstall` that runs `git config core.hooksPath .githooks`, or rely on CI instead.
