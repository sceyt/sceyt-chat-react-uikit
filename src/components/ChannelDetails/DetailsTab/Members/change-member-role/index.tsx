import React, { useEffect, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
// Store
import { rolesSelector } from '../../../../../store/member/selector'
import { changeMemberRoleAC, getRolesAC } from '../../../../../store/member/actions'
// Helpers
import {
  Popup,
  PopupName,
  CloseIcon,
  DropdownOptionsUl,
  // DropdownOptionLi,
  CustomSelect,
  CustomSelectTrigger,
  PopupFooter,
  Button,
  PopupBody,
  DropdownOptionLi
} from '../../../../../UIHelper'
import { IMember, IRole } from '../../../../../types'
import { colors, THEME_COLORS } from '../../../../../UIHelper/constants'
// Components
import PopupContainer from '../../../../../common/popups/popupContainer'
import DropDown from '../../../../../common/dropdown'
import { useColor } from '../../../../../hooks'

interface IProps {
  theme: string
  channelId: string
  member: IMember
  handleClosePopup: () => void
}

const ChangeMemberRole = ({ theme, channelId, member, handleClosePopup }: IProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.SECTION_BACKGROUND]: sectionBackground,
    [THEME_COLORS.SURFACE_1]: surface1Background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLORS.ERROR]: errorColor
  } = useColor()

  const dispatch = useDispatch()
  const [isChanged, setIsChanged] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>()
  const roles = useSelector(rolesSelector, shallowEqual) || []

  useEffect(() => {
    dispatch(getRolesAC())
  }, [])

  const handleSave = () => {
    if (isChanged && selectedRole) {
      const updateMember: IMember = {
        ...member,
        role: selectedRole
      }
      dispatch(changeMemberRoleAC(channelId, [updateMember]))
    }
    handleClosePopup()
  }

  function onChangeFunction(roleName: string) {
    if (member.role !== roleName) {
      setIsChanged(true)
    }
    setSelectedRole(roleName)
  }

  return (
    <PopupContainer>
      <Popup backgroundColor={sectionBackground} maxWidth='400px' padding='0'>
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={textPrimary} onClick={() => handleClosePopup()} />
          <PopupName color={textPrimary}>Change member role</PopupName>

          <RolesSelect>
            <RoleLabel color={textPrimary}>Roles</RoleLabel>

            <CustomSelect
              backgroundColor={sectionBackground}
              color={textPrimary}
              errorColor={errorColor}
              placeholderColor={textFootnote}
            >
              <DropDown
                withIcon
                theme={theme}
                isSelect
                trigger={
                  <CustomSelectTrigger color={textPrimary}>
                    {selectedRole || member.role || 'Select'}
                  </CustomSelectTrigger>
                }
              >
                <DropdownOptionsUl theme={theme}>
                  {!!roles.length &&
                    roles.map((role: IRole) => (
                      <DropdownOptionLi
                        hoverBackground={colors.primaryLight}
                        key={role.name}
                        onClick={() => onChangeFunction(role.name)}
                        textColor={textPrimary}
                      >
                        <RoleSpan>{role.name}</RoleSpan>
                      </DropdownOptionLi>
                    ))}
                </DropdownOptionsUl>
              </DropDown>
            </CustomSelect>
          </RolesSelect>
        </PopupBody>
        <PopupFooter backgroundColor={surface1Background}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={() => handleClosePopup()}>
            Cancel
          </Button>
          <Button
            type='button'
            color={colors.white}
            backgroundColor={accentColor}
            borderRadius='8px'
            onClick={handleSave}
          >
            Save
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

const RolesSelect = styled.div`
  margin-bottom: 32px;
`

const RoleLabel = styled.div<{ color: string }>`
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  margin: 20px 0 8px;
  color: ${({ color }) => color};
`

const RoleSpan = styled.span`
  font-style: normal;
  font-weight: normal;
  font-size: 14px;
  text-transform: capitalize;
`

export default ChangeMemberRole
