import { useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'store/hooks'
import { usersMapSelector } from '../../store/user/selector'
import { updateUserStatusOnMapAC } from '../../store/user/actions'
import { setUserToMap } from '../../helpers/userHelper'
import { IUser, IMember } from '../../types'

export default function useUpdatedUser<T extends IUser | IMember | null | undefined>(user: T): T {
  const dispatch = useDispatch()
  const usersMap = useSelector(usersMapSelector)

  useEffect(() => {
    if (user?.id && !usersMap[user.id]) {
      setUserToMap(user as IUser)
      dispatch(updateUserStatusOnMapAC({ [user.id]: user as IUser }))
    }
  }, [user?.id])

  return useMemo(() => {
    if (!user?.id) {
      return user
    }
    return (usersMap[user.id] || user) as T
  }, [user, usersMap])
}
