/// <reference types="react" />
import { IAttachment } from '../../../../types';
interface IProps {
    file: IAttachment;
    voicePreviewPlayIcon?: JSX.Element;
    voicePreviewPlayHoverIcon?: JSX.Element;
    voicePreviewPauseIcon?: JSX.Element;
    voicePreviewPauseHoverIcon?: JSX.Element;
    voicePreviewTitleColor?: string;
    voicePreviewDateAndTimeColor?: string;
    voicePreviewHoverBackgroundColor?: string;
    playingVoiceId?: string;
    setVoiceIsPlaying?: (attachmentId: string) => void;
}
declare const VoiceItem: ({ file, voicePreviewPlayIcon, voicePreviewPlayHoverIcon, voicePreviewPauseIcon, voicePreviewPauseHoverIcon, voicePreviewTitleColor, voicePreviewDateAndTimeColor, voicePreviewHoverBackgroundColor, setVoiceIsPlaying, playingVoiceId }: IProps) => JSX.Element;
export default VoiceItem;
