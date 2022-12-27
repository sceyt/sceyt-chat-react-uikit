import React, { useEffect } from 'react'
import styled from 'styled-components'
import { useDispatch } from 'react-redux'
import { CHANNEL_TYPE, channelDetailsTabs } from '../../../helpers/constants'
import { colors } from '../../../UIHelper/constants'
import Members from './Members'
import Media from './Media'
import Files from './Files'
import Links from './Links'
import { emptyChannelAttachmentsAC } from '../../../store/message/actions'
import { IChannel } from '../../../types'

interface IProps {
  channel: IChannel
  activeTab: string
  setActiveTab: (activeTab: string) => void
  chekActionPermission: (permission: string) => boolean
  linkPreviewIcon?: JSX.Element
  linkPreviewHoverIcon?: JSX.Element
  linkPreviewTitleColor?: string
  linkPreviewColor?: string
  linkPreviewHoverBackgroundColor?: string
  filePreviewIcon?: JSX.Element
  filePreviewHoverIcon?: JSX.Element
  filePreviewTitleColor?: string
  filePreviewSizeColor?: string
  filePreviewHoverBackgroundColor?: string
  filePreviewDownloadIcon?: JSX.Element
}

const DetailsTab = ({
  channel,
  activeTab,
  chekActionPermission,
  setActiveTab,
  linkPreviewIcon,
  linkPreviewHoverIcon,
  linkPreviewTitleColor,
  linkPreviewColor,
  linkPreviewHoverBackgroundColor,
  filePreviewIcon,
  filePreviewHoverIcon,
  filePreviewTitleColor,
  filePreviewSizeColor,
  filePreviewHoverBackgroundColor,
  filePreviewDownloadIcon
}: IProps) => {
  const dispatch = useDispatch()
  /* const [activeTab, setActiveTab] = useState(
    channel.type !== CHANNEL_TYPE.DIRECT ? channelDetailsTabs.member : channelDetailsTabs.media
  ) */
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const showMembers = !isDirectChannel && chekActionPermission('getMembers')

  const handleTabClick = (tabIndex: string) => {
    dispatch(emptyChannelAttachmentsAC())
    setActiveTab(tabIndex)
  }

  useEffect(() => {
    if (!showMembers) {
      setActiveTab(channelDetailsTabs.media)
    } else {
      setActiveTab(channelDetailsTabs.member)
    }
  }, [showMembers])

  return (
    <Container>
      <DetailsTabHeader activeTabColor='#0DBD8B'>
        {showMembers && (
          <button
            className={activeTab === channelDetailsTabs.member ? 'active' : ''}
            type='button'
            onClick={() => handleTabClick(channelDetailsTabs.member)}
          >
            Members
          </button>
        )}
        <button
          className={activeTab === channelDetailsTabs.media ? 'active' : ''}
          type='button'
          onClick={() => handleTabClick(channelDetailsTabs.media)}
        >
          Media
        </button>
        <button
          className={activeTab === channelDetailsTabs.file ? 'active' : ''}
          type='button'
          onClick={() => handleTabClick(channelDetailsTabs.file)}
        >
          Files
        </button>
        <button
          className={activeTab === channelDetailsTabs.link ? 'active' : ''}
          type='button'
          onClick={() => handleTabClick(channelDetailsTabs.link)}
        >
          Links
        </button>
      </DetailsTabHeader>
      {showMembers && activeTab === channelDetailsTabs.member && (
        <Members channel={channel} chekActionPermission={chekActionPermission} />
      )}
      {activeTab === channelDetailsTabs.media && <Media channelId={channel.id} />}
      {activeTab === channelDetailsTabs.file && (
        <Files
          channelId={channel.id}
          filePreviewIcon={filePreviewIcon}
          filePreviewHoverIcon={filePreviewHoverIcon}
          filePreviewTitleColor={filePreviewTitleColor}
          filePreviewSizeColor={filePreviewSizeColor}
          filePreviewHoverBackgroundColor={filePreviewHoverBackgroundColor}
          filePreviewDownloadIcon={filePreviewDownloadIcon}
        />
      )}
      {activeTab === channelDetailsTabs.link && (
        <Links
          channelId={channel.id}
          linkPreviewIcon={linkPreviewIcon}
          linkPreviewHoverIcon={linkPreviewHoverIcon}
          linkPreviewTitleColor={linkPreviewTitleColor}
          linkPreviewColor={linkPreviewColor}
          linkPreviewHoverBackgroundColor={linkPreviewHoverBackgroundColor}
        />
      )}
    </Container>
  )
}

export default DetailsTab

const Container = styled.div`
  border-top: 1px solid ${colors.gray1};
`

const DetailsTabHeader = styled.div<{ activeTabColor?: string }>`
  padding: 0 11px;
  margin: 8px 0;
  border-bottom: 1px solid ${colors.gray1};
  display: flex;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fff;
  button {
    position: relative;
    border: none;
    margin: 0 5px;
    background: transparent;
    outline: none;
    padding: 6px 0;
    font-family: Roboto, sans-serif;
    font-style: normal;
    font-weight: normal;
    font-size: 15px;
    line-height: 20px;
    color: ${colors.gray6};
    cursor: pointer;
  }
  & .active:after {
    content: '';
    width: 100%;
    border-radius: 2px;
    height: 2px;
    background-color: #0dbd8b;
    position: absolute;
    top: calc(100% - 1px);
    left: 0;
  }
`

export const AttachmentIconCont = styled.span`
  display: inline-flex;
`
export const AttachmentHoverIconCont = styled.span`
  display: none;
`

export const AttachmentPreviewTitle = styled.span<{ color?: string }>`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: calc(100% - 20px);
  font-family: Roboto, sans-serif;
  font-style: normal;
  font-weight: normal;
  font-size: 15px;
  line-height: 20px;
  color: ${(props) => props.color || colors.blue10};
`
