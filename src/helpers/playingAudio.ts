let playingAudioId: string = ''

export const setPlayingAudioId = (attachmentId: string) => {
  playingAudioId = attachmentId
}

export const getPlayingAudioId = () => playingAudioId
