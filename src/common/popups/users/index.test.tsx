import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import UsersPopup from './index'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'
import { makeUser } from '../../../testUtils/messageFixtures'
import { setShowOnlyContactUsers } from '../../../helpers/contacts'
import { updateUserStatusOnMapAC } from '../../../store/user/actions'
import { setUserBlockedForInviteAC } from '../../../store/member/actions'
import { GET_USERS } from '../../../store/user/constants'
import { IContact } from '../../../types'

const ada = makeUser({ id: 'ada', firstName: 'Ada', lastName: 'Lovelace', presence: { state: 'offline' } as any })
const alan = makeUser({ id: 'alan', firstName: 'Alan', lastName: 'Turing', presence: { state: 'offline' } as any })

const renderPopup = (preloadedState: any) => {
  const store = createMessageListStore(preloadedState)
  const dispatchSpy = jest.spyOn(store, 'dispatch')
  const view = renderWithSceytProvider(
    <UsersPopup toggleCreatePopup={jest.fn()} actionType='addMembers' memberIds={[]} />,
    { store }
  )
  return { ...view, store, dispatchSpy }
}

const getUsersCalls = (dispatchSpy: jest.SpyInstance) =>
  dispatchSpy.mock.calls.filter(([action]) => action?.type === GET_USERS)

describe('UsersPopup presence updates', () => {
  afterEach(() => {
    setShowOnlyContactUsers(false)
  })

  it('does not re-query users or reset the loaded list on a presence-only update', () => {
    setShowOnlyContactUsers(false)
    const { store, dispatchSpy } = renderPopup({ UserReducer: { usersList: [ada, alan] } })
    expect(getUsersCalls(dispatchSpy)).toHaveLength(1)
    dispatchSpy.mockClear()

    act(() => {
      store.dispatch(updateUserStatusOnMapAC({ ada: { ...ada, presence: { state: 'online' } as any } }))
    })

    expect(getUsersCalls(dispatchSpy)).toHaveLength(0)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Alan Turing')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('still marks a listed contact as blocked when its blocked flag changes', () => {
    setShowOnlyContactUsers(true)
    const contact = { id: 'ada', firstName: 'Ada', lastName: 'Lovelace', keys: [], user: ada } as unknown as IContact
    const { store, dispatchSpy, container } = renderPopup({
      UserReducer: { contactList: [contact], contactsMap: { ada: contact } }
    })
    const adaRow = () => container.ownerDocument.querySelector('[data-presence-user-id="ada"]') as Element

    act(() => {
      store.dispatch(updateUserStatusOnMapAC({ ada: { ...ada, presence: { state: 'online' } as any } }))
    })
    fireEvent.click(adaRow())
    expect(dispatchSpy).not.toHaveBeenCalledWith(setUserBlockedForInviteAC(true, ['ada']))

    act(() => {
      store.dispatch(updateUserStatusOnMapAC({ ada: { ...ada, blocked: true } }))
    })
    fireEvent.click(adaRow())
    expect(dispatchSpy).toHaveBeenCalledWith(setUserBlockedForInviteAC(true, ['ada']))
    expect(getUsersCalls(dispatchSpy)).toHaveLength(0)
  })
})
