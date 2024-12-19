import React, { useEffect, useState } from 'react'
// @ts-ignore
import SceytChatClient from 'sceyt-chat'
import './App.css'
import {
  SceytChat,
  ChannelList,
  Chat,
  ChatHeader,
  MessageList,
  SendMessage,
  ChannelDetails,
  MessagesScrollToBottomButton
} from 'sceyt-chat-react-uikit'

function App() {
  const [chatToken, setChatToken] = useState()
  const [clientState, setClientState] = useState('')
  const [client, setClient] = useState<SceytChatClient>()

  const getToken = async () => {
    const userId = 'owner-user-timeshareexit'
    fetch(`https://s74jcl67y4.execute-api.us-east-2.amazonaws.com/token?user=${userId}`).then(async (tokenData) => {
      const data = await tokenData.json()
      setChatToken(data.chat_token)
    })
      .catch((e) => {
        console.log('error on gen token. .. ', e)
      })
  }

  const connectClient = (token: string) => {
    const sceytClient = new SceytChatClient('https://us-ohio-api.sceyt.com', '364dkpzjr9', Math.random()
      .toString(36)
      .substr(2, 11))

    sceytClient.setLogLevel('trace')

    const listener = new (sceytClient.ConnectionListener as any)()

    listener.onConnectionStateChanged = async (status: string) => {
      setClientState(status)
      if (status === 'Failed') {
        await getToken()
      } else if (status === 'Connected') {
        sceytClient.setPresence('online')
      }
    }
    listener.onTokenWillExpire = async () => {
      getToken()
    }
    listener.onTokenExpired = async () => {
      getToken()
    }

    sceytClient.addConnectionListener('listener_id', listener)

    setClientState('Connecting')
    sceytClient.connect(token)
      .then(() => {
        setClient(sceytClient)
      })
      .catch((e: any) => {
        const date = new Date()
        console.error(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()} : Error on connect ... `, e)
        getToken()
      })
  }
  useEffect(() => {
    if (!chatToken) {
      getToken()
    }
  }, [])

  useEffect(() => {
    if (chatToken) {
      if (clientState === 'Connected' && client) {
        client.updateToken(chatToken)
      } else {
        if (client) {
          client.connect(chatToken)
            .then(() => {
              setClientState('Connected')
            })
            .catch((e: any) => {
              const date = new Date()
              console.error(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()} : Error on connect after updating the token ... `, e)
              if (e.code === 10005 && client && client && client.connectionState === 'Connected') {
                setClientState('Connected')
              } else {
                getToken()
              }
            })
        } else if (clientState !== 'Connecting') {
          connectClient(chatToken)
        }
      }
    }

  }, [chatToken])
  return (
    <div className="App">
      <div className="sceyt_chat_wrapper">
        {client &&
          (
            <SceytChat
              client={client}
            >
              <ChannelList />
              <Chat>
                <ChatHeader />
                <MessageList />
                <MessagesScrollToBottomButton />
                <SendMessage />
              </Chat>
              <ChannelDetails />
            </SceytChat>)
        }
      </div>
    </div>
  )
}

export default App
