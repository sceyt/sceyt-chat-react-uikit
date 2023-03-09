/// <reference types="react" />
declare function EmojisPopup({ handleAddEmoji, handleEmojiPopupToggle, rtlDirection, rightSide }: {
    handleAddEmoji: (selectedEmoji: string) => void;
    handleEmojiPopupToggle?: (state: boolean) => void;
    rtlDirection?: boolean;
    rightSide?: boolean;
}): JSX.Element;
export default EmojisPopup;
