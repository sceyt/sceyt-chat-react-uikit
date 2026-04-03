import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { IAttachment } from '../../../types'
import styled from 'styled-components'
import { attachmentTypes } from '../../../helpers/constants'
import { useDispatch, useSelector } from '../../../store/hooks'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'
import { getChannelByInviteKeyAC } from 'store/channel/actions'
import { setUpdateMessageAttachmentAC } from 'store/message/actions'
import { attachmentUpdatedMapSelector } from 'store/message/selector'
import { getAttachmentURLWithVersion } from 'helpers/attachmentsCache'
import { isJSON } from 'helpers/message'

const OG_IMAGE_CACHE = 'og-images-v1'

const loadFromMetadata = (firstAttachment: IAttachment | undefined) => {
  if (!firstAttachment) {
    return null
  }
  if (firstAttachment?.metadata && isJSON(firstAttachment.metadata)) {
    const compactMeta = JSON.parse(firstAttachment.metadata)
    // Convert compact format to full OG format
    if (compactMeta?.hld) {
      return false
    }
    const fullMetadata: any = {
      og: {
        title: compactMeta.ttl,
        description: compactMeta.dsc,
        image: compactMeta.iur ? [{ url: compactMeta.iur }] : undefined,
        favicon: compactMeta.tur ? { url: compactMeta.tur } : undefined
      },
      imageWidth: compactMeta.szw,
      imageHeight: compactMeta.szh
    }
    return fullMetadata
  }
  return null
}

const useCachedOGImage = (url: string | undefined) => {
  const dispatch = useDispatch()
  const attachmentUpdatedMap = useSelector(attachmentUpdatedMapSelector)
  const reduxCached = url ? attachmentUpdatedMap[getAttachmentURLWithVersion(url)] : undefined
  const [src, setSrc] = useState<string | undefined>(reduxCached || url)

  useEffect(() => {
    if (!url) return
    // If Redux already has a blob URL for this image, use it immediately
    if (reduxCached) {
      setSrc(reduxCached)
      return
    }
    setSrc(url)
    if (!('caches' in window)) return
    caches
      .open(OG_IMAGE_CACHE)
      .then((cache) => cache.match(url))
      .then((cached) => {
        if (cached) {
          cached.blob().then((blob) => {
            const blobUrl = URL.createObjectURL(blob)
            setSrc(blobUrl)
            dispatch(setUpdateMessageAttachmentAC(url, blobUrl))
          })
        }
      })
      .catch(() => {})
  }, [url, reduxCached])

  const onImageLoad = useCallback(() => {
    if (!url || !('caches' in window)) return
    try {
      if (new URL(url).origin !== window.location.origin) return
    } catch {
      return
    }
    fetch(url, { credentials: 'omit' })
      .then((response) => {
        if (response.ok) {
          response
            .clone()
            .blob()
            .then((blob) => {
              const blobUrl = URL.createObjectURL(blob)
              dispatch(setUpdateMessageAttachmentAC(url, blobUrl))
              caches.open(OG_IMAGE_CACHE).then((cache) => cache.put(url, response))
            })
        }
      })
      .catch(() => {})
  }, [url])

  const onImageError = useCallback(() => {
    if (!url || !('caches' in window)) return
    caches
      .open(OG_IMAGE_CACHE)
      .then((cache) => cache.match(url))
      .then((cached) => {
        if (cached) {
          cached.blob().then((blob) => {
            const blobUrl = URL.createObjectURL(blob)
            setSrc(blobUrl)
            dispatch(setUpdateMessageAttachmentAC(url, blobUrl))
          })
        }
      })
      .catch(() => {})
  }, [url])

  return { src, onImageLoad, onImageError }
}

const validateUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    return urlObj
  } catch (error) {
    return false
  }
}

export const isDescriptionOnlySymbol = (description: string | undefined): boolean => {
  if (!description) return true

  const trimmed = description?.trim()
  return !!trimmed && !/[a-zA-Z0-9]/.test(trimmed)
}

const MIN_IMAGE_SIZE = 200

const OGMetadata = ({
  attachments,
  state,
  incoming,
  ogShowUrl = false,
  ogShowTitle = true,
  ogShowDescription = true,
  ogShowFavicon = true,
  order = { image: 1, title: 2, description: 3, link: 4 },
  maxWidth = 400,
  maxHeight,
  ogContainerBorderRadius,
  ogContainerPadding,
  ogContainerClassName,
  ogContainerShowBackground = true,
  ogContainerBackground,
  infoPadding = '0 8px',
  ogContainerMargin,
  target = '_blank',
  isInviteLink = false,
  onClick
}: {
  attachments: IAttachment[]
  state: string
  incoming: boolean
  ogShowUrl?: boolean
  ogShowTitle?: boolean
  ogShowDescription?: boolean
  ogShowFavicon?: boolean
  order?: { image?: number; title?: number; description?: number; link?: number }
  maxWidth?: number
  maxHeight?: number
  ogContainerBorderRadius?: string | number
  ogContainerPadding?: string
  ogContainerClassName?: string
  ogContainerShowBackground?: boolean
  ogContainerBackground?: string
  infoPadding?: string
  ogContainerMargin?: string
  target?: string
  isInviteLink?: boolean
  onClick?: () => void
}) => {
  const dispatch = useDispatch()
  const {
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND_X]: incomingMessageBackgroundX,
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND_X]: outgoingMessageBackgroundX,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary
  } = useColor()
  const attachment = useMemo(() => {
    return attachments.find((attachment) => attachment.type === attachmentTypes.link)
  }, [attachments])

  const metadata = useMemo(() => {
    return loadFromMetadata(attachment)
  }, [attachment])

  const [imageLoadError, setImageLoadError] = useState(false)
  const { src: cachedImageSrc, onImageLoad, onImageError } = useCachedOGImage(metadata?.og?.image?.[0]?.url)
  const { src: cachedFaviconSrc, onImageLoad: onFaviconLoad } = useCachedOGImage(metadata?.og?.favicon?.url)

  useEffect(() => {
    setImageLoadError(false)
  }, [attachment?.url])

  useEffect(() => {
    if (cachedImageSrc?.startsWith('blob:')) {
      setImageLoadError(false)
    }
  }, [cachedImageSrc])

  const ogUrl = useMemo(() => {
    const url = attachment?.url
    const urlObj = validateUrl(url)
    if (urlObj) {
      return urlObj.hostname
    }
    return url
  }, [attachment])

  const shouldShowTitle = useMemo(() => {
    return ogShowTitle && metadata?.og?.title && !isDescriptionOnlySymbol(metadata?.og?.description)
  }, [ogShowTitle, metadata?.og?.title, metadata?.og?.description])

  const shouldShowDescription = useMemo(() => {
    return ogShowDescription && metadata?.og?.description && !isDescriptionOnlySymbol(metadata?.og?.description)
  }, [ogShowDescription, metadata?.og?.description])

  const showOGMetadata = useMemo(() => {
    const descriptionIsSymbol = isDescriptionOnlySymbol(metadata?.og?.description)
    if (descriptionIsSymbol) {
      return false
    }

    if (!metadata?.og?.title || !metadata?.og?.description) {
      return false
    }
    if (!(metadata?.og?.image?.[0]?.url || metadata?.og?.favicon?.url)) {
      return false
    }

    return (
      state !== 'deleted' &&
      (metadata?.og?.title ||
        metadata?.og?.description ||
        metadata?.og?.image?.[0]?.url ||
        metadata?.og?.favicon?.url) &&
      metadata
    )
  }, [state, metadata])

  const calculatedImageHeight = useMemo(() => {
    if (!metadata?.imageWidth || !metadata?.imageHeight) {
      return 0
    }
    let maxSize = maxWidth
    if (metadata?.imageWidth < MIN_IMAGE_SIZE || metadata?.imageHeight < MIN_IMAGE_SIZE) {
      maxSize = 52
    }
    return Math.floor(metadata?.imageHeight / (metadata?.imageWidth / maxSize))
  }, [metadata?.imageWidth, metadata?.imageHeight, maxWidth])

  const hasImage = useMemo(
    () => metadata?.og?.image?.[0]?.url && (!imageLoadError || cachedImageSrc?.startsWith('blob:')),
    [metadata?.og?.image?.[0]?.url, imageLoadError, cachedImageSrc]
  )
  const faviconUrl = useMemo(() => {
    if (
      ogShowFavicon &&
      hasImage &&
      (metadata?.imageWidth < MIN_IMAGE_SIZE || metadata?.imageHeight < MIN_IMAGE_SIZE)
    ) {
      return cachedImageSrc || metadata?.og?.image?.[0]?.url
    }

    return ogShowFavicon && !hasImage && metadata?.og?.favicon?.url
      ? cachedFaviconSrc || metadata?.og?.favicon?.url
      : ''
  }, [metadata?.og?.favicon?.url, metadata?.faviconLoaded, ogShowFavicon, hasImage, cachedImageSrc, cachedFaviconSrc])
  const resolvedOrder = useMemo(() => order || { image: 1, title: 2, description: 3, link: 4 }, [order])

  const MIN_IMAGE_HEIGHT = 180
  const MAX_IMAGE_HEIGHT = 400

  const showImage = useMemo(() => {
    return hasImage && calculatedImageHeight >= MIN_IMAGE_HEIGHT && calculatedImageHeight <= MAX_IMAGE_HEIGHT
  }, [hasImage, calculatedImageHeight])

  const elements = useMemo(
    () =>
      [
        showImage
          ? {
              key: 'image',
              order: resolvedOrder?.image ?? 1,
              render: (
                <ImageContainer
                  showOGMetadata={!!showOGMetadata}
                  containerWidth={maxWidth}
                  containerHeight={calculatedImageHeight}
                  maxWidth={maxWidth}
                  maxHeight={maxHeight || calculatedImageHeight}
                >
                  <Img
                    src={cachedImageSrc}
                    alt='OG image'
                    onLoad={onImageLoad}
                    onError={() => {
                      onImageError()
                      setImageLoadError(true)
                    }}
                  />
                </ImageContainer>
              )
            }
          : null,
        {
          key: 'title',
          order: resolvedOrder?.title ?? 2,
          render: shouldShowTitle && (
            <Title maxWidth={maxWidth} padding={infoPadding} color={textPrimary}>
              <span>{metadata?.og?.title?.trim()}</span>
            </Title>
          )
        },
        {
          key: 'description',
          order: resolvedOrder?.description ?? 3,
          render: shouldShowDescription && (
            <Desc maxWidth={maxWidth} color={textSecondary} padding={infoPadding}>
              {metadata?.og?.description?.trim()}
            </Desc>
          )
        },
        {
          key: 'link',
          order: resolvedOrder?.link ?? 4,
          render: ogShowUrl && (
            <Url maxWidth={maxWidth} padding={infoPadding}>
              {ogUrl}
            </Url>
          )
        }
      ]
        .filter((el): el is { key: string; order: number; render: JSX.Element | false } => !!el)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [
      hasImage,
      resolvedOrder,
      showOGMetadata,
      maxWidth,
      calculatedImageHeight,
      maxHeight,
      metadata?.og?.image,
      shouldShowTitle,
      metadata?.og?.title,
      infoPadding,
      shouldShowDescription,
      metadata?.og?.description,
      textSecondary,
      ogShowUrl,
      ogUrl
    ]
  )

  const textContent = useMemo(
    () => (
      <OGText margin={ogContainerShowBackground}>
        {elements
          .filter((el) => el.key !== 'image')
          .map((el) => (
            <React.Fragment key={el.key}>{el.render}</React.Fragment>
          ))}
      </OGText>
    ),
    [elements, ogContainerShowBackground]
  )

  const content = useMemo(
    () =>
      hasImage && metadata?.imageWidth > MIN_IMAGE_SIZE && metadata?.imageHeight > MIN_IMAGE_SIZE ? (
        <OGText margin={ogContainerShowBackground}>
          {elements.map((el) => (
            <React.Fragment key={el.key}>{el.render}</React.Fragment>
          ))}
        </OGText>
      ) : faviconUrl ? (
        <OGRow>
          <OGTextWrapper>{textContent}</OGTextWrapper>
          <FaviconContainer aria-hidden='true'>
            <FaviconImg src={faviconUrl} alt='' loading='lazy' decoding='async' onLoad={onFaviconLoad} />
          </FaviconContainer>
        </OGRow>
      ) : (
        textContent
      ),
    [hasImage, elements, ogContainerShowBackground, ogShowFavicon, faviconUrl, textContent]
  )

  const getChannel = useCallback(() => {
    const splitedKey = attachment?.url.split('/')
    const key = splitedKey[splitedKey.length - 1]
    if (key) {
      dispatch(getChannelByInviteKeyAC(key))
    }
  }, [attachment?.url])

  // If we shouldn't show OG metadata, return null to render as default message
  if (!showOGMetadata) {
    return null
  }

  return (
    <OGMetadataContainer
      showOGMetadata={!!showOGMetadata}
      bgColor={incoming ? incomingMessageBackgroundX : outgoingMessageBackgroundX}
      showBackground={ogContainerShowBackground}
      customBg={ogContainerBackground}
      borderRadius={ogContainerBorderRadius}
      padding={ogContainerPadding}
      className={ogContainerClassName}
      containerMargin={ogContainerMargin}
      maxWidth={maxWidth}
      {...(onClick
        ? {
            as: 'div',
            onClick
          }
        : isInviteLink
          ? {
              as: 'div',
              onClick: () => {
                getChannel()
              }
            }
          : {
              as: 'a',
              href: attachment?.url,
              target,
              rel: target === '_blank' ? 'noopener noreferrer' : undefined
            })}
    >
      {content}
    </OGMetadataContainer>
  )
}

export { OGMetadata }

const OGMetadataContainer = styled.div<{
  showOGMetadata: boolean
  bgColor: string
  showBackground: boolean
  customBg?: string
  borderRadius?: string | number
  padding?: string
  containerMargin?: string
  maxWidth?: number
}>`
  min-width: inherit;
  max-width: ${({ maxWidth }) => (maxWidth ? `${maxWidth}px` : 'inherit')};
  width: 100%;
  display: grid;
  grid-template-columns: 1fr;
  background-color: ${({ showBackground, customBg, bgColor }) =>
    showBackground ? customBg ?? bgColor : 'transparent'};
  border-radius: ${({ borderRadius }) => (borderRadius !== undefined ? borderRadius : '8px')};
  margin: ${({ containerMargin }) => containerMargin ?? '8px auto 0'};
  padding: ${({ padding }) => padding ?? '0'};
  text-decoration: none;
  &:hover {
    opacity: 0.9;
    cursor: pointer;
  }
`

const ImageContainer = styled.div<{
  showOGMetadata: boolean
  containerWidth: number
  containerHeight: number
  maxWidth: number
  maxHeight: number
}>`
  width: 100%;
  height: ${({ containerHeight }) => (containerHeight ? `${containerHeight}px` : '0px')};
  opacity: ${({ showOGMetadata, containerHeight }) => (showOGMetadata && containerHeight ? 1 : 0)};
  margin: 0 auto;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
`

const OGText = styled.div<{ margin: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0;
`

const Title = styled.p<{ maxWidth: number; padding?: string; color: string }>`
  font-weight: bold;
  font-size: 14px;
  line-height: 18px;
  letter-spacing: 0px;
  color: ${({ color }) => color};
  margin: 4px 0 0 0;
  padding: ${({ padding }) => padding ?? '0'};
  box-sizing: border-box;
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${maxWidth}px;
  `}
`

const Desc = styled.p<{
  maxWidth: number
  color: string
  padding?: string
}>`
  font-weight: normal;
  font-size: 13px;
  line-height: 16px;
  margin: 4px 0 4px 0;
  padding: ${({ padding }) => padding ?? '0'};
  color: ${({ color }) => color};
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  box-sizing: border-box;
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${maxWidth}px;
  `}
`

const Url = styled.p<{ maxWidth: number; padding?: string }>`
  font-weight: normal;
  font-size: 13px;
  line-height: 16px;
  margin: 0 0 12px 0;
  padding: ${({ padding }) => padding ?? '0'};
  color: gray;
  box-sizing: border-box;
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${maxWidth}px;
  `}
`

const Img = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: inherit;
`

const OGRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0;
`

const OGTextWrapper = styled.div`
  flex: 1 1 auto;
`

const FaviconContainer = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  margin: 8px;
  flex: 0 0 52px;
`

const FaviconImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`
