import { runSaga } from 'redux-saga'
import log from 'loglevel'
import { IUser } from '../../types'
import { APPLY_PRESENCE_USERS } from '../../helpers/presence/registry'
import { updateChannelMemberInAllChannels } from '../../helpers/channelHalper'
import { updateUserStatusOnMapAC } from '../user/actions'
import { updateMembersPresenceAC } from '../member/actions'
import { updateUserStatusOnChannelAC } from './actions'
import { __channelSagaTestables } from './saga'

jest.mock('store', () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({})) }
}))

jest.mock('../evetns/inedx', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('../../helpers/channelHalper', () => ({
  ...jest.requireActual('../../helpers/channelHalper'),
  updateChannelMemberInAllChannels: jest.fn()
}))

const baseUser: IUser = {
  id: 'alice',
  firstName: 'Alice',
  lastName: 'Smith',
  state: 'active',
  avatarUrl: 'https://example.test/alice.png',
  blocked: false,
  presence: { state: 'offline', status: 'away', lastActiveAt: new Date('2026-10-01T10:00:00.000Z') } as any
}

const runApply = async (users: IUser[], updatedUserMap: { [key: string]: IUser }, dispatch?: (a: any) => void) => {
  const dispatched: any[] = []
  await runSaga(
    {
      dispatch: dispatch || ((action) => dispatched.push(action)),
      getState: () => ({ UserReducer: { updatedUserMap } })
    },
    __channelSagaTestables.applyPresenceUsers as any,
    { type: APPLY_PRESENCE_USERS, payload: { users } }
  ).toPromise()
  return dispatched
}

describe('applyPresenceUsers saga', () => {
  let logError: jest.SpyInstance

  beforeEach(() => {
    logError = jest.spyOn(log, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    logError.mockRestore()
  })

  it('treats the first result for a user as changed', async () => {
    const dispatched = await runApply([baseUser], {})
    expect(dispatched).toHaveLength(3)
  })

  it('dispatches nothing when the result matches updatedUserMap', async () => {
    const dispatched = await runApply([{ ...baseUser }], { alice: baseUser })
    expect(dispatched).toEqual([])
    expect(updateChannelMemberInAllChannels).not.toHaveBeenCalled()
  })

  const fieldChanges: Array<[string, Partial<IUser>]> = [
    ['presence state', { presence: { ...baseUser.presence, state: 'online' } as any }],
    ['presence status', { presence: { ...baseUser.presence, status: 'busy' } as any }],
    ['lastActiveAt', { presence: { ...baseUser.presence, lastActiveAt: new Date('2026-10-01T11:00:00.000Z') } as any }],
    ['avatarUrl', { avatarUrl: 'https://example.test/alice-new.png' }],
    ['firstName', { firstName: 'Alicia' }],
    ['lastName', { lastName: 'Jones' }],
    ['blocked', { blocked: true }]
  ]

  it.each(fieldChanges)('updates when %s changes', async (_field, patch) => {
    const next = { ...baseUser, ...patch }
    const dispatched = await runApply([next], { alice: baseUser })
    expect(dispatched).toHaveLength(3)
    expect(dispatched[0]).toEqual(updateUserStatusOnMapAC({ alice: { ...next, blocked: !!next.blocked } }))
  })

  it('dispatches the user, member and channel updates and patches cached channels', async () => {
    const online = { ...baseUser, presence: { ...baseUser.presence, state: 'online' } as any }
    const unchanged = { ...baseUser, id: 'bob' }
    const dispatched = await runApply([online, unchanged], { alice: baseUser, bob: unchanged })
    const changed = { alice: { ...online, blocked: false } }
    expect(dispatched).toEqual([
      updateUserStatusOnMapAC(changed),
      updateMembersPresenceAC(changed),
      updateUserStatusOnChannelAC(changed)
    ])
    expect(updateChannelMemberInAllChannels).toHaveBeenCalledWith([changed.alice])
  })

  it('logs and swallows an error thrown by a reducer', async () => {
    const throwingDispatch = () => {
      throw new Error('reducer failed')
    }
    await expect(runApply([baseUser], {}, throwingDispatch)).resolves.toEqual([])
    expect(logError).toHaveBeenCalledWith('ERROR in apply presence users : ', 'reducer failed')
  })

  it('logs and swallows an error thrown by the channel helper', async () => {
    ;(updateChannelMemberInAllChannels as jest.Mock).mockImplementationOnce(() => {
      throw new Error('helper failed')
    })
    const dispatched = await runApply([baseUser], {})
    expect(dispatched).toHaveLength(3)
    expect(logError).toHaveBeenCalledWith('ERROR in apply presence users : ', 'helper failed')
  })
})
