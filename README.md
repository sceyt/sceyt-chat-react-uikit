# Getting Started with Sceyt Chat React UiKit
To begin using Sceyt Chat React UiKit in your React project, you need to install two essential packages: sceyt-chat and
sceyt-chat-react-uikit. Follow these steps to set up your environment:

## Install

```bash
# If you use npm:
npm install sceyt-chat
npm install sceyt-chat-react-uikit

# Or if you use Yarn:
yarn add sceyt-chat
yarn add sceyt-chat-react-uikit
```

## Initializing Sceyt Chat in Your Application

### 1. Register on Sceyt.com:
Visit [sceyt.com](https://sceyt.com 'sceyt.com') and sign up for an account. Follow the registration process to create your account.

### 2. Create an Application:
Once your account is set up, navigate to the dashboard and create a new application. This
application will be the basis for integrating Sceyt chat into your project.

### 3. Obtain Application Credentials:
After creating your application, you will receive unique credentials – appId and apiUrl.
These are critical for the initialization process and will be used to authenticate and configure your chat instance.

### 4. Initialize Sceyt Chat:
Then, initialize Sceyt chat by using the credentials obtained from your Sceyt dashboard. Here's an example of how you
can do this in your application:\
**clientId:** serves as a unique identifier for each device or connection instance. This is crucial for managing user
sessions across different devices or browsers.The clientId distinguishes each connection or device from others. When a
user logs in from a new device or browser, they must use a unique clientId. Otherwise, the previously established
connection with the same userId will be disconnected.

```tsx
import SceytChatClient from 'sceyt-chat'

const chatClient = new SceytChatClient('{apiUrl}', '{appId}', '{clientId}')

// Before connecting to the SceytChat service, it's a good idea to add connection listeners to the SceytChat client to handle various events that may occur during the connection process. Here are connection listeners you can add:

// Create a new connection listener
const connectionListener = new chatClient.ConnectionListener();

// Set the listener function for the listen connection status changes
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

// Add the connection listener with unique id to the SceytChat client
chatClient.addConnectionListener('my-connection-listener-id', connectionListener);

// Connect to the Sceyt Chat API with a valid access token
chatClient.connect('{accessToken}');
```
#
#### Prior to using the UiKit, verify that the SceytChatClient is both initialized and connected. This can be done by monitoring changes in the connection status changes listener.
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

MIT ©
