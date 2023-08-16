import styled from 'styled-components'
import React from 'react'
import { ClearTypedText, StyledSearchSvg } from '../../../UIHelper'
import { colors } from '../../../UIHelper/constants'
import { THEME } from '../../../helpers/constants'

const SearchInputContainer = styled.div<{ inline?: boolean; borderColor?: string }>`
  position: relative;
  width: 100%;
  max-width: ${(props) => props.inline && 'calc(100% - 24px)'};
  box-sizing: border-box;
  padding: ${(props) => !props.inline && '0 12px 16px'};
  border-right: ${(props) => !props.inline && `1px solid ${props.borderColor}`};

  & ${ClearTypedText} {
    ${(props) => !props.inline && 'right: 20px'};
  }
`

const SearchInput = styled.input<{ inline?: boolean; borderRadius?: string; backgroundColor?: string; color?: string }>`
  padding: 0 34px;
  background: ${(props) => props.backgroundColor};
  color: ${(props) => props.color};
  border-radius: ${(props) => props.borderRadius || '30px'};
  width: 100%;
  border: none;
  height: 36px;
  outline: none;
  box-sizing: border-box;
  font-size: 15px;

  &::placeholder {
    font-style: normal;
    font-weight: normal;
    font-size: 15px;
    //line-height: 22px;
    color: ${colors.textColor2};
    opacity: 1;
  }
`

interface IChannelSearchProps {
  searchValue: string
  theme?: string
  handleSearchValueChange: (e: any) => void
  getMyChannels: () => void
  inline?: boolean
  borderRadius?: string
  searchInputBackgroundColor?: string
  searchInputTextColor?: string
}

const ChannelSearch: React.FC<IChannelSearchProps> = ({
  searchValue,
  theme,
  handleSearchValueChange,
  getMyChannels,
  inline,
  borderRadius,
  searchInputBackgroundColor,
  searchInputTextColor
}) => (
  <SearchInputContainer inline={inline} borderColor={colors.backgroundColor}>
    <StyledSearchSvg left={!inline ? '22px' : ''} />
    <SearchInput
      backgroundColor={
        searchInputBackgroundColor || (theme === THEME.DARK ? colors.hoverBackgroundColor : colors.primaryLight)
      }
      color={searchInputTextColor || colors.textColor1}
      borderRadius={borderRadius}
      type='text'
      onChange={handleSearchValueChange}
      value={searchValue}
      placeholder='Search for channels'
    />
    {searchValue && <ClearTypedText onClick={getMyChannels} />}
  </SearchInputContainer>
)

export default ChannelSearch
