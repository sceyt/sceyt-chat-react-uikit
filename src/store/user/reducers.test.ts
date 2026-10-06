import UserReducer, { setContacts } from './reducers'
import { resetUpdatedUserMapAC, setContactsAC, updateUserStatusOnMapAC } from './actions'
import { IContact } from '../../types'

const contact = (id: string, firstName: string): IContact =>
  ({ id, firstName, lastName: 'Test', keys: [], user: { id } as any }) as unknown as IContact

const initialState = () => UserReducer(undefined, { type: '@@INIT' })

// Contacts are no longer fetched by the UI kit (GET_CONTACTS saga removed); the host app passes
// them in through the `contacts` prop and SceytChat dispatches setContactsAC(contacts).
describe('user reducer - setContacts', () => {
  it('stores the contact list and builds contactsMap keyed by id', () => {
    const contacts = [contact('u1', 'Ann'), contact('u2', 'Bob')]
    const state = UserReducer(initialState(), setContactsAC(contacts))

    expect(state.contactList).toEqual(contacts)
    expect(Object.keys(state.contactsMap)).toEqual(['u1', 'u2'])
    expect(state.contactsMap.u2.firstName).toBe('Bob')
  })

  it('replaces previous contacts instead of merging', () => {
    let state = UserReducer(initialState(), setContactsAC([contact('u1', 'Ann'), contact('u2', 'Bob')]))
    state = UserReducer(state, setContactsAC([contact('u3', 'Cid')]))

    expect(state.contactList.map((c: IContact) => c.id)).toEqual(['u3'])
    expect(state.contactsMap.u1).toBeUndefined()
    expect(state.contactsMap.u3.firstName).toBe('Cid')
  })

  it('clears contacts when given an empty list', () => {
    let state = UserReducer(initialState(), setContactsAC([contact('u1', 'Ann')]))
    state = UserReducer(state, setContactsAC([]))

    expect(state.contactList).toEqual([])
    expect(state.contactsMap).toEqual({})
  })

  it('setContactsAC creates the slice action', () => {
    expect(setContactsAC([]).type).toBe(setContacts.type)
  })
})

describe('user reducer - client change', () => {
  it('clears fetched user data without removing contacts', () => {
    let state = UserReducer(initialState(), setContactsAC([contact('u1', 'Ann')]))
    state = UserReducer(
      state,
      updateUserStatusOnMapAC({
        u1: { id: 'u1', firstName: 'Ann', lastName: 'Test', state: 'active', blocked: true } as any
      })
    )
    state = UserReducer(state, resetUpdatedUserMapAC())
    expect(state.updatedUserMap).toEqual({})
    expect(state.contactsMap.u1).toBeDefined()
  })
})
