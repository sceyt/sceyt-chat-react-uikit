export declare function getFrame(videoSrc: any, time?: number): Promise<{
    thumb: string;
    width: number;
    height: number;
}>;
export declare function getFrame2(videoSrc: any, time: number): Promise<unknown>;
export declare function getFrame3(video: any, time: number): Promise<import("./messagesHalper").IAttachmentMeta>;
