import { PresenceRegistry, APPLY_PRESENCE_USERS } from './registry'
import { IUser } from '../../types'
import { CONNECTION_STATUS } from '../../store/user/constants'

const user = (id: string) => ({ id, firstName: id, lastName: '', state: 'active' }) as IUser
const flushPromises = async () => {
  for (let index = 0; index < 6; index++) await Promise.resolve()
}

describe('PresenceRegistry', () => {
  let registry: PresenceRegistry
  let dispatch: jest.Mock
  let getUsers: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    registry = new PresenceRegistry()
    dispatch = jest.fn()
    getUsers = jest.fn().mockResolvedValue([])
    registry.configure(dispatch, { getUsers })
    registry.setAvailability(true, true)
  })

  afterEach(() => {
    registry.dispose()
    jest.useRealTimers()
  })

  it('coalesces new IDs and retains a shared ID until its last subscriber leaves', async () => {
    const first = registry.subscribe(['a'])
    const second = registry.subscribe(['a', 'b'])
    jest.advanceTimersByTime(149)
    expect(getUsers).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)
    expect(getUsers).toHaveBeenCalledWith(['a', 'b'])

    first()
    jest.advanceTimersByTime(3850)
    await flushPromises()
    expect(getUsers).toHaveBeenLastCalledWith(['a', 'b'])
    second()
    jest.advanceTimersByTime(4000)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
  })

  it('queues IDs added during an in-flight request without overlapping it', async () => {
    let finishFirst!: (users: IUser[]) => void
    getUsers.mockImplementationOnce(() => new Promise<IUser[]>((resolve) => (finishFirst = resolve)))
    registry.subscribe(['a'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    registry.subscribe(['b'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)

    finishFirst([user('a')])
    await flushPromises()
    jest.advanceTimersByTime(150)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
    expect(getUsers).toHaveBeenLastCalledWith(['b'])
    expect(dispatch).toHaveBeenCalledWith({ type: APPLY_PRESENCE_USERS, payload: { users: [user('a')] } })
  })

  it('pauses in a hidden tab and refreshes on return', async () => {
    registry.subscribe(['a'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    registry.setAvailability(true, false)
    jest.advanceTimersByTime(8000)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)
    registry.setAvailability(true, true)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
  })

  it('waits for the next regular poll after a failed request', async () => {
    getUsers.mockRejectedValueOnce(new Error('network unavailable'))
    registry.subscribe(['a'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    jest.advanceTimersByTime(3849)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(1)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
  })

  it('does not immediately retry a failed request after a poll tick arrived mid-flight', async () => {
    let failFirst!: (error: Error) => void
    getUsers.mockImplementationOnce(() => new Promise<IUser[]>((_resolve, reject) => (failFirst = reject)))
    registry.subscribe(['a'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    jest.advanceTimersByTime(3850)
    expect(getUsers).toHaveBeenCalledTimes(1)
    failFirst(new Error('network unavailable'))
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(4000)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
  })

  it('drops an old client response but retains mounted subscriptions', async () => {
    let finishOld!: (users: IUser[]) => void
    getUsers.mockImplementationOnce(() => new Promise<IUser[]>((resolve) => (finishOld = resolve)))
    registry.subscribe(['a'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    const newGetUsers = jest.fn().mockResolvedValue([user('a')])
    registry.resetSession({ getUsers: newGetUsers })
    await flushPromises()
    finishOld([user('old')])
    await flushPromises()
    expect(newGetUsers).toHaveBeenCalledWith(['a'])
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: APPLY_PRESENCE_USERS, payload: { users: [user('a')] } })
  })

  it('never has two requests in flight across a quick pause and resume', async () => {
    let active = 0
    let maxActive = 0
    const finishers: Array<(users: IUser[]) => void> = []
    getUsers.mockImplementation(
      () =>
        new Promise<IUser[]>((resolve) => {
          active++
          maxActive = Math.max(maxActive, active)
          finishers.push((users) => {
            active--
            resolve(users)
          })
        })
    )
    registry.subscribe(['a'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)

    for (let index = 0; index < 3; index++) {
      registry.setAvailability(true, false)
      registry.setAvailability(true, true)
    }
    jest.advanceTimersByTime(4000)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)

    finishers[0]([user('a')])
    await flushPromises()
    expect(dispatch).toHaveBeenCalledWith({ type: APPLY_PRESENCE_USERS, payload: { users: [user('a')] } })
    expect(getUsers).toHaveBeenCalledTimes(2)
    finishers[1]([])
    await flushPromises()
    expect(maxActive).toBe(1)
  })

  it('refreshes exactly once when a hidden tab becomes visible', async () => {
    registry.subscribe(['a'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    registry.setAvailability(true, false)
    jest.advanceTimersByTime(5000)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)

    registry.setAvailability(true, true)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
    expect(getUsers).toHaveBeenLastCalledWith(['a'])
    jest.advanceTimersByTime(3999)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
  })

  it('skips the resume refresh when the last request started less than 4 s ago', async () => {
    registry.subscribe(['a'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    registry.setAvailability(true, false)
    jest.advanceTimersByTime(1000)
    registry.setAvailability(true, true)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(4000)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
  })

  it('does not poll a client that is still connecting until it reports connected', async () => {
    const connectingGetUsers = jest.fn().mockResolvedValue([])
    registry.configure(dispatch, { getUsers: connectingGetUsers, connectionState: CONNECTION_STATUS.CONNECTING })
    registry.subscribe(['a'])
    jest.advanceTimersByTime(8150)
    await flushPromises()
    expect(connectingGetUsers).not.toHaveBeenCalled()

    registry.setAvailability(true, true)
    await flushPromises()
    expect(connectingGetUsers).toHaveBeenCalledTimes(1)
    expect(connectingGetUsers).toHaveBeenCalledWith(['a'])
  })

  it('polls a new client right away when it is already connected', async () => {
    registry.subscribe(['a'])
    const connectedGetUsers = jest.fn().mockResolvedValue([])
    registry.configure(dispatch, { getUsers: connectedGetUsers, connectionState: CONNECTION_STATUS.CONNECTED })
    await flushPromises()
    expect(connectedGetUsers).toHaveBeenCalledWith(['a'])
  })

  it('leaves IDs queued during a failed request for the next regular poll', async () => {
    let failFirst!: (error: Error) => void
    getUsers.mockImplementationOnce(() => new Promise<IUser[]>((_resolve, reject) => (failFirst = reject)))
    registry.subscribe(['a'])
    jest.advanceTimersByTime(150)
    await flushPromises()
    registry.subscribe(['b'])
    failFirst(new Error('network unavailable'))
    await flushPromises()
    jest.advanceTimersByTime(3849)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1)
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
    expect(getUsers).toHaveBeenLastCalledWith(['a', 'b'])
  })
})
