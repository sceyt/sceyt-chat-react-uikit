import React from 'react';
import { IAttachment } from '../../types';
interface AudioPlayerProps {
    url: string;
    file: IAttachment;
}
declare const AudioPlayer: React.FC<AudioPlayerProps>;
export default AudioPlayer;
