import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
// Assets
import { ReactComponent as DeletedAvatarIcon } from '../../assets/svg/deletedUserAvatar.svg'
import { ReactComponent as DefaultAvatarIcon } from '../../assets/svg/avatar.svg'
// Helpers
import { generateAvatarColor } from '../../UIHelper'
import { useColor } from '../../hooks'
import { THEME_COLORS } from '../../UIHelper/constants'
import { useSelector } from 'store/hooks'
import { themeSelector } from 'store/theme/selector'
import { getAttachmentUrlFromCache, setAttachmentToCache } from '../../helpers/attachmentsCache'

interface IProps {
  image?: string | null
  name: string
  size?: number
  textSize?: number
  marginAuto?: string
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
  const theme = useSelector(themeSelector) as 'light' | 'dark'
  const { [THEME_COLORS.ICON_INACTIVE]: iconInactive } = useColor()
  const [resolvedImageSrc, setResolvedImageSrc] = useState<string | null>(image || null)
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

  useEffect(() => {
    let isCancelled = false
    if (!image) {
      setResolvedImageSrc(null)
      return
    }

    // Only attempt custom cache for network URLs
    const isHttpUrl = /^https?:\/\//i.test(image)
    if (!isHttpUrl) {
      setResolvedImageSrc(image)
      return
    }

    // Try to read from Cache Storage first; fall back to network and write-through
    getAttachmentUrlFromCache(image)
      .then(async (cachedUrl) => {
        if (isCancelled) return
        if (cachedUrl) {
          setResolvedImageSrc(cachedUrl)
        } else {
          try {
            const response = await fetch(image, { credentials: 'same-origin' })
            // Write-through to cache; ignore failures
            setAttachmentToCache(image, response.clone())
            setResolvedImageSrc(image)
          } catch (_) {
            setResolvedImageSrc(image)
          }
        }
      })
      .catch(async () => {
        if (isCancelled) return
        try {
          const response = await fetch(image, { credentials: 'same-origin' })
          setAttachmentToCache(image, response.clone())
          setResolvedImageSrc(image)
        } catch (_) {
          setResolvedImageSrc(image)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [image])

  return (
    <Container
      border={border}
      marginAuto={marginAuto}
      size={size}
      isImage={!!(resolvedImageSrc || setDefaultAvatar)}
      avatarName={name}
      textSize={textSize}
      onClick={handleAvatarClick}
      cursorPointer={!!handleAvatarClick}
      borderRadius={borderRadius}
      theme={theme}
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
        <AvatarImage draggable={false} showImage src={resolvedImageSrc || image} size={size} alt='' />
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
  marginAuto?: string
  border?: string
  borderRadius?: string
  cursorPointer?: boolean
  theme: 'light' | 'dark'
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
  margin: ${(props) => props.marginAuto || ''};
  ${(props: ContainerProps) =>
    !props.isImage ? `background-color:${generateAvatarColor(props.avatarName, props.theme)};` : ''};
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
