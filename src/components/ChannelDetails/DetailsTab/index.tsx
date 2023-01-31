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
import Voices from './Voices'

interface IProps {
  channel: IChannel
  activeTab: string
  setActiveTab: (activeTab: string) => void
  checkActionPermission: (permission: string) => boolean
  linkPreviewIcon?: JSX.Element
  linkPreviewHoverIcon?: JSX.Element
  linkPreviewTitleColor?: string
  linkPreviewColor?: string
  linkPreviewHoverBackgroundColor?: string
  voicePreviewIcon?: JSX.Element
  voicePreviewHoverIcon?: JSX.Element
  voicePreviewTitleColor?: string
  voicePreviewDateAndTimeColor?: string
  voicePreviewHoverBackgroundColor?: string
  filePreviewIcon?: JSX.Element
  filePreviewHoverIcon?: JSX.Element
  filePreviewTitleColor?: string
  filePreviewSizeColor?: string
  filePreviewHoverBackgroundColor?: string
  filePreviewDownloadIcon?: JSX.Element
  showChangeMemberRole?: boolean
  showKickMember?: boolean
  showKickAndBlockMember?: boolean
  showMakeMemberAdmin?: boolean
  publicChannelDeleteMemberPopupDescription?: string
  privateChannelDeleteMemberPopupDescription?: string
  publicChannelRevokeAdminPopupTitle?: string
  publicChannelRevokeAdminPopupDescription?: string
  privateChannelRevokeAdminPopupTitle?: string
  privateChannelRevokeAdminPopupDescription?: string
  publicChannelMakeAdminPopupTitle?: string
  publicChannelMakeAdminPopupDescription?: string
  privateChannelMakeAdminPopupTitle?: string
  privateChannelMakeAdminPopupDescription?: string
}

const DetailsTab = ({
  channel,
  activeTab,
  checkActionPermission,
  setActiveTab,
  linkPreviewIcon,
  linkPreviewHoverIcon,
  linkPreviewTitleColor,
  linkPreviewColor,
  linkPreviewHoverBackgroundColor,
  voicePreviewIcon,
  voicePreviewHoverIcon,
  voicePreviewTitleColor,
  voicePreviewDateAndTimeColor,
  voicePreviewHoverBackgroundColor,
  filePreviewIcon,
  filePreviewHoverIcon,
  filePreviewTitleColor,
  filePreviewSizeColor,
  filePreviewHoverBackgroundColor,
  filePreviewDownloadIcon,
  showChangeMemberRole,
  showKickMember,
  showKickAndBlockMember,
  showMakeMemberAdmin,
  publicChannelDeleteMemberPopupDescription,
  privateChannelDeleteMemberPopupDescription,
  publicChannelRevokeAdminPopupDescription,
  privateChannelRevokeAdminPopupDescription,
  publicChannelMakeAdminPopupDescription,
  privateChannelMakeAdminPopupDescription
}: IProps) => {
  const dispatch = useDispatch()
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const showMembers = !isDirectChannel && checkActionPermission('getMembers')

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
      <DetailsTabHeader activeTabColor={colors.primary}>
        {Object.keys(channelDetailsTabs).map((key) => {
          if (key === 'member') {
            if (showMembers) {
              return (
                <button
                  className={activeTab === channelDetailsTabs[key] ? 'active' : ''}
                  type='button'
                  onClick={() => handleTabClick(channelDetailsTabs[key])}
                  key={key}
                >
                  {channelDetailsTabs[key] === channelDetailsTabs.member
                    ? channel.type === CHANNEL_TYPE.PUBLIC
                      ? 'Subscribers'
                      : channelDetailsTabs[key]
                    : channelDetailsTabs[key]}
                </button>
              )
            } else {
              return null
            }
          }
          return (
            <button
              className={activeTab === channelDetailsTabs[key] ? 'active' : ''}
              type='button'
              onClick={() => handleTabClick(channelDetailsTabs[key])}
              key={key}
            >
              {channelDetailsTabs[key]}
            </button>
          )
        })}
      </DetailsTabHeader>
      {showMembers && activeTab === channelDetailsTabs.member && (
        <Members
          publicChannelDeleteMemberPopupDescription={publicChannelDeleteMemberPopupDescription}
          privateChannelDeleteMemberPopupDescription={privateChannelDeleteMemberPopupDescription}
          publicChannelRevokeAdminPopupDescription={publicChannelRevokeAdminPopupDescription}
          privateChannelRevokeAdminPopupDescription={privateChannelRevokeAdminPopupDescription}
          publicChannelMakeAdminPopupDescription={publicChannelMakeAdminPopupDescription}
          privateChannelMakeAdminPopupDescription={privateChannelMakeAdminPopupDescription}
          channel={channel}
          chekActionPermission={checkActionPermission}
          showChangeMemberRole={showChangeMemberRole}
          showKickMember={showKickMember}
          showKickAndBlockMember={showKickAndBlockMember}
          showMakeMemberAdmin={showMakeMemberAdmin}
        />
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
      {activeTab === channelDetailsTabs.voice && (
        <Voices
          channelId={channel.id}
          voicePreviewIcon={voicePreviewIcon}
          voicePreviewHoverIcon={voicePreviewHoverIcon}
          voicePreviewTitleColor={voicePreviewTitleColor}
          voicePreviewDateAndTimeColor={voicePreviewDateAndTimeColor}
          voicePreviewHoverBackgroundColor={voicePreviewHoverBackgroundColor}
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
  padding: 0 20px;
  border-bottom: 1px solid ${colors.gray1};
  display: flex;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 12;
  background: #fff;
  button {
    position: relative;
    border: none;
    background: transparent;
    outline: none;
    padding: 13px 0 11px;
    font-style: normal;
    font-weight: 500;
    font-size: 15px;
    line-height: 20px;
    color: ${colors.gray9};
    cursor: pointer;
  }
  & .active {
    color: ${colors.gray6};

    &:after {
      content: '';
      width: 100%;
      border-radius: 2px;
      height: 2px;
      background-color: ${(props) => props.activeTabColor || colors.primary};
      position: absolute;
      top: calc(100% - 1px);
      left: 0;
    }
  }
`
