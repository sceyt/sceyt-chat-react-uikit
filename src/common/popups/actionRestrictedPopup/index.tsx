import React from 'react'
import { useDispatch } from 'store/hooks'
import {
  Popup,
  PopupDescription,
  PopupName,
  CloseIcon,
  PopupBody,
  Button,
  PopupFooter,
  BoltText
} from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'
import PopupContainer from '../popupContainer'
import { setActionIsRestrictedAC, setOpenInviteModalAC } from '../../../store/member/actions'
import { IContactsMap, IMember, IUser } from '../../../types'
import { makeUsername } from 'helpers/message'
import { getShowOnlyContactUsers } from 'helpers/contacts'

const ActionRestrictedPopup = ({
  fromChannel,
  members,
  contactsMap
}: {
  fromChannel: boolean
  members: IMember[]
  contactsMap: IContactsMap
}) => {
  const dispatch = useDispatch()
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.LINK_COLOR]: linkColor
  } = useColor()

  const handleClose = () => {
    dispatch(setActionIsRestrictedAC(false, false, null))
  }

  const handleInvite = () => {
    dispatch(setOpenInviteModalAC(true))
    handleClose()
  }

  const getExcludedContactsMessage = (fromChannel: boolean) => {
    const excludedContacts = members || []
    const count = excludedContacts.length

    const fromContact = getShowOnlyContactUsers() || false
    const makeName = (member: IMember) => {
      return makeUsername(contactsMap[member.id], member as unknown as IUser, fromContact, false)
    }

    const prefix = fromChannel ? '' : 'The group was created, but '
    const suffix = fromChannel
      ? " couldn't be added to the group. You can share an invite link with them."
      : " couldn't be added. You can share an invite link with them."

    if (count === 1) {
      const name = makeName(excludedContacts[0])
      return (
        <React.Fragment>
          {prefix}
          <BoltText>{name}</BoltText>
          {suffix}
        </React.Fragment>
      )
    } else if (count === 2) {
      const name1 = makeName(excludedContacts[0])
      const name2 = makeName(excludedContacts[1])
      return (
        <React.Fragment>
          {prefix}
          <BoltText>{name1}</BoltText> and <BoltText>{name2}</BoltText>
          {suffix}
        </React.Fragment>
      )
    } else if (count > 2) {
      const firstName = makeName(excludedContacts[0])
      const othersCount = count - 1
      return (
        <React.Fragment>
          {prefix}
          <BoltText>
            {firstName} and {othersCount} others
          </BoltText>
          {suffix}
        </React.Fragment>
      )
    }

    return null
  }

  return (
    <PopupContainer>
      <Popup backgroundColor={background} maxWidth='520px' minWidth='520px' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={iconPrimary} onClick={handleClose} />
          <PopupName color={textPrimary} marginBottom='20px'>
            Privacy note
          </PopupName>
          <PopupDescription color={textPrimary} highlightColor={linkColor}>
            {getExcludedContactsMessage(fromChannel)}
          </PopupDescription>
        </PopupBody>
        <PopupFooter backgroundColor={surface1}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type='button'
            backgroundColor={accentColor}
            color={textOnPrimary}
            borderRadius='8px'
            onClick={handleInvite}
          >
            Invite
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default ActionRestrictedPopup
