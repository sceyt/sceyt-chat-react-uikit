import { useState, useRef } from 'react'

export interface MessageState {
  deletePopupOpen: boolean
  forwardPopupOpen: boolean
  infoPopupOpen: boolean
  messageActionsShow: boolean
  showEndVoteConfirmPopup: boolean
  emojisPopupOpen: boolean
  frequentlyEmojisOpen: boolean
  reactionsPopupOpen: boolean
  reactionsPopupPosition: number
  emojisPopupPosition: string
  reactionsPopupHorizontalPosition: { left: number; right: number }
}

export interface MessageStateSetters {
  setDeletePopupOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setForwardPopupOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setInfoPopupOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setMessageActionsShow: (value: boolean | ((prev: boolean) => boolean)) => void
  setShowEndVoteConfirmPopup: (value: boolean | ((prev: boolean) => boolean)) => void
  setEmojisPopupOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setFrequentlyEmojisOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setReactionsPopupOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setReactionsPopupPosition: (value: number) => void
  setEmojisPopupPosition: (value: string) => void
  setReactionsPopupHorizontalPosition: (value: { left: number; right: number }) => void
  setReportPopupOpen: (value: boolean | ((prev: boolean) => boolean)) => void
}

export const useMessageState = () => {
  const [deletePopupOpen, setDeletePopupOpen] = useState(false)
  const [forwardPopupOpen, setForwardPopupOpen] = useState(false)
  // Reserved for future use - report popup functionality
  const [, setReportPopupOpen] = useState(false)
  const [infoPopupOpen, setInfoPopupOpen] = useState(false)
  const [messageActionsShow, setMessageActionsShow] = useState(false)
  const [showEndVoteConfirmPopup, setShowEndVoteConfirmPopup] = useState(false)
  const [emojisPopupOpen, setEmojisPopupOpen] = useState(false)
  const [frequentlyEmojisOpen, setFrequentlyEmojisOpen] = useState(false)
  const [reactionsPopupOpen, setReactionsPopupOpen] = useState(false)
  const [reactionsPopupPosition, setReactionsPopupPosition] = useState(0)
  const [emojisPopupPosition, setEmojisPopupPosition] = useState('')
  const [reactionsPopupHorizontalPosition, setReactionsPopupHorizontalPosition] = useState({ left: 0, right: 0 })
  const messageActionsTimeout = useRef<NodeJS.Timeout | null>(null)

  const state: MessageState = {
    deletePopupOpen,
    forwardPopupOpen,
    infoPopupOpen,
    messageActionsShow,
    showEndVoteConfirmPopup,
    emojisPopupOpen,
    frequentlyEmojisOpen,
    reactionsPopupOpen,
    reactionsPopupPosition,
    emojisPopupPosition,
    reactionsPopupHorizontalPosition
  }

  const setters: MessageStateSetters = {
    setDeletePopupOpen,
    setForwardPopupOpen,
    setInfoPopupOpen,
    setMessageActionsShow,
    setShowEndVoteConfirmPopup,
    setEmojisPopupOpen,
    setFrequentlyEmojisOpen,
    setReactionsPopupOpen,
    setReactionsPopupPosition,
    setEmojisPopupPosition,
    setReactionsPopupHorizontalPosition,
    setReportPopupOpen
  }

  return {
    state,
    setters,
    messageActionsTimeout
  }
}
