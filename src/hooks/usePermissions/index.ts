import { useEffect } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { getRolesAC } from '../../store/user/actions'
import { rolesMapSelector } from '../../store/user/selector'

export default function usePermissions(myRole: string) {
  const dispatch = useDispatch()
  const rolesMap = useSelector(rolesMapSelector, shallowEqual)
  const myPermissions = myRole && rolesMap[myRole] ? rolesMap[myRole].permissions : []
  // const myPermissions: any = []

  const chekActionPermission = (actionName: string) => myPermissions.includes(actionName)

  useEffect(() => {
    dispatch(getRolesAC())
  }, [])
  return [chekActionPermission, myPermissions] as const
}
