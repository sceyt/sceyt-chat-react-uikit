import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { IAttachment, IOGMetadata } from '../../../types'
import styled from 'styled-components'
import { getClient } from '../../../common/client'
import { getMetadata, storeMetadata } from '../../../services/indexedDB/metadataService'

const validateUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    return urlObj
  } catch (error) {
    return false
  }
}

const OGMetadata = ({ attachments, state }: { attachments: IAttachment[]; state: string }) => {
  const [metadata, setMetadata] = useState<IOGMetadata | null>(null)

  const attachment = useMemo(() => {
    return attachments.find((attachment) => attachment.type === 'link')
  }, [attachments?.length])

  const ogMetadataQueryBuilder = useCallback(async (url: string) => {
    const client = getClient()
    if (client) {
      try {
        const queryBuilder = new client.MessageLinkOGQueryBuilder(url)
        const query = await queryBuilder.build()
        const metadata = await query.loadOGData()
        await storeMetadata(url.replace('https://', '').replace('http://', ''), metadata)
        setMetadata(metadata)
      } catch (error) {
        console.log('Failed to fetch OG metadata')
      }
    }
    return null
  }, [])

  useEffect(() => {
    if (attachment?.id && !metadata) {
      const url = attachment?.url

      if (url) {
        getMetadata(url.replace('https://', '').replace('http://', ''))
          .then(async (cachedMetadata) => {
            if (cachedMetadata) {
              setMetadata(cachedMetadata)
            } else {
              ogMetadataQueryBuilder(url)
            }
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
    return (
      state === 'deleted' ||
      metadata?.og?.title === '' ||
      metadata?.og?.image?.[0]?.url === '' ||
      metadata?.og?.description === '' ||
      !metadata
    )
  }, [state, metadata])

  return (
    <OGMetadataContainer>
      <div
        onClick={() => {
          window.open(attachment?.url, '_blank')
        }}
      >
        <ImageContainer showOGMetadata={showOGMetadata}>
          {metadata?.og?.image?.[0]?.url ? <Img src={metadata?.og?.image?.[0]?.url} alt='OG metadata image' /> : null}
        </ImageContainer>
        {showOGMetadata ? null : (
          <OGText>
            <Url>{ogUrl}</Url>
            {metadata?.og?.title ? (
              <Title>
                {metadata?.og?.favicon?.url ? <Favicon src={metadata?.og?.favicon?.url} /> : null}
                <span>{metadata?.og?.title}</span>
              </Title>
            ) : null}
            {metadata?.og?.description ? <Desc>{metadata?.og?.description}</Desc> : null}
          </OGText>
        )}
      </div>
    </OGMetadataContainer>
  )
}

export { OGMetadata }

const OGMetadataContainer = styled.div`
  min-width: inherit;
  max-width: inherit;
  display: grid;
  grid-template-columns: 1fr;
  background-color: rgba(0, 0, 0, 0.034);
  border-radius: 6px;
  margin-bottom: 0.4rem;
  margin: 0 auto;
  margin-bottom: 0.8rem;
  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
    cursor: pointer;
  }
`

const ImageContainer = styled.div<{ showOGMetadata: boolean }>`
  max-width: 100%;
  max-height: 200px;
  width: 100%;
  height: 200px;
  margin: 0 auto;
  padding: 0.3rem;
  height: ${({ showOGMetadata }) => (!showOGMetadata ? '200px' : '0')};
  transition: height 0.2s ease;
`

const OGText = styled.div`
  width: 80%;
  padding: 0.5rem;
  margin: 0;
`

const Url = styled.p`
  font-weight: normal;
  font-size: 13px;
  padding: 0;
  margin: 0 0 12px 0;
  color: gray;
`

const Title = styled.p`
  font-weight: bold;
  font-size: 13px;
  padding: 0;
  display: flex;
  align-items: center;
`

const Desc = styled.p`
  font-weight: normal;
  font-size: 13px;
  padding: 0;
`

const Img = styled.img`
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 200px;
  object-fit: cover;
  transition: height 0.2s ease;
`

const Favicon = styled.img`
  width: 24px;
  height: 24px;
  object-fit: contain;
  margin-right: 4px;
`
