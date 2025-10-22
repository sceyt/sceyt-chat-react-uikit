import React from 'react'
import styled from 'styled-components'
import { ReactComponent as LinkIcon } from '../../../assets/svg/linkIcon.svg'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'

interface Props {
  onClick?: () => void
}

function AddMembersListItemInviteLink({ onClick }: Props) {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered
  } = useColor()

  return (
    <Row hoverBackground={backgroundHovered} onClick={onClick}>
      <IconCircle backgroundColor={backgroundHovered}>
        <StyledLinkIcon color={accentColor} />
      </IconCircle>
      <Title color={textPrimary}>Invite link</Title>
    </Row>
  )
}

export default AddMembersListItemInviteLink

const Row = styled.div<{ hoverBackground: string }>`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 7px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background-color: ${(props) => props.hoverBackground};
  }
`

const IconCircle = styled.span<{ backgroundColor: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  background-color: ${(props) => props.backgroundColor};
  box-sizing: border-box;
  border: 0.5px solid rgba(0, 0, 0, 0.14);
  overflow: hidden;
`

const StyledLinkIcon = styled(LinkIcon)`
  color: ${(props) => (props as any).color};
  /* keep default fill from theme surface */
`

const Title = styled.h4<{ color: string }>`
  margin: 0 0 0 12px;
  font-size: 15px;
  font-weight: 500;
  line-height: 16px;
  color: ${(props) => props.color};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`
