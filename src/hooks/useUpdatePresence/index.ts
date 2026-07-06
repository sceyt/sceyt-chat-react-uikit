import { useEffect } from 'react'
import { useSelector, useDispatch } from 'store/hooks'
// import { CHANNEL_TYPE } from '../../helpers/constants'
import { IChannel, IMember, IUser } from '../../types'
import { updateUserStatusOnChannelAC } from '../../store/channel/actions'
import { connectionStatusSelector } from '../../store/user/selector'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { checkUserStatusAC } from '../../store/user/actions'
import { DEFAULT_CHANNEL_TYPE } from '../../helpers/constants'
import { getClient } from '../../common/client'
import { deleteUserFromMap, setUserToMap, updateUserOnMap, usersMap } from '../../helpers/userHelper'
// import { checkUserStatusAC } from '../../store/user/actions'
// One shared polling interval for all hook instances; stopped when the last
// instance unmounts, presence tracking empties, or the connection drops.
let updateInterval: any
let presenceHookInstances = 0

const stopPresenceInterval = () => {
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = undefined
  }
}

const syncPresenceInterval = (dispatch: any, connected: boolean) => {
  const shouldRun = presenceHookInstances > 0 && Object.keys(usersMap).length > 0 && connected
  if (shouldRun && !updateInterval) {
    updateInterval = setInterval(() => {
      dispatch(checkUserStatusAC())
    }, 4000)
  } else if (!shouldRun) {
    stopPresenceInterval()
  }
}

export default function useUpdatePresence(channel: IChannel, isVisible: boolean) {
  const dispatch = useDispatch()
  const connectionStatus = useSelector(connectionStatusSelector)
  const ChatClient = getClient()
  const { user } = ChatClient
  const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
  const userId = directChannelUser && directChannelUser.id
  if (userId && usersMap[userId] && !isVisible) {
    deleteUserFromMap(userId)
  }

  useEffect(() => {
    presenceHookInstances++
    return () => {
      presenceHookInstances--
      if (presenceHookInstances <= 0) {
        stopPresenceInterval()
      }
    }
  }, [])

  useEffect(() => {
    if (userId && isVisible && directChannelUser) {
      if (!usersMap[userId]) {
        setUserToMap(directChannelUser as IUser)
      } else if (usersMap[userId]?.presence?.state !== directChannelUser.presence!.state) {
        updateUserOnMap(directChannelUser as IUser)
        dispatch(updateUserStatusOnChannelAC({ [directChannelUser.id]: directChannelUser }))
      }
    }
  })

  // Runs after every render so changes to the module-level usersMap (which
  // never changes identity) are still picked up.
  useEffect(() => {
    syncPresenceInterval(dispatch, connectionStatus === CONNECTION_STATUS.CONNECTED)
  })

  useEffect(() => {
    if (
      directChannelUser &&
      usersMap[directChannelUser.id] &&
      directChannelUser.presence &&
      (directChannelUser.presence.state !== usersMap[directChannelUser.id].state ||
        (directChannelUser.presence.lastActiveAt &&
          new Date(directChannelUser.presence.lastActiveAt).getTime() !==
            new Date(usersMap[directChannelUser.id]?.presence?.lastActiveAt || 0).getTime()))
    ) {
      dispatch(updateUserStatusOnChannelAC({ [directChannelUser.id]: directChannelUser }))
      updateUserOnMap(directChannelUser)
    }
  }, [])
  // }
}
