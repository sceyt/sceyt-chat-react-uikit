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
import { getEmojisCategoryTitle } from '../../helpers'

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
  rightSide,
  bottomPosition,
  emojisContainerBorderRadius,
  emojisCategoryIconsPosition,
  separateEmojiCategoriesWithTitle,
  emojisPopupPosition,
  relativePosition
}: {
  handleAddEmoji: (selectedEmoji: string) => void
  handleEmojiPopupToggle?: (state: boolean) => void
  rtlDirection?: boolean
  rightSide?: boolean
  relativePosition?: boolean
  bottomPosition?: string
  emojisContainerBorderRadius?: string
  emojisCategoryIconsPosition?: 'top' | 'bottom'
  emojisPopupPosition?: string
  separateEmojiCategoriesWithTitle?: boolean
}) {
  const [rendered, setRendered] = useState<any>(false)
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
      (col: any) => col.elem.current.getBoundingClientRect().top - 80 - containerTop
    )
    setCollectionHeights(heights)
    setRendered(true)
  }, [])

  return (
    <Container
      relativePosition={relativePosition}
      borderRadius={emojisContainerBorderRadius}
      rightSide={rightSide}
      id='emojisContainer'
      rtlDirection={rtlDirection}
      bottomPosition={bottomPosition}
      rendered={rendered}
      emojisPopupPosition={emojisPopupPosition}
    >
      {emojisCategoryIconsPosition === 'top' && (
        <EmojiFooter emojisCategoryIconsPosition={emojisCategoryIconsPosition}>
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
      )}
      {!separateEmojiCategoriesWithTitle && (
        <EmojiHeader padding={emojisCategoryIconsPosition !== 'top' ? '10px 18px 6px' : ''}>
          {getEmojisCategoryTitle(activeCollection)}
        </EmojiHeader>
      )}
      <EmojiSection ref={emojiContainerRef} onScroll={handleEmojiListScroll}>
        <AllEmojis>
          {EMOJIS.map((emojiBigCollection, bigColIndex) => {
            const mainCollectionKey = emojiBigCollection.key
            return (
              <React.Fragment key={mainCollectionKey}>
                {separateEmojiCategoriesWithTitle && (
                  <EmojiHeader padding='6px 8px'>{getEmojisCategoryTitle(mainCollectionKey)}</EmojiHeader>
                )}
                {emojiBigCollection.array.map((emojiSmallCollection, bigIndex) => {
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
                      <span
                        className='emoji'
                        role='img'
                        aria-label={label || ''}
                        aria-hidden={label ? 'false' : 'true'}
                      >
                        {emoji}
                      </span>
                    </Emoji>
                  ))
                })}
              </React.Fragment>
            )
          })}
        </AllEmojis>
      </EmojiSection>
      {emojisCategoryIconsPosition !== 'top' && (
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
      )}
    </Container>
  )
}

export default EmojisPopup

const Container = styled.div<{
  rendered?: boolean
  rightSide?: boolean
  rtlDirection?: boolean
  relativePosition?: boolean
  bottomPosition?: string
  borderRadius?: string
  emojisPopupPosition?: string
}>`
  position: ${(props) => (props.relativePosition ? 'relative' : 'absolute')};
  left: ${(props) => (props.rtlDirection ? '' : props.rightSide ? '-276px' : '0')};
  right: ${(props) => props.rtlDirection && '0'};
  bottom: ${(props) => props.bottomPosition};
  width: 306px;
  border: 1px solid ${colors.gray1};
  box-sizing: border-box;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
  border-radius: ${(props) => props.borderRadius || '6px'};
  background: ${colors.white};
  z-index: 35;
  transform: scaleY(0);
  transform-origin: ${(props) => (props.emojisPopupPosition === 'bottom' ? '0 0' : '0 100%')};
  transition: all 0.2s ease-in-out;
  ${(props) =>
    props.rendered &&
    `
    transform: scaleY(1);
  `};
`
const EmojiHeader = styled.div<{ padding?: string }>`
  align-items: flex-end;
  font-style: normal;
  font-weight: 500;
  font-size: 12px;
  line-height: 22px;
  text-transform: uppercase;
  color: ${colors.gray9};
  display: flex;
  padding: ${(props) => props.padding || '6px 18px'};
`
const EmojiSection = styled.div`
  height: 200px;
  overflow-x: hidden;
`
const EmojiCollection = styled.span<EmojiCollectionProps>`
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;

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
const EmojiFooter = styled.div<{ emojisCategoryIconsPosition?: 'top' | 'bottom' }>`
  height: 42px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  border-top: ${(props) => props.emojisCategoryIconsPosition !== 'top' && `1px solid ${colors.gray1}`};
  border-bottom: ${(props) => props.emojisCategoryIconsPosition === 'top' && `1px solid ${colors.gray1}`};
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
  font-family: apple color emoji, segoe ui emoji, noto color emoji, android emoji, emojisymbols, emojione mozilla,
    twemoji mozilla, segoe ui symbol;
  & > * {
    font-size: 22px;
  }
  &:hover {
    background: #f5f5f8;
  }
`
