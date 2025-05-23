import React, { useEffect, useState } from 'react'
import { Popup, PopupDescription, PopupName, CloseIcon, PopupBody, Button, PopupFooter } from '../../../UIHelper'
import { colors, THEME_COLORS } from '../../../UIHelper/constants'
import styled from 'styled-components'
import CustomRadio from '../../customRadio'
import usePermissions from '../../../hooks/usePermissions'
import PopupContainer from '../popupContainer'
import { useColor } from '../../../hooks'

interface IProps {
  title: string
  description: string | JSX.Element
  buttonText: string
  theme?: string
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
  theme,
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
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.SECTION_BACKGROUND]: sectionBackground,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_1]: surface1Background,
    [THEME_COLORS.WARNING]: errorColor
  } = useColor()

  const [checkActionPermission] = usePermissions(myRole ?? '')
  const [initialRender, setInitialRender] = useState(true)
  const deleteForEveryoneIsPermitted = isIncomingMessage
    ? allowDeleteIncoming && !isDirectChannel && checkActionPermission('deleteAnyMessage')
    : isDirectChannel || checkActionPermission('deleteOwnMessage')
  const [deleteMessageOption, setDeleteMessageOption] = useState(deleteForEveryoneIsPermitted ? 'forEveryone' : 'forMe')

  const handleDelete = () => {
    handleFunction(isDeleteMessage && deleteMessageOption)
    togglePopup()
  }

  const handleChooseDeleteOption = (e: any, option: 'forEveryone' | 'forMe') => {
    if (e.target.checked) {
      setDeleteMessageOption(option)
    }
  }
  useEffect(() => {
    setInitialRender(false)
  }, [])

  return (
    <PopupContainer>
      <Popup
        theme={theme}
        backgroundColor={sectionBackground}
        maxWidth='520px'
        minWidth='520px'
        isLoading={loading}
        padding='0'
      >
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={textPrimary} onClick={() => togglePopup()} />
          <PopupName color={textPrimary} isDelete marginBottom='20px'>
            {title}
          </PopupName>
          <PopupDescription color={textSecondary}>{description}</PopupDescription>
          {isDeleteMessage && (
            <DeleteMessageOptions>
              {deleteForEveryoneIsPermitted && (
                <DeleteOptionItem color={textSecondary} onClick={() => setDeleteMessageOption('forEveryone')}>
                  <CustomRadio
                    index='1'
                    size='18px'
                    state={deleteMessageOption === 'forEveryone'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChooseDeleteOption(e, 'forEveryone')}
                    checkedBorderColor={accentColor}
                    borderColor={textSecondary}
                  />
                  Delete for everyone
                </DeleteOptionItem>
              )}
              <DeleteOptionItem color={textSecondary} onClick={() => setDeleteMessageOption('forMe')}>
                <CustomRadio
                  index='2'
                  size='18px'
                  state={deleteMessageOption === 'forMe'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChooseDeleteOption(e, 'forMe')}
                  checkedBorderColor={accentColor}
                  borderColor={textSecondary}
                />
                Delete for me
              </DeleteOptionItem>
            </DeleteMessageOptions>
          )}
        </PopupBody>
        <PopupFooter backgroundColor={surface1Background}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={() => togglePopup()}>
            Cancel
          </Button>
          <Button
            type='button'
            backgroundColor={buttonBackground || errorColor}
            color={buttonTextColor || colors.white}
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
const DeleteOptionItem = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 15px;
  line-height: 160%;
  color: ${(props) => props.color};
  margin-bottom: 12px;

  & > label {
    margin-right: 10px;
  }
`
