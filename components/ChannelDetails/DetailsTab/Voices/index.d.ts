/// <reference types="react" />
interface IProps {
    channelId: string;
    voicePreviewPlayIcon?: JSX.Element;
    voicePreviewPlayHoverIcon?: JSX.Element;
    voicePreviewPauseIcon?: JSX.Element;
    voicePreviewPauseHoverIcon?: JSX.Element;
    voicePreviewTitleColor?: string;
    voicePreviewDateAndTimeColor?: string;
    voicePreviewHoverBackgroundColor?: string;
}
declare const Voices: ({ channelId, voicePreviewPlayIcon, voicePreviewPlayHoverIcon, voicePreviewPauseIcon, voicePreviewPauseHoverIcon, voicePreviewTitleColor, voicePreviewDateAndTimeColor, voicePreviewHoverBackgroundColor }: IProps) => JSX.Element;
export default Voices;
