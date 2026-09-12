import ChannelReducer, { setChannels } from './reducers'
import { updateMessage } from '../message/reducers'
import { MESSAGE_STATUS } from '../../helpers/constants'

describe('channel last-message parent snapshots', () => {
  it('updates a PM last-message preview when its pinned source is deleted', () => {
    const channel: any = {
      id: 'channel-1',
      type: 'direct',
      lastMessage: {
        id: 'pin-system-message',
        body: 'PM',
        parentMessage: { id: 'pinned-source', body: 'Pinned text' }
      }
    }
    let state = ChannelReducer(undefined, setChannels({ channels: [channel] }))

    state = ChannelReducer(
      state,
      updateMessage({
        messageId: 'pinned-source',
        params: { state: MESSAGE_STATUS.DELETE, body: '' } as any
      })
    )

    expect(state.channels[0].lastMessage.parentMessage).toMatchObject({
      id: 'pinned-source',
      state: MESSAGE_STATUS.DELETE
    })
  })
})
