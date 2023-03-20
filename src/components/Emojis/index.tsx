import React, { createRef, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { ReactComponent as BodyPartEmoji } from '../../assets/svg/emojiSmileIcon.svg'
import { ReactComponent as AnimalEmoji } from '../../assets/svg/emojiAnimalIcon.svg'
import { ReactComponent as FoodEmoji } from '../../assets/svg/emojiFoodIcon.svg'
import { ReactComponent as TravelingEmoji } from '../../assets/svg/emojiTravelIcon.svg'
import { ReactComponent as ObjectEmoji } from '../../assets/svg/emojiObjectIcon.svg'
import { ReactComponent as SymbolEmoji } from '../../assets/svg/emojiSymbolsIcon.svg'
import { ReactComponent as FlagEmoji } from '../../assets/svg/emojiFlagicon.svg'
import { colors } from '../../UIHelper/constants'
import EMOJIS from './emojis'

interface EmojiCollectionProps {
  activeCollection: boolean
}

const EmojiIcon = ({ collectionName }: any) => {
  switch (collectionName) {
    case 'People':
      return <BodyPartEmoji />
    case 'Animals':
      return <AnimalEmoji />
    case 'Food':
      return <FoodEmoji />
    case 'Travel':
      return <TravelingEmoji />
    case 'Objects':
      return <ObjectEmoji />
    case 'Symbols':
      return <SymbolEmoji />
    case 'Flags':
      return <FlagEmoji />
    default:
      return null
  }
}

// function EmojisPopup({ setMessageText, messageText, handleEmojiPopupToggle, handleAddReaction, rightSide }: any) {
function EmojisPopup({
  handleAddEmoji,
  handleEmojiPopupToggle,
  rtlDirection,
  rightSide
}: {
  handleAddEmoji: (selectedEmoji: string) => void
  handleEmojiPopupToggle?: (state: boolean) => void
  rtlDirection?: boolean
  rightSide?: boolean
}) {
  const [activeCollection, setActiveCollection] = useState('People')
  const [collectionHeights, setCollectionHeights] = useState<number[]>([])
  const emojiContainerRef = useRef<any>(null)
  const collectionsRef = useRef<any>(EMOJIS.map((col) => ({ collectionName: col.key, elem: createRef() })))
  const handleEmojiListScroll = () => {
    const scrollPos = emojiContainerRef.current.scrollTop
    if (collectionHeights[6] < scrollPos) {
      setActiveCollection('Flags')
    } else if (collectionHeights[5] < scrollPos) {
      setActiveCollection('Symbols')
    } else if (collectionHeights[4] < scrollPos) {
      setActiveCollection('Objects')
    } else if (collectionHeights[3] < scrollPos) {
      setActiveCollection('Travel')
    } else if (collectionHeights[2] < scrollPos) {
      setActiveCollection('Food')
    } else if (collectionHeights[1] < scrollPos) {
      setActiveCollection('Animals')
    } else {
      setActiveCollection('People')
    }
  }
  const chooseEmoji = (selectedEmoji: any) => {
    handleAddEmoji(selectedEmoji)
    if (handleEmojiPopupToggle) {
      handleEmojiPopupToggle(false)
    }
    /* if (setMessageText) {
      setMessageText(messageText + selectedEmoji)
      handleEmojiPopupToggle(false)
    } else {
      handleAddReaction(selectedEmoji)
    } */
  }
  const handleEmojiCollectionClick = (mainCollection: any) => {
    const collection: any = collectionsRef.current.find((el: any) => el.collectionName === mainCollection)
    const pos = collection.elem.current.offsetTop - 40
    emojiContainerRef.current.scrollTo(0, pos)
  }

  useEffect(() => {
    const containerTop = emojiContainerRef.current.getBoundingClientRect().top + 10
    const heights = collectionsRef.current.map(
      (col: any) => col.elem.current.getBoundingClientRect().top - containerTop
    )
    setCollectionHeights(heights)
  }, [])

  return (
    <Container rightSide={rightSide} id='emojisContainer' rtlDirection={rtlDirection}>
      <EmojiHeader>{activeCollection}</EmojiHeader>
      <EmojiSection ref={emojiContainerRef} onScroll={handleEmojiListScroll}>
        <AllEmojis>
          {EMOJIS.map((emojiBigCollection, bigColIndex) => {
            const mainCollectionKey = emojiBigCollection.key
            return emojiBigCollection.array.map((emojiSmallCollection, bigIndex) => {
              const label = emojiSmallCollection.key
              const { array } = emojiSmallCollection
              return array.map((emoji, i) => (
                <Emoji key={`${emoji}`} className='emoji-cont' onClick={() => chooseEmoji(emoji)}>
                  {bigIndex === 0 && i === 0 && (
                    <CollectionPointer
                      ref={collectionsRef.current[bigColIndex].elem}
                      data-emoji-sec={mainCollectionKey}
                    />
                  )}
                  <span className='emoji' role='img' aria-label={label || ''} aria-hidden={label ? 'false' : 'true'}>
                    {emoji}
                  </span>
                </Emoji>
              ))
            })
          })}
        </AllEmojis>
      </EmojiSection>
      <EmojiFooter>
        {EMOJIS.map((emoji) => (
          <EmojiCollection
            activeCollection={activeCollection === emoji.key}
            key={`${emoji.key}`}
            onClick={() => handleEmojiCollectionClick(emoji.key)}
          >
            <EmojiIcon collectionName={emoji.key} />
          </EmojiCollection>
        ))}
      </EmojiFooter>
    </Container>
  )
}

export default EmojisPopup

const Container = styled.div<{ rightSide?: boolean; rtlDirection?: boolean }>`
  position: absolute;
  left: ${(props) => (props.rtlDirection ? '' : props.rightSide ? '-276px' : '0')};
  right: ${(props) => props.rtlDirection && '0'};
  bottom: 46px;
  width: 306px;
  border: 1px solid ${colors.gray1};
  box-sizing: border-box;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  background: ${colors.white};
  z-index: 35;
`
const EmojiHeader = styled.div`
  height: 32px;
  font-style: normal;
  font-weight: 500;
  font-size: 13px;
  line-height: 18px;
  color: ${colors.gray6};
  display: flex;
  align-items: flex-end;
  padding: 3px 18px;
`
const EmojiSection = styled.div`
  height: 166px;
  overflow-x: hidden;
`
const EmojiCollection = styled.span<EmojiCollectionProps>`
  cursor: pointer;
  & > * {
    color: ${(props) => (props.activeCollection ? colors.primary : colors.gray7)};
  }
`
const CollectionPointer = styled.span``

const AllEmojis = styled.ul`
  overflow: hidden;
  padding: 8px;
  margin: 0;
`
const EmojiFooter = styled.div`
  height: 42px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  border-top: 1px solid ${colors.gray1};
  padding: 0 10px;
  & > span {
    width: 100%;
    text-align: center;
  }
`

const Emoji = styled.li`
  cursor: pointer;
  width: 32px;
  height: 32px;
  margin: 0 2px;
  display: inline-block;
  box-sizing: border-box;
  border-radius: 50%;
  padding-top: 2px;
  text-align: center;
  background: transparent;
  & > * {
    font-size: 22px;
  }
  &:hover {
    background: #f5f5f8;
  }
`
