# Test plan — Forward opens destination at latest + stable chat order + reorder animation

_Branch: `uikit-testing` (uncommitted changes, reviewed 2026-10-03)_

## 1. What changed

| Area | Files | Change |
|---|---|---|
| Forward → navigate | `common/popups/forwardMessage/index.tsx` | After forwarding to **one** chat that isn't the active one, dispatch `switchChannelActionAC(channel, true, openAtLatest=true)`. `handleForward` may now return `false` / a Promise; popup awaits it. New prop `navigateOnSingleForward` (default `true`). |
| Opt-outs | `inviteLink/InviteLinkModal.tsx`, `sliderPopup/index.tsx` | Invite sharing passes `navigateOnSingleForward={false}`; slider's `handleForward` returns `true/false`. |
| Open at latest | `store/channel/{actions,reducers,saga,selector}.ts` | New `activeChannelOpenAtLatest` flag. `switchChannel` skips unread-scroll when `openAtLatest`. Flag is kept when the same channel is re-set without the flag; reset on switching to another channel. |
| Message list boot | `MessageList/index.tsx`, `useChatController.ts` | With `openAtLatest`, boot loads the latest window (not near-unread). While that load runs (`openAtLatest && isNextLoading`) the view is treated as "at latest". |
| Stable chat order | `store/message/saga.ts` | `shouldMoveChannelOnConfirm`: when a send/forward is confirmed and the chat preview was its own pending message, don't move the chat again (it already moved when the pending message was added). Resend still moves. `forwardMessage` now reads the active channel live (`getActiveChannelId()`) instead of once at start. |
| Reorder animation | `ChannelList/index.tsx`, `ChannelList/useChannelReorderAnimation.ts` | Rows wrapped in `ChannelRow` (`data-channel-row-id`, solid background); FLIP animation (240 ms, WAAPI) when order changes; skipped for reduced motion, off-screen rows, hidden list. |

## 2. Review findings (fix or decide before merge)

| # | Severity | Finding | Where |
|---|---|---|---|
| F1 | ✅ Fixed — **Blocker** | 2 existing tests fail: `forwards without a note on Enter…` and `forwards the typed note on Enter…`. `handleForwardMessage` is now async, so `togglePopup` runs after an `await`; the tests assert synchronously. The pre-push hook and CI will both fail. | `forwardMessage/index.test.tsx:453, :512` |
| F2 | ✅ Fixed — High | **Double forward.** While `await handleForward(...)` is pending the popup stays open and the Forward button / Enter still work — a second press forwards again (and may dispatch a second switch). Also, if `handleForward` **rejects**, `togglePopup` is never called (popup stuck) and the rejection is unhandled. Needs an in-flight guard + `try/finally`. | `forwardMessage/index.tsx` `handleForwardMessage` |
| F3 | ✅ Confirmed & fixed — Medium | **`openAtLatest` is sticky for the whole channel visit.** `keepLatestWhileOpening = openAtLatest && isNextLoading` is also true for any *later* "load next" — e.g. jump to a reply / search result far up, then scroll down. The view would report "at latest" while it isn't (scroll-to-bottom button / new-message counter / auto-stick wrong). Suggest clearing the flag after the first latest-window load completes. Verify with a test first. | `useChatController.ts`, `channel/reducers.ts` |
| F4 | Medium | **Breaking for custom `ListItem` users.** Every row is now wrapped in a `div` with `position: relative` and a forced solid `background-color`; `ChannelsList` became `position: relative`. Custom items with transparent/rounded/gradient backgrounds, margins between items, or absolutely-positioned overlays can render differently. Needs a changelog note at least. | `ChannelList/index.tsx` |
| F5 | Low | On confirm the Redux list no longer moves, but `updateChannelLastMessageOnAllChannels` still moves the chat to the top of the helper `allChannels` list → the two orders can diverge. | `message/saga.ts` + `channelHalper` |
| F6 | Product | Forwarding from **message selection mode** (`SendMessageInput`) and from a single message (`MessagePopups`) now navigates by default. Confirm that's wanted, and that selection mode is cleared in the source chat. | callers of `ForwardMessagePopup` |
| F7 | Check | Ordering race: the forward saga adds the pending message, then the popup switches channel (`removeAllMessages` + load latest). The forwarded message must be visible once (pending → sent) in the destination, never missing until refresh and never duplicated. | `message/saga.ts`, `channel/saga.ts` |

## 3. What the branch already tests (all passing except F1)

- `useChannelReorderAnimation.test.tsx` — 5 tests: sort moves rows, no re-measure on same array, reduced motion, new chat on top, consecutive reorders.
- `forwardMessage/index.test.tsx` — 6 new: single → opens destination, several → stays, waits for async forward, `false` → no navigation, invite opt-out, already-active → no switch.
- `useChatController.test.tsx` / `MessageList.test.tsx` — 3 new: open-at-latest boot with unread history, scroll to forwarded message after first load, two messages during first load.
- `channel/reducers.test.ts`, `channel/saga.test.ts` — flag survives same-channel updates, clears on switch; switch skips unread restore.
- `message/saga.test.ts` — confirm after switching; list order stable for multi-chat forward.

## 4. Automated tests to add

### Unit — store / sagas
| ID | Test | Type |
|---|---|---|
| S1 | `shouldMoveChannelOnConfirm` table: pending preview + same tid → no move; preview is a *different* message (incoming arrived meanwhile) → move; preview FAILED → move; `RESEND_MESSAGE` → always move; no preview → move | unit |
| S2 | `sendMessage` (attachment) and `sendTextMessage` confirm: `updateChannelDataAC(..., moveUp=false)` when confirming own pending preview | saga |
| S3 | `forwardMessage`: active channel changes **during** the forward (switch dispatched mid-saga) → `updateMessageAC` targets the new active channel; no update for a channel that is no longer active | saga |
| S4 | `setActiveChannel` matrix: other channel w/o flag → `false`; same channel w/o flag → keeps; same channel with `false` → `false`; `{}` (clear) → `false` | reducer |
| S5 | F5: after a confirm with `moveUp=false`, Redux `channels` order equals `getAllChannels()` order (expected to **fail** today → decide) | integration |

### Component — Forward popup
| ID | Test |
|---|---|
| P1 | Fix F1: the two Enter tests `await waitFor(() => expect(togglePopup).toHaveBeenCalledTimes(1))` |
| P2 | F2: `handleForward` returns a never-resolving promise → press Forward twice + Enter → `handleForward` called **once**; button disabled/spinner while pending |
| P3 | F2: `handleForward` rejects → popup closes (or shows error), no unhandled rejection, no navigation |
| P4 | `navigateOnSingleForward={false}` from slider/invite → no `SWITCH_CHANNEL` |
| P5 | Single selected *direct* chat and single selected *group* → switches with `openAtLatest=true` and the selected channel object |
| P6 | Selection-mode forward (`SendMessageInput`): after navigate, source chat selection is cleared (F6) |

### Component — Message list / controller
| ID | Test |
|---|---|
| L1 | F3: open at latest → jump to an old message (reply/search) → scroll down triggers `loadNext` → `isViewingLatest` must be **false** while not at latest; scroll-to-bottom button visible (expected to **fail** if F3 is real) |
| L2 | Open at latest with `newMessageCount > 0`: unread separator not auto-scrolled to; unread count/markers still correct (messages marked read only when seen) |
| L3 | Forwarded pending message appears exactly once in the destination, then turns to sent (F7) |
| L4 | Normal channel click (no flag) still opens near unread — regression guard |

### Component — Channel list
| ID | Test |
|---|---|
| C1 | Rows render inside `[data-channel-row-id]` wrappers in channel order; custom `ListItem` receives the same props (no `key` prop leakage) |
| C2 | Reorder while list is scrolled: only rows inside the viewport animate |
| C3 | Unmount during an animation cancels it (no WAAPI callbacks after unmount) |
| C4 | No `Element.animate` (old browsers / jsdom) → no crash, no animation |

## 5. Manual QA checklist (demo app, 2 accounts)

**Forward + navigation**
- [ ] Forward one message to one other chat → opens that chat at its **newest** message, forwarded message visible once, list not jumping.
- [ ] Same, destination has 50+ unread → still opens at newest; unread badge clears only as messages are seen.
- [ ] Forward to 3 chats → stays in current chat; the 3 chats rise to the top once and keep their order when confirmations arrive.
- [ ] Forward to the chat you are already in → no reload/flicker.
- [ ] Forward with a note (+ mention) → note sent after the message in the destination.
- [ ] Double-click Forward / Enter twice quickly → forwarded once (F2).
- [ ] Forward while offline → destination opens, message pending; reconnect → sent, not duplicated.
- [ ] Forward from media slider → stays in slider context (no navigation); from invite link "Share invite" → no navigation.
- [ ] Forward from multi-select (selection mode) → navigation + selection cleared in source chat (F6).
- [ ] After opening via forward: click a reply quote far up, scroll back down → scroll-to-bottom button and new-message counter behave normally (F3).

**Chat list**
- [ ] Incoming message in a lower chat → row slides to top (~240 ms), no flash/overlap; pinned chats stay on top.
- [ ] Several chats reorder at once (burst of incoming) → no stuck offsets after animations.
- [ ] OS "reduce motion" on → instant reorder.
- [ ] List scrolled down; chat below viewport moves to top → appears at top, no animation across the screen.
- [ ] Custom `ListItem` (messenger demo) + light/dark theme → backgrounds, hover, selected state, rounded corners unchanged (F4).
- [ ] 300+ chats: scrolling and typing indicators stay smooth (no layout thrash).

**Regression**
- [ ] Normal click into a chat with unread → opens near the unread separator (unchanged).
- [ ] Send / resend a failed message → failed chat moves to top on resend.

## 6. Exit criteria
- F1 fixed; `yarn test:all`, `yarn test:lint`, `yarn test:coverage` green locally and in CI.
- F2 fixed with P2/P3 passing. F3 confirmed or ruled out by L1.
- F4 decision recorded (changelog note or opt-out prop). F6 confirmed with product.
- Manual checklist done on Chrome + Safari (WAAPI + `prefers-reduced-motion`).

## 7. Status (2026-10-03)
- **F1** fixed: the two Enter tests now wait for the popup to close.
- **F2** fixed in `forwardMessage/index.tsx`: in-flight guard (ref + state), Forward button disabled while pending, rejection caught → popup closes, no navigation. Tests P2/P3 pass and fail on the previous version.
- **F3** confirmed by L1 (`useChatController.test.tsx` › "openAtLatest after the first load") and fixed: "keep at latest" now only applies until the first latest-window load of the visit has settled.
- **C2 / C3** were not bugs: rows entering the viewport are meant to slide in; animations *are* cancelled on unmount (React 18 runs the cleanup asynchronously). Tests rewritten to assert the real behavior.
- Still open: F4 (custom `ListItem` wrapper — decision), F5 (helper list order), F6 (product), S1–S5, P4–P6, L2–L4, C1, manual QA.
