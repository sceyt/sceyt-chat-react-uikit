import React from 'react'
import ConfirmPopup from '../delete'

interface ConfirmEndPollPopupProps {
  handleFunction: () => void
  togglePopup: () => void
  buttonText: string
  description: string
  title: string
}

export default function ConfirmEndPollPopup({
  handleFunction,
  togglePopup,
  buttonText,
  description,
  title
}: ConfirmEndPollPopupProps) {
  return (
    <ConfirmPopup
      togglePopup={togglePopup}
      handleFunction={handleFunction}
      title={title}
      description={description}
      buttonText={buttonText}
    />
  )
}
