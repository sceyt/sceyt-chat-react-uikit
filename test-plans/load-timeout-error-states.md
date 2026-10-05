# Plan — "Unable to load" view on request timeout

_Ticket: when the first load of channels, channel-details tabs, or the message list times out, show an
error view with Retry (see design: title, one-line description, Retry button, centered)._

**Decisions:** trigger = **timeout only** (SDK error code `9902`, `REQUEST_TIMEOUT`).
Apps can replace the view with their own via an optional prop.

## 1. What happens today

| Area | Load | On timeout today |
|---|---|---|
| Channel list | `getChannels` saga (`store/channel/saga.ts:437`) | error is logged; `channelsLoadingState` stays **LOADING** → skeleton forever |
| Message list | `loadDefaultMessages` / `loadNearUnread` / `getMessagesQuery` (`store/message/saga.ts`) | error logged; `finally` sets LOADED with no messages → looks like an **empty chat** |
| Details › Members | `getMembers` (`store/member/saga.ts`) | `finally` sets LOADED → looks like **no members** |
| Details › Media / Files / Links / Voice | `getMessageAttachments` (`store/message/saga.ts:3865`) | `finally` sets LOADED → looks like **no media** |

## 2. Design

### 2.1 Shared pieces
- `LOADING_STATE.FAILED = 3` in `helpers/constants.ts`. Existing checks compare to `LOADED` / `LOADING`
  explicitly, so a new value doesn't change them (verify with grep before merging).
- `isRequestTimeoutError(e)` in `helpers/error.ts` → `e?.code === 9902`.
- New component `common/LoadErrorState` (matches the design):
  - props: `title`, `description`, `onRetry`, `retryText = 'Retry'`
  - theme colors via `useColor` (TEXT_PRIMARY title, TEXT_SECONDARY description, SURFACE_1 button)
  - centered in its container, `role="alert"`, Retry is a real `<button>`
- Override prop (optional) on each host component:
  `CustomLoadErrorState?: React.FC<{ title: string; description: string; onRetry: () => void }>`.

### 2.2 Channel list
- `getChannels` catch: `if (isRequestTimeoutError(e)) put(setChannelsLoadingStateAC(FAILED))`.
  Non-timeout errors: set `LOADED` (today they leave LOADING forever — fix that too; flag in PR).
- `ChannelList`: if `channelsLoading === FAILED && channels.length === 0` → render the view
  - title **"Unable to load channels"**, description **"We couldn't load your channels in time. Please try again."**
  - Retry → `getChannelsAC({ filter, limit, sort, search: '', memberCount })` (same as the CONNECTED effect).
  - If channels are already shown (e.g. reconnect), keep the list; no full-screen error.
- `loadMoreChannels` timeout → set `LOADED` so scrolling can try again (no full-screen view).
- Reconnect (CONNECTED) already re-runs `getChannels` → clears the error automatically.

### 2.3 Message list
- New field `MessageReducer.messagesLoadFailedChannelId: string | null` (+ `setMessagesLoadFailedAC`).
  A separate field because the `finally` blocks reset `loadingPrev/Next` and other code depends on that.
- In `loadDefaultMessages`, `loadNearUnread`, `getMessagesQuery` catch: if timeout **and nothing is shown**
  for that channel (no cached/active messages) → `setMessagesLoadFailedAC(channel.id)`.
  Success path and `switchChannel` → clear it (`null`).
- `MessageList`: if `messagesLoadFailedChannelId === channel.id` and no messages → render the view
  - **"Unable to load messages"** / **"We couldn't load messages in time. Please try again."**
  - Retry → re-run the same boot the controller used (default / near-unread / open-at-latest).
    Expose `retryInitialLoad()` from `useChatController` (it already owns the boot branch) instead of
    duplicating that logic in the component.
- Send box stays usable; a newly sent message replaces the error view (messages.length > 0).
- `loadMore` (prev/next) timeouts: no full view; keep current behavior (loading resets to LOADED).

### 2.4 Channel details tabs
- Members: `getMembers` catch → if timeout `setMembersLoadingStateAC(FAILED, channelId)` and skip the
  `finally` reset (move the LOADED put into the success path).
- Media / Files / Links / Voice: `getMessageAttachments` catch → if timeout
  `setAttachmentsLoadingStateAC(FAILED, forPopup)`; same `finally` change. The failed state must be
  per tab type (store `{ type, state }` or check that the tab in view is the one that failed) so a
  failed Media load doesn't show the error on Links.
- Each tab: failed + empty list → view with title **"Unable to load members"** / **"…media"** /
  **"…files"** / **"…links"** / **"…voice messages"**, same description pattern. Retry → the same
  action the tab dispatches on mount (`getMembersAC(channelId)` / `getAttachmentsAC(channelId, type, …)`).
- Load-more failures inside a tab: keep items, no full view.

## 3. Tests (write alongside, same rules as the testing plan)

| Layer | Tests |
|---|---|
| helpers | `isRequestTimeoutError`: 9902 → true; 9904, 503, undefined, plain Error → false |
| sagas | each of `getChannels`, `loadDefaultMessages`, `loadNearUnread`, `getMessagesQuery`, `getMembers`, `getMessageAttachments`: timeout → FAILED / failed id set; other error → no FAILED (and channels no longer stuck in LOADING); success after failure clears it; message timeout **with cached messages** → no failed id |
| reducers | new field set / cleared; `switchChannel` clears `messagesLoadFailedChannelId` |
| `LoadErrorState` | renders title/description, Retry calls `onRetry`, `role="alert"`, theme colors |
| ChannelList | FAILED + empty → view with exact copy; Retry dispatches `getChannelsAC` with props; FAILED but channels present → list, no view; custom component prop used and gets `onRetry`; load-more timeout → no view |
| MessageList | failed for active channel + no messages → view; Retry re-dispatches the right boot (default / near-unread / open-at-latest); failed id for another channel → no view; message arrives → view gone |
| Details tabs | per tab: FAILED + empty → its copy; Retry dispatches its load action; failure on one tab type doesn't show on another |
| Manual QA | throttle to offline mid-request / block the API in DevTools so requests hit the SDK timeout; check all 5 tabs, channel list on app start, message list on open; light + dark theme; Retry while still offline shows the view again |

## 4. Order of work
1. Shared: `FAILED`, `isRequestTimeoutError`, `LoadErrorState` (+ tests).
2. Channel list (saga + UI + tests) — the screen in the ticket.
3. Message list (reducer field, sagas, controller `retryInitialLoad`, UI + tests).
4. Details tabs (members, attachments per type, 5 tab UIs + tests).
5. Coverage thresholds for the new component; changelog entry for the new `FAILED` state + override prop.

## 5. Open questions
- Exact copy for the message list and each tab (proposed above) — confirm with design.
- Should the in-chat send box be disabled while the message list shows the error? (Proposed: no.)
- Non-timeout errors on the channel list currently leave the skeleton forever; proposed fix is to set
  LOADED (empty list). Confirm that's acceptable, or show the same view for those too later.

## 6. Status (2026-10-05) — implemented
- Shared: `LOADING_STATE.FAILED`, `isRequestTimeoutError` (helpers/error.ts), `common/LoadErrorState`
  (+ `renderLoadErrorState`, `CustomLoadErrorStateComponent`).
- Channel list: `getChannels` timeout -> FAILED (only if the main list hadn't loaded yet); any other error
  -> LOADED (was stuck in LOADING). `channelsLoadMore` failure -> LOADED (was stuck). View + Retry +
  `CustomLoadErrorState` prop, also inside a custom `List`.
- Message list: `messagesLoadFailedChannelId` (reducer/action/selector); set by `loadDefaultMessages`,
  `loadNearUnread`, `getMessagesQuery` on timeout when the chat is open and nothing is shown; cleared when
  a load starts. `useChatController.retryInitialLoad` re-runs the same first load. Prop passes through
  `Messages` -> `MessageList`.
- Details tabs: `getMembers` and `getMessageAttachments` set FAILED on timeout (attachments only when
  nothing cached, not for the slider popup). View in Members, Media, Files, Links, Voices. Prop passes
  through `ChannelDetailsContainer` -> `ChannelDetails` -> `DetailsTab` -> tabs.
- Tests: helper (8), component (6), channel saga (4), message saga (9 + 3), member saga (1),
  ChannelList (7), MessageList (6), Members (3), Media/Files/Links/Voices (12).
- Not covered: search timeouts (search still uses the shared loading state), load-more inside tabs.

## Update — retryable errors (beyond timeout)

The view is now shown for any **retryable load error** (`isRetryableLoadError` in `helpers/error.ts`):

| Shows view | Does not show view |
|---|---|
| 9900 UNKNOWN_ERROR | 9901 INVALID_INITIALIZATION (developer config error) |
| 9902 REQUEST_TIMEOUT | 9903 CONNECTION_REQUIRED (offline; reconnect reloads) |
| 503 SERVICE_UNAVAILABLE | 9904 NETWORK_CONNECTION_ERROR |
| server `type: 'InternalError'` | 9908 QUERY_IN_PROGRESS (request already running) |
| | 1203 TOO_LARGE_MESSAGE (send-only) |

Copy no longer says "in time": e.g. "We couldn't load your channels. Please try again."
