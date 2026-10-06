import React from 'react'
import { act } from '@testing-library/react'
import { MentionsContainer } from './index'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'
import { LOADING_STATE } from '../../../helpers/constants'
import { getMembersAC, loadMoreMembersAC, setMembersLoadingStateAC } from '../../../store/member/actions'

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
