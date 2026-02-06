import React, { useEffect, useState } from 'react'
import SceytChatClient from 'sceyt-chat'
import { v4 as uuidv4 } from 'uuid'
import {
  ChannelDetails,
  ChannelList,
  Chat,
  ChatHeader,
  MessageList,
  MessagesScrollToBottomButton,
  SceytChat,
  SendMessage
} from 'sceyt-chat-react-uikit'
import lightModeIcon from './assets/svg/lightModeIcon.svg'
import darkModeIcon from './assets/svg/darkModeIcon.svg'
import sceytIcon from './assets/img/sceyt_rounded.png'
import './App.css'
import { genToken } from './api'
import { SceytContext } from './sceytContext'
import ChannelCustomList from './ChannelCustomList'
import CreateChannelButton from './CreateChannel'
import useDidUpdate from './hooks/useDidUpdate'
import useMobileView from './hooks/useMobileView'
import CustomMessageItem from './CustomMessageItem'
import log from 'loglevel'

const MOBILE_ACTIVE_VIEW = {
  CHANNELS: 'channels',
  CHAT: 'chat'
}

function App() {
  const [client, setClient] = useState<SceytChatClient>()
  const [clientState, setClientState] = useState('')
  const [chatToken, setChatToken] = useState(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [userId, setUserId] = useState('')
  const [rolesMap, setRolesMap] = useState<any>()
  const isMobile = useMobileView()
  const [mobileActiveView, setMobileActiveView] = useState(MOBILE_ACTIVE_VIEW.CHANNELS)
  const guestsUsersList = [
    'alice',
    'ben',
    'charlie',
    'david',
    'emma',
    'emily',
    'ethan',
    'grace',
    'harry',
    'isabella',
    'jacob',
    'james',
    'john',
    'lily',
    'michael',
    'olivia',
    'sophia',
    'thomas',
    'william',
    'zoe'
  ]

  const activeChannelIsChanged = (channel: any) => {
    if (channel && channel.id) {
      setMobileActiveView(MOBILE_ACTIVE_VIEW.CHAT)
    }
  }
  const handleBackToChannels = () => {
    setMobileActiveView(MOBILE_ACTIVE_VIEW.CHANNELS)
  }

  function getRandomNumber() {
    // Generate a random number between 0 and 1.
    const randomNumber = Math.random()

    // Return the rounded number.
    return Math.floor(randomNumber * 20)
  }

  const getToken = () => {
    genToken(userId)
      .then(async (tokenData) => {
        const { token } = await tokenData.json()
        log.info('token ... ', token)
        setChatToken(token)
      })
      .catch((e) => {
        log.info('error on gen token. .. ', e)
      })
  }

  const connectClient = (token: string) => {
    const sceytClient = new SceytChatClient('https://us-ohio-api.sceyt.com', '8lwox2ge93', uuidv4())

    sceytClient.setLogLevel('trace')

    // @ts-ignore
    const listener = new sceytClient.ConnectionListener()
    listener.onConnectionStateChanged = async (status: string) => {
      setClientState(status)
      if (status === 'Failed') {
        await getToken()
      } else if (status === 'Connected') {
        log.info('client user.. .. ', sceytClient.user)
        try {
          sceytClient.setPresence('online')
        } catch (e) {
          log.error('error on setPresence. .. ', e)
        }
      }
    }
    listener.onTokenWillExpire = async () => {
      getToken()
    }
    listener.onTokenExpired = async () => {
      if (clientState === 'Connected') {
        getToken()
        // handlegetToken(
      } else {
        await getToken()
      }
    }
    sceytClient.addConnectionListener('listener_id', listener)

    sceytClient
      .connect(token)
      .then(() => {
        setClient(sceytClient)
        if (typeof window !== 'undefined' && window != null && window.addEventListener != null) {
          window.addEventListener('offline', (e) => onlineStatusChanged(e, sceytClient))
          window.addEventListener('online', (e) => onlineStatusChanged(e, sceytClient))
        }
      })
      .catch((e) => {
        const date = new Date()
        log.error(
          `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()} : Error on connect ... `,
          e
        )
        getToken()
      })
  }

  const onlineStatusChanged = (event: any, client: SceytChatClient) => {
    const date = new Date()
    log.info(
      `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()} : Online status changed : `,
      event.type
    )
    if (event.type === 'online') {
      setTimeout(() => {
        if (client && (!client.accessToken || client.connectionState === 'Disconnected')) {
          getToken()
        }
      }, 1000)
    }
  }

  useDidUpdate(() => {
    if (chatToken) {
      if (client && clientState === 'Connected') {
        client.updateToken(chatToken)
      } else {
        if (client && chatToken) {
          client
            .connect(chatToken)
            .then(() => {
              setClientState('Connected')
            })
            .catch((e: any) => {
              const date = new Date()
              log.error(
                `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()} : Error on connect after updating the token ... `,
                e
              )
              if (e.code === 10005 && client && client && client.connectionState === 'Connected') {
                setClientState('Connected')
              } else {
                getToken()
              }
            })
        } else {
          connectClient(chatToken)
        }
      }
    }
  }, [chatToken])

  useEffect(() => {
    if (!userId) {
      setUserId(guestsUsersList[getRandomNumber()])
    }
  }, [])

  useEffect(() => {
    if (!chatToken && userId) {
      getToken()
    }
  }, [userId])

  useEffect(() => {
    if (client && clientState === 'Connected') {
      client
        .getRoles()
        .then((roles: any[]) => {
          const rolesMap: any = {}

          roles.forEach((role: any) => {
            rolesMap[role.name] = role.permissions
          })
          setRolesMap(rolesMap)
        })
        .catch((e: any) => {
          log.info('error on get roles', e)
        })
    }
  }, [client])

  return (
    <div className='main'>
      <SceytContext.Provider value={{ client, theme }}>
        <div className='messenger_demo_wrapper'>
          <div className='theme_switcher'>
            <div
              className={`theme_switcher_item light_mode ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <img src={lightModeIcon} alt='ligh mode' />
              <span>Light Mode</span>
            </div>
            <div
              className={`theme_switcher_item dark_mode ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <img src={darkModeIcon} alt='dark mode' />
              <span>Dark Mode</span>
            </div>
          </div>
          <div className='messenger_demo_header'>
            <span className='red_circle'></span>
            <span className='orange_circle'></span>
            <span className='green_circle'></span>
          </div>
          {/*<div className={`sceyt_chat_wrapper ${showChat ? 'show_chat' : ''}`}>*/}
          <div className='sceyt_chat_wrapper'>
            {client ? (
              <SceytChat
                // autoSelectFirstChannel={true}
                themeMode={theme}
                theme={{
                  colors: {
                    accent: {
                      dark: '#6B72FF',
                      light: '#5159F6'
                    },
                    textPrimary: {
                      dark: '#ffffffcc',
                      light: '#111539'
                    }
                  }
                }}
                showNotifications={false}
                customColors={{ primaryColor: '#5159F6' }}
                client={client}
              >
                <React.Fragment>
                  {(!isMobile || mobileActiveView === MOBILE_ACTIVE_VIEW.CHANNELS) && (
                    <ChannelList
                      // className='custom_channel_list'
                      List={(props) => <ChannelCustomList {...props} activeChannelIsChanged={activeChannelIsChanged} />}
                      CreateChannel={<CreateChannelButton />}
                      backgroundColor={'#1B1C25'}
                      searchInputBackgroundColor={'#25262E'}
                      selectedChannelBackground={'#25262E'}
                      searchInputTextColor={'#ffffffcc'}
                      ChannelsTitle={<div className={`channels_title ${theme} dark`}> 👨‍💻 Workspace</div>}
                    />
                  )}
                </React.Fragment>
                {/*<Chat className={`custom_chat ${showChat ? '' : 'hide'}`}>*/}
                <React.Fragment>
                  {(!isMobile || mobileActiveView === MOBILE_ACTIVE_VIEW.CHAT) && (
                    <Chat className='custom_chat'>
                      <ChatHeader mobileBackButtonClicked={handleBackToChannels} />
                      <MessageList
                        reactionsContainerBackground={'inherit'}
                        reactionsContainerBoxShadow={'inherit'}
                        reactionsContainerPadding={'0 0 4px'}
                        reactionItemPadding={'5px 10px'}
                        ownMessageOnRightSide={false}
                        showSenderNameOnOwnMessages
                        showSenderNameOnDirectChannel
                        showOwnAvatar
                        incomingMessageStyles={{ background: 'inherit' }}
                        outgoingMessageStyles={{ background: 'inherit' }}
                        showMessageTimeAndStatusOnlyOnHover
                        reportMessage={false}
                        replyMessageInThread={false}
                        CustomMessageItem={(props) => (
                          <CustomMessageItem {...props} client={client} rolesMap={rolesMap} />
                        )}
                        fileAttachmentsBoxWidth={isMobile ? 220 : undefined}
                        imageAttachmentMaxWidth={isMobile ? 220 : undefined}
                        imageAttachmentMaxHeight={isMobile ? 200 : undefined}
                        videoAttachmentMaxWidth={isMobile ? 220 : undefined}
                        videoAttachmentMaxHeight={isMobile ? 200 : undefined}
                      />
                      <MessagesScrollToBottomButton bottomPosition={65} rightPosition={4} />
                      <SendMessage
                        margin='30px 0 10px -1px'
                        inputPaddings='6px 0'
                        backgroundColor='inherit'
                        emojiIcoOrder={1}
                        inputCustomClassname='sceyt_send_message_input'
                        // replyMessageBackgroundColor={'#ea3636'}
                        // replyMessageTextColor={'#0079e1'}
                        CustomSendMessageButton={<div>Send</div>}
                      />
                    </Chat>
                  )}
                </React.Fragment>

                <ChannelDetails size='small' avatarAndNameDirection='column' showDeleteChannel={true} showAboutChannel={true} />
              </SceytChat>
            ) : (
              <div className='messenger_loading'>
                <img src={sceytIcon} alt='sceyt logo' />
              </div>
            )}
          </div>
        </div>
      </SceytContext.Provider>
    </div>
  )
}

export default App
