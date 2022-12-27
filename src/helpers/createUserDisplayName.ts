import { IContact, IUser } from '../types'

export function createUserDisplayName(contact: IContact, user: IUser) {
  return contact
    ? contact.firstName
      ? `${contact.firstName} ${contact.lastName}`
      : contact.id
    : user
    ? user.firstName
      ? `${user.firstName} ${user.lastName}`
      : user.id
    : 'Deleted user'
}
