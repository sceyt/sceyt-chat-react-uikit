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
  ogLayoutOrder = 'link-first',
  ogShowUrl = true,
  ogShowTitle = true,
  ogShowDescription = true,
  // ogShowFavicon = false,
  order = { image: 1, title: 2, description: 3, link: 4 }
}: {
  attachments: IAttachment[]
  state: string
  incoming: boolean
  ogLayoutOrder?: 'link-first' | 'og-first'
  ogShowUrl?: boolean
  ogShowTitle?: boolean
  ogShowDescription?: boolean
  ogShowFavicon?: boolean
  order?: { image?: number; title?: number; description?: number; link?: number }
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
    if (client) {
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
    return metadata?.imageHeight / (metadata?.imageWidth / 400)
  }, [metadata?.imageWidth, metadata?.imageHeight])

  if (!showOGMetadata) return null

  const hasImage = metadata?.og?.image?.[0]?.url && !imageLoadError
  const resolvedOrder = order || { image: 1, title: 2, description: 3, link: 4 }

  const elements = [
    hasImage
      ? {
          key: 'image',
          order: resolvedOrder?.image ?? 1,
          render: (
            <ImageContainer
              showOGMetadata={!!showOGMetadata}
              containerWidth={400}
              containerHeight={calculatedImageHeight}
              shouldAnimate={shouldAnimate}
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
        <Title maxWidth={400} shouldAnimate={shouldAnimate}>
          <span>{metadata?.og?.title}</span>
        </Title>
      )
    },
    {
      key: 'description',
      order: resolvedOrder?.description ?? 3,
      render: ogShowDescription && metadata?.og?.description && (
        <Desc maxWidth={400} shouldAnimate={shouldAnimate} color={textSecondary}>
          {metadata?.og?.description}
        </Desc>
      )
    },
    {
      key: 'link',
      order: resolvedOrder?.link ?? 4,
      render: ogShowUrl && (
        <Url maxWidth={400} shouldAnimate={shouldAnimate}>
          {ogUrl}
        </Url>
      )
    }
  ]
    .filter((el): el is { key: string; order: number; render: JSX.Element | false } => !!el)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const content = (
    <OGText shouldAnimate={shouldAnimate}>
      {elements.map((el) => (
        <React.Fragment key={el.key}>{el.render}</React.Fragment>
      ))}
    </OGText>
  )

  return (
    <OGMetadataContainer
      showOGMetadata={!!showOGMetadata}
      bgColor={incoming ? incomingMessageBackgroundX : outgoingMessageBackgroundX}
    >
      {ogLayoutOrder === 'og-first' && content}
      <div onClick={() => window.open(attachment?.url, '_blank')} style={{ width: '100%', cursor: 'pointer' }}>
        {ogLayoutOrder !== 'og-first' && content}
      </div>
    </OGMetadataContainer>
  )
}

export { OGMetadata }

const OGMetadataContainer = styled.div<{ showOGMetadata: boolean; bgColor: string }>`
  min-width: 294px;
  max-width: 400px;
  display: grid;
  grid-template-columns: 1fr;
  background-color: ${({ bgColor }) => bgColor};
  border-radius: 8px;
  margin-bottom: 0.4rem;
  margin-top: 0.4rem;
  margin: 0.8rem auto;
  margin-bottom: ${({ showOGMetadata }) => (showOGMetadata ? '0.4rem' : '0')};
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
}>`
  // width: 400px;
  // height: 240px;
  max-width: 400px;
  max-height: 240px;
  opacity: ${({ showOGMetadata, containerHeight }) => (showOGMetadata && containerHeight ? 1 : 0)};
  overflow: hidden;
  margin: 0 auto;
  border-radius: 8px;
  transition: ${({ shouldAnimate }) => (shouldAnimate ? 'height 0.2s ease, opacity 0.2s ease' : 'none')};
`

const OGText = styled.div<{ shouldAnimate: boolean }>`
  margin: 12px;
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: all 0.2s ease;
  `}
`

const Url = styled.p<{ maxWidth: number; shouldAnimate: boolean }>`
  font-weight: normal;
  font-size: 13px;
  padding: 0;
  margin: 0 0 12px 0;
  color: gray;
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${`${maxWidth}px`};
  `}
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: all 0.2s ease;
  `}
`

const Title = styled.p<{ maxWidth: number; shouldAnimate: boolean }>`
  font-weight: bold;
  font-size: 13px;
  display: flex;
  align-items: center;
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${`${maxWidth}px`};
  `}
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: all 0.2s ease;
  `}
`

const Desc = styled.p<{ maxWidth: number; shouldAnimate: boolean; color: string }>`
  font-weight: normal;
  font-size: 13px;
  margin: 8px;
  overflow: hidden;
  display: -webkit-box;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: 0px;
  color: ${(props) => props.color};
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  ${({ maxWidth }) =>
    maxWidth &&
    `
    max-width: ${`${maxWidth}px`};
  `}
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: all 0.2s ease;
  `}
`

const Img = styled.img<{ imageWidth?: number; imageHeight?: number; shouldAnimate: boolean }>`
  //width: 100%;
  // height: 100%;
  max-width: 100%;
  object-fit: cover;
  display: block;
  border-radius: inherit;
  transition: ${({ shouldAnimate }) => (shouldAnimate ? 'opacity 0.2s ease' : 'none')};
`

// const Favicon = styled.img<{ shouldAnimate: boolean }>`
//   ${({ shouldAnimate }) =>
//     shouldAnimate &&
//     `
//     transition: all 0.2s ease;
//   `}
//   width: 24px;
//   height: 24px;
//   object-fit: contain;
//   margin-right: 4px;
// `
