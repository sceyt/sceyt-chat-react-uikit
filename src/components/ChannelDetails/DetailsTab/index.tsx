import React, { useEffect } from 'react'
import styled from 'styled-components'
import { useDispatch } from 'react-redux'
import { CHANNEL_TYPE, channelDetailsTabs, THEME } from '../../../helpers/constants'
import { colors } from '../../../UIHelper/constants'
import Members from './Members'
import Media from './Media'
import Files from './Files'
import Links from './Links'
import { emptyChannelAttachmentsAC } from '../../../store/message/actions'
import { IChannel } from '../../../types'
import Voices from './Voices'
import { getChannelTypesMemberDisplayTextMap } from '../../../helpers/channelHalper'

interface IProps {
  channel: IChannel
  activeTab: string
  theme: string
  // eslint-disable-next-line no-unused-vars
  setActiveTab: (activeTab: string) => void
  // eslint-disable-next-line no-unused-vars
  checkActionPermission: (permission: string) => boolean
  linkPreviewIcon?: JSX.Element
  linkPreviewHoverIcon?: JSX.Element
  linkPreviewTitleColor?: string
  linkPreviewColor?: string
  linkPreviewHoverBackgroundColor?: string
  voicePreviewPlayIcon?: JSX.Element
  voicePreviewPlayHoverIcon?: JSX.Element
  voicePreviewPauseIcon?: JSX.Element
  voicePreviewPauseHoverIcon?: JSX.Element
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
}

const DetailsTab = ({
  channel,
  theme,
  activeTab,
  checkActionPermission,
  setActiveTab,
  linkPreviewIcon,
  linkPreviewHoverIcon,
  linkPreviewTitleColor,
  linkPreviewColor,
  linkPreviewHoverBackgroundColor,
  voicePreviewPlayIcon,
  voicePreviewPlayHoverIcon,
  voicePreviewPauseIcon,
  voicePreviewPauseHoverIcon,
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
  showMakeMemberAdmin
}: IProps) => {
  const dispatch = useDispatch()
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const showMembers = !isDirectChannel && checkActionPermission('getMembers')
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const displayMemberText =
    memberDisplayText && memberDisplayText[channel.type]
      ? `${memberDisplayText[channel.type]}s`
      : channel.type === CHANNEL_TYPE.BROADCAST || channel.type === CHANNEL_TYPE.PUBLIC
      ? 'subscribers'
      : 'members'
  const handleTabClick = (tabIndex: string) => {
    if (activeTab !== tabIndex) {
      dispatch(emptyChannelAttachmentsAC())
      setActiveTab(tabIndex)
    }
  }
  useEffect(() => {
    if (!showMembers) {
      setActiveTab(channelDetailsTabs.media)
    } else {
      setActiveTab(channelDetailsTabs.member)
    }
  }, [showMembers])

  return (
    <Container theme={theme}>
      <DetailsTabHeader
        activeTabColor={colors.primary}
        backgroundColor={theme === THEME.DARK ? colors.dark : colors.white}
      >
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
                  {channelDetailsTabs[key] === channelDetailsTabs.member ? displayMemberText : channelDetailsTabs[key]}
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
          theme={theme}
          channel={channel}
          checkActionPermission={checkActionPermission}
          showChangeMemberRole={showChangeMemberRole}
          showKickMember={showKickMember}
          showKickAndBlockMember={showKickAndBlockMember}
          showMakeMemberAdmin={showMakeMemberAdmin}
        />
      )}
      {activeTab === channelDetailsTabs.media && <Media channel={channel} />}
      {activeTab === channelDetailsTabs.file && (
        <Files
          channelId={channel.id}
          theme={theme}
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
          voicePreviewPlayHoverIcon={voicePreviewPlayIcon}
          voicePreviewPlayIcon={voicePreviewPlayHoverIcon}
          voicePreviewPauseIcon={voicePreviewPauseIcon}
          voicePreviewPauseHoverIcon={voicePreviewPauseHoverIcon}
          voicePreviewTitleColor={voicePreviewTitleColor}
          voicePreviewDateAndTimeColor={voicePreviewDateAndTimeColor}
          voicePreviewHoverBackgroundColor={voicePreviewHoverBackgroundColor}
        />
      )}
    </Container>
  )
}

export default DetailsTab

const Container = styled.div<{ theme?: string }>`
  //border-top: 1px solid ${colors.gray1};
`

const DetailsTabHeader = styled.div<{ activeTabColor?: string; borderColor?: string; backgroundColor?: string }>`
  overflow: auto;
  padding: 0 20px;
  border-bottom: 1px solid ${(props) => props.borderColor || colors.backgroundColor};
  background-color: ${(props) => props.backgroundColor || colors.white};
  display: flex;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 12;
  /* width */
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    background: transparent;
  }

  /* Handle */
  &::-webkit-scrollbar-thumb {
    background: transparent;
  }

  /* Handle on hover */
  &::-webkit-scrollbar-thumb:hover {
    background: transparent;
  }
  button {
    position: relative;
    border: none;
    background: transparent;
    outline: none;
    padding: 13px 0 11px;
    text-transform: capitalize;
    font-style: normal;
    font-weight: 500;
    font-size: 15px;
    line-height: 20px;
    color: ${colors.textColor2};
    min-width: 70px;
    cursor: pointer;
  }
  & .active {
    color: ${(props) => props.activeTabColor || colors.primary};

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
