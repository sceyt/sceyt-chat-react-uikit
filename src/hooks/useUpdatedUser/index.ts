import { useMemo } from 'react'
import { useSelector } from 'store/hooks'
import { IUser, IMember } from '../../types'

export default function useUpdatedUser<T extends IUser | IMember | null | undefined>(user: T): T {
  const latest = useSelector((state: any) => (user?.id ? state.UserReducer.updatedUserMap[user.id] : undefined))
  return useMemo(() => (latest ? { ...user, ...latest } : user) as T, [user, latest])
}
