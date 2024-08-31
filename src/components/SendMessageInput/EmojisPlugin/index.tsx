import React, { createRef, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createTextNode, $getSelection, $isRangeSelection } from 'lexical'
import { ReactComponent as BodyPartEmoji } from '../../../assets/svg/emojiSmileIcon.svg'
import { ReactComponent as AnimalEmoji } from '../../../assets/svg/emojiAnimalIcon.svg'
import { ReactComponent as FoodEmoji } from '../../../assets/svg/emojiFoodIcon.svg'
import { ReactComponent as TravelingEmoji } from '../../../assets/svg/emojiTravelIcon.svg'
import { ReactComponent as ObjectEmoji } from '../../../assets/svg/emojiObjectIcon.svg'
import { ReactComponent as SymbolEmoji } from '../../../assets/svg/emojiSymbolsIcon.svg'
import { ReactComponent as FlagEmoji } from '../../../assets/svg/emojiFlagicon.svg'
import { colors, THEME_COLOR_NAMES } from '../../../UIHelper/constants'
import { getEmojisCategoryTitle } from '../../../helpers'
import { useSelector } from 'react-redux'
import { themeSelector } from '../../../store/theme/selector'
import { THEME } from '../../../helpers/constants'
import EMOJIS from '../../Emojis/emojis'
import { useColor } from '../../../hooks'

interface EmojiCollectionProps {
  activeCollection: boolean,
  iconColor: string
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
    case 'Flags':
      return <FlagEmoji />
    case 'Symbols':
      return <SymbolEmoji />
    default:
      return null
  }
}

function EmojisPopup({
  handleAddEmoji,
  handleEmojiPopupToggle,
  rtlDirection,
  rightSide,
  bottomPosition,
  emojisContainerBorderRadius,
  emojisCategoryIconsPosition = 'top',
  fixEmojiCategoriesTitleOnTop,
  emojisPopupPosition,
  relativePosition,
  leftPosition
}: {
  // eslint-disable-next-line no-unused-vars
  handleAddEmoji?: (selectedEmoji: string) => void
  // eslint-disable-next-line no-unused-vars
  handleEmojiPopupToggle?: (state: boolean) => void
  rtlDirection?: boolean
  rightSide?: boolean
  relativePosition?: boolean
  bottomPosition?: string
  emojisContainerBorderRadius?: string
  emojisCategoryIconsPosition?: 'top' | 'bottom'
  emojisPopupPosition?: string
  fixEmojiCategoriesTitleOnTop?: boolean
  leftPosition?: string
}) {
  const accentColor = useColor(THEME_COLOR_NAMES.ACCENT)
  const theme = useSelector(themeSelector)
  let richTextEditor: any
  try {
    const [editor] = useLexicalComposerContext()
    richTextEditor = editor
  } catch (e) {
    console.log('error getting editor', e)
  }
  const [rendered, setRendered] = useState<any>(false)
  const [activeCollection, setActiveCollection] = useState('People')
  const [collectionHeights, setCollectionHeights] = useState<number[]>([])
  const emojiContainerRef = useRef<any>(null)
  const collectionsRef = useRef<any>(EMOJIS.map((col) => ({ collectionName: col.key, elem: createRef() })))
  const handleEmojiListScroll = () => {
    const scrollPos = emojiContainerRef.current.scrollTop
    if (collectionHeights[6] < scrollPos) {
      setActiveCollection('Symbols')
    } else if (collectionHeights[5] < scrollPos) {
      setActiveCollection('Flags')
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
    if (richTextEditor) {
      richTextEditor.update(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          return
        }

        selection.insertNodes([$createTextNode(selectedEmoji)])
      })
      if (handleAddEmoji) {
        handleAddEmoji(selectedEmoji)
      }
    }

    if (handleEmojiPopupToggle) {
      handleEmojiPopupToggle(false)
    }
  }
  const handleEmojiCollectionClick = (mainCollection: any) => {
    const collection: any = collectionsRef.current.find((el: any) => el.collectionName === mainCollection)
    const pos = collection.elem.current.offsetTop - 40
    emojiContainerRef.current.scrollTo(0, pos)
  }

  useEffect(() => {
    setRendered(true)
    setTimeout(() => {
      if (emojiContainerRef.current) {
        const containerTop = emojiContainerRef.current.getBoundingClientRect().top + 10
        const heights = collectionsRef.current.map((col: any) => {
          return col.elem.current.getBoundingClientRect().top - 80 - containerTop
        })
        setCollectionHeights(heights)
      }
    }, 300)
  }, [])

  return (
    <Container
      backgroundColor={theme === THEME.DARK ? colors.backgroundColor : colors.white}
      noBorder={theme === THEME.DARK}
      relativePosition={relativePosition}
      borderRadius={emojisContainerBorderRadius}
      rightSide={rightSide}
      id='emojisContainer'
      rtlDirection={rtlDirection}
      bottomPosition={bottomPosition}
      leftPosition={leftPosition}
      rendered={rendered}
      emojisPopupPosition={emojisPopupPosition}
    >
      {emojisCategoryIconsPosition === 'top' && (
        <EmojiFooter
          borderColor={colors.hoverBackgroundColor}
          emojisCategoryIconsPosition={emojisCategoryIconsPosition}
        >
          {EMOJIS.map((emoji) => (
            <EmojiCollection
              activeCollection={activeCollection === emoji.key}
              key={`${emoji.key}`}
              iconColor={accentColor}
              onClick={() => handleEmojiCollectionClick(emoji.key)}
            >
              <EmojiIcon collectionName={emoji.key} />
            </EmojiCollection>
          ))}
        </EmojiFooter>
      )}
      {fixEmojiCategoriesTitleOnTop && (
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
                {!fixEmojiCategoriesTitleOnTop && (
                  <EmojiHeader padding='6px 8px 0'>{getEmojisCategoryTitle(mainCollectionKey)}</EmojiHeader>
                )}
                {emojiBigCollection.array.map((emojiSmallCollection, bigIndex) => {
                  const label = emojiSmallCollection.key
                  const { array } = emojiSmallCollection
                  return array.map((emoji, i) => (
                    <Emoji
                      hoverBackgroundColor={colors.hoverBackgroundColor}
                      key={`${emoji}`}
                      className='emoji-cont'
                      onClick={() => chooseEmoji(emoji)}
                    >
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
              iconColor={accentColor}
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
  leftPosition?: string
  borderRadius?: string
  emojisPopupPosition?: string
  backgroundColor?: string
  noBorder?: boolean
}>`
  position: ${(props) => (props.leftPosition ? 'fixed' : props.relativePosition ? 'relative' : 'absolute')};
  left: ${(props) =>
    props.rightSide
      ? `calc(${props.leftPosition} - 250px)`
      : props.leftPosition || (props.rtlDirection ? '' : props.rightSide ? '' : '5px')};
  right: ${(props) => (props.rtlDirection ? '0' : props.rightSide ? '65px' : '')};
  direction: ${(props) => (props.rtlDirection ? 'initial' : '')};
  bottom: ${(props) => props.bottomPosition};
  width: 306px;
  border: ${(props) => (props.noBorder ? 'none' : `1px solid ${colors.gray1}`)};
  box-sizing: border-box;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
  border-radius: ${(props) => props.borderRadius || '12px'};
  background: ${(props) => props.backgroundColor};
  z-index: 35;
  //transform: scaleY(0);
  height: 0;
  overflow: hidden;
  transform-origin: ${(props) => (props.emojisPopupPosition === 'bottom' ? '0 0' : '0 100%')};
  transition: all 0.2s ease-in-out;
  ${(props) =>
    props.rendered &&
    `
    height: 225px;
  `};
`
const EmojiHeader = styled.div<{ padding?: string }>`
  align-items: flex-end;
  font-style: normal;
  font-weight: 500;
  font-size: 12px;
  line-height: 22px;
  text-transform: uppercase;
  color: ${colors.textColor2};
  display: flex;
  padding: ${(props) => props.padding || '6px 18px'};
`
const EmojiSection = styled.div`
  height: 180px;
  overflow-x: hidden;

  & ::selection {
    color: inherit;
    background: inherit;
  }
`
const EmojiCollection = styled.span<EmojiCollectionProps>`
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;

  & > * {
    color: ${(props) => (props.activeCollection ? props.iconColor : colors.textColor3)};
  }
`
const CollectionPointer = styled.span``

const AllEmojis = styled.ul`
  overflow: hidden;
  padding: 0 8px 8px;
  margin: 0;
`
const EmojiFooter = styled.div<{ emojisCategoryIconsPosition?: 'top' | 'bottom'; borderColor?: string }>`
  height: 42px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  border-top: ${(props) =>
    props.emojisCategoryIconsPosition !== 'top' && `1px solid ${props.borderColor || colors.gray1}`};
  border-bottom: ${(props) =>
    props.emojisCategoryIconsPosition === 'top' && `1px solid ${props.borderColor || colors.gray1}`};
  padding: 0 10px;
  & > span {
    width: 100%;
    text-align: center;
  }
`

const Emoji = styled.li<{ hoverBackgroundColor?: string }>`
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
    background: ${(props) => props.hoverBackgroundColor || colors.backgroundColor};
  }
`
