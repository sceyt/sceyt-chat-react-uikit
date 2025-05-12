import React, { useEffect } from 'react'
import styled from 'styled-components'
import { useDispatch } from 'react-redux'
// Store
import { emptyChannelAttachmentsAC } from '../../../store/message/actions'
// Helpers
import { getChannelTypesMemberDisplayTextMap } from '../../../helpers/channelHalper'
import { DEFAULT_CHANNEL_TYPE, channelDetailsTabs } from '../../../helpers/constants'
import { colors, THEME_COLORS } from '../../../UIHelper/constants'
import { IChannel } from '../../../types'
// Components
import Members from './Members'
import Media from './Media'
import Files from './Files'
import Links from './Links'
import Voices from './Voices'
import { useColor } from '../../../hooks'

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
  fileNameFontSize?: string
  fileNameLineHeight?: string
  fileSizeFontSize?: string
  fileSizeLineHeight?: string
  showChangeMemberRole?: boolean
  showKickMember?: boolean
  showKickAndBlockMember?: boolean
  showMakeMemberAdmin?: boolean
  memberHoverBackgroundColor?: string
  addMemberFontSize?: string
  addMemberIcon?: JSX.Element
  memberNameFontSize?: string
  memberAvatarSize?: number
  memberPresenceFontSize?: string
  borderColor?: string
  tabItemsFontSize?: string
  tabItemsLineHeight?: string
  tabItemsMinWidth?: string
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
  fileNameFontSize,
  fileNameLineHeight,
  fileSizeFontSize,
  fileSizeLineHeight,
  showChangeMemberRole,
  showKickMember,
  showKickAndBlockMember,
  showMakeMemberAdmin,
  memberHoverBackgroundColor,
  addMemberFontSize,
  addMemberIcon,
  memberNameFontSize,
  memberAvatarSize,
  memberPresenceFontSize,
  borderColor,
  tabItemsFontSize,
  tabItemsLineHeight,
  tabItemsMinWidth
}: IProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BORDER]: borderThemeColor,
    [THEME_COLORS.BACKGROUND]: backgroundColor
  } = useColor()

  const dispatch = useDispatch()
  const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const showMembers = !isDirectChannel && checkActionPermission('getMembers')
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const displayMemberText =
    memberDisplayText && memberDisplayText[channel.type]
      ? `${memberDisplayText[channel.type]}s`
      : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
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
        color={textSecondary}
        activeTabColor={accentColor}
        borderColor={borderColor || borderThemeColor}
        fontSize={tabItemsFontSize}
        lineHeight={tabItemsLineHeight}
        minWidth={tabItemsMinWidth}
        backgroundColor={backgroundColor}
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
                  <span>
                    {channelDetailsTabs[key] === channelDetailsTabs.member
                      ? displayMemberText
                      : channelDetailsTabs[key]}
                  </span>
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
              <span>{channelDetailsTabs[key]}</span>
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
          hoverBackgroundColor={memberHoverBackgroundColor}
          addMemberFontSize={addMemberFontSize}
          addMemberIcon={addMemberIcon}
          memberNameFontSize={memberNameFontSize}
          memberAvatarSize={memberAvatarSize}
          memberPresenceFontSize={memberPresenceFontSize}
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
          fileNameFontSize={fileNameFontSize}
          fileNameLineHeight={fileNameLineHeight}
          fileSizeFontSize={fileSizeFontSize}
          fileSizeLineHeight={fileSizeLineHeight}
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

const DetailsTabHeader = styled.div<{
  activeTabColor?: string
  borderColor: string
  backgroundColor?: string
  fontSize?: string
  minWidth?: string
  lineHeight?: string
  color: string
}>`
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 20px;
  border-bottom: 1px solid ${(props) => props.borderColor};
  background-color: ${(props) => props.backgroundColor || 'transparent'};
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
    height: 44px;
    text-transform: capitalize;
    font-style: normal;
    font-weight: 500;
    font-size: ${(props) => props.fontSize || '15px'};
    line-height: ${(props) => props.lineHeight || '20px'};
    color: ${(props) => props.color};
    min-width: ${(props) => props.minWidth || '70px'};
    cursor: pointer;
  }

  & span {
    position: relative;
    display: inline-flex;
    align-items: center;
    height: 100%;
  }

  & .active span {
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
