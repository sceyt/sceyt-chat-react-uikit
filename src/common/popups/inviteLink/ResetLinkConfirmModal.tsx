import React from 'react'
import ConfirmPopup from '../delete'

interface ResetLinkConfirmModalProps {
  onCancel: () => void
  onConfirm: () => void
}

export default function ResetLinkConfirmModal({ onCancel, onConfirm }: ResetLinkConfirmModalProps) {
  return (
    <ConfirmPopup
      togglePopup={onCancel}
      handleFunction={onConfirm}
      title='Reset link'
      description={
        <span>
          Are you sure you want to reset the group link? Anyone with the existing link will no longer be able to use it
          to join.
        </span>
      }
      buttonText='Reset'
    />
  )
}
