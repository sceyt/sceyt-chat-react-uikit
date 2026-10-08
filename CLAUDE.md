# CLAUDE.md — sceyt-chat-react-uikit

React 18 UI kit for Sceyt Chat, published to npm as `sceyt-chat-react-uikit` and used by WAAFI Web and other customer apps.
Stack: TypeScript, Redux Toolkit + redux-saga, styled-components, Lexical editor, IndexedDB caching. Built with microbundle-crl.

## Commands

```bash
yarn install                      # Node 22 (see .nvmrc)
yarn test:lint                    # ESLint (standard + prettier)
yarn test:all                     # full Jest suite (needs examples/sceyt-livechat-demo deps installed)
yarn test:coverage                # same + per-file coverage thresholds (what CI runs)
yarn test:message-list            # fast subset for the message pipeline
yarn build                        # microbundle → dist/
```

Run one test file:
```bash
CI=1 NODE_PATH=examples/sceyt-livechat-demo/node_modules npx react-scripts test --env=jsdom --watchAll=false src/path/to/file.test.ts
```
Tests resolve react/react-dom from `examples/sceyt-livechat-demo/node_modules`, so run `yarn install` there once.

## Layout

- `src/index.tsx` — public API (`components` + `messageUtils`). Anything exported here is used by customers; don't rename or remove without a deliberate breaking change.
- `src/components/` — UI (Channel, ChannelList, Messages/MessageList, Message, SendMessageInput, ChannelDetails, …)
- `src/store/` — Redux slices and sagas per domain: `message`, `channel`, `member`, `user`, `pinned`, `theme`; real-time SDK events in `store/evetns/inedx.ts` (typos are the real file names)
- `src/helpers/` — caches and utilities (`messagesHalper`, `channelHalper`, `messagesIdb` IndexedDB, media helpers)
- `src/testUtils/` — fixtures (`messageFixtures`), `messageListHarness`, `eventHarness`, `mockServerDelay`
- `test-plans/` — manual QA plans for risky flows

## Known fragile areas (most regressions come from here)

1. **Message state lives in 4 places**: Redux `activeChannelMessages`, module-level cache in `helpers/messagesHalper` (`messagesMap`, `activeSegment`, `loadedSegmentsMap`), IndexedDB (`messagesIdb`), and the SDK. Any change to send/receive/edit/delete/reconnect must keep all of them consistent.
2. **`Message` is wrapped in `React.memo` with a custom comparator** (`components/Message/index.tsx`, bottom of file) that checks only listed fields. A new prop or message field that affects rendering must be added there, or the UI won't update.
3. **Offline / reconnect** (pending messages, uploads, pin queue, `resumePendingMessagesAfterReconnect`) is the most repeated bug area in Jira.
4. **Very large files**: `store/message/saga.ts` (~4.9k lines), `SendMessageInput/index.tsx`, `MessageList/useChatController.ts`. Keep changes small and local.
5. `react-hooks/exhaustive-deps` is disabled in `.eslintrc` — check hook dependencies by hand.
6. Module-level mutable state must be reset in tests (`clearMessagesMap()`, `destroyChannelsMap()`, `clearActiveSegment()`) or tests leak into each other.

## Rules for every change

- **Every bug fix includes a regression test** that fails before the fix and passes after. Name it after the Jira ticket, e.g. `it('WAAF-3069 sent message is not shown as pending', …)`.
- Prefer tests that assert behavior: reducers (state in → state out), sagas with `runSaga` + recorded dispatches (not generator `.next()` steps), components via React Testing Library queries by role/text.
- Use fixtures from `src/testUtils/messageFixtures` (`makeUser`, `makeChannel`, `makeMessage`, `makePendingMessage`) instead of inline objects. Message IDs are 64-bit; use values above `Number.MAX_SAFE_INTEGER` in ordering tests.
- Use `jest.useFakeTimers()` for debounce/batching; never wait on real timers.
- Don't lower coverage thresholds in `package.json`; raise them when you add tests.
- No new `any` in `src/store`; don't swallow SDK errors silently in sagas.
- Keep PRs small (aim < 400 changed lines). Refactors and behavior changes go in separate PRs.
- Commit messages: `Fix: …` for fixes, `Feat: …` for features.
- Before finishing: `yarn test:lint` and the relevant tests pass; run `yarn test:coverage` for store/helpers changes.

## CI (GitHub Actions)

- `ci.yml` — lint, tests with coverage, build (Node from `.nvmrc`)
- `security.yml` — CodeQL, dependency review, TruffleHog secret scan
- `claude-review.yml` — AI review on PRs (add label `ai-review` to re-run)
- Dependabot: weekly npm, monthly GitHub Actions

## Publishing

The npm package is published from a separate repo (`sceyt-chat-react-uikit-npm`) by copying `dist/`. Do not publish from here. Note: that repo's `package.json` `files` list must include every folder referenced by the shipped `.d.ts` files.

## Related repos

- `sceyt-chat-js-sdk-source` — chat SDK (`sceyt-chat`); the UIKit receives a client instance from the app
- `sceyt-call-js-sdk-source` — call SDK (`sceyt-call`)
- `waafi/waafiweb/client/waafiweb` — WAAFI Web, the main consumer
- Jira: waafi.atlassian.net, project WAAF
