// Browser MIME values matter here: some files expose an empty or generic type.
export const documentDropCases = [
  ['report.pdf', 'application/pdf'],
  ['archive.zip', 'application/zip'],
  ['backup.7z', 'application/x-7z-compressed'],
  ['backup.tar.gz', 'application/gzip'],
  ['report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['contacts.csv', 'text/csv'],
  ['notes.txt', 'text/plain'],
  ['settings.json', 'application/json'],
  ['recording.mp3', 'audio/mpeg'],
  ['recording.wav', 'audio/wav'],
  ['disk.iso', 'application/octet-stream'],
  ['README', ''],
  ['հաշվետվություն 📄.pdf', '']
] as const

export const mediaDropCases = [
  ['photo.jpg', 'image/jpeg'],
  ['photo.PNG', 'image/png'],
  ['animation.gif', 'image/gif'],
  ['clip.mp4', 'video/mp4'],
  ['clip.MOV', 'video/quicktime'],
  ['clip.webm', 'video/webm']
] as const
