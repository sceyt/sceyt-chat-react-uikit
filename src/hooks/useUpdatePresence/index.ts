import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
// import { CHANNEL_TYPE } from '../../helpers/constants'
import { IChannel, IMember, IUser } from '../../types'
import { updateUserStatusOnChannelAC } from '../../store/channel/actions'
import { connectionStatusSelector } from '../../store/user/selector'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { checkUserStatusAC } from '../../store/user/actions'
import { CHANNEL_TYPE } from '../../helpers/constants'
import { getClient } from '../../common/client'
import { deleteUserFromMap, setUserToMap, updateUserOnMap, usersMap } from '../../helpers/userHelper'
// import { checkUserStatusAC } from '../../store/user/actions'
let updateInterval: any
export default function useUpdatePresence(channel: IChannel, isVisible: boolean) {
  const dispatch = useDispatch()
  const connectionStatus = useSelector(connectionStatusSelector)
  const ChatClient = getClient()
  const { user } = ChatClient
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
  const userId = directChannelUser && directChannelUser.id
  if (userId && usersMap[userId] && !isVisible) {
    deleteUserFromMap(userId)
  }
  if (userId && !usersMap[userId] && isVisible && directChannelUser) {
    setUserToMap(directChannelUser as IUser)
  }
  if (Object.keys(usersMap).length && connectionStatus === CONNECTION_STATUS.CONNECTED) {
    clearInterval(updateInterval)
    updateInterval = setInterval(() => {
      dispatch(checkUserStatusAC(usersMap))
    }, 4000)
  } else if (!Object.keys(usersMap).length && updateInterval) {
    clearInterval(updateInterval)
    updateInterval = undefined
  }

  useEffect(() => {
    clearInterval(updateInterval)
  }, [usersMap])

  useEffect(() => {
    if (connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      clearInterval(updateInterval)
    }
  }, [connectionStatus])

  useEffect(() => {
    if (
      directChannelUser &&
      usersMap[directChannelUser.id] &&
      directChannelUser.presence &&
      (directChannelUser.presence.state !== usersMap[directChannelUser.id].state ||
        (directChannelUser.presence.lastActiveAt &&
          new Date(directChannelUser.presence.lastActiveAt).getTime() !==
            new Date(usersMap[directChannelUser.id].lastActiveAt).getTime()))
    ) {
      dispatch(updateUserStatusOnChannelAC({ [directChannelUser.id]: directChannelUser }))
      updateUserOnMap(directChannelUser)
    }
  }, [])
  // }
}
