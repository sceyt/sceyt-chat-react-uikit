import React, { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
// Assets
import { ReactComponent as DeletedAvatarIcon } from '../../assets/svg/deletedUserAvatar.svg'
import { ReactComponent as DefaultAvatarIcon } from '../../assets/svg/avatar.svg'
// Helpers
import { generateAvatarColor } from '../../UIHelper'
import { useColor } from '../../hooks'
import { THEME_COLORS } from '../../UIHelper/constants'
import { useDispatch, useSelector } from 'store/hooks'
import { themeSelector } from 'store/theme/selector'
import { getAttachmentUrlFromCache, getAttachmentURLWithVersion } from '../../helpers/attachmentsCache'
import { setUpdateMessageAttachmentAC } from 'store/message/actions'
import { attachmentUpdatedMapSelector } from 'store/message/selector'
import { compressAndCacheImage } from 'helpers/getVideoFrame'

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
}) => {
  const theme = useSelector(themeSelector)
  const { [THEME_COLORS.ICON_INACTIVE]: iconInactive } = useColor()
  const attachmentUpdatedMap = useSelector(attachmentUpdatedMapSelector) || {}
  const attachmentUrlFromMap = useMemo(
    () => image && attachmentUpdatedMap[getAttachmentURLWithVersion(image)],
    [attachmentUpdatedMap, image]
  )
  const [resolvedImageSrc, setResolvedImageSrc] = useState<string | null>(attachmentUrlFromMap || image || null)
  const isDeletedUserAvatar = !image && !name
  const dispatch = useDispatch()
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
    const isBlobUrl = /^blob:https?:\/\//i.test(image)
    if (!isHttpUrl && !isBlobUrl) {
      setResolvedImageSrc(image)
      return
    }

    // Try to read from Cache Storage first; fall back to network and write-through
    if (attachmentUrlFromMap) {
      return
    }
    getAttachmentUrlFromCache(image)
      .then(async (cachedUrl: string | false) => {
        if (isCancelled) return
        if (cachedUrl) {
          dispatch(setUpdateMessageAttachmentAC(image, cachedUrl))
        } else {
          try {
            const compressedUrl = await compressAndCacheImage(image, image, 100, 100)
            if (compressedUrl) {
              dispatch(setUpdateMessageAttachmentAC(image, compressedUrl))
            }
          } catch (_) {
            dispatch(setUpdateMessageAttachmentAC(image, image))
          }
        }
      })
      .catch(async () => {
        if (isCancelled) return
        try {
          const compressedUrl = await compressAndCacheImage(image, image, 100, 100)
          if (compressedUrl) {
            dispatch(setUpdateMessageAttachmentAC(image, compressedUrl))
          }
        } catch (_) {
          dispatch(setUpdateMessageAttachmentAC(image, image))
        }
      })

    return () => {
      isCancelled = true
    }
  }, [image, attachmentUrlFromMap])

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
        <AvatarImage
          draggable={false}
          showImage
          src={attachmentUrlFromMap || resolvedImageSrc || image}
          size={size}
          alt=''
          loading='lazy'
          decoding='async'
        />
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
