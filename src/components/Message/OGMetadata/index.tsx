import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { IAttachment, IOGMetadata } from '../../../types'
import styled from 'styled-components'
import { getClient } from '../../../common/client'
import { getMetadata, storeMetadata } from '../../../services/indexedDB/metadataService'
import { attachmentTypes } from '../../../helpers/constants'
import { setOGMetadataAC } from '../../../store/message/actions'
import { useDispatch, useSelector } from '../../../store/hooks'
import { useColor } from 'hooks'
import { THEME_COLORS } from 'UIHelper/constants'
import { CONNECTION_STATUS } from 'store/user/constants'

const validateUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    return urlObj
  } catch (error) {
    return false
  }
}

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
  metadataGetSuccessCallback
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
  metadataGetSuccessCallback?: (url: string, success: boolean, hasImage: boolean) => void
}) => {
  const dispatch = useDispatch()
  const oGMetadata = useSelector((state: any) => state.MessageReducer.oGMetadata)
  const [metadataLoaded, setMetadataLoaded] = useState(false)
  const {
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND_X]: incomingMessageBackgroundX,
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND_X]: outgoingMessageBackgroundX,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary
  } = useColor()
  const attachment = useMemo(() => {
    return attachments.find((attachment) => attachment.type === attachmentTypes.link)
  }, [attachments])


  const metadata = useMemo(() => {
    const metadata = oGMetadata?.[attachment?.url] || null
    if (metadata?.og?.title && metadata?.og?.description) {
      return metadata
    }
    return null
  }, [oGMetadata, attachment?.url])

  const [imageLoadError, setImageLoadError] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  const handleMetadata = useCallback((metadata: IOGMetadata | null) => {
    if (metadata) {
      dispatch(setOGMetadataAC(attachment?.url, metadata))
    } else {
      dispatch(setOGMetadataAC(attachment?.url, null))
    }
  }, [dispatch, attachment])

  const ogMetadataQueryBuilder = useCallback(async (url: string) => {
    const client = getClient()
    if (client && client.connectionState === CONNECTION_STATUS.CONNECTED) {
      try {
        const queryBuilder = new client.MessageLinkOGQueryBuilder(url)
        const query = await queryBuilder.build()
        const metadata = await query.loadOGData()
        const image = new Image()
        image.src = metadata?.og?.image?.[0]?.url
        if (image.src) {
          image.onload = async () => {
            const imageWidth = image.width
            const imageHeight = image.height
            await storeMetadata(url, { ...metadata, imageWidth, imageHeight })
            handleMetadata({ ...metadata, imageWidth, imageHeight })
          }
          image.onerror = async () => {
            setImageLoadError(true)

            const favicon = new Image()
            favicon.src = metadata?.og?.favicon?.url
            if (favicon.src) {
              favicon.onload = async () => {
                await storeMetadata(url, { ...metadata, faviconLoaded: true })
                handleMetadata({ ...metadata, faviconLoaded: true })
              }
              favicon.onerror = async () => {
                await storeMetadata(url, { ...metadata, faviconLoaded: false })
                handleMetadata({ ...metadata, faviconLoaded: false })
              }
            }
          }
        } else {
          await storeMetadata(url, { ...metadata })
          handleMetadata({ ...metadata })
        }
      } catch (error) {
        console.log('Failed to fetch OG metadata', url)
      } finally {
        setMetadataLoaded(true)
      }
    }
    return null
  }, [])

  useEffect(() => {
    if (attachment?.id && attachment?.url && !metadata) {
      setShouldAnimate(true)
      const url = attachment?.url
      if (url) {
        getMetadata(url)
          .then(async (cachedMetadata) => {
            if (cachedMetadata) {
              handleMetadata(cachedMetadata)
            }
            ogMetadataQueryBuilder(url)
          })
          .catch(() => {
            ogMetadataQueryBuilder(url)
            setMetadataLoaded(true)
          })
      }
    }
  }, [attachment, metadata])

  const ogUrl = useMemo(() => {
    const url = attachment?.url
    const urlObj = validateUrl(url)
    if (urlObj) {
      return urlObj.hostname
    }
    return url
  }, [attachment])

  const showOGMetadata = useMemo(() => {
    return state !== 'deleted' && (metadata?.og?.title || metadata?.og?.description || metadata?.og?.image?.[0]?.url || metadata?.og?.favicon?.url) && metadata
  }, [state, metadata])

  const calculatedImageHeight = useMemo(() => {
    if (!metadata?.imageWidth || !metadata?.imageHeight) {
      return 0
    }
    return metadata?.imageHeight / (metadata?.imageWidth / maxWidth)
  }, [metadata?.imageWidth, metadata?.imageHeight, maxWidth])

  const hasImage = useMemo(() => metadata?.og?.image?.[0]?.url && !imageLoadError, [metadata?.og?.image?.[0]?.url, imageLoadError])
  const faviconUrl = useMemo(() => ogShowFavicon && metadata?.faviconLoaded ? metadata?.og?.favicon?.url : '', [metadata?.og?.favicon?.url, metadata?.faviconLoaded, ogShowFavicon])
  const resolvedOrder = useMemo(() => order || { image: 1, title: 2, description: 3, link: 4 }, [order])

  useEffect(() => {
    if (metadataLoaded || oGMetadata?.[attachment?.url]) {
      if (metadata && metadataGetSuccessCallback && (hasImage || faviconUrl)) {
        metadataGetSuccessCallback(attachment?.url, true, hasImage)
      } else {
        metadataGetSuccessCallback?.(attachment?.url, false, false)
      }
    }
  }, [metadata, metadataLoaded, oGMetadata, attachment?.url, hasImage])

  const elements = useMemo(() => [
    hasImage
      ? {
        key: 'image',
        order: resolvedOrder?.image ?? 1,
        render: (
          <ImageContainer
            showOGMetadata={!!showOGMetadata}
            containerWidth={maxWidth}
            containerHeight={calculatedImageHeight}
            shouldAnimate={shouldAnimate}
            maxWidth={maxWidth}
            maxHeight={maxHeight || calculatedImageHeight}
          >
            <Img src={metadata?.og?.image?.[0]?.url} alt='OG image' shouldAnimate={shouldAnimate} />
          </ImageContainer>
        )
      }
      : null,
    {
      key: 'title',
      order: resolvedOrder?.title ?? 2,
      render: ogShowTitle && metadata?.og?.title && (
        <Title maxWidth={maxWidth} shouldAnimate={shouldAnimate} padding={infoPadding}>
          <span>{metadata?.og?.title}</span>
        </Title>
      )
    },
    {
      key: 'description',
      order: resolvedOrder?.description ?? 3,
      render: ogShowDescription && metadata?.og?.description && (
        <Desc maxWidth={maxWidth} shouldAnimate={shouldAnimate} color={textSecondary} padding={infoPadding}>
          {metadata?.og?.description}
        </Desc>
      )
    },
    {
      key: 'link',
      order: resolvedOrder?.link ?? 4,
      render: ogShowUrl && (
        <Url maxWidth={maxWidth} shouldAnimate={shouldAnimate} padding={infoPadding}>
          {ogUrl}
        </Url>
      )
    }
  ]
    .filter((el): el is { key: string; order: number; render: JSX.Element | false } => !!el)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [
    hasImage,
    resolvedOrder,
    showOGMetadata,
    maxWidth,
    calculatedImageHeight,
    maxHeight,
    metadata?.og?.image,
    shouldAnimate,
    ogShowTitle,
    metadata?.og?.title,
    infoPadding,
    ogShowDescription,
    metadata?.og?.description,
    textSecondary,
    ogShowUrl,
    ogUrl
  ])

  const textContent = useMemo(() => (
    <OGText shouldAnimate={shouldAnimate} margin={ogContainerShowBackground}>
      {elements
        .filter((el) => el.key !== 'image')
        .map((el) => (
          <React.Fragment key={el.key}>{el.render}</React.Fragment>
        ))}
    </OGText>
  ), [elements, shouldAnimate, ogContainerShowBackground])

  const content = useMemo(() => hasImage ? (
    <OGText shouldAnimate={shouldAnimate} margin={ogContainerShowBackground}>
      {elements.map((el) => (
        <React.Fragment key={el.key}>{el.render}</React.Fragment>
      ))}
    </OGText>
  ) : faviconUrl ? (
    <OGRow>
      <OGTextWrapper>{textContent}</OGTextWrapper>
      <FaviconContainer aria-hidden='true'>
        <FaviconImg src={faviconUrl} alt='' />
      </FaviconContainer>
    </OGRow>
  ) : (
    textContent
  ), [hasImage, elements, shouldAnimate, ogContainerShowBackground, ogShowFavicon, faviconUrl, textContent])

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
      as="a"
      href={attachment?.url}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
    >
      {content}
    </OGMetadataContainer>
  )
}

export { OGMetadata }

// Shared keyframes to avoid duplication
const sharedKeyframes = `
  @keyframes fadeInSlideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes expandHeight {
    from {
      max-height: 0;
      opacity: 0;
    }
    to {
      max-height: 1000px;
      opacity: 1;
    }
  }
`

const OGMetadataContainer = styled.div<{
  showOGMetadata: boolean
  bgColor: string
  showBackground: boolean
  customBg?: string
  borderRadius?: string | number
  padding?: string
  containerMargin?: string
}>`
  min-width: inherit;
  max-width: inherit;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr;
  background-color: ${({ showBackground, customBg, bgColor }) =>
    showBackground ? customBg ?? bgColor : 'transparent'};
  border-radius: ${({ borderRadius }) => (borderRadius !== undefined ? borderRadius : '8px')};
  margin: ${({ containerMargin }) => containerMargin ?? '0.8rem auto 0'};
  // margin-bottom: ${({ showOGMetadata }) => (showOGMetadata ? '0.4rem' : '0')};
  padding: ${({ padding }) => padding ?? '0'};
  text-decoration: none;
  color: inherit;
  &:hover {
    opacity: 0.9;
    cursor: pointer;
  }
`

const ImageContainer = styled.div<{
  showOGMetadata: boolean
  containerWidth: number
  containerHeight: number
  shouldAnimate: boolean
  maxWidth: number
  maxHeight: number
}>`
  ${sharedKeyframes}
  width: 100%;
  height: ${({ containerHeight }) => (containerHeight ? `${containerHeight}px` : '0px')};
  opacity: ${({ showOGMetadata, containerHeight }) => (showOGMetadata && containerHeight ? 1 : 0)};
  margin: 0 auto;
  overflow: hidden;
  ${({ shouldAnimate, showOGMetadata, containerHeight }) =>
    shouldAnimate && showOGMetadata && containerHeight &&
    `
    animation: expandHeight 0.3s ease-out forwards;
  `}
`

const OGText = styled.div<{ shouldAnimate: boolean; margin: boolean }>`
  ${sharedKeyframes}
  display: flex;
  flex-direction: column;
  gap: 0;
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    animation: fadeInSlideUp 0.3s ease-out forwards;
  `}
  ${({ margin }) => (margin ? '12px' : '0')};
`

const Title = styled.p<{ maxWidth: number; shouldAnimate: boolean; padding?: string }>`
  ${sharedKeyframes}
  font-weight: bold;
  font-size: 13px;
  line-height: 16px;
  margin: 8px 0 0 0;
  padding: ${({ padding }) => padding ?? '0'};
  box-sizing: border-box;
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${maxWidth}px;
  `}
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    animation: fadeInSlideUp 0.3s ease-out 0.1s backwards;
  `}
`

const Desc = styled.p<{
  maxWidth: number
  shouldAnimate: boolean
  color: string
  padding?: string
}>`
  ${sharedKeyframes}
  font-weight: normal;
  font-size: 13px;
  line-height: 16px;
  margin: 0 0 8px 0;
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
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    animation: fadeInSlideUp 0.3s ease-out 0.2s backwards;
  `}
`

const Url = styled.p<{ maxWidth: number; shouldAnimate: boolean; padding?: string }>`
  ${sharedKeyframes}
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
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    animation: fadeInSlideUp 0.3s ease-out 0.3s backwards;
  `}
`

const Img = styled.img<{ shouldAnimate: boolean }>`
  ${sharedKeyframes}
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: inherit;
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    animation: fadeIn 0.4s ease-out forwards;
  `}
`

const OGRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`

const OGTextWrapper = styled.div`
  flex: 1 1 auto;
`

const FaviconContainer = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  margin: 12px;
  flex: 0 0 52px;
`

const FaviconImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`
