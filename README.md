# sceyt-ui-kit

## Install

```bash
# If you use npm:
npm install sceyt-chat
npm install sceyt-ui-kit

# Or if you use Yarn:
yarn add sceyt-chat
yarn add sceyt-ui-kit
```

## Initialization
```tsx
import SceytChatClient from 'sceyt-chat'

const chatClient = new SceytChatClient('{apiUrl}', '{appId}', '{clientId}')

// Before connecting to the SceytChat service, it's a good idea to add connection listeners to the SceytChat client to handle various events that may occur during the connection process. Here are connection listeners you can add:

// Create a new connection listener
const connectionListener = new chatClient.ConnectionListener();

// Set the listener function for the 'connectionStatusChanged' event
connectionListener.onConnectionStatusChanged = async (status) => {
  console.log('Connection status changed:', status);
};

// Set the listener function for the 'tokenWillExpire' event
connectionListener.onTokenWillExpire = async (timeInterval) => {
  console.log('Token will expire in', timeInterval/1000, 'seconds');
};

// Set the listener function for the 'tokenExpired' event
connectionListener.onTokenExpired = async () => {
  console.log('Access token has expired');
};

// Add the connection listener to the SceytChat client
chatClient.addConnectionListener('my-connection-listener', connectionListener);

// Connect to the Sceyt Chat API with a valid access token
chatClient.connect('{accessToken}');
```

Before using UiKit, make sure the SceytChatClient is initialized

## Usage

```tsx
import {
    SceytChat,
    ChannelList,
    Chat,
    ChatHeader,
    MessageList,
    SendMessage,
    ChannelDetails,
} from 'sceyt-ui-kit';

function App() {
    return (
        <SceytChat client={client}>
            <ChannelList/>
            <Chat>
                <ChatHeader/>
                <MessageList/>
                <SendMessage/>
            </Chat>
            <ChannelDetails/>
        </SceytChat>
    )
}
```

## License

MIT © [Armen-Varmtech](https://github.com/Armen-Varmtech)
