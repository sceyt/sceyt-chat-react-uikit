import React from 'react';
interface MessagesScrollToBottomButtonProps {
    buttonIcon?: JSX.Element;
    buttonWidth?: string;
    buttonHeight?: string;
    buttonBorder?: string;
    buttonBackgroundColor?: string;
    buttonHoverBackgroundColor?: string;
    buttonBorderRadius?: string;
    buttonShadow?: string;
    unreadCountWidth?: string;
    unreadCountHeight?: string;
    unreadCountFontSize?: string;
    unreadCountTextColor?: string;
    unreadCountBackgroundColor?: string;
}
declare const MessagesScrollToBottomButton: React.FC<MessagesScrollToBottomButtonProps>;
export default MessagesScrollToBottomButton;
