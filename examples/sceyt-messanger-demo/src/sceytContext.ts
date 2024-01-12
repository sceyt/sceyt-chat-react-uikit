import { createContext } from 'react';
import SceytChatClient from "sceyt-chat";

export const SceytContext = createContext<{client?: SceytChatClient; theme?: string}>({});
