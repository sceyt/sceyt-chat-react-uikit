import styled from 'styled-components'
import React from 'react'
import { ClearTypedText, StyledSearchSvg } from '../../../UIHelper'

const SearchInputContainer = styled.div<{ inline?: boolean }>`
  position: relative;
  width: 100%;
  box-sizing: border-box;
  padding: ${(props) => !props.inline && '0 12px'};
  margin-bottom: ${(props) => !props.inline && '16px'};
`

const SearchInput = styled.input<{ inline?: boolean; borderRadius?: string }>`
  padding: 0 34px;
  background: #ebedf0;
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
    color: #818c99;
    opacity: 1;
  }
`

interface IChannelSearchProps {
  searchValue: string
  handleSearchValueChange: (e: any) => void
  getMyChannels: () => void
  inline?: boolean
  borderRadius?: string
}

const ChannelSearch: React.FC<IChannelSearchProps> = ({
  searchValue,
  handleSearchValueChange,
  getMyChannels,
  inline,
  borderRadius
}) => (
  <SearchInputContainer inline={inline}>
    <StyledSearchSvg left={!inline ? '26px' : ''} />
    <SearchInput
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
