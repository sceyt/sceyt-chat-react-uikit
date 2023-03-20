let userDisplayNameFromContact = false

export const setShowOnlyContactUsers = (value: boolean) => {
  userDisplayNameFromContact = value
}

export const getShowOnlyContactUsers = () => userDisplayNameFromContact
