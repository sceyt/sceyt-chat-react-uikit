import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { IAttachment, IOGMetadata } from '../../../types'
import styled from 'styled-components'
import { getClient } from '../../../common/client'
import { getMetadata, storeMetadata } from '../../../services/indexedDB/metadataService'
import { attachmentTypes } from '../../../helpers/constants'
import { setOGMetadataAC, updateOGMetadataAC } from '../../../store/message/actions'
import { useDispatch, useSelector } from '../../../store/hooks'

const validateUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    return urlObj
  } catch (error) {
    return false
  }
}

const OGMetadata = ({ attachments, state }: { attachments: IAttachment[]; state: string }) => {
  const dispatch = useDispatch()
  const oGMetadata = useSelector((state: any) => state.MessageReducer.oGMetadata)

  const attachment = useMemo(() => {
    return attachments.find((attachment) => attachment.type === attachmentTypes.link)
  }, [attachments])

  const metadata = useMemo(() => {
    return oGMetadata[attachment?.url] || null
  }, [oGMetadata, attachment?.url])

  const [imageLoadError, setImageLoadError] = useState(false)
  const [faviconLoadError, setFaviconLoadError] = useState(false)
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

  console.log('metadata', metadata)

  return (
    <OGMetadataContainer showOGMetadata={!!showOGMetadata}>
      <div
        onClick={() => {
          window.open(attachment?.url, '_blank')
        }}
        style={{ width: showOGMetadata ? '400px' : 'auto' }}
      >
        <ImageContainer
          showOGMetadata={!!showOGMetadata && !imageLoadError}
          containerWidth={400}
          containerHeight={calculatedImageHeight}
          shouldAnimate={shouldAnimate}
        >
          {metadata?.og?.image?.[0]?.url && !imageLoadError ? (
            <Img
              src={metadata?.og?.image?.[0]?.url}
              alt='OG metadata image'
              imageWidth={400}
              imageHeight={calculatedImageHeight}
              shouldAnimate={shouldAnimate}
            />
          ) : null}
        </ImageContainer>
        {showOGMetadata ? (
          <OGText shouldAnimate={shouldAnimate}>
            <Url maxWidth={400} shouldAnimate={shouldAnimate}>
              {ogUrl}
            </Url>
            {metadata?.og?.title ? (
              <Title maxWidth={400} shouldAnimate={shouldAnimate}>
                {metadata?.og?.favicon?.url && !faviconLoadError ? (
                  <Favicon
                    shouldAnimate={shouldAnimate}
                    src={metadata?.og?.favicon?.url}
                    onLoad={() => setFaviconLoadError(false)}
                    onError={() => {
                      dispatch(
                        updateOGMetadataAC(attachment?.url, {
                          ...metadata,
                          og: { ...metadata?.og, favicon: { url: '' } }
                        })
                      )
                      setFaviconLoadError(true)
                    }}
                  />
                ) : null}
                <span>{metadata?.og?.title}</span>
              </Title>
            ) : null}
            {metadata?.og?.description ? (
              <Desc maxWidth={400} shouldAnimate={shouldAnimate}>
                {metadata?.og?.description}
              </Desc>
            ) : null}
          </OGText>
        ) : null}
      </div>
    </OGMetadataContainer>
  )
}

export { OGMetadata }

const OGMetadataContainer = styled.div<{ showOGMetadata: boolean }>`
  min-width: inherit;
  max-width: inherit;
  display: grid;
  grid-template-columns: 1fr;
  background-color: rgba(0, 0, 0, 0.034);
  border-radius: 6px;
  margin-bottom: 0.4rem;
  margin: 0 auto;
  margin-bottom: ${({ showOGMetadata }) => (showOGMetadata ? '0.8rem' : '0')};
  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
    cursor: pointer;
  }
`

const ImageContainer = styled.div<{
  showOGMetadata: boolean
  containerWidth: number
  containerHeight: number
  shouldAnimate: boolean
}>`
  ${({ containerWidth }) =>
    containerWidth
      ? `
    max-width: ${`${containerWidth}px`};
  `
      : `
    max-width: 100%;
    width: 100%;
  `}

  ${({ containerHeight, showOGMetadata }) =>
    containerHeight
      ? `
    max-height: ${`${containerHeight}px`};
    height: ${showOGMetadata ? `${containerHeight}px` : '0'};
  `
      : `
      height: 0;
  `}

  opacity: ${({ showOGMetadata, containerHeight }) => (showOGMetadata && containerHeight ? 1 : 0)};
  overflow: hidden;
  margin: 0 auto;
  padding: ${({ showOGMetadata, containerHeight }) => (showOGMetadata && containerHeight ? '4px' : '0')};
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: height 0.2s ease;
  `}
`

const OGText = styled.div<{ shouldAnimate: boolean }>`
  padding: 0.5rem;
  margin: 0;
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
  padding: 0;
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

const Desc = styled.p<{ maxWidth: number; shouldAnimate: boolean }>`
  font-weight: normal;
  font-size: 13px;
  padding: 0;
  overflow: hidden;
  display: -webkit-box;
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
  ${({ imageWidth }) =>
    imageWidth &&
    `
    max-width: ${`${imageWidth}px`};
    width: ${`calc(${imageWidth}px - 8px)`};
  `}
  ${({ imageHeight }) =>
    imageHeight &&
    `
    max-height: ${`${imageHeight}px`};
    min-height: ${`${imageHeight}px`};
    height: ${`${imageHeight}px`};
  `}

  object-fit: cover;
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: height 0.2s ease;
  `}
`

const Favicon = styled.img<{ shouldAnimate: boolean }>`
  ${({ shouldAnimate }) =>
    shouldAnimate &&
    `
    transition: all 0.2s ease;
  `}
  width: 24px;
  height: 24px;
  object-fit: contain;
  margin-right: 4px;
`
