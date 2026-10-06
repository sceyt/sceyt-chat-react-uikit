import React from 'react'
import { act, fireEvent } from '@testing-library/react'
import SceytChat from './index'
import { createMessageListStore, renderWithSceytProvider } from '../../testUtils/messageListHarness'
import { APPLY_PRESENCE_USERS, presenceRegistry } from '../../helpers/presence/registry'
import { resetUpdatedUserMapAC } from '../../store/user/actions'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { IUser } from '../../types'

jest.mock('../../helpers/messagesIdb', () => ({
  initMessagesIdbForUser: () => Promise.resolve(),
  clearPersistedDrafts: () => undefined
}))

jest.mock('../../helpers/messagesHalper', () => ({
  ...jest.requireActual('../../helpers/messagesHalper'),
  hydrateDraftMessages: () => undefined
}))

jest.mock('../../helpers/attachmentsCache', () => ({
  ...jest.requireActual('../../helpers/attachmentsCache'),
  cleanupOldAttachmentCache: () => undefined
}))

const presenceUser = (id: string, firstName: string) =>
  ({ id, firstName, lastName: '', state: 'active', presence: { state: 'online' } }) as unknown as IUser

const makeClient = (id: string, getUsers: jest.Mock) => ({
  user: { id, firstName: id, lastName: '', state: 'active' },
  connectionState: CONNECTION_STATUS.CONNECTED,
  getUsers
})

const flushPromises = async () => {
  await act(async () => {
    for (let index = 0; index < 6; index++) await Promise.resolve()
  })
}

// React runs the unmount cleanup on a real timer (its scheduler keeps the real timers),
// so wait for one before checking it and before the next test starts.
const { setTimeout: realSetTimeout } = jest.requireActual('timers')
const unmountChat = async (unmount: () => void) => {
  unmount()
  await act(async () => {
    await new Promise((resolve) => realSetTimeout(resolve, 0))
  })
}

const setDocumentVisibility = (visible: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !visible })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (visible ? 'visible' : 'hidden')
  })
}

const renderChat = (client: any) => {
  const store = createMessageListStore()
  const dispatchSpy = jest.spyOn(store, 'dispatch')
  const view = renderWithSceytProvider(<SceytChat client={client} />, { store })
  const rerenderWith = (nextClient: any) => view.rerender(<SceytChat client={nextClient} />)
  return { ...view, store, dispatchSpy, rerenderWith }
}

const appliedUsers = (dispatchSpy: jest.SpyInstance) =>
  dispatchSpy.mock.calls
    .filter(([action]) => action?.type === APPLY_PRESENCE_USERS)
    .map(([action]) => action.payload.users)

describe('SceytChat presence lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    setDocumentVisibility(true)
    jest.spyOn(document, 'hasFocus').mockReturnValue(true)
  })

  afterEach(() => {
    presenceRegistry.dispose()
    jest.restoreAllMocks()
    jest.useRealTimers()
    delete (document as any).hidden
    delete (document as any).visibilityState
  })

  it('resets user data and reconfigures the registry when the client changes', async () => {
    const configure = jest.spyOn(presenceRegistry, 'configure')
    const first = makeClient('first', jest.fn().mockResolvedValue([]))
    const second = makeClient('second', jest.fn().mockResolvedValue([]))
    const { dispatchSpy, rerenderWith, unmount } = renderChat(first)
    expect(configure).toHaveBeenLastCalledWith(expect.any(Function), first)

    dispatchSpy.mockClear()
    rerenderWith(second)
    expect(dispatchSpy).toHaveBeenCalledWith(resetUpdatedUserMapAC())
    expect(configure).toHaveBeenLastCalledWith(expect.any(Function), second)
    await unmountChat(unmount)
  })

  it('disposes the registry on unmount', async () => {
    const dispose = jest.spyOn(presenceRegistry, 'dispose')
    const { unmount } = renderChat(makeClient('first', jest.fn().mockResolvedValue([])))
    expect(dispose).not.toHaveBeenCalled()
    await unmountChat(unmount)
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it("ignores a result from the previous client's request", async () => {
    let finishOld!: (users: IUser[]) => void
    const oldGetUsers = jest.fn(() => new Promise<IUser[]>((resolve) => (finishOld = resolve)))
    const newGetUsers = jest.fn().mockResolvedValue([presenceUser('alice', 'New')])
    const { dispatchSpy, rerenderWith, unmount } = renderChat(makeClient('first', oldGetUsers))
    act(() => {
      presenceRegistry.subscribe(['alice'])
    })
    act(() => jest.advanceTimersByTime(150))
    await flushPromises()
    expect(oldGetUsers).toHaveBeenCalledWith(['alice'])

    rerenderWith(makeClient('second', newGetUsers))
    await flushPromises()
    expect(newGetUsers).toHaveBeenCalledWith(['alice'])

    finishOld([presenceUser('alice', 'Old')])
    await flushPromises()
    expect(appliedUsers(dispatchSpy)).toEqual([[presenceUser('alice', 'New')]])
    await unmountChat(unmount)
  })

  it('keeps polling when the window loses focus but pauses in a hidden tab', async () => {
    const setAvailability = jest.spyOn(presenceRegistry, 'setAvailability')
    const getUsers = jest.fn().mockResolvedValue([])
    const { store, unmount } = renderChat(makeClient('first', getUsers))
    act(() => {
      presenceRegistry.subscribe(['alice'])
    })
    act(() => jest.advanceTimersByTime(150))
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(1)
    ;(document.hasFocus as jest.Mock).mockReturnValue(false)
    act(() => {
      fireEvent.blur(window)
    })
    expect(store.getState().UserReducer.browserTabIsActive).toBe(false)
    expect(setAvailability).toHaveBeenLastCalledWith(true, true)
    act(() => jest.advanceTimersByTime(4000))
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)

    setDocumentVisibility(false)
    act(() => {
      fireEvent(document, new Event('visibilitychange'))
    })
    expect(setAvailability).toHaveBeenLastCalledWith(true, false)
    act(() => jest.advanceTimersByTime(8000))
    await flushPromises()
    expect(getUsers).toHaveBeenCalledTimes(2)
    await unmountChat(unmount)
  })
})
