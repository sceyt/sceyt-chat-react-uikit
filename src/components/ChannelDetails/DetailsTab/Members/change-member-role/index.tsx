import React, { useEffect, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import {
  Popup,
  PopupContainer,
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
import DropDown from '../../../../../common/dropdown'
import { IMember, IRole } from '../../../../../types'
import { rolesSelector } from '../../../../../store/member/selector'
import { changeMemberRoleAC, getRolesAC } from '../../../../../store/member/actions'
import { colors, customColors } from '../../../../../UIHelper/constants'

interface IProps {
  channelId: string
  member: IMember
  handleClosePopup: () => void
}

const ChangeMemberRole = ({ channelId, member, handleClosePopup }: IProps) => {
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
      console.log('chnaged member data .. ', updateMember)
      dispatch(changeMemberRoleAC(channelId, [updateMember]))
    }
    handleClosePopup()
  }

  function onChangeFunction(roleName: string) {
    console.log('selected role ,, ,, ', roleName)
    if (member.role !== roleName) {
      setIsChanged(true)
    }
    setSelectedRole(roleName)
  }

  return (
    <PopupContainer>
      <Popup maxWidth='400px' padding='0'>
        <PopupBody padding={24}>
          <CloseIcon onClick={() => handleClosePopup()} />
          <PopupName>Change member role</PopupName>

          <RolesSelect>
            <RoleLabel>Roles</RoleLabel>

            <CustomSelect>
              <DropDown
                withIcon
                isSelect
                trigger={<CustomSelectTrigger>{selectedRole || member.role || 'Select'}</CustomSelectTrigger>}
              >
                <DropdownOptionsUl>
                  {!!roles.length &&
                    roles.map((role: IRole) => (
                      <DropdownOptionLi
                        hoverBackground={customColors.selectedChannelBackground}
                        key={role.name}
                        onClick={() => onChangeFunction(role.name)}
                      >
                        <RoleSpan>{role.name}</RoleSpan>
                      </DropdownOptionLi>
                    ))}
                </DropdownOptionsUl>
              </DropDown>
            </CustomSelect>
          </RolesSelect>
        </PopupBody>
        <PopupFooter backgroundColor={colors.gray5}>
          <Button type='button' color={colors.gray6} backgroundColor='transparent' onClick={() => handleClosePopup()}>
            Cancel
          </Button>
          <Button type='button' backgroundColor='#0DBD8B' borderRadius='8px' onClick={handleSave}>
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

const RoleLabel = styled.div`
  font-family: Roboto, sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  margin: 20px 0 8px;
  color: #1f233c;
`

const RoleSpan = styled.span`
  font-style: normal;
  font-weight: normal;
  font-size: 14px;
  color: #383b51;
  text-transform: capitalize;
`

export default ChangeMemberRole
