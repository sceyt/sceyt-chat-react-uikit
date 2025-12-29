import React, { useEffect, useState } from 'react'
import { Popup, PopupDescription, PopupName, CloseIcon, PopupBody, Button, PopupFooter } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import styled from 'styled-components'
import CustomRadio from '../../customRadio'
import usePermissions from '../../../hooks/usePermissions'
import PopupContainer from '../popupContainer'
import { useColor } from '../../../hooks'

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
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.WARNING]: warningColor,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.LINK_COLOR]: linkColor
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
      <Popup backgroundColor={background} maxWidth='520px' minWidth='520px' isLoading={loading} padding='0'>
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={iconPrimary} onClick={() => togglePopup()} />
          <PopupName color={textPrimary} isDelete marginBottom='20px'>
            {title}
          </PopupName>
          <PopupDescription color={textPrimary} highlightColor={linkColor}>
            {description}
          </PopupDescription>
          {isDeleteMessage && (
            <DeleteMessageOptions>
              {deleteForEveryoneIsPermitted && (
                <DeleteOptionItem color={textPrimary} onClick={() => setDeleteMessageOption('forEveryone')}>
                  <CustomRadio
                    index='1'
                    size='18px'
                    state={deleteMessageOption === 'forEveryone'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChooseDeleteOption(e, 'forEveryone')}
                    checkedBorderColor={accentColor}
                    borderColor={iconInactive}
                  />
                  Delete for everyone
                </DeleteOptionItem>
              )}
              <DeleteOptionItem color={textPrimary} onClick={() => setDeleteMessageOption('forMe')}>
                <CustomRadio
                  index='2'
                  size='18px'
                  state={deleteMessageOption === 'forMe'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChooseDeleteOption(e, 'forMe')}
                  checkedBorderColor={accentColor}
                  borderColor={iconInactive}
                />
                Delete for me
              </DeleteOptionItem>
            </DeleteMessageOptions>
          )}
        </PopupBody>
        <PopupFooter backgroundColor={surface1}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={() => togglePopup()}>
            Cancel
          </Button>
          <Button
            type='button'
            backgroundColor={buttonBackground || warningColor}
            color={buttonTextColor || textOnPrimary}
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
