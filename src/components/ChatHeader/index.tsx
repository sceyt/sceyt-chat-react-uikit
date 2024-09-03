import styled from 'styled-components'
import React from 'react'
// Store
import { switchChannelActionAC, switchChannelInfoAC } from '../../store/channel/actions'
import {
  activeChannelSelector,
  channelInfoIsOpenSelector,
  channelListHiddenSelector
} from '../../store/channel/selector'
import { themeSelector } from '../../store/theme/selector'
import { contactsMapSelector } from '../../store/user/selector'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
// Assets
import { ReactComponent as InfoIconD } from '../../assets/svg/info.svg'
import { ReactComponent as ArrowLeftIcon } from '../../assets/svg/arrowLeft.svg'
// Helpers
import { userLastActiveDateFormat } from '../../helpers'
import { makeUsername } from '../../helpers/message'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { hideUserPresence } from '../../helpers/userHelper'
import { getClient } from '../../common/client'
import { getChannelTypesMemberDisplayTextMap, getShowChannelDetails } from '../../helpers/channelHalper'
import { DEFAULT_CHANNEL_TYPE, USER_PRESENCE_STATUS } from '../../helpers/constants'
import { SectionHeader, SubTitle } from '../../UIHelper'
import { AvatarWrapper, UserStatus } from '../Channel'
import { colors, THEME_COLOR_NAMES } from '../../UIHelper/constants'
import { IContactsMap, IMember } from '../../types'
// Components
import Avatar from '../Avatar'
import { useColor } from '../../hooks'
interface IProps {
  backgroundColor?: string
  avatarBorderRadius?: string
  titleColor?: string
  titleFontSize?: string
  titleLineHeight?: string
  memberInfoTextColor?: string
  memberInfoFontSize?: string
  memberInfoLineHeight?: string
  avatarSize?: number
  avatarTextSize?: number
  showMemberInfo?: boolean
  infoIcon?: JSX.Element
  borderBottom?: string
  mobileBackButtonClicked?: () => void
  MobileBackButton?: JSX.Element
  CustomActions?: JSX.Element
  backButtonOrder?: number
  channelInfoOrder?: number
  infoIconOrder?: number
  customActionsOrder?: number
}

export default function ChatHeader({
  infoIcon,
  backgroundColor,
  titleColor,
  avatarBorderRadius,
  memberInfoTextColor,
  memberInfoFontSize,
  memberInfoLineHeight,
  mobileBackButtonClicked,
  MobileBackButton,
  showMemberInfo = true,
  avatarSize,
  avatarTextSize,
  borderBottom,
  titleFontSize,
  titleLineHeight,
  CustomActions,
  backButtonOrder,
  channelInfoOrder,
  infoIconOrder,
  customActionsOrder
}: IProps) {
  const accentColor = useColor(THEME_COLOR_NAMES.ACCENT)
  const textPrimary = useColor(THEME_COLOR_NAMES.TEXT_PRIMARY)
  const textSecondary = useColor(THEME_COLOR_NAMES.TEXT_SECONDARY)
  const iconPrimary = useColor(THEME_COLOR_NAMES.ICON_PRIMARY)
  const borderColor = useColor(THEME_COLOR_NAMES.BORDER)
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()
  // const [infoButtonVisible, setInfoButtonVisible] = useState(false)
  const activeChannel = useSelector(activeChannelSelector)
  const theme = useSelector(themeSelector)
  const showChannelDetails = getShowChannelDetails()
  const channelListHidden = useSelector(channelListHiddenSelector)
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)
  const isDirectChannel = activeChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const isSelfChannel = isDirectChannel && activeChannel.metadata?.s
  const directChannelUser = isDirectChannel && activeChannel.members.find((member: IMember) => member.id !== user.id)
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const displayMemberText =
    memberDisplayText && memberDisplayText[activeChannel.type]
      ? activeChannel.memberCount > 1
        ? `${memberDisplayText[activeChannel.type]}s`
        : memberDisplayText[activeChannel.type]
      : activeChannel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || activeChannel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
        ? activeChannel.memberCount > 1
          ? 'subscribers'
          : 'subscriber'
        : activeChannel.memberCount > 1
          ? 'members'
          : 'member'
  const channelDetailsOnOpen = () => {
    if (!channelListHidden && showChannelDetails) {
      dispatch(switchChannelInfoAC(!channelDetailsIsOpen))
    }
  }
  const handleSwitchChannel = () => {
    if (activeChannel.linkedFrom) {
      dispatch(switchChannelActionAC({ ...activeChannel.linkedFrom, backToLinkedChannel: true }))
    }
  }

  const handleBackToChannels = () => {
    dispatch(switchChannelActionAC({}))
    mobileBackButtonClicked && mobileBackButtonClicked()
  }

  /* const channelDetailsOpen = false

   useEffect(() => {
     if (!channelDetailsOpen) {
       setTimeout(() => {
         setInfoButtonVisible(!channelDetailsOpen)
       }, 90)
     } else {
       setInfoButtonVisible(!channelDetailsOpen)
     }
   }, [channelDetailsOpen]) */

  return (
    <Container background={backgroundColor} borderBottom={borderBottom} borderColor={borderColor}>
      {/* {LefSideCustomActions && <LefSideCustomActions />} */}
      <MobileButtonWrapper onClick={handleBackToChannels}>
        {MobileBackButton || (
          <MobileBackButtonWrapper onClick={handleBackToChannels} hoverBackground={colors.primaryLight}>
            <WrapArrowLeftIcon color={iconPrimary} />
          </MobileBackButtonWrapper>
        )}
      </MobileButtonWrapper>

      {activeChannel.isLinkedChannel && (
        <BackButtonWrapper onClick={handleSwitchChannel} hoverBackground={colors.primaryLight} order={backButtonOrder}>
          <WrapArrowLeftIcon color={iconPrimary} />
        </BackButtonWrapper>
      )}
      <ChannelInfo
        onClick={channelDetailsOnOpen}
        clickable={!channelListHidden && showChannelDetails}
        order={channelInfoOrder}
      >
        <AvatarWrapper>
          {(activeChannel.subject || (isDirectChannel && (directChannelUser || isSelfChannel))) && (
            <Avatar
              borderRadius={avatarBorderRadius}
              name={
                activeChannel.subject ||
                (isDirectChannel && directChannelUser
                  ? directChannelUser.firstName || directChannelUser.id
                  : isSelfChannel
                    ? 'Me'
                    : '')
              }
              image={
                activeChannel.avatarUrl ||
                (isDirectChannel && directChannelUser
                  ? directChannelUser.avatarUrl
                  : isSelfChannel
                    ? user.avatarUrl
                    : '')
              }
              size={avatarSize || 36}
              textSize={avatarTextSize || 13}
              setDefaultAvatar={isDirectChannel}
            />
          )}
          {/* {isDirectChannel && directChannelUser.presence.state === PRESENCE_STATUS.ONLINE && <UserStatus />} */}
        </AvatarWrapper>
        <ChannelName>
          <SectionHeader
            color={titleColor || textPrimary}
            theme={theme}
            fontSize={titleFontSize}
            uppercase={directChannelUser && hideUserPresence && hideUserPresence(directChannelUser)}
            lineHeight={titleLineHeight}
          >
            {activeChannel.subject ||
              (isDirectChannel && directChannelUser
                ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
                : isSelfChannel
                  ? 'Me'
                  : '')}
          </SectionHeader>
          {showMemberInfo &&
            !isSelfChannel &&
            (isDirectChannel && directChannelUser ? (
              <SubTitle
                fontSize={memberInfoFontSize}
                lineHeight={memberInfoLineHeight}
                color={memberInfoTextColor || textSecondary}
              >
                {hideUserPresence && hideUserPresence(directChannelUser)
                  ? ''
                  : directChannelUser.presence &&
                    (directChannelUser.presence.state === USER_PRESENCE_STATUS.ONLINE
                      ? 'Online'
                      : directChannelUser.presence.lastActiveAt &&
                        userLastActiveDateFormat(directChannelUser.presence.lastActiveAt))}
              </SubTitle>
            ) : (
              <SubTitle
                fontSize={memberInfoFontSize}
                lineHeight={memberInfoLineHeight}
                color={memberInfoTextColor || textSecondary}
              >
                {!activeChannel.subject && !isDirectChannel ? '' : `${activeChannel.memberCount} ${displayMemberText} `}
              </SubTitle>
            ))}
        </ChannelName>
      </ChannelInfo>
      {CustomActions && <CustomActionsWrapper order={customActionsOrder}>{CustomActions}</CustomActionsWrapper>}
      {!channelListHidden && showChannelDetails && (
        <ChanelInfo onClick={() => channelDetailsOnOpen()} infoIconColor={accentColor} order={infoIconOrder}>
          {infoIcon || <DefaultInfoIcon color={iconPrimary} />}
        </ChanelInfo>
      )}
    </Container>
  )
}

const Container = styled.div<{ background?: string; borderColor: string; borderBottom?: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  height: 64px;
  box-sizing: border-box;
  border-bottom: ${(props) => props.borderBottom || `1px solid ${props.borderColor}`};
  background-color: ${(props) => props.background};
`

const ChannelInfo = styled.div<{ clickable?: boolean; onClick: any; order?: number }>`
  display: flex;
  align-items: center;
  width: 650px;
  max-width: calc(100% - 70px);
  cursor: ${(props) => props.clickable && 'pointer'};
  margin-right: auto;
  order: ${(props) => props.order};

  & ${UserStatus} {
    width: 10px;
    height: 10px;
  }
`

const ChannelName = styled.div`
  margin-left: 7px;
  width: 100%;

  & > ${SectionHeader} {
    max-width: calc(100% - 8px);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
`

const CustomActionsWrapper = styled.div<{ order?: number }>`
  order: ${(props) => props.order};
`

const ChanelInfo = styled.span<{ infoIconColor?: string; order?: number }>`
  display: flex;
  cursor: pointer;
  order: ${(props) => props.order};

  > svg {
    color: ${(props) => props.infoIconColor};
  }
`
const BackButtonWrapper = styled.span<{ hoverBackground?: string; order?: number }>`
  display: inline-flex;
  cursor: pointer;
  margin-right: 16px;
  border-radius: 50%;
  transition: all 0.2s;
  order: ${(props) => props.order};
  &:hover {
    background-color: ${(props) => props.hoverBackground || colors.primaryLight};
  }
  @media (max-width: 768px) {
    display: none;
  }
`

const MobileButtonWrapper = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: inline-flex;
  }
`

const MobileBackButtonWrapper = styled.span<{ hoverBackground?: string; order?: number }>`
  display: inline-flex;
  cursor: pointer;
  margin-right: 16px;
  border-radius: 50%;
  transition: all 0.2s;
  order: ${(props) => props.order};
  &:hover {
    background-color: ${(props) => props.hoverBackground || colors.primaryLight};
  }
`

const DefaultInfoIcon = styled(InfoIconD)``
const WrapArrowLeftIcon = styled(ArrowLeftIcon)``
