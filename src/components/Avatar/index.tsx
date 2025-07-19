import React from 'react'
import styled from 'styled-components'
// Assets
import { ReactComponent as DeletedAvatarIcon } from '../../assets/svg/deletedUserAvatar.svg'
import { ReactComponent as DefaultAvatarIcon } from '../../assets/svg/avatar.svg'
// Helpers
import { generateAvatarColor } from '../../UIHelper'
import { useColor } from '../../hooks'
import { THEME_COLORS } from '../../UIHelper/constants'

interface IProps {
  image?: string | null
  name: string
  size?: number
  textSize?: number
  marginAuto?: boolean
  setDefaultAvatar?: boolean
  DefaultAvatar?: JSX.Element
  DeletedIcon?: JSX.Element
  border?: string
  borderRadius?: string
  handleAvatarClick?: () => void
}

const Avatar: React.FC<IProps> = ({
  image,
  size,
  name,
  textSize,
  DeletedIcon,
  marginAuto,
  setDefaultAvatar,
  DefaultAvatar,
  border,
  borderRadius,
  handleAvatarClick
  // customAvatarColors
}) => {
  const { [THEME_COLORS.ICON_INACTIVE]: iconInactive } = useColor()
  const isDeletedUserAvatar = !image && !name
  let avatarText = ''
  if (!image && name) {
    const trimedName = name.trim()
    const splittedName = trimedName.split(' ')
    if (splittedName.length > 1 && splittedName[1]) {
      const firstWord = splittedName[0]
      const secondWord = splittedName[1]
      const firstCharOfFirstWord = firstWord.codePointAt(0)
      const firstCharOfSecondWord = secondWord.codePointAt(0)

      // @ts-ignore
      avatarText = `${firstCharOfFirstWord ? String.fromCodePoint(firstCharOfFirstWord) : ''}${
        firstCharOfSecondWord ? String.fromCodePoint(firstCharOfSecondWord) : ''
      }`
    } else {
      const firstCharOfFirstWord = trimedName.codePointAt(0)

      avatarText = firstCharOfFirstWord ? String.fromCodePoint(firstCharOfFirstWord) : ''
    }
  }

  return (
    <Container
      border={border}
      marginAuto={marginAuto}
      size={size}
      isImage={!!(image || setDefaultAvatar)}
      avatarName={name}
      textSize={textSize}
      onClick={handleAvatarClick}
      cursorPointer={!!handleAvatarClick}
      borderRadius={borderRadius}
    >
      {isDeletedUserAvatar ? (
        DeletedIcon || <DeletedAvatarWrapper color={iconInactive} />
      ) : !image ? (
        setDefaultAvatar ? (
          DefaultAvatar || <DefaultAvatarWrapper color={iconInactive} />
        ) : (
          <span>{avatarText}</span>
        )
      ) : (
        <AvatarImage draggable={false} showImage src={image} size={size} alt='' />
      )}
    </Container>
  )
}

export default Avatar

interface ContainerProps {
  size?: number
  avatarName: string
  textSize?: number
  isImage?: boolean
  marginAuto?: boolean
  border?: string
  borderRadius?: string
  cursorPointer?: boolean
}

interface AvatarImageProps {
  showImage: boolean
  size?: number
}

export const Container = styled.div<ContainerProps>`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  text-transform: uppercase;
  justify-content: center;
  width: ${(props) => (props.size ? `${props.size}px` : '38px')};
  height: ${(props) => (props.size ? `${props.size}px` : '38px')};
  border: ${(props) => props.border};
  border-radius: ${(props) => props.borderRadius || '50%'};
  color: #fff;
  overflow: hidden;
  margin: ${(props) => (props.marginAuto ? 'auto' : '')};
  ${(props: ContainerProps) => (!props.isImage ? `background-color:${generateAvatarColor(props.avatarName)};` : '')};
  cursor: ${(props) => props.cursorPointer && 'pointer'};

  span {
    text-transform: uppercase;
    font-style: normal;
    white-space: nowrap;
    font-weight: 500;
    font-size: ${(props: ContainerProps) => (props.textSize ? `${props.textSize}px` : '14px')}
  }
;
}

& > svg {
  height: ${(props) => props.size && `${props.size}px`};
  width: ${(props) => props.size && `${props.size}px`};
}

`

export const AvatarImage = styled.img<AvatarImageProps>`
  visibility: ${(props: AvatarImageProps) => (props.showImage ? 'visible' : 'hidden')};
  width: ${(props) => `${props.size}px`};
  height: ${(props) => `${props.size}px`};
  object-fit: cover;
`

export const DefaultAvatarWrapper = styled(DefaultAvatarIcon)<{ color: string }>`
  color: ${(props) => props.color};
`

export const DeletedAvatarWrapper = styled(DeletedAvatarIcon)<{ color: string }>`
  color: ${(props) => props.color};
`
