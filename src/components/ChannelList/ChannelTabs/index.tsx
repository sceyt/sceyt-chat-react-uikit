import styled from 'styled-components'
import React, { useState } from 'react'
import { colors } from '../../../UIHelper/constants'

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px 10px;
  border-right: 1px solid ${colors.gray1};
`

const ChannelCount = styled.span`
  font-size: 14px;
  line-height: 20px;
  color: #ffffff;
  padding: 0 6px;
  border-radius: 12px;
  margin-left: 4px;
`

const TabItem = styled.div<{ active?: boolean }>`
  position: relative;
  width: 100%;
  text-align: center;
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  padding-bottom: 6px;
  cursor: pointer;
  ${(props) =>
    props.active &&
    `
   &:after {
    content: '';
    position: absolute;
    top: 100%;
    left: 6px;
    height: 2px;
    width: calc(100% - 12px);
    border-radius: 2px;
    background-color: #1ebe71;
  }
  `};

  & ${ChannelCount} {
    background-color: ${(props) => (props.active ? '#1EBE71' : '#B2B6BE')};
  }
`
interface IChannelTabsProps {}

// eslint-disable-next-line no-empty-pattern
const ChannelTabs = ({}: IChannelTabsProps) => {
  const [activeTab, setActiveTab] = useState('chats')
  return (
    <Container>
      <TabItem onClick={() => setActiveTab('chats')} active={activeTab === 'chats'}>
        Chats <ChannelCount>12</ChannelCount>
      </TabItem>
      <TabItem onClick={() => setActiveTab('channels')} active={activeTab === 'channels'}>
        Channels <ChannelCount>12</ChannelCount>
      </TabItem>
    </Container>
  )
}

export default ChannelTabs
