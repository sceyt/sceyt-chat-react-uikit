import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { colors } from '../../../UIHelper/constants'
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus.svg'
import { IReaction } from '../../../types'

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
  const defaultEmojisMap = {
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
    <Container id='emojisContainer' rendered={rendered} rightSide={rtlDirection}>
      {emojis.map((emoji: any) => (
        <EmojiItem active={emoji.reacted} key={emoji.key} onClick={() => chooseEmoji(emoji.key)}>
          {emoji.key}
        </EmojiItem>
      ))}
      <OpenMoreEmojis onClick={() => handleEmojiPopupToggle(true)}>
        <PlusIcon />
      </OpenMoreEmojis>
    </Container>
  )
}

export default FrequentlyEmojis

const Container = styled.div<{ rendered?: boolean; rightSide?: boolean }>`
  transform: scale(0, 0);
  transform-origin: ${(props) => (props.rightSide ? '100% 100%' : '0 100%')};
  display: flex;
  align-items: center;
  padding: 6px;
  background: ${colors.white};
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

const EmojiItem = styled.span<{ active?: boolean }>`
  font-family: apple color emoji, segoe ui emoji, noto color emoji, android emoji, emojisymbols, emojione mozilla,
    twemoji mozilla, segoe ui symbol;
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
  background-color: ${(props) => props.active && colors.gray5};
  &:hover {
    background-color: ${colors.gray5};
  }
`

const OpenMoreEmojis = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background-color: ${colors.gray5};
  cursor: pointer;

  & > svg {
    color: ${colors.gray4};
    height: 18px;
    width: 18px;
  }
  border-radius: 50%;
`
