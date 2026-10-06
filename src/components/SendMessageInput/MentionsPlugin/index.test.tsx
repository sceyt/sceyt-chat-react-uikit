import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { MentionTypeaheadOption, MentionsContainer, useMentionLookupService } from './index'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'
import { LOADING_STATE } from '../../../helpers/constants'
import { getMembersAC, loadMoreMembersAC, setMembersLoadingStateAC } from '../../../store/member/actions'
import { updateUserStatusOnMapAC } from '../../../store/user/actions'
import { presenceRegistry } from '../../../helpers/presence/registry'
import { makeMember, makeUser } from '../../../testUtils/messageFixtures'

const channelId = 'channel-mentions'

const renderContainer = (loadingState: number) => {
  const store = createMessageListStore({
    MembersReducer: {
      channelsMembersHasNextMap: { [channelId]: true },
      channelsMembersLoadingState: { [channelId]: loadingState }
    }
  } as any)
  const dispatchSpy = jest.spyOn(store, 'dispatch')
  renderWithSceytProvider(
    <MentionsContainer
      queryString=''
      options={[]}
      selectedIndex={0}
      selectOptionAndCleanUp={jest.fn()}
      setHighlightedIndex={jest.fn()}
      channelId={channelId}
    />,
    { store }
  )
  const callsOf = (type: string) => dispatchSpy.mock.calls.filter((call) => (call[0] as any)?.type === type)
  return {
    store,
    getMembersCalls: () => callsOf(getMembersAC(channelId).type),
    loadMoreCalls: () => callsOf(loadMoreMembersAC(15, channelId).type)
  }
}

describe('MentionsContainer auto-load of members', () => {
  it('loads more members when the list is short and the last load finished', () => {
    expect(renderContainer(LOADING_STATE.LOADED).loadMoreCalls()).toEqual([[loadMoreMembersAC(15, channelId)]])
  })

  it('retries the first load (not load-more) after it failed, so mentions recover', () => {
    // getMembers sets FAILED (Members tab shows Retry); the mentions list must not stay empty.
    // loadMoreMembers would page a query that never loaded and overwrite FAILED with LOADED.
    const result = renderContainer(LOADING_STATE.FAILED)
    expect(result.getMembersCalls()).toEqual([[getMembersAC(channelId)]])
    expect(result.loadMoreCalls()).toEqual([])
  })

  it('retries a failed first load only once while it keeps failing', () => {
    const result = renderContainer(LOADING_STATE.FAILED)
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.store.dispatch(setMembersLoadingStateAC(LOADING_STATE.LOADING, channelId))
      })
      act(() => {
        result.store.dispatch(setMembersLoadingStateAC(LOADING_STATE.FAILED, channelId))
      })
    }
    expect(result.getMembersCalls()).toEqual([[getMembersAC(channelId)]])
    expect(result.loadMoreCalls()).toEqual([])
  })

  it('does not load more while a request is in flight', () => {
    expect(renderContainer(LOADING_STATE.LOADING).loadMoreCalls()).toEqual([])
  })
})

describe('mention presence', () => {
  it('rebuilds same-count matches after a member update and menu reopen', () => {
    const offline = makeMember(makeUser({ id: 'alice', firstName: 'Alice', presence: { state: 'offline' } as any }))
    const online = makeMember(makeUser({ id: 'alice', firstName: 'Alice', presence: { state: 'online' } as any }))
    const Lookup = ({ member, query }: { member: typeof offline; query: string | null }) => {
      const results = useMentionLookupService(query, {}, 'self', [member])
      return <span>{results[0]?.presence?.state || 'closed'}</span>
    }
    const view = render(<Lookup member={offline} query='a' />)
    expect(screen.getByText('offline')).toBeInTheDocument()
    view.rerender(<Lookup member={online} query='a' />)
    expect(screen.getByText('online')).toBeInTheDocument()
    view.rerender(<Lookup member={online} query={null} />)
    view.rerender(<Lookup member={online} query='a' />)
    expect(screen.getByText('online')).toBeInTheDocument()
  })

  it('updates an open option from Redux and stops polling after the menu closes', async () => {
    jest.useFakeTimers()
    const getUsers = jest.fn().mockResolvedValue([])
    const store = createMessageListStore({
      MembersReducer: { channelsMembersHasNextMap: { [channelId]: false } }
    } as any)
    presenceRegistry.configure(store.dispatch, { getUsers })
    presenceRegistry.setAvailability(true, true)
    const option = new MentionTypeaheadOption('Alice', 'alice', { state: 'offline' })
    const view = renderWithSceytProvider(
      <MentionsContainer
        queryString='a'
        options={[option]}
        selectedIndex={0}
        selectOptionAndCleanUp={jest.fn()}
        setHighlightedIndex={jest.fn()}
        channelId={channelId}
      />,
      { store }
    )
    const row = view.container.querySelector('[data-presence-user-id="alice"]') as Element
    act(() => (global as any).__setMockIntersection(row, true))
    act(() => jest.advanceTimersByTime(300))
    act(() => jest.advanceTimersByTime(150))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(getUsers).toHaveBeenCalledWith(['alice'])

    act(() => {
      store.dispatch(
        updateUserStatusOnMapAC({
          alice: makeUser({ id: 'alice', presence: { state: 'online' } as any })
        })
      )
    })
    expect(screen.getByText('Online')).toBeInTheDocument()
    view.unmount()
    const calls = getUsers.mock.calls.length
    act(() => jest.advanceTimersByTime(4000))
    expect(getUsers).toHaveBeenCalledTimes(calls)
    presenceRegistry.dispose()
    jest.useRealTimers()
  })
})
