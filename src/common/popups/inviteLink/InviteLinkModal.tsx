import React, { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { Popup, PopupName, CloseIcon, PopupBody, Button, PopupFooter } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'
import { ReactComponent as CopySvg } from '../../../assets/svg/copyIcon.svg'
import { themeSelector } from 'store/theme/selector'
import PopupContainer from '../popupContainer'
// import { createChannelInviteKeyAC } from 'store/channel/actions'
import { useDispatch, useSelector } from 'store/hooks'
import { getChannelInviteKeysAC, regenerateChannelInviteKeyAC, updateChannelInviteKeyAC } from 'store/channel/actions'
import { channelInviteKeysSelector } from 'store/channel/selector'
import { shallowEqual } from 'react-redux'
import ResetLinkConfirmModal from './ResetLinkConfirmModal'
import { getBaseUrlForInviteMembers } from 'helpers/channelHalper'

interface InviteLinkModalProps {
  onClose: () => void
  link?: string
  onShare?: (link: string) => void
  onReset?: () => void
  SVGLogoIcon?: React.ReactNode
  channelId: string
}

export default function InviteLinkModal({
  onClose,
  link,
  onShare,
  onReset,
  SVGLogoIcon,
  channelId
}: InviteLinkModalProps) {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary
  } = useColor()

  const theme = useSelector(themeSelector) || 'light'
  const channelsInviteKeys: {
    [key: string]: {
      key: string
      maxUses: number
      expiresAt: number
      accessPriorHistory: boolean
    }[]
  } = useSelector(channelInviteKeysSelector, shallowEqual)
  console.log('channelsInviteKeys', channelsInviteKeys)
  const dispatch = useDispatch()

  const [activeTab, setActiveTab] = useState<'link' | 'qr'>('link')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch (e) {
      // ignore
    }
  }

  const handleShare = async () => {
    if (onShare) {
      onShare(inviteUrl)
      return
    }
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ text: inviteUrl, url: inviteUrl })
      } else {
        await navigator.clipboard.writeText(inviteUrl)
      }
    } catch (e) {
      // ignore
    }
    onClose()
  }

  const handleReset = () => {
    setShowResetConfirm(true)
  }

  const handleConfirmReset = () => {
    setShowResetConfirm(false)
    dispatch(regenerateChannelInviteKeyAC(channelId, channelInviteKeys?.[0]?.key || ''))
    if (onReset) onReset()
  }

  useEffect(() => {
    if (channelId) {
      dispatch(getChannelInviteKeysAC(channelId))
    }
  }, [channelId])

  const channelInviteKeys = useMemo(
    () => (channelId && channelsInviteKeys?.[channelId] ? channelsInviteKeys[channelId] : []),
    [channelId, channelsInviteKeys]
  )
  const inviteKey = useMemo(() => channelInviteKeys?.[0] || null, [channelInviteKeys])

  const inviteUrl = useMemo(() => link || `${getBaseUrlForInviteMembers()}/${inviteKey?.key || ''}`, [link, inviteKey])

  const handleShowPreviousMessages = () => {
    dispatch(updateChannelInviteKeyAC(channelId, inviteKey?.key || '', !inviteKey?.accessPriorHistory || false))
  }

  return (
    <PopupContainer theme={theme}>
      <Popup maxWidth='522px' minWidth='522px' height='auto' padding='0' backgroundColor={background}>
        <PopupBody paddingH='24px' paddingV='24px' withFooter>
          <CloseIcon onClick={onClose} color={iconPrimary} />
          <PopupName color={textPrimary} marginBottom='16px'>
            Invite link
          </PopupName>

          <Tabs borderColor={border} backgroundColor={surface1}>
            <TabButton
              type='button'
              active={activeTab === 'link'}
              onClick={() => setActiveTab('link')}
              activeColor={textPrimary}
              inactiveColor={textSecondary}
              activeBackgroundColor={background}
              backgroundColor={backgroundHovered}
            >
              Group Link
            </TabButton>
            <TabButton
              type='button'
              active={activeTab === 'qr'}
              onClick={() => setActiveTab('qr')}
              activeColor={textPrimary}
              inactiveColor={textSecondary}
              activeBackgroundColor={background}
              backgroundColor={backgroundHovered}
            >
              QR Code
            </TabButton>
          </Tabs>

          {activeTab === 'link' ? (
            <React.Fragment>
              <Description color={textSecondary}>You can invite anyone to the chat using this link</Description>

              <FieldLabel color={textSecondary}>Link</FieldLabel>
              <LinkField borderColor={border} backgroundColor={surface1}>
                <LinkInput value={inviteUrl} readOnly color={textPrimary} />
                <CopyButton onClick={handleCopy} aria-label='Copy invite link'>
                  <CopySvg color={accentColor} />
                </CopyButton>
              </LinkField>

              <SectionTitle color={textSecondary}>History</SectionTitle>
              <HistoryRow>
                <span>
                  <FieldLabel color={textPrimary}>Show Previous Messages</FieldLabel>
                </span>
                <Switch
                  onClick={handleShowPreviousMessages}
                  active={inviteKey?.accessPriorHistory || false}
                  accent={accentColor}
                />
              </HistoryRow>

              <ResetLink type='button' onClick={handleReset}>
                Reset link
              </ResetLink>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <QRCodeBox borderColor={border} backgroundColor={surface1}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                    inviteUrl
                  )}&size=200x200&ecc=H&margin=12&color=000000&bgcolor=FFFFFF`}
                  alt='Invite QR'
                  width={200}
                  height={200}
                />
                <LogoIconCont>{SVGLogoIcon}</LogoIconCont>
              </QRCodeBox>
              <QrHint color={textSecondary}>Show or send this to anyone who wants to join this channel</QrHint>
            </React.Fragment>
          )}
        </PopupBody>
        <PopupFooter backgroundColor={surface1}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={onClose}>
            Cancel
          </Button>
          <Button
            type='button'
            color={textOnPrimary}
            backgroundColor={accentColor}
            borderRadius='8px'
            onClick={handleShare}
          >
            Share
          </Button>
        </PopupFooter>
      </Popup>
      {showResetConfirm && (
        <ResetLinkConfirmModal onCancel={() => setShowResetConfirm(false)} onConfirm={handleConfirmReset} />
      )}
    </PopupContainer>
  )
}

const LogoIconCont = styled.div`
  position: absolute;
  top: calc(50% - 18px);
  left: calc(50% - 18px);
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background-color: #ffffff;
  align-items: center;
  justify-content: center;
  display: flex;
  padding: 6px;
`

const Tabs = styled.div<{ borderColor: string; backgroundColor: string }>`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  border-radius: 10px;
  background-color: ${(p) => p.backgroundColor};
  padding: 2px;
  margin: 4px 0 16px;
  border: 1px solid ${(p) => p.borderColor};
`

const TabButton = styled.button<{
  active: boolean
  activeColor?: string
  inactiveColor?: string
  activeBackgroundColor?: string
  backgroundColor?: string
}>`
  height: 36px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  background-color: ${(p) => (p.active ? p.activeBackgroundColor : p.backgroundColor)};
  ${(p) =>
    p.active &&
    `
    box-shadow: 0px 3px 6px -4px #0000001F;
  `}
  color: ${(p) => (p.active ? p.activeColor : p.inactiveColor)};
`

const Description = styled.p<{ color: string }>`
  margin: 8px 0 16px;
  font-size: 14px;
  line-height: 16px;
  color: ${(p) => p.color};
`

const FieldLabel = styled.span<{ color: string }>`
  font-size: 14px;
  line-height: 16px;
  color: ${(p) => p.color};
`

const LinkField = styled.div<{ borderColor: string; backgroundColor: string }>`
  display: flex;
  align-items: center;
  border: 1px solid ${(p) => p.borderColor};
  border-radius: 8px;
  margin-top: 8px;
  padding-left: 12px;
  background-color: ${(p) => p.backgroundColor};
`

const LinkInput = styled.input<{ color: string }>`
  flex: 1;
  border: none;
  outline: none;
  height: 40px;
  background: transparent;
  color: ${(p) => p.color};
  font-size: 14px;
`

const CopyButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
`

const SectionTitle = styled.h4<{ color: string }>`
  margin: 16px 0 8px;
  font-weight: 500;
  font-size: 15px;
  line-height: 16px;
  color: ${(p) => p.color};
`

const HistoryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`

const Switch = styled.div<{ active: boolean; accent: string }>`
  width: 44px;
  height: 26px;
  border-radius: 13px;
  background: ${(p) => (p.active ? p.accent : 'rgba(226,226,226,1)')};
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;

  &:after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${(p) => (p.active ? '22px' : '3px')};
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: left 0.2s ease;
  }
`

const ResetLink = styled.button`
  margin-top: 12px;
  border: none;
  background: transparent;
  color: #ff4d4f;
  cursor: pointer;
`

const QRCodeBox = styled.div<{ borderColor: string; backgroundColor: string }>`
  border-radius: 8px;
  border: 1px solid ${(p) => p.borderColor};
  background-color: ${(p) => p.backgroundColor};
  display: flex;
  width: max-content;
  padding: 13.5px;
  margin: auto;
  position: relative;
`

const QrHint = styled.p<{ color: string }>`
  text-align: center;
  font-size: 14px;
  line-height: 16px;
  color: ${(p) => p.color};
  margin: 12px 0 0;
`
