import { useEffect } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { getRolesAC } from '../../store/member/actions'
import { rolesMapSelector } from '../../store/member/selector'

export default function usePermissions(myRole: string) {
  const dispatch = useDispatch()
  const rolesMap = useSelector(rolesMapSelector, shallowEqual)
  const myPermissions = myRole && rolesMap && rolesMap[myRole] ? rolesMap[myRole].permissions : []
  // const myPermissions: any = []
  const checkActionPermission = (actionName: string) => myPermissions.includes(actionName)
  // console.log('roleMap .. .', rolesMap)
  useEffect(() => {
    dispatch(getRolesAC())
  }, [])
  return [checkActionPermission, myPermissions] as const
}
