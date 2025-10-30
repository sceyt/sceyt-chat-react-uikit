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
  ogShowUrl = true,
  ogShowTitle = true,
  ogShowDescription = true,
  ogShowFavicon = true,
  order = { image: 1, title: 2, description: 3, link: 4 },
  maxWidth = 400,
  maxHeight = 240,
  ogContainerBorderRadius,
  ogContainerPadding,
  ogContainerClassName,
  ogContainerShowBackground = true,
  ogContainerBackground,
  infoPadding = '0',
  ogContainerMargin
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
}) => {
  const dispatch = useDispatch()
  const oGMetadata = useSelector((state: any) => state.MessageReducer.oGMetadata)
  const {
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND_X]: incomingMessageBackgroundX,
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND_X]: outgoingMessageBackgroundX,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary
  } = useColor()
  const attachment = useMemo(() => {
    return attachments.find((attachment) => attachment.type === attachmentTypes.link)
  }, [attachments])

  const metadata = useMemo(() => {
    return oGMetadata[attachment?.url] || null
  }, [oGMetadata, attachment?.url])

  const [imageLoadError, setImageLoadError] = useState(false)
  // const [faviconLoadError, setFaviconLoadError] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  const handleMetadata = useCallback((metadata: IOGMetadata | null) => {
    if (metadata) {
      dispatch(setOGMetadataAC(attachment?.url, metadata))
    } else {
      dispatch(setOGMetadataAC(attachment?.url, null))
    }
  }, [])

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
            await storeMetadata(url, { ...metadata })
            handleMetadata({ ...metadata })
          }
        } else {
          await storeMetadata(url, { ...metadata })
          handleMetadata({ ...metadata })
        }
      } catch (error) {
        console.log('Failed to fetch OG metadata')
        handleMetadata(null)
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
          })
      }
    }
  }, [attachment?.url, metadata])

  const ogUrl = useMemo(() => {
    const url = attachment?.url
    const urlObj = validateUrl(url)
    if (urlObj) {
      return urlObj.hostname
    }
    return url
  }, [attachment?.url])

  const showOGMetadata = useMemo(() => {
    return state !== 'deleted' && metadata?.og?.title && metadata?.og?.description && metadata
  }, [state, metadata])

  const calculatedImageHeight = useMemo(() => {
    if (!metadata?.imageWidth) {
      return 0
    }
    return metadata?.imageHeight / (metadata?.imageWidth / maxWidth)
  }, [metadata?.imageWidth, metadata?.imageHeight, maxWidth])

  if (!showOGMetadata) return null

  const hasImage = metadata?.og?.image?.[0]?.url && !imageLoadError
  const faviconUrl = metadata?.og?.favicon?.url
  const resolvedOrder = order || { image: 1, title: 2, description: 3, link: 4 }

  const elements = [
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
              maxHeight={maxHeight}
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
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const textContent = (
    <OGText shouldAnimate={shouldAnimate} margin={ogContainerShowBackground}>
      {elements
        .filter((el) => el.key !== 'image')
        .map((el) => (
          <React.Fragment key={el.key}>{el.render}</React.Fragment>
        ))}
    </OGText>
  )

  const content = hasImage ? (
    <OGText shouldAnimate={shouldAnimate} margin={ogContainerShowBackground}>
      {elements.map((el) => (
        <React.Fragment key={el.key}>{el.render}</React.Fragment>
      ))}
    </OGText>
  ) : ogShowFavicon && faviconUrl ? (
    <OGRow>
      <OGTextWrapper>{textContent}</OGTextWrapper>
      <FaviconContainer aria-hidden='true'>
        <FaviconImg src={faviconUrl} alt='' />
      </FaviconContainer>
    </OGRow>
  ) : (
    textContent
  )

  return (
    <div className='ogmetadata-container'>
      <OGMetadataContainer
        showOGMetadata={!!showOGMetadata}
        bgColor={incoming ? incomingMessageBackgroundX : outgoingMessageBackgroundX}
        showBackground={ogContainerShowBackground}
        customBg={ogContainerBackground}
        borderRadius={ogContainerBorderRadius}
        padding={ogContainerPadding}
        className={ogContainerClassName}
        containerMargin={ogContainerMargin}
      >
        <div onClick={() => window.open(attachment?.url, '_blank')} style={{ width: '100%', cursor: 'pointer' }}>
          {content}
        </div>
      </OGMetadataContainer>
    </div>
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
  width: 100%;
  max-width: ${({ maxWidth }) => (maxWidth ? `${maxWidth}px` : '400px')};
  max-height: ${({ maxHeight }) => (maxHeight ? `${maxHeight}px` : '240px')};
  height: ${({ containerHeight }) => (containerHeight ? `${containerHeight}px` : '0px')};
  opacity: ${({ showOGMetadata, containerHeight }) => (showOGMetadata && containerHeight ? 1 : 0)};
  margin: 0 auto;
  overflow: hidden;
  transition: ${({ shouldAnimate }) => (shouldAnimate ? 'height 0.2s ease, opacity 0.2s ease' : 'none')};
`

const OGText = styled.div<{ shouldAnimate: boolean; margin: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0;
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: all 0.2s ease;
  `}
  ${({ margin }) => (margin ? '12px' : '0')};
`

const Title = styled.p<{ maxWidth: number; shouldAnimate: boolean; padding?: string }>`
  font-weight: bold;
  font-size: 13px;
  line-height: 16px;
  margin: 8px 0 0 0;
  padding: ${({ padding }) => padding ?? '0'};
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${maxWidth}px;
  `}
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: all 0.2s ease;
  `}
`

const Desc = styled.p<{
  maxWidth: number
  shouldAnimate: boolean
  color: string
  padding?: string
}>`
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
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${maxWidth}px;
  `}
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: all 0.2s ease;
  `}
`

const Url = styled.p<{ maxWidth: number; shouldAnimate: boolean; padding?: string }>`
  font-weight: normal;
  font-size: 13px;
  line-height: 16px;
  margin: 0 0 12px 0;
  padding: ${({ padding }) => padding ?? '0'};
  color: gray;
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${maxWidth}px;
  `}
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: all 0.2s ease;
  `}
`

const Img = styled.img<{ shouldAnimate: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  border-radius: inherit;
  transition: ${({ shouldAnimate }) => (shouldAnimate ? 'opacity 0.2s ease' : 'none')};
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
