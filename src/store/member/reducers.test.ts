import MembersReducer, { addMembersToList, setMembersToList, updateMembersPresence } from './reducers'
import { makeMember, makeUser } from '../../testUtils/messageFixtures'

describe('member presence updates', () => {
  const original = makeMember(makeUser({ id: 'shared', presence: { state: 'offline' } as any }), 'participant')

  it('patches a user in every channel without replacing membership fields', () => {
    let state = MembersReducer(undefined, setMembersToList({ channelId: 'first', members: [original] }))
    state = MembersReducer(state, setMembersToList({ channelId: 'second', members: [original] }))
    state = MembersReducer(
      state,
      updateMembersPresence({
        usersMap: { shared: makeUser({ id: 'shared', presence: { state: 'online' } as any }) }
      })
    )
    expect(state.channelsMembersMap.first[0].presence?.state).toBe('online')
    expect(state.channelsMembersMap.second[0].presence?.state).toBe('online')
    expect(state.channelsMembersMap.first[0].role).toBe('participant')
  })

  it('does not duplicate or overwrite an existing member with a stale add response', () => {
    let state = MembersReducer(undefined, setMembersToList({ channelId: 'group', members: [original] }))
    state = MembersReducer(
      state,
      updateMembersPresence({
        usersMap: { shared: makeUser({ id: 'shared', presence: { state: 'online' } as any }) }
      })
    )
    state = MembersReducer(state, addMembersToList({ channelId: 'group', members: [original] }))
    expect(state.channelsMembersMap.group).toHaveLength(1)
    expect(state.channelsMembersMap.group[0].presence?.state).toBe('online')
  })
})
