import styled from 'styled-components'
import { colors, device } from '../../UIHelper/constants'

export const Container = styled.div<{ isCustomContainer?: boolean; ref?: any }>`
  display: flex;
  flex-direction: column;
  width: ${(props) => (props.isCustomContainer ? '' : '280px')};
  min-width: ${(props) => (props.isCustomContainer ? '' : '280px')};
  //border-right: ${(props) => (props.isCustomContainer ? '' : '1px solid #DFE0EB')};

  ${(props) =>
    props.isCustomContainer
      ? ''
      : `
    @media  ${device.laptopL} {
      width: 310px;
      min-width: auto;
    }
 `};
`

export const ChannelsList = styled.div`
  height: auto;
  border-right: 1px solid ${colors.gray1};
  overflow-y: auto;
`
export const SearchedChannels = styled.div`
  height: calc(100vh - 123px);
  overflow-x: hidden;
`
export const SearchedChannelsHeader = styled.p`
  padding-left: 16px;
  font-weight: 500;
  font-size: 15px;
  line-height: 14px;
  color: #676a7c;
`
export const DirectChannels = styled.div``
export const GroupChannels = styled.div``
