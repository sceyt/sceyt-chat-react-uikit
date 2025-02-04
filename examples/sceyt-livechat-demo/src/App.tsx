import React, {useEffect, useState} from 'react';
import SceytChatClient from "sceyt-chat";
import {v4 as uuidv4} from 'uuid'
import {
    Chat, MessageList, MessagesScrollToBottomButton, SceytChat, SendMessage,
} from 'sceyt-chat-react-uikit';
import openLivechatIcon from './svg/livechat-button.svg';
import closeLivechatIcon from './svg/close-chat.svg';
import supportIcon from './svg/supportIcon.svg';
import sceytRounded from './svg/sceyt-rounded.svg';
import './App.css';
import {genToken} from "./api";
import log from 'loglevel'

function App() {
    const [client, setClient] = useState<SceytChatClient>();
    const [clientState, setClientState] = useState('');
    const [unreadCount, setUnreadCount] = useState<number>();
    const [chatToken, setChatToken] = useState(null);
    const [isMobile, setIsMobile] = useState<boolean>();
    const [liveChatOpen, setLiveChatOpen] = useState(false);

    const handleUpdateUnreadCount = (channel: any) => {
        setUnreadCount(channel.unreadMessageCount)
    }

    const handleOpenLiveChat = (state: boolean) => {
        setLiveChatOpen(state)
    }

    const getToken = () => {
        let userId = ''
        const clientId = localStorage.getItem('client_id')
        if (clientId) {
            userId = clientId
        } else {
            userId = `guest_${uuidv4()}`
            localStorage.setItem('client_id', userId)
        }
        genToken(userId).then(async (tokenData) => {
            const data = await tokenData.json()
            setChatToken(data.chat_token)
        })
            .catch((e) => {
                log.info('error on gen token. .. ', e)
            })
    }

    const connectClient = (token: string) => {
        const sceytClient = new SceytChatClient('https://us-ohio-api.sceyt.com', 'ldpz9kvzol', Math.random()
            .toString(36)
            .substr(2, 11));

        sceytClient.setLogLevel('trace')

        // @ts-ignore
        const listener = new sceytClient.ConnectionListener();
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
            if (clientState === 'Connected') {
                getToken()
                // handlegetToken(
            } else {
                await getToken()
            }
        }
        sceytClient.addConnectionListener('listener_id', listener);
        setClientState('Connecting')
        sceytClient.connect(token)
            .then(() => {
                setClient(sceytClient);
            })
            .catch((e) => {
                const date = new Date()
                console.error(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()} : Error on connect ... `, e);
                getToken()
            });
    }
    useEffect(() => {
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            setIsMobile(true);
        } else {
            setIsMobile(false);
        }
        if (liveChatOpen && !chatToken) {
            getToken()
        }
        if (liveChatOpen) {
            document.body.classList.add("no-scroll")
        } else {
            document.body.classList.remove("no-scroll")
        }
    }, [liveChatOpen])

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
                        .catch((e) => {
                            const date = new Date()
                            console.error(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()} : Error on connect after updating the token ... `, e);
                            if (e.code === 10005 && client && client && client.connectionState === 'Connected') {
                                setClientState('Connected')
                            } else {
                                getToken()
                            }
                        });
                } else if(clientState !== 'Connecting'){
                    connectClient(chatToken)
                }
            }
        }

    }, [chatToken])

    return (
        <div className="App">
            <header className="App-header">
                <p>
                    Sceyt livechat demo
                </p>
            </header>

            <div className='livechat_wrapper'>
                <div className='open_live_chat_button' onClick={() => handleOpenLiveChat(true)}>
                    {!!(unreadCount && unreadCount > 0 && !liveChatOpen) && (<span className='unread_count'>{unreadCount}</span>)}
                    <img src={openLivechatIcon} alt="livechat trigger" />
                </div>
                <div
                    className={`live_chat_container ${liveChatOpen && 'live_chat_container_opened'} ${isMobile ? 'mobile_livechat' : ''}`}>
                    <div className='livechat_header'>
                        <img src={supportIcon} alt="sceyt logo" />
                        <h3 className='livechat_title'>Support Team</h3>

                        <span className='close_live_chat_button' onClick={() => handleOpenLiveChat(false)}>
                            <img src={closeLivechatIcon} alt="livechat trigger" />
                        </span>
                    </div>
                    <div className='sceyt_livechat'>
                        {client ? (
                            <SceytChat
                                showNotifications={false}
                                client={client}
                                autoSelectFirstChannel={true}
                            >
                                <Chat onSelectedChannelUpdated={handleUpdateUnreadCount} hideChannelList={true}>
                                    <MessageList
                                        fontFamily="Inter, sans-serif"
                                        messageWidthPercent={70}
                                        messageStatusAndTimePosition='bottomOfMessage'
                                        messageStatusDisplayingType='text'
                                        showMessageStatusForEachMessage={false}
                                        showSenderNameOnGroupChannel={false}
                                        showMessageTimeForEachMessage={false}
                                        outgoingMessageStyles={{ background: '#E3E7FF' }}
                                        incomingMessageStyles={{ background: '#F1F2F6' }}
                                        dateDividerTextColor={'#707388'}
                                        dateDividerBorder="none"
                                        dateDividerFontSize='13px'
                                        dateDividerBackgroundColor={'#fff'}
                                        dateDividerBorderRadius='14px'
                                        newMessagesSeparatorWidth='calc(100% - 170px)'
                                        newMessagesSeparatorBackground={'rgb(162 163 164)'}
                                        newMessagesSeparatorTextLeftRightSpacesWidth='12px'
                                        newMessagesSeparatorFontSize='12px'
                                        newMessagesSeparatorTextColor={'#fff'}
                                        newMessagesSeparatorText='New Messages'
                                        fileAttachmentsBoxBackground={'#F3F5F7'}
                                        fileAttachmentsBoxBorder='none'
                                        fileAttachmentsTitleColor={'#17191C'}
                                        fileAttachmentsSizeColor={'#757D8B'}
                                        fileAttachmentsBoxWidth={220}
                                        imageAttachmentMaxWidth={220}
                                        imageAttachmentMaxHeight={200}
                                        videoAttachmentMaxWidth={220}
                                        videoAttachmentMaxHeight={200}
                                        sameUserMessageSpacing='6px'
                                        differentUserMessageSpacing='12px'
                                        editMessage={false}
                                        deleteMessage={false}
                                        forwardMessage={false}
                                        copyMessage={false}
                                        replyMessage={false}
                                        replyMessageInThread={false}
                                        messageReaction={false}
                                        reportMessage={false}
                                        selectMessage={false}
                                    />
                                    <MessagesScrollToBottomButton />
                                    <SendMessage
                                        voiceMessage={false}
                                        allowMentionUser={false}
                                        allowTextEdit={false}
                                    />
                                </Chat>
                            </SceytChat>
                        ) : (
                            <div className='livechat_loading'>
                                <img src={sceytRounded} alt="loading" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
