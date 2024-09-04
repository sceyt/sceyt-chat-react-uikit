import styled from 'styled-components'
import React from 'react'
import { ClearTypedText, StyledSearchSvg } from '../../../UIHelper'
import { THEME_COLOR_NAMES } from '../../../UIHelper/constants'
import { useColor } from '../../../hooks'

const SearchInputContainer = styled.div<{ inline?: boolean; borderColor?: string }>`
  position: relative;
  width: 100%;
  max-width: ${(props) => props.inline && 'calc(100% - 24px)'};
  box-sizing: border-box;
  padding: ${(props) => !props.inline && '0 12px 16px'};
  //border-right: ${(props) => !props.inline && `1px solid ${props.borderColor}`};

  & ${ClearTypedText} {
    ${(props) => !props.inline && 'right: 20px'};
  }
`

const SearchInput = styled.input<{
  placeholderColor: string
  inline?: boolean
  borderRadius?: string
  backgroundColor?: string
  color?: string
  fontSize?: string
}>`
  padding: 0 34px;
  background: ${(props) => props.backgroundColor};
  color: ${(props) => props.color};
  border-radius: ${(props) => props.borderRadius || '30px'};
  width: 100%;
  border: none;
  height: 36px;
  outline: none;
  box-sizing: border-box;
  font-size: ${(props) => props.fontSize || '15px'};

  &::placeholder {
    font-style: normal;
    font-weight: normal;
    font-size: ${(props) => props.fontSize || '15px'};
    //line-height: 22px;
    color: ${(props) => props.placeholderColor};
    opacity: 1;
  }
`

interface IChannelSearchProps {
  searchValue: string
  theme?: string
  // eslint-disable-next-line no-unused-vars
  handleSearchValueChange: (e: any) => void
  getMyChannels: () => void
  inline?: boolean
  borderRadius?: string
  searchInputBackgroundColor?: string
  searchInputTextColor?: string
  fontSize?: string
}

const ChannelSearch: React.FC<IChannelSearchProps> = ({
  searchValue,
  handleSearchValueChange,
  getMyChannels,
  inline,
  borderRadius,
  searchInputBackgroundColor,
  searchInputTextColor,
  fontSize
}) => {
  const textPrimary = useColor(THEME_COLOR_NAMES.TEXT_PRIMARY)
  const surface1Background = useColor(THEME_COLOR_NAMES.SURFACE_1)
  const textSecondary = useColor(THEME_COLOR_NAMES.TEXT_SECONDARY)

  return (
    <SearchInputContainer inline={inline} borderColor={surface1Background}>
      <StyledSearchSvg left={!inline ? '22px' : ''} />
      <SearchInput
        backgroundColor={searchInputBackgroundColor || surface1Background}
        color={searchInputTextColor || textPrimary}
        placeholderColor={textSecondary}
        borderRadius={borderRadius}
        type='text'
        onChange={handleSearchValueChange}
        value={searchValue}
        placeholder='Search for channels'
        fontSize={fontSize}
      />
      {searchValue && <ClearTypedText onClick={getMyChannels} />}
    </SearchInputContainer>
  )
}

export default ChannelSearch
