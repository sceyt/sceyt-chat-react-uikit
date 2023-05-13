import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
// import { CHANNEL_TYPE } from '../../helpers/constants'
import { IChannel } from '../../types'
import { updateUserStatusOnChannelAC } from '../../store/channel/actions'
import { connectionStatusSelector } from '../../store/user/selector'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { checkUserStatusAC } from '../../store/user/actions'
// import { checkUserStatusAC } from '../../store/user/actions'
const usersMap = {}
let updateInterval: any
export default function useUpdatePresence(channel: IChannel, isVisible: boolean) {
  const dispatch = useDispatch()
  const connectionStatus = useSelector(connectionStatusSelector)
  // const updatedUsersMap = useSelector(usersMapSelector)
  // const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  // if (isDirectChannel) {
  const userId = channel.peer && channel.peer.id
  if (usersMap[userId] && !isVisible) {
    delete usersMap[userId]
  }
  if (!usersMap[userId] && isVisible) {
    usersMap[userId] = channel.peer && channel.peer.presence
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
    /* if (channel.peer) {
      console.log('channel.peer.presence', channel.peer.presence)
      console.log('usersMap[channel.peer.id].lastActiveAt', usersMap[channel.peer.id])
    } */
    if (
      channel.peer &&
      usersMap[channel.peer.id] &&
      channel.peer.presence &&
      (channel.peer.presence.state !== usersMap[channel.peer.id].state ||
        (channel.peer.presence.lastActiveAt &&
          new Date(channel.peer.presence.lastActiveAt).getTime() !==
            new Date(usersMap[channel.peer.id].lastActiveAt).getTime()))
    ) {
      dispatch(updateUserStatusOnChannelAC({ [channel.peer.id]: channel.peer }))
      usersMap[channel.peer.id] = channel.peer.presence
    }
  }, [])
  // }
}
