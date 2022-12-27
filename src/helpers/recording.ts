export async function startRecording(setRecording: any) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setRecording((prevState: any) => ({ ...prevState, mediaStream: stream }));
    /* use the stream */
  } catch (err) {
    /* handle the error */
  }
}
