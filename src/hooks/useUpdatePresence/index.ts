import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
// import { CHANNEL_TYPE } from '../../helpers/constants'
import { IChannel } from '../../types'
import { checkUserStatusAC } from '../../store/channel/actions'
import { connectionStatusSelector } from '../../store/user/selector'
import { CONNECTION_STATUS } from '../../store/user/constants'
const usersMap = {}
let updateInterval: any
export default function useUpdatePresence(channel: IChannel, isVisible: boolean) {
  const dispatch = useDispatch()
  const connectionStatus = useSelector(connectionStatusSelector)
  // const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  // if (isDirectChannel) {
  const userId = channel.peer.id
  if (usersMap[userId] && !isVisible) {
    delete usersMap[userId]
  }
  if (!usersMap[userId] && isVisible) {
    usersMap[userId] = channel.peer.presence
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
      usersMap[channel.peer.id] &&
      channel.peer.presence &&
      (channel.peer.presence.state !== usersMap[channel.peer.id].state ||
        channel.peer.presence.lastActiveAt !== usersMap[channel.peer.id].lastActiveAt)
    ) {
      usersMap[channel.peer.id] = channel.peer.presence
    }
  }, [channel])
  // }
}
