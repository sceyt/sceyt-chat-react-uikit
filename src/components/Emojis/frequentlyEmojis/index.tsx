import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus.svg'
import { IReaction } from '../../../types'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'

function FrequentlyEmojis({
  handleAddEmoji,
  handleEmojiPopupToggle,
  frequentlyEmojis,
  rtlDirection
}: {
  handleAddEmoji: (selectedEmoji: string) => void
  handleEmojiPopupToggle: (state: boolean) => void
  frequentlyEmojis?: IReaction[]
  rtlDirection?: boolean
}) {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary
  } = useColor()

  const defaultEmojisMap: Record<string, { key: string; reacted: boolean }> = {
    '👍': { key: '👍', reacted: false },
    '😍': { key: '😍', reacted: false },
    '❤️': { key: '❤️', reacted: false },
    '🤝': { key: '🤝', reacted: false },
    '😂': { key: '😂', reacted: false },
    '😏': { key: '😏', reacted: false }
  }
  const [rendered, setRendered] = useState<any>(false)
  const [emojis, setEmojis] = useState<any>([
    { key: '👍', reacted: false },
    { key: '😍', reacted: false },
    { key: '❤️', reacted: false },
    { key: '🤝', reacted: false },
    { key: '😂', reacted: false },
    { key: '😏', reacted: false }
  ])
  const chooseEmoji = (selectedEmoji: any) => {
    handleAddEmoji(selectedEmoji)
    if (handleEmojiPopupToggle) {
      handleEmojiPopupToggle(false)
    }
  }

  useEffect(() => {
    if (frequentlyEmojis && frequentlyEmojis.length > 0) {
      const sortedEmojis = [...frequentlyEmojis]
        // @ts-ignore
        .sort((a: IReaction, b: IReaction) => b.createdAt - a.createdAt)
      let defaultIsChanged = false
      const uniqueEmojis = sortedEmojis.filter((emoji: any) => {
        if (defaultEmojisMap[emoji.key]) {
          defaultEmojisMap[emoji.key].reacted = true
          defaultIsChanged = true
          return false
        } else {
          return true
        }
      })
      const uniqueEmojisList = uniqueEmojis.map((emoji: any) => ({ key: emoji.key, reacted: true }))
      if (uniqueEmojisList.length || defaultIsChanged) {
        if (uniqueEmojisList.length > 6) {
          uniqueEmojisList.length = 6
        }
        setEmojis((prevState: any) =>
          prevState
            .map((em: any) => defaultEmojisMap[em.key])
            .splice(0, 6 - uniqueEmojisList.length)
            .concat(uniqueEmojisList)
        )
      }
    }
    setRendered(true)
  }, [])

  return (
    <Container id='emojisContainer' backgroundColor={backgroundSections} rendered={rendered} rightSide={rtlDirection}>
      {emojis.map((emoji: any) => (
        <EmojiItem
          activeBackground={backgroundHovered}
          active={emoji.reacted}
          key={emoji.key}
          onClick={() => chooseEmoji(emoji.key)}
        >
          {emoji.key}
        </EmojiItem>
      ))}
      <OpenMoreEmojis
        onClick={() => handleEmojiPopupToggle(true)}
        iconBackgroundColor={backgroundSections}
        hoverBackground={backgroundHovered}
        iconHoverColor={accentColor}
        iconColor={textSecondary}
      >
        <PlusIcon />
      </OpenMoreEmojis>
    </Container>
  )
}

export default FrequentlyEmojis

const Container = styled.div<{ rendered?: boolean; rightSide?: boolean; backgroundColor: string }>`
  transform: scale(0, 0);
  transform-origin: ${(props) => (props.rightSide ? '100% 100%' : '0 100%')};
  display: flex;
  align-items: center;
  padding: 6px;
  background-color: ${(props) => props.backgroundColor};
  box-shadow: 0 3px 10px -4px rgba(0, 0, 0, 0.2);
  border-radius: 24px;
  overflow: hidden;
  box-sizing: border-box;
  transition: all 0.2s ease-in-out;
  ${(props) =>
    props.rendered &&
    `
    transform: scale(1, 1);
  `};
`

const EmojiItem = styled.span<{ active?: boolean; activeBackground: string }>`
  font-family:
    apple color emoji,
    segoe ui emoji,
    noto color emoji,
    android emoji,
    emojisymbols,
    emojione mozilla,
    twemoji mozilla,
    segoe ui symbol;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  font-size: 28px;
  line-height: 32px;
  cursor: pointer;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  background-color: ${(props) => props.active && props.activeBackground};
  &:hover {
    background-color: ${(props) => props.activeBackground};
  }
`

const OpenMoreEmojis = styled.span<{
  iconBackgroundColor: string
  hoverBackground: string
  iconColor: string
  iconHoverColor: string
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background-color: ${(props) => props.iconBackgroundColor};
  cursor: pointer;

  & > svg {
    color: ${(props) => props.iconColor};
    height: 18px;
    width: 18px;
  }
  &:hover {
    background-color: ${(props) => props.hoverBackground};
    & > svg {
      color: ${(props) => props.iconHoverColor};
    }
  }
  border-radius: 50%;
`
