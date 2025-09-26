declare module 'mic-recorder-to-mp3' {
  export interface MicRecorderOptions {
    bitRate?: number
    sampleRate?: number
  }

  export default class MicRecorder {
    constructor(options?: MicRecorderOptions)
    start(): Promise<void>
    stop(): {
      getMp3(): Promise<[BlobPart[], Blob]>
    }

    activeStream?: MediaStream
  }
}
