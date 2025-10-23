import React from 'react'
import ConfirmPopup from '../delete'
import { getInviteLinkOptions, ResetLinkConfirmOptions } from 'helpers/channelHalper'

interface ResetLinkConfirmModalProps {
  onCancel: () => void
  onConfirm: () => void
}

export default function ResetLinkConfirmModal({ onCancel, onConfirm }: ResetLinkConfirmModalProps) {
  const options = (getInviteLinkOptions()?.ResetLinkConfirmModal || {}) as ResetLinkConfirmOptions
  const titleText = options.titleText || 'Reset link'
  const descriptionText = options.descriptionText || (
    <span>
      Are you sure you want to reset the group link? Anyone with the existing link will no longer be able to use it to
      join.
    </span>
  )
  const buttonText = options.buttonText || 'Reset'
  const show = options.show !== false
  if (!show) return null

  const customRender = typeof options.render === 'function' ? options.render : null
  const customComponent = options.component || options.CustomComponent

  if (customRender) {
    return customRender({
      onCancel,
      onConfirm,
      defaults: { titleText, descriptionText, buttonText }
    }) as unknown as JSX.Element
  }
  if (customComponent) {
    return customComponent as unknown as JSX.Element
  }
  return (
    <ConfirmPopup
      togglePopup={onCancel}
      handleFunction={onConfirm}
      title={titleText}
      description={descriptionText}
      buttonText={buttonText}
    />
  )
}
