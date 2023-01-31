import React, { FC, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import styled, { keyframes } from 'styled-components'
// import metascraper from 'metascraper'
// @ts-ignore
// import WaveSurfer from 'wavesurfer.js';

import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { ReactComponent as SendIcon } from '../../assets/svg/send.svg'
import { ReactComponent as EyeIcon } from '../../assets/svg/eye.svg'
// import { ReactComponent as RecordIcon } from '../../assets/lib/svg/recordButton.svg'
import { ReactComponent as EditIcon } from '../../assets/svg/edit.svg'
import { ReactComponent as ReplyIcon } from '../../assets/svg/replyIcon.svg'
import { ReactComponent as AttachmentIcon } from '../../assets/svg/attachment.svg'
import { ReactComponent as CloseIcon } from '../../assets/svg/close.svg'
import { ReactComponent as EmojiSmileIcon } from '../../assets/svg/emojiSmileIcon.svg'
import { colors } from '../../UIHelper/constants'
import EmojisPopup from '../Emojis'
import Attachment, { AttachmentFile, AttachmentImg } from '../Attachment'
// import { useDidUpdate } from '../../hooks'
import {
  editMessageAC,
  sendMessageAC,
  sendTextMessageAC,
  setMessageForReplyAC,
  setMessageToEditAC,
  setSendMessageInputHeightAC
} from '../../store/message/actions'
import { makeUserName, MessageTextFormat, urlRegex } from '../../helpers'
import { DropdownOptionLi, DropdownOptionsUl, UploadFile } from '../../UIHelper'
import { messageForReplySelector, messageToEditSelector } from '../../store/message/selector'
import {
  activeChannelSelector,
  draggedAttachmentsSelector,
  typingIndicatorSelector
} from '../../store/channel/selector'
import { IUser } from '../../types'
import { joinChannelAC, sendTypingAC, setDraggedAttachments } from '../../store/channel/actions'
import { createFileImageThumbnail, createImageThumbnail, resizeImage } from '../../helpers/resizeImage'
import { connectionStatusSelector, contactsMapSelector } from '../../store/user/selector'
import { ReactComponent as ChoseFileIcon } from '../../assets/svg/choseFile.svg'
import { ReactComponent as BlockInfoIcon } from '../../assets/svg/error_circle.svg'
import { ReactComponent as ChoseMediaIcon } from '../../assets/svg/choseMedia.svg'
import DropDown from '../../common/dropdown'
import { getCustomUploader, getSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import { getFrame } from '../../helpers/getVideoFrame'
import { deleteVideoThumb } from '../../helpers/messagesHalper'
import { attachmentTypes } from '../../helpers/constants'
import usePermissions from '../../hooks/usePermissions'
import { getUserDisplayNameFromContact } from '../../helpers/contacts'
import { useDidUpdate } from '../../hooks'
// import got from 'got'

interface SendMessageProps {
  draggedAttachments?: boolean
  handleAttachmentSelected?: (state: boolean) => void
  hideEmojis?: boolean
  emojiIcoOrder?: number
  attachmentIcoOrder?: number
  sendIconOrder?: number
  iconsHoverColor?: string
  inputOrder?: number
  CustomTypingIndicator?: FC<{ from: IUser; typingState: boolean }>
  margin?: string
  border?: string
  borderRadius?: string
  selectedFileAttachmentsBoxWidth?: string
  selectedFileAttachmentsBoxBackground?: string
  selectedFileAttachmentsBoxBorder?: string
  selectedFileAttachmentsTitleColor?: string
  selectedFileAttachmentsSizeColor?: string
  selectedFileAttachmentsIcon?: JSX.Element
  selectedAttachmentsBorderRadius?: string
  replyMessageIcon?: JSX.Element
}
const SendMessageInput: React.FC<SendMessageProps> = ({
  handleAttachmentSelected,
  // draggedAttachments,
  emojiIcoOrder,
  attachmentIcoOrder,
  sendIconOrder,
  inputOrder,
  hideEmojis,
  iconsHoverColor,
  CustomTypingIndicator,
  margin,
  border,
  borderRadius,
  selectedAttachmentsBorderRadius,
  selectedFileAttachmentsIcon,
  selectedFileAttachmentsBoxWidth,
  selectedFileAttachmentsBoxBackground,
  selectedFileAttachmentsBoxBorder,
  selectedFileAttachmentsTitleColor,
  selectedFileAttachmentsSizeColor,
  replyMessageIcon
}) => {
  const dispatch = useDispatch()
  const getFromContacts = getUserDisplayNameFromContact()
  const activeChannel = useSelector(activeChannelSelector)
  const isBlockedUserChat = activeChannel.peer && activeChannel.peer.blocked
  const messageToEdit = useSelector(messageToEditSelector)
  const messageForReply = useSelector(messageForReplySelector)
  const draggedAttachments = useSelector(draggedAttachmentsSelector)
  // const { handleSendMessage } = useMessages(activeChannel)
  /* const recordingInitialState = {
    recordingSeconds: 0,
    recordingMilliseconds: 0,
    initRecording: false,
    mediaStream: null,
    mediaRecorder: null,
    audio: undefined
  } */
  const messageContRef = useRef<any>(null)
  const [checkActionPermission] = usePermissions(activeChannel.role)
  const [messageText, setMessageText] = useState('')
  const [editMessageText, setEditMessageText] = useState('')
  const [readyVideoAttachments, setReadyVideoAttachments] = useState({})
  const [showChooseAttachmentType, setShowChooseAttachmentType] = useState(false)
  /* MessageTextFormatForEdit({
    text: messageToEdit && messageToEdit.body,
    messageToEdit
  }) */
  const [isEmojisOpened, setIsEmojisOpened] = useState(false)
  const [emojisInRightSide, setEmojisInRightSide] = useState(false)

  // const [recording, setRecording] = useState<Recording>(recordingInitialState)
  // const [recordedFile, setRecordedFile] = useState<any>(null)

  // const [mentionedMembers, setMentionedMembers] = useState([])

  // const [mentionedMembersDisplayName, setMentionedMembersDisplayName] = useState([])

  // const [currentMentions, setCurrentMentions] = useState(undefined)

  // const [mentionTyping, setMentionTyping] = useState(false)

  // const [mentionEdit, setMentionEdit] = useState(undefined)

  // const [selectionPos, setSelectionPos] = useState()

  const [typingTimout, setTypingTimout] = useState<any>()
  const [inTypingState, setInTypingState] = useState(false)
  const [sendMessageIsActive, setSendMessageIsActive] = useState(false)
  // const [openMention, setOpenMention] = useState(false)
  const [attachments, setAttachments]: any = useState([])
  const typingIndicator = useSelector(typingIndicatorSelector(activeChannel.id))
  const contactsMap = useSelector(contactsMapSelector)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)
  // const typingIndicator = { from: { firstName: 'Armen2', lastName: 'Mkrtchyan2', id: 'armen2' }, typingState: true }
  const fileUploader = useRef<any>(null)
  const messageInput = useRef<any>(null)
  // const emojisRef = useRef<any>(null)
  const emojiBtnRef = useRef<any>(null)
  // const mentionsRef = useRef<any>(null)
  // const mentionsBtnRef = useRef<any>(null)
  // const playerRef = useRef<any>(null)

  const mediaExtensions = '.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.wmv,.flv,.webm'
  const handleSendTypingState = (typingState: boolean) => {
    setInTypingState(typingState)
    dispatch(sendTypingAC(typingState))
  }

  /* const handleSetMention = (member) => {
    const mentionDisplayName = `${member.firstName}${member.lastName !== '' ? ` ${member.lastName}` : ''}`;
    const mentionToChange = mentionedMembers.find((men) => men.start === currentMentions.start);
    if (mentionToChange) {
      setMentionedMembers(mentionedMembers.filter((menMem) => menMem.start !== currentMentions.start));
      setMentionedMembersDisplayName(mentionedMembersDisplayName.filter((menMem) => menMem.id !== mentionToChange.id));
    }
    setMentionedMembers((members) =>
    [...members,
    { ...member, start: currentMentions.start, end: currentMentions.start + mentionDisplayName.length + 1 }]);
    if (!mentionedMembersDisplayName.find((menMem) => menMem.id === member.id)) {
      setMentionedMembersDisplayName(
        (prevState) => ([...prevState, { id: member.id, displayName: `@${mentionDisplayName}` }]),
      );
    }
    setMentionTyping(false);
    setMessageText([messageText.slice(0, currentMentions.start + 1),
      mentionDisplayName, messageText.slice(currentMentions.start + 1 + currentMentions.typed.length)].join(''));
    const updateCurrentMentions = { ...currentMentions };
    updateCurrentMentions.typed = mentionDisplayName;
    updateCurrentMentions.id = member.id;
    updateCurrentMentions.end = updateCurrentMentions.start + mentionDisplayName.length;
    setCurrentMentions(updateCurrentMentions);
    setMentionEdit(undefined);
    messageInput.current.focus();
  }; */
  /* const handleCloseMentionsPopup = () => {
    setOpenMention(false)
    setMentionTyping(false)
    setMentionEdit(undefined)
  } */
  /* const handleMentionButtonClick = () => {
    if (!openMention) {
      const selPos = messageInput.current.selectionStart;
      const updateMessageText = [messageText.slice(0, selPos), '@', messageText.slice(selPos)].join('');

      setMessageText(updateMessageText);
      setCurrentMentions({
        start: messageInput.current.selectionStart,
        typed: '',
      });
    } else if (messageText.slice(-1) === '@') {
      setMessageText(messageText.slice(0, -1));
    }
    setOpenMention(!openMention);
  }; */
  const handleTyping = (e: any) => {
    if (messageToEdit) {
      setEditMessageText(e.currentTarget.value)
    } else {
      setMessageText(e.currentTarget.value)
    }
    /* if (mentionTyping) {
      if (e.currentTarget.value.slice(-1) === ' ') {
        setMentionTyping(false);
        handleCloseMentionsPopup();
        if (!currentMentions.end) {
          setCurrentMentions(undefined);
        }
      } else if (!currentMentions.end) {
        const typedMessage = e.currentTarget.value;
        const updateCurrentMentions = { ...currentMentions };
        // eslint-disable-next-line prefer-destructuring
        updateCurrentMentions.typed = typedMessage.slice(updateCurrentMentions.start + 1).split(' ')[0];
        setCurrentMentions(updateCurrentMentions);
      }
    } */
    /* if (mentionEdit && !(e.key === 'Delete' || e.key === 'Backspace')) {
      const selPos = e.currentTarget.selectionStart;
      setMentionedMembers(((prevState) => prevState.filter((mem) => mem.id !== mentionEdit.id)));
      setCurrentMentions({
        start: mentionEdit.start,
        typed: messageText.slice(mentionEdit.start + 1, selPos),
      });
    } */

    if (typingTimout) {
      clearTimeout(typingTimout)
    } else {
      handleSendTypingState(true)
    }
    setTypingTimout(
      setTimeout(() => {
        setTypingTimout(0)
      }, 2000)
    )
  }

  /* const handleKeyDown = (e) => {
    const selPos = e.currentTarget.selectionStart;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      setSelectionPos(selPos);
    }
    if (e.key === '@' && !mentionTyping) {
      setCurrentMentions({
        start: messageInput.current.selectionStart,
        typed: '',
      });

      if (!mentionTyping) {
        setMentionTyping(true);
        setOpenMention(true);
      }
    }
    if (mentionedMembers.length) {
      let edited = false;
      const editMentions = mentionedMembers.map((men) => {
        if (men.start > selPos - 1) {
          if (!edited) {
            edited = true;
          }
          const newMen = { ...men };
          if (e.key === 'Delete' || e.key === 'Backspace') {
            newMen.start -= 1;
            newMen.end -= 1;
          } else {
            newMen.start += 1;
            newMen.end += 1;
          }
          return newMen;
        }
        return men;
      });
      if (edited) {
        setMentionedMembers(editMentions);
      }
    }
    if (e.keyCode === 8) {
      const mentionToEdit = mentionedMembers.find((menMem) => menMem.start < selPos && menMem.end >= selPos);
      if (mentionToEdit) {
        setOpenMention(true);
        setMentionTyping(true);
        setMentionedMembers(((prevState) => prevState.filter((mem) => mem.id !== mentionToEdit.id)));
        setCurrentMentions({
          start: mentionToEdit.start,
          typed: messageText.slice(mentionToEdit.start, selPos - 1),
        });
      } else if (currentMentions) {
        if (currentMentions.start + 1 >= selPos) {
          setCurrentMentions(undefined);
          setOpenMention(false);
          setMentionTyping(false);
        } else {
          setCurrentMentions({
            start: currentMentions.start,
            typed: messageText.slice(currentMentions.start, selPos - 1),
          });
        }
      }
    }
  }; */

  const handleCloseReply = () => {
    dispatch(setMessageForReplyAC(null))
  }

  const handleSendEditMessage = (event?: any) => {
    const { shiftKey, charCode, type } = event
    const shouldSend = (charCode === 13 && shiftKey === false) || type === 'click'
    if (shouldSend) {
      event.preventDefault()
      if (messageToEdit) {
        handleEditMessage()
      } else {
        const messageTexToSend = messageText.trim()
        // if (messageTexToSend) {
        // eslint-disable-next-line max-len
        /* let mentionedMembersPositions = {}
         const sortedMentionedMembersDspNames = mentionedMembersDisplayName.sort((a, b) =>
           a.displayName < b.displayName ? 1 : b.displayName < a.displayName ? -1 : 0
         )
         const findIndexes = []
         sortedMentionedMembersDspNames.forEach((menMem) => {
           let menIndex = messageTexToSend.indexOf(menMem.displayName)
           let existingIndex = findIndexes.includes(menIndex)
           let i = 0
           while (existingIndex) {
             menIndex = messageTexToSend.indexOf(menMem.displayName, menIndex + 1)
             existingIndex = findIndexes.includes(menIndex)
             // eslint-disable-next-line no-plusplus
             i++
             if (i > sortedMentionedMembersDspNames.length) {
               break
             }
           }

           const mentionDisplayLength = menMem.displayName.length
           if (!mentionedMembersPositions[menMem.id] && menIndex >= 0) {
             findIndexes.push(menIndex)
             mentionedMembersPositions = {
               ...mentionedMembersPositions,
               [menMem.id]: { loc: menIndex, len: mentionDisplayLength }
             }
           }
         }) */

        const messageToSend: any = {
          // metadata: mentionedMembersPositions,
          body: messageTexToSend,
          mentionedMembers: [],
          attachments: [],
          type: 'text'
        }

        /* messageToSend.mentionedMembers = mentionedMembers.filter(
           (v: any, i, a) => a.findIndex((t: any) => t.id === v.id) === i
         ) */
        // messageToSend.type = /(https?:\/\/[^\s]+)/.test(messageToSend.body) ? 'link' : messageToSend.type

        if (messageForReply) {
          messageToSend.parent = messageForReply
        }

        if (messageTexToSend && !attachments.length) {
          const messageTextArr = [messageTexToSend]
          let firstUrl: any
          messageTextArr.forEach((textPart) => {
            if (urlRegex.test(textPart)) {
              const textArray = textPart.split(urlRegex)
              textArray.forEach(async (part) => {
                if (urlRegex.test(part)) {
                  if (!firstUrl) {
                    firstUrl = part
                    try {
                    } catch (error) {
                      console.error(error)
                    }
                  }
                }
              })
            }
          })
          if (firstUrl) {
            messageToSend.attachments = [
              {
                type: attachmentTypes.link,
                data: firstUrl,
                upload: false
              }
            ]
          }
          dispatch(sendTextMessageAC(messageToSend, activeChannel.id, connectionStatus))
        }
        if (attachments.length) {
          const sendAsSeparateMessage = getSendAttachmentsAsSeparateMessages()

          messageToSend.attachments = attachments.map((attachment: any, index: any) => {
            const attachmentToSend = {
              name: attachment.data.name,
              data: attachment.data,
              attachmentId: attachment.attachmentId,
              upload: attachment.upload,
              attachmentUrl: attachment.attachmentUrl,
              metadata: attachment.metadata,
              type: attachment.type,
              size: attachment.size
            }
            if (sendAsSeparateMessage) {
              if (index !== 0) {
                messageToSend.body = ''
              }
              /* handleSendMessage(
                {
                  ...messageToSend,
                  attachments: [attachmentToSend],
                  metadata: { ...messageToSend.metadata, groupId }
                },
                connectionStatus,
                activeChannel.id,
                true
              ) */
              dispatch(
                sendMessageAC(
                  {
                    ...messageToSend,
                    attachments: [attachmentToSend]
                  },
                  activeChannel.id,
                  connectionStatus,
                  true
                )
              )
            }
            return attachmentToSend
          })
          if (!sendAsSeparateMessage) {
            dispatch(sendMessageAC(messageToSend, activeChannel.id, connectionStatus, false))
          }
        }

        setMessageText('')
        setAttachments([])
        handleCloseReply()
        // setMentionedMembers([])
        // setMentionedMembersDisplayName([])
        // setOpenMention(false)
        // setMentionTyping(false)
        fileUploader.current.value = ''
        if (inTypingState) {
          handleSendTypingState(false)
        }
        clearTimeout(typingTimout)
        setTypingTimout(undefined)
        /* else if (recordedFile) {
         /!* const file = new File([recordedFile.data], 'voice_message.webm', {
           type: 'audio/ogg',
         });
         const messageToSend = {
           metadata: '',
           body: '',
           mentionedMembers: [],
           attachments: [
             {
               name: recordedFile.data.name,
               data: recordedFile.data,
               attachmentId: Date.now(),
               upload: true,
               attachmentUrl: recordedFile.attachmentURL,
               metadata: 'metadata for voice message',
               type: recordedFile.data.type.split('/')[1]
             }
           ],
           type: 'voice'
         }
         dispatch(sendMessageAC(messageToSend))
       } */
      }
    }
  }
  const handleEditMessage = () => {
    const messageTexToSend = editMessageText.trim()
    let mentionedMembersPositions = messageToEdit.metadata
    let mentionedUserForSend = messageToEdit.mentionedUsers
    if (messageToEdit.mentionedUsers && messageToEdit.mentionedUsers.length) {
      mentionedMembersPositions = {}
      const findIndexes: any[] = []
      mentionedUserForSend.forEach((menMem: any) => {
        // eslint-disable-next-line max-len
        const mentionedMembersDisplayName = `@${menMem.firstName}${menMem.lastName !== '' ? ` ${menMem.lastName}` : ''}`
        let menIndex = messageTexToSend.indexOf(mentionedMembersDisplayName)
        let existingIndex = findIndexes.includes(menIndex)
        let i = 0
        if (menIndex < 0) {
          mentionedUserForSend = messageToEdit.mentionedUsers.filter((menUs: any) => menUs.id !== menMem.id)
        } else {
          while (existingIndex) {
            menIndex = messageTexToSend.indexOf(menMem.displayName, menIndex + 1)
            existingIndex = findIndexes.includes(menIndex)
            // eslint-disable-next-line no-plusplus
            i++
            if (i > mentionedUserForSend.length) {
              break
            }
          }

          const mentionDisplayLength = mentionedMembersDisplayName.length
          if (!mentionedMembersPositions[menMem.id] && menIndex >= 0) {
            findIndexes.push(menIndex)
            mentionedMembersPositions = {
              ...mentionedMembersPositions,
              [menMem.id]: {
                loc: menIndex,
                len: mentionDisplayLength
              }
            }
          }
        }
      })
    }

    const messageToSend = {
      ...messageToEdit,
      metadata: mentionedMembersPositions,
      mentionedUsers: mentionedUserForSend,
      body: messageTexToSend
    }

    messageToSend.type = /(https?:\/\/[^\s]+)/.test(messageToSend.body) ? 'link' : messageToSend.type
    dispatch(editMessageAC(activeChannel.id, messageToSend))
    handleCloseEditMode()
  }
  const handleCloseEditMode = () => {
    setEditMessageText('')
    dispatch(setMessageToEditAC(null))
  }
  const removeUpload = (attachmentId: string) => {
    if (attachmentId) {
      deleteVideoThumb(attachmentId)
      setAttachments(attachments.filter((item: any) => item.attachmentId !== attachmentId))
    } else {
      setAttachments([])
    }
  }

  const handleFileUpload = (e: any) => {
    // const { files } = fileUploader.current
    const isMediaAttachment = e.target.accept === mediaExtensions
    const fileList = Object.values(e.target.files)
    // if (fileList.length > 10) {
    //   alert('You are chosen more than 10 attachment')
    // } else {
    const customUploader = getCustomUploader()
    fileList.forEach(async (file: any) => {
      const fileType = file.type.split('/')[0]
      if (customUploader) {
        if (fileType === 'image') {
          resizeImage(file, 700, 500).then(async (resizedFile: any) => {
            setAttachments((prevState: any[]) => [
              ...prevState,
              {
                data: file,
                upload: false,
                type: isMediaAttachment ? fileType : 'file',
                attachmentUrl: URL.createObjectURL(resizedFile.blob as any),
                attachmentId: uuidv4(),
                size: file.size
              }
            ])
          })
        } else if (fileType === 'video') {
          setAttachments((prevState: any[]) => [
            ...prevState,
            {
              data: file,
              upload: false,
              type: isMediaAttachment ? fileType : 'file',
              attachmentUrl: URL.createObjectURL(file),
              attachmentId: uuidv4(),
              size: file.size
            }
          ])
        } else {
          setAttachments((prevState: any[]) => [
            ...prevState,
            {
              data: file,
              upload: false,
              type: isMediaAttachment ? fileType : 'file',
              attachmentUrl: URL.createObjectURL(file),
              attachmentId: uuidv4(),
              size: file.size
            }
          ])
        }
      } else {
        if (fileType === 'image') {
          if (isMediaAttachment) {
            resizeImage(file).then(async (resizedFile: any) => {
              const { thumbnail } = await createImageThumbnail(file)
              // resizedFiles.forEach((file: any, index: number) => {
              setAttachments((prevState: any[]) => [
                ...prevState,
                {
                  data: new File([resizedFile.blob], resizedFile.file.name),
                  attachmentUrl: URL.createObjectURL(file),
                  attachmentId: uuidv4(),
                  type: fileType,
                  metadata: JSON.stringify({
                    tmb: thumbnail,
                    szw: resizedFile.newWidth,
                    szh: resizedFile.newHeight
                  })
                }
              ])
              // })
            })
          } else {
            createFileImageThumbnail(file).then((thumbnail) => {
              setAttachments((prevState: any[]) => [
                ...prevState,
                {
                  data: file,
                  // type: file.type.split('/')[0],
                  type: 'file',
                  attachmentUrl: URL.createObjectURL(file as any),
                  attachmentId: uuidv4(),
                  metadata: JSON.stringify({
                    tmb: thumbnail
                  })
                }
              ])
            })
          }
        } else if (fileType === 'video') {
          const { thumb, width, height } = await getFrame(URL.createObjectURL(file as any), 1)
          setAttachments((prevState: any[]) => [
            ...prevState,
            {
              data: file,
              // type: file.type.split('/')[0],
              type: 'video',
              attachmentUrl: URL.createObjectURL(file as any),
              attachmentId: uuidv4(),
              metadata: JSON.stringify({
                tmb: thumb,
                szw: width,
                szh: height
              })
            }
          ])
        } else {
          setAttachments((prevState: any[]) => [
            ...prevState,
            {
              data: file,
              // type: file.type.split('/')[0],
              type: 'file',
              attachmentUrl: URL.createObjectURL(file as any),
              attachmentId: uuidv4()
            }
          ])
        }
      }
    })
    // }
    /* const { files } = fileUploader.current
    const fileList = Object.values(files)
    fileList.forEach((file, index) => {
      setAttachments((prevState: any[]) => [
        ...prevState,
        {
          data: file,
          attachmentUrl: URL.createObjectURL(file as any),
          attachmentId: Date.now() + index
        }
      ])
    }) */
    fileUploader.current.value = ''
  }

  const onOpenFileUploader = (attachmentType: string) => {
    setShowChooseAttachmentType(false)
    fileUploader.current.accept = attachmentType
    fileUploader.current.click()
  }

  const handleEmojiPopupToggle = (bool: boolean) => {
    setIsEmojisOpened(bool)
    messageInput.current.focus()
  }

  const setVideoIsReadyToSend = (attachmentId: string) => {
    setReadyVideoAttachments({ ...readyVideoAttachments, [attachmentId]: true })
  }

  const handleJoinToChannel = () => {
    dispatch(joinChannelAC(activeChannel.id))
  }

  const handleClick = (e: any) => {
    const emojisContainer = document.getElementById('emojisContainer')
    if (
      emojisContainer &&
      !emojisContainer.contains(e.target) &&
      emojiBtnRef.current &&
      !emojiBtnRef.current.contains(e.target)
    ) {
      setIsEmojisOpened(false)
    }
    /* if (!mentionsRef.current.contains(e.target) && !mentionsBtnRef.current.contains(e.target)) {
      handleCloseMentionsPopup();
    } */
  }
  /* useEffect(() => {
    if (mentionedMembers.length) {
      const currentPos = messageInput.current.selectionStart;
      const mentionToEdit = mentionedMembers.find((menMem) => menMem.start <= currentPos && menMem.end >= currentPos);
      if (mentionToEdit) {
        setMentionEdit(mentionToEdit);
        if (!currentMentions) {
          setCurrentMentions({
            start: mentionToEdit.start,
            typed: messageText.slice(mentionToEdit.start + 1, mentionToEdit.end),
          });
        }
        setOpenMention(true);
        setMentionTyping(true);
      } else if (openMention || mentionTyping) {
        handleCloseMentionsPopup();
        setMentionTyping(false);
      }
    }
  }, [selectionPos]); */

  useEffect(() => {
    if (typingTimout === 0) {
      handleSendTypingState(false)
    }
  }, [typingTimout])

  useDidUpdate(() => {
    if (draggedAttachments.length > 0) {
      const attachmentsFiles = draggedAttachments.map(
        (draggedData: any) => {
          const arr = draggedData.data.split(',')
          const bstr = atob(arr[1])
          let n = bstr.length
          const u8arr = new Uint8Array(n)
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
          }
          return new File([u8arr], draggedData.name, { type: draggedData.type })
        }
        /* new File([draggedData.data], draggedData.name, {
            type: draggedData.type
          }) */
      )
      const customUploader = getCustomUploader()
      attachmentsFiles.forEach(async (file: any) => {
        const fileType = file.type.split('/')[0]
        const isMediaAttachment = draggedAttachments[0].attachmentType === 'media'
        if (customUploader) {
          if (fileType === 'image') {
            resizeImage(file, 700, 500).then(async (resizedFile: any) => {
              setAttachments((prevState: any[]) => [
                ...prevState,
                {
                  data: file,
                  upload: false,
                  type: isMediaAttachment ? fileType : 'file',
                  attachmentUrl: URL.createObjectURL(resizedFile.blob as any),
                  attachmentId: uuidv4(),
                  size: file.size
                }
              ])
            })
          } else if (fileType === 'video') {
            setAttachments((prevState: any[]) => [
              ...prevState,
              {
                data: file,
                upload: false,
                type: isMediaAttachment ? fileType : 'file',
                attachmentUrl: URL.createObjectURL(file),
                attachmentId: uuidv4(),
                size: file.size
              }
            ])
          } else {
            setAttachments((prevState: any[]) => [
              ...prevState,
              {
                data: file,
                upload: false,
                type: isMediaAttachment ? fileType : 'file',
                attachmentUrl: URL.createObjectURL(file),
                attachmentId: uuidv4(),
                size: file.size
              }
            ])
          }
        } else {
          if (fileType === 'image') {
            if (isMediaAttachment) {
              resizeImage(file).then(async (resizedFile: any) => {
                const { thumbnail } = await createImageThumbnail(file)
                // resizedFiles.forEach((file: any, index: number) => {
                setAttachments((prevState: any[]) => [
                  ...prevState,
                  {
                    data: new File([resizedFile.blob], resizedFile.file.name),
                    attachmentUrl: URL.createObjectURL(file),
                    attachmentId: uuidv4(),
                    type: fileType,
                    metadata: JSON.stringify({
                      tmb: thumbnail,
                      szw: resizedFile.newWidth,
                      szh: resizedFile.newHeight
                    })
                  }
                ])
                // })
              })
            } else {
              createFileImageThumbnail(file).then((thumbnail) => {
                setAttachments((prevState: any[]) => [
                  ...prevState,
                  {
                    data: file,
                    // type: file.type.split('/')[0],
                    type: 'file',
                    attachmentUrl: URL.createObjectURL(file as any),
                    attachmentId: uuidv4(),
                    metadata: JSON.stringify({
                      tmb: thumbnail
                    })
                  }
                ])
              })
            }
          } else if (fileType === 'video') {
            const { thumb, width, height } = await getFrame(URL.createObjectURL(file as any), 1)
            setAttachments((prevState: any[]) => [
              ...prevState,
              {
                data: file,
                // type: file.type.split('/')[0],
                type: 'video',
                attachmentUrl: URL.createObjectURL(file as any),
                attachmentId: uuidv4(),
                metadata: JSON.stringify({
                  tmb: thumb,
                  szw: width,
                  szh: height
                })
              }
            ])
          } else {
            setAttachments((prevState: any[]) => [
              ...prevState,
              {
                data: file,
                // type: file.type.split('/')[0],
                type: 'file',
                attachmentUrl: URL.createObjectURL(file as any),
                attachmentId: uuidv4()
              }
            ])
          }
        }
      })
      dispatch(setDraggedAttachments([], ''))
    }
  }, [draggedAttachments])

  /* const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setRecording((prevState: any) => ({
        ...prevState,
        initRecording: true,
        mediaStream: stream
      }))
    } catch (e) {
    }
  }

  const saveRecord = () => {
    const recorder = recording.mediaRecorder
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  const deleteRecord = () => {
    const recorder = recording.mediaRecorder
    if (recorder)
      recorder.stream.getAudioTracks().forEach((track: any) => track.stop())
    setRecording(recordingInitialState)
  }

  useDidUpdate(() => {
    if (recording.mediaStream) {
      setRecording({
        ...recording,
        mediaRecorder: new MediaRecorder(recording.mediaStream, {
          mimeType: 'audio/webm'
        })
      })
    }
  }, [recording.mediaStream])

  useEffect(() => {
    const MAX_RECORDER_TIME = 15
    let recordingInterval: any = null

    if (recording.initRecording) {
      recordingInterval = setInterval(() => {
        setRecording((prevState) => {
          if (
            prevState.recordingSeconds === MAX_RECORDER_TIME &&
            prevState.recordingMilliseconds === 0
          ) {
            clearInterval(recordingInterval)
            return prevState
          }

          if (
            prevState.recordingMilliseconds >= 0 &&
            prevState.recordingMilliseconds < 99
          ) {
            return {
              ...prevState,
              recordingMilliseconds: prevState.recordingMilliseconds + 1
            }
          }

          if (prevState.recordingMilliseconds === 99) {
            return {
              ...prevState,
              recordingSeconds: prevState.recordingSeconds + 1,
              recordingMilliseconds: 0
            }
          }

          return prevState
        })
      }, 10)
    } else clearInterval(recordingInterval)

    return () => clearInterval(recordingInterval)
  }, [recording.initRecording])

  useEffect(() => {
    const recorder = recording.mediaRecorder
    let chunks: Blob[] = []
    if (recorder && recorder.state === 'inactive') {
      recorder.start()
      recorder.ondataavailable = (e) => {
        chunks.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        chunks = []
        setRecording((prevState) => {
          if (prevState.mediaRecorder) {
            setRecordedFile({
              data: blob,
              attachmentURL: URL.createObjectURL(blob)
            })
            return {
              ...recordingInitialState,
              initRecording: false,
              audio: URL.createObjectURL(blob)
            }
          }
          return recordingInitialState
        })
      }
    }

    return () => {
      if (recorder)
        recorder.stream.getAudioTracks().forEach((track) => track.stop())
    }
  }, [recording.mediaRecorder])

  useEffect(() => {
    if (recordedFile) {
      handleSendEditMessage()
    }
  }, [recordedFile])
*/
  useEffect(() => {
    setMessageText('')
    // setMentionedMembers([])
    // setMentionedMembersDisplayName([])
    setAttachments([])
    if (messageInput.current) {
      messageInput.current.focus()
    }
    // setOpenMention(false)
    handleCloseEditMode()
    clearTimeout(typingTimout)
  }, [activeChannel.id])

  useEffect(() => {
    if (messageText || (editMessageText && editMessageText !== messageToEdit.body) || attachments.length) {
      if (attachments.length) {
        let videoAttachment = false
        attachments.forEach((att: any) => {
          if (att.data.type.split('/')[0] === 'video') {
            videoAttachment = true
            if (!readyVideoAttachments[att.attachmentId]) {
              setSendMessageIsActive(false)
            } else {
              setSendMessageIsActive(true)
            }
          }
        })
        if (!videoAttachment) {
          setSendMessageIsActive(true)
        }
      } else {
        setSendMessageIsActive(true)
      }
    } else {
      setSendMessageIsActive(false)
    }
  }, [messageText, attachments, editMessageText, readyVideoAttachments])

  useEffect(() => {
    if (handleAttachmentSelected) {
      handleAttachmentSelected(!!attachments.length)
    }
    if (messageContRef && messageContRef.current) {
      dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
    }
  }, [attachments])

  useEffect(() => {
    if (messageForReply && messageToEdit) {
      handleCloseEditMode()
    }

    if (messageContRef && messageContRef.current) {
      dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
    }
    if (messageInput.current) {
      messageInput.current.focus()
    }
  }, [messageForReply])

  useEffect(() => {
    if (messageToEdit) {
      setEditMessageText(messageToEdit.body || '')
      if (messageForReply) {
        handleCloseReply()
      }
    }
    if (messageContRef && messageContRef.current) {
      dispatch(setSendMessageInputHeightAC(messageContRef.current.getBoundingClientRect().height))
    }

    if (messageInput.current) {
      messageInput.current.focus()
    }
  }, [messageToEdit])

  useEffect(() => {
    /* wavesurfer.current = WaveSurfer.create({
      container: '#waveform',
      waveColor: '#757D8B',
      progressColor: '#0DBD8B',
      // cursorColor: 'transparent',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 0,
      barGap: 2,
      barMinHeight: 1,
      height: 200,
    });

    wavesurfer.current.on('ready', () => {
      wavesurfer.current.play();
    }); */

    if (emojiBtnRef.current && emojiBtnRef.current.offsetLeft > messageInput.current.offsetWidth) {
      setEmojisInRightSide(true)
    }
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])
  return (
    <Container margin={margin} border={border} borderRadius={borderRadius} ref={messageContRef}>
      {!activeChannel.id ? (
        <Loading />
      ) : isBlockedUserChat ? (
        <BlockedUserInfo>
          <BlockInfoIcon /> You blocked this user.
        </BlockedUserInfo>
      ) : !activeChannel.role ? (
        <JoinChannelCont onClick={handleJoinToChannel}>Join</JoinChannelCont>
      ) : !checkActionPermission('sendMessage') ? (
        <ReadOnlyCont>
          <EyeIcon /> Read only
        </ReadOnlyCont>
      ) : (
        <React.Fragment>
          <TypingIndicator>
            {CustomTypingIndicator ? (
              <CustomTypingIndicator from={typingIndicator.from} typingState={typingIndicator.typingState} />
            ) : (
              typingIndicator &&
              typingIndicator.typingState && (
                <TypingIndicatorCont>
                  <TypingFrom>
                    {(contactsMap[typingIndicator.from.id] && contactsMap[typingIndicator.from.id].firstName) ||
                      typingIndicator.from.id}{' '}
                    is typing
                  </TypingFrom>
                  <TypingAnimation>
                    <DotOne />
                    <DotTwo />
                    <DotThree />
                  </TypingAnimation>
                </TypingIndicatorCont>
              )
            )}
          </TypingIndicator>
          {/* <EmojiContainer rigthSide={emojisInRightSide} ref={emojisRef} isEmojisOpened={isEmojisOpened}> */}
          {isEmojisOpened && (
            <EmojisPopup
              setMessageText={setMessageText}
              messageText={messageText}
              // ccc={handleTyping}
              handleEmojiPopupToggle={handleEmojiPopupToggle}
              rightSide={emojisInRightSide}
            />
          )}
          {/* </EmojiContainer> */}
          {messageToEdit && (
            <EditReplyMessageCont>
              <CloseEditMode onClick={handleCloseEditMode}>
                <CloseIcon />
              </CloseEditMode>
              <EditReplyMessageHeader>
                <EditIcon />
                Edit Message
              </EditReplyMessageHeader>
              {messageToEdit.body}
            </EditReplyMessageCont>
          )}
          {messageForReply && (
            <EditReplyMessageCont>
              <CloseEditMode onClick={handleCloseReply}>
                <CloseIcon />
              </CloseEditMode>
              <EditReplyMessageHeader>
                {replyMessageIcon || <ReplyIcon />} Reply{' '}
                {makeUserName(contactsMap[messageForReply.user.id], messageForReply.user, getFromContacts)}
              </EditReplyMessageHeader>
              {MessageTextFormat({ text: messageForReply.body, message: messageForReply })}
            </EditReplyMessageCont>
          )}
          {/* {messageForReply && (
        <ReplyMessageContainer>
          <CloseReply onClick={handleCloseReply}>
            <CloseSvg />
          </CloseReply>
          <MessageOwner>
            {messageForReply.user
              ? messageForReply.user.firstName
                ? `${messageForReply.user.firstName} ${messageForReply.user.lastName}`
                : messageForReply.user.id
              : 'Deleted user'}
          </MessageOwner>
          <MessageText>
            <MessageTextFormat text={messageForReply.body} message={messageForReply} />
          </MessageText>
        </ReplyMessageContainer>
      )} */}
          {!!attachments.length && (
            <ChosenAttachments fileBoxWidth={selectedFileAttachmentsBoxWidth}>
              {attachments.map((attachment: any) => (
                <Attachment
                  attachment={attachment}
                  isPrevious
                  removeSelected={removeUpload}
                  key={attachment.attachmentId}
                  setVideoIsReadyToSend={setVideoIsReadyToSend}
                  borderRadius={selectedAttachmentsBorderRadius}
                  selectedFileAttachmentsIcon={selectedFileAttachmentsIcon}
                  backgroundColor={selectedFileAttachmentsBoxBackground || ''}
                  selectedFileAttachmentsBoxBorder={selectedFileAttachmentsBoxBorder}
                  selectedFileAttachmentsTitleColor={selectedFileAttachmentsTitleColor}
                  selectedFileAttachmentsSizeColor={selectedFileAttachmentsSizeColor}
                />
              ))}
            </ChosenAttachments>
          )}

          {/* <div id="waveform" /> */}
          {/* <SendMessageInput messageForReply={messageForReply}> */}
          <SendMessageInputContainer border={border} borderRadius={borderRadius}>
            {/* <AddAttachmentIcon onClick={() => onOpenFileUploader()} isActive={!!attachments.length}> */}

            {/* {!recording.initRecording && ( */}
            <DropDown
              forceClose={showChooseAttachmentType}
              position='top'
              order={attachmentIcoOrder}
              trigger={
                <AddAttachmentIcon isActive={!!attachments.length} iconHoverColor={iconsHoverColor}>
                  <AttachmentIcon />
                </AddAttachmentIcon>
              }
            >
              <DropdownOptionsUl>
                <DropdownOptionLi
                  key={1}
                  textColor={colors.gray6}
                  hoverBackground={colors.gray5}
                  onClick={() => onOpenFileUploader(mediaExtensions)}
                  iconWidth='20px'
                  iconColor={colors.gray4}
                >
                  <ChoseMediaIcon />
                  Photo or video
                </DropdownOptionLi>
                <DropdownOptionLi
                  key={2}
                  textColor={colors.gray6}
                  hoverBackground={colors.gray5}
                  onClick={() => onOpenFileUploader('')}
                  iconWidth='20px'
                  iconColor={colors.gray4}
                >
                  <ChoseFileIcon />
                  File
                </DropdownOptionLi>
              </DropdownOptionsUl>
            </DropDown>
            {/* )} */}
            {/* <MentionButton
          ref={mentionsBtnRef}
          // onClick={handleMentionButtonClick}
        >
          <MentionIcon />
        </MentionButton> */}

            {/* {!hideEmojis && !recording.initRecording && ( */}
            {!hideEmojis && (
              <EmojiButton
                order={emojiIcoOrder}
                isEmojisOpened={isEmojisOpened}
                ref={emojiBtnRef}
                iconHoverColor={iconsHoverColor}
                onClick={() => {
                  setIsEmojisOpened(!isEmojisOpened)
                }}
              >
                <EmojiSmileIcon />
              </EmojiButton>
            )}

            {/* <MentionsContainer ref={mentionsRef} mentionsIsOpen={openMention}>
          {openMention && (
          <MentionMembersPopup
            channelId={activeChannel.id}
            addMentionMember={handleSetMention}
            searchMention={currentMentions.typed}
            handleMentionsPopupClose={handleCloseMentionsPopup}
          />
          )}
        </MentionsContainer> */}
            <UploadFile ref={fileUploader} onChange={handleFileUpload} multiple type='file' />
            <MessageInput
              order={inputOrder}
              onChange={handleTyping}
              onKeyPress={handleSendEditMessage}
              // onKeyDown={handleKeyDown}
              value={editMessageText || messageText}
              ref={messageInput}
              placeholder='Type message here...'
            />
            <SendMessageIcon
              isActive={sendMessageIsActive}
              order={sendIconOrder}
              onClick={sendMessageIsActive ? handleSendEditMessage : null}
            >
              <SendIcon />
            </SendMessageIcon>
            {/*  {recording.initRecording ? (
            <AudioCont />
          ) : (
            <MessageInput
              order={inputOrder}
              onChange={handleTyping}
              onKeyPress={handleSendEditMessage}
              // onKeyDown={handleKeyDown}
              value={messageText}
              ref={messageInput}
              placeholder='Type message here...'
            />
          )}

          {sendMessageIsActive ? (
            <SendMessageIcon order={sendIcoOrder} onClick={handleSendEditMessage}>
              <SendIcon />
            </SendMessageIcon>
          ) : recording.initRecording ? (
            <React.Fragment>
              <RecordingTimer>
                {recording.recordingSeconds}:{recording.recordingMilliseconds}
              </RecordingTimer>
              <SendMessageIcon order={sendIcoOrder} onClick={deleteRecord}>
                <DelteIcon />
              </SendMessageIcon>
              <SendMessageIcon order={sendIcoOrder} onClick={saveRecord}>
                <SendIcon />
              </SendMessageIcon>
            </React.Fragment>
          ) : (
            <SendMessageIcon order={sendIcoOrder} onClick={startRecording}>
              <RecordIcon />
            </SendMessageIcon>
          )} */}
          </SendMessageInputContainer>
        </React.Fragment>
      )}
    </Container>
  )
}

const Container = styled.div<{ margin?: string; border?: string; borderRadius?: string; ref?: any }>`
  margin: ${(props) => props.margin || '30px 16px 16px'};
  border-top: 1px solid ${colors.gray1};
  border: ${(props) => props.border || ''};
  border-radius: ${(props) => props.borderRadius || '4px'};
  position: relative;
  padding: 0 12px;
`

const EditReplyMessageCont = styled.div<any>`
  position: relative;
  left: -12px;
  width: calc(100% - 8px);
  padding: 8px 16px;
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  color: ${colors.gray6};
  background-color: ${colors.gray5};
  z-index: 19;
  border-bottom: 1px solid ${colors.gray1};
`

const CloseEditMode = styled.span`
  position: absolute;
  top: 8px;
  right: 12px;
  width: 20px;
  height: 20px;
  text-align: center;
  line-height: 22px;
  cursor: pointer;
`
const EditReplyMessageHeader = styled.h4<any>`
  display: flex;
  margin: 0 0 2px;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${colors.primary};

  > svg {
    margin-right: 4px;
    width: 16px;
    height: 16px;
  }
`
const SendMessageInputContainer = styled.div<any>`
  display: flex;
  align-items: center;
  position: relative;
  min-height: 48px;
  box-sizing: border-box;
  border-radius: ${(props) => (props.messageForReply ? '0 0 4px 4px' : '4px')};
`

/*
const CloseReply = styled.span`
  position: absolute;
  right: 14px;
  top: 8px;
  cursor: pointer;
`
*/

const MessageInput = styled.textarea<any>`
  resize: none;
  padding: 14px 12px 0 12px;
  //padding: 16px 45px 0 80px;
  width: 100%;
  display: block;
  border: none;
  font: inherit;
  box-sizing: border-box;
  border-radius: 6px;
  outline: none !important;
  font-size: 15px;
  line-height: 17px;
  order: ${(props) => (props.order === 0 || props.order ? props.order : 3)};

  &::placeholder {
    font-size: 15px;
    color: ${colors.gray7};
    opacity: 1;
  }
  //caret-color: #000;
`

const AddAttachmentIcon = styled.span<any>`
  margin: 0 5px;
  cursor: pointer;
  line-height: 13px;
  z-index: 2;
  order: ${(props) => (props.order === 0 || props.order ? props.order : 1)};

  > svg {
    ${(props) => (props.isActive ? `color: ${props.iconHoverColor || colors.cobalt1};` : 'color: #898B99;')}
  }

  &:hover > svg {
    color: ${(props) => props.iconHoverColor || colors.cobalt1};
  }
`
const EmojiButton = styled.span<any>`
  position: relative;
  margin: 0 5px;
  cursor: pointer;
  line-height: 13px;
  z-index: 2;
  order: ${(props) => (props.order === 0 || props.order ? props.order : 2)};
  > svg {
    ${(props) => (props.isEmojisOpened ? `color: ${props.iconHoverColor || colors.cobalt1};` : 'color: #898B99;')}
  }

  &:hover > svg {
    color: ${(props) => props.iconHoverColor || colors.cobalt1};
  }
`

// TODO Mentions
/* const MentionButton = styled.span<any>`
  margin: 0 5px;
  cursor: pointer;
  line-height: 13px;
  z-index: 2;
  > svg {
    ${(props) =>
      props.isEmojisOpened ? `color: ${colors.cobalt1};` : 'color: #898B99;'}
  }

  &:hover > svg {
    color: ${colors.cobalt1};
  }
` */

/* const EmojiContainer = styled.div<any>`
  position: absolute;
  left: ${(props) => (props.rigthSide ? '-276px' : '-8px')};
  bottom: 46px;
  z-index: 9998;
` */

export const MentionsContainer = styled.span`
  position: absolute;
  left: 0;
  bottom: 100%;
  z-index: 9998;
`

/* const TypingMessage = styled.div`
  position: absolute;
  top: -21px;
  font-style: italic;
  color: #7c7e8e;
  font-size: 14px;
` */

const SendMessageIcon = styled.span<any>`
  margin: 0 5px;
  cursor: pointer;
  line-height: 13px;
  order: ${(props) => (props.order === 0 || props.order ? props.order : 4)};

  color: ${(props) => (props.isActive ? colors.primary : '#ccc')};
`

/* const AudioCont = styled.div<any>`
  display: flex;
  width: 100%;
  justify-content: flex-end;
`

const RecordingTimer = styled.span<any>`
  display: inline-block;
  width: 50px;
  font-size: 16px;
  color: ${colors.gray6};
` */

const ChosenAttachments = styled.div<{ fileBoxWidth?: string }>`
  display: flex;
  align-items: center;
  padding: 16px 16px 14px;
  overflow-x: auto;

  & ${AttachmentImg} {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    object-fit: cover;
  }

  & ${AttachmentFile} {
    width: ${(props) => props.fileBoxWidth || '200px'};
    padding: 6px 12px;
    height: 48px;
  }
`

const TypingIndicator = styled.div`
  position: absolute;
  bottom: 100%;
  left: 16px;
`

const TypingIndicatorCont = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
`

const TypingFrom = styled.h5`
  margin: 0 4px 0 0;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.2px;
  color: ${colors.gray9};
`
const sizeAnimation = keyframes`
  0% {
    width: 2px;
    height: 2px;
    opacity: 0.4;
  }
  100% {
    width: 6px;
    height: 6px;
    opacity: 1;
  }
`
const DotOne = styled.span``
const DotTwo = styled.span``
const DotThree = styled.span``
const TypingAnimation = styled.div`
  display: flex;

  & > span {
    position: relative;
    width: 6px;
    height: 6px;
    margin-right: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation-timing-function: linear;

    &:after {
      content: '';
      position: absolute;

      width: 3.5px;
      height: 3.5px;
      border-radius: 50%;
      background-color: #818c99;
      animation-name: ${sizeAnimation};
      animation-duration: 0.6s;
      animation-iteration-count: infinite;
    }
  }
  & ${DotOne} {
    &:after {
      animation-delay: 0s;
    }
  }
  & ${DotTwo} {
    &:after {
      animation-delay: 0.2s;
    }
  }
  & ${DotThree} {
    &:after {
      animation-delay: 0.3s;
    }
  }
`
const Loading = styled.div`
  height: 48px;
`
const BlockedUserInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  color: ${colors.gray6};

  & > svg {
    margin-right: 12px;
  }
`
const JoinChannelCont = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 -12px;
  padding: 14px;
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  color: ${colors.primary};
  background-color: ${colors.gray5};
  cursor: pointer;
`
const ReadOnlyCont = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
  color: ${colors.gray6};

  & > svg {
    margin-right: 12px;
    color: ${colors.primary};
  }
`
/* interface Recording {
  recordingSeconds: number
  recordingMilliseconds: number
  initRecording: boolean
  mediaStream: null | MediaStream
  mediaRecorder: null | MediaRecorder
  audio?: string
} */

export default SendMessageInput
