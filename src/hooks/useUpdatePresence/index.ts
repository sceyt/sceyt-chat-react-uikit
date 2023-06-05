import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
// import { CHANNEL_TYPE } from '../../helpers/constants'
import { IChannel, IMember } from '../../types'
import { updateUserStatusOnChannelAC } from '../../store/channel/actions'
import { connectionStatusSelector } from '../../store/user/selector'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { checkUserStatusAC } from '../../store/user/actions'
import { CHANNEL_TYPE } from '../../helpers/constants'
import { getClient } from '../../common/client'
// import { checkUserStatusAC } from '../../store/user/actions'
const usersMap = {}
let updateInterval: any
export default function useUpdatePresence(channel: IChannel, isVisible: boolean) {
  const dispatch = useDispatch()
  const connectionStatus = useSelector(connectionStatusSelector)
  const ChatClient = getClient()
  const { user } = ChatClient
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
  // const updatedUsersMap = useSelector(usersMapSelector)
  // const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  // if (isDirectChannel) {
  const userId = directChannelUser && directChannelUser.id
  if (userId && usersMap[userId] && !isVisible) {
    delete usersMap[userId]
  }
  if (userId && !usersMap[userId] && isVisible) {
    usersMap[userId] = directChannelUser && directChannelUser.presence
  }
  if (Object.keys(usersMap).length && connectionStatus === CONNECTION_STATUS.CONNECTED) {
    clearInterval(updateInterval)
    updateInterval = setInterval(() => {
      /* const date = new Date()
      console.info(
        `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()} : get users `
      ) */
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

  /* useEffect(() => {
    console.log('updatedUsersMap', updatedUsersMap)
    if (updatedUsersMap) {
      Object.keys(updatedUsersMap).forEach((key) => {
        usersMap[key] = updatedUsersMap[key]
      })
    }
  }, [updatedUsersMap]) */

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
      usersMap[directChannelUser.id] = directChannelUser.presence
    }
  }, [])
  // }
}
