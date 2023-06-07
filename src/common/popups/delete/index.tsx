import React, { useEffect, useState } from 'react'
import {
  Popup,
  PopupContainer,
  PopupDescription,
  PopupName,
  CloseIcon,
  PopupBody,
  Button,
  PopupFooter
} from '../../../UIHelper'
import { colors } from '../../../UIHelper/constants'
import styled from 'styled-components'
import CustomRadio from '../../customRadio'
import usePermissions from '../../../hooks/usePermissions'

interface IProps {
  title: string
  description: string | JSX.Element
  buttonText: string
  buttonTextColor?: string
  buttonBackground?: string
  togglePopup: () => void
  handleFunction: (option?: any) => void
  loading?: boolean
  isDeleteMessage?: boolean
  isIncomingMessage?: boolean
  isDirectChannel?: boolean
  allowDeleteIncoming?: boolean
  myRole?: string
}

function ConfirmPopup({
  title,
  description,
  buttonText,
  buttonTextColor,
  buttonBackground,
  togglePopup,
  handleFunction,
  isDeleteMessage,
  isIncomingMessage,
  allowDeleteIncoming,
  isDirectChannel,
  myRole = '',
  loading
}: IProps) {
  const [checkActionPermission] = usePermissions(myRole)
  const [initialRender, setInitialRender] = useState(true)
  const deleteForEveryoneIsPermitted = isIncomingMessage
    ? allowDeleteIncoming && !isDirectChannel && checkActionPermission('deleteAnyMessage')
    : isDirectChannel || checkActionPermission('deleteOwnMessage')
  const [deleteMessageOption, setDeleteMessageOption] = useState(deleteForEveryoneIsPermitted ? 'forEveryone' : 'forMe')

  const handleDelete = () => {
    handleFunction(isDeleteMessage && deleteMessageOption)
    togglePopup()
  }

  const handleChoseDeleteOption = (e: any, option: 'forEveryone' | 'forMe') => {
    if (e.target.checked) {
      setDeleteMessageOption(option)
    }
  }
  useEffect(() => {
    setInitialRender(false)
  }, [])

  // @ts-ignore
  return (
    <PopupContainer>
      <Popup maxWidth='520px' minWidth='520px' isLoading={loading} padding='0'>
        <PopupBody padding={24}>
          <CloseIcon onClick={() => togglePopup()} />
          <PopupName isDelete marginBottom='20px'>
            {title}
          </PopupName>
          <PopupDescription>{description}</PopupDescription>
          {isDeleteMessage && (
            <DeleteMessageOptions>
              {deleteForEveryoneIsPermitted && (
                <DeleteOptionItem onClick={() => setDeleteMessageOption('forEveryone')}>
                  <CustomRadio
                    index='1'
                    size='18px'
                    state={deleteMessageOption === 'forEveryone'}
                    onChange={(e) => handleChoseDeleteOption(e, 'forEveryone')}
                  />
                  Delete for everyone
                </DeleteOptionItem>
              )}
              <DeleteOptionItem onClick={() => setDeleteMessageOption('forMe')}>
                <CustomRadio
                  index='2'
                  size='18px'
                  state={deleteMessageOption === 'forMe'}
                  onChange={(e) => handleChoseDeleteOption(e, 'forMe')}
                />
                Delete for me
              </DeleteOptionItem>
            </DeleteMessageOptions>
          )}
        </PopupBody>
        <PopupFooter backgroundColor={colors.gray5}>
          <Button type='button' color={colors.gray6} backgroundColor='transparent' onClick={() => togglePopup()}>
            Cancel
          </Button>
          <Button
            type='button'
            backgroundColor={buttonBackground || colors.red1}
            color={buttonTextColor}
            borderRadius='8px'
            onClick={handleDelete}
            disabled={initialRender}
          >
            {buttonText || 'Delete'}
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default ConfirmPopup

const DeleteMessageOptions = styled.div`
  margin-top: 14px;
`
const DeleteOptionItem = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 15px;
  line-height: 160%;
  color: ${colors.gray8};
  margin-bottom: 12px;

  & > label {
    margin-right: 10px;
  }
`
