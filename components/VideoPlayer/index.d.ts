/// <reference types="react" />
interface IVideoPlayerProps {
    src: string;
    videoFileId?: string;
    activeFileId?: string;
}
declare const VideoPlayer: ({ src, videoFileId, activeFileId }: IVideoPlayerProps) => JSX.Element;
export default VideoPlayer;
