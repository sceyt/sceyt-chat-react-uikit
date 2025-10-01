import { shallowEqual } from 'react-redux'
import { useSelector } from 'store/hooks'
import { rolesMapSelector } from '../../store/member/selector'

export default function usePermissions(myRole: string) {
  const rolesMap = useSelector(rolesMapSelector, shallowEqual)
  const myPermissions = myRole && rolesMap && rolesMap[myRole] ? rolesMap[myRole].permissions : []
  const checkActionPermission = (actionName: string) => myPermissions.includes(actionName)
  return [checkActionPermission, myPermissions] as const
}
