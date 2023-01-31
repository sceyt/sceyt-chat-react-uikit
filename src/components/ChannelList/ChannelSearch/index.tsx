import styled from 'styled-components'
import React from 'react'
import { ClearTypedText, StyledSearchSvg } from '../../../UIHelper'

const SearchInputContainer = styled.div`
  position: relative;
  width: 100%;
`

const SearchInput = styled.input`
  padding: 0 32px 0 34px;
  background: #ebedf0;
  border-radius: 30px;
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
}

const ChannelSearch: React.FC<IChannelSearchProps> = ({ searchValue, handleSearchValueChange, getMyChannels }) => (
  <SearchInputContainer>
    <StyledSearchSvg />
    <SearchInput type='text' onChange={handleSearchValueChange} value={searchValue} placeholder='Search for channels' />
    {searchValue && <ClearTypedText onClick={getMyChannels} />}
  </SearchInputContainer>
)

export default ChannelSearch
