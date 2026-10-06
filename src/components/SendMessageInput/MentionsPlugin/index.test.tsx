import React from 'react'
import { MentionsContainer } from './index'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'
import { LOADING_STATE } from '../../../helpers/constants'
import { loadMoreMembersAC } from '../../../store/member/actions'

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
  return dispatchSpy.mock.calls.filter((call) => (call[0] as any)?.type === loadMoreMembersAC(15, channelId).type)
}

describe('MentionsContainer auto-load of members', () => {
  it('loads more members when the list is short and the last load finished', () => {
    expect(renderContainer(LOADING_STATE.LOADED)).toEqual([[loadMoreMembersAC(15, channelId)]])
  })

  it('still loads members after the first load failed, so mentions recover', () => {
    // getMembers sets FAILED (Members tab shows Retry); the mentions list must not stay empty
    expect(renderContainer(LOADING_STATE.FAILED)).toEqual([[loadMoreMembersAC(15, channelId)]])
  })

  it('does not load more while a request is in flight', () => {
    expect(renderContainer(LOADING_STATE.LOADING)).toEqual([])
  })
})
