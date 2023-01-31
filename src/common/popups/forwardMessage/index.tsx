import React, { useEffect, useState } from 'react'
import { Popup, PopupContainer, PopupName, CloseIcon, PopupBody, Button, PopupFooter } from '../../../UIHelper'
import { colors } from '../../../UIHelper/constants'
import styled from 'styled-components'
import { getChannelsForForwardAC } from '../../../store/channel/actions'
import { useDispatch, useSelector } from 'react-redux'
import { channelsForForwardSelector, searchValueSelector } from '../../../store/channel/selector'
import { IChannel } from '../../../types'
import ChannelSearch from '../../../components/ChannelList/ChannelSearch'

interface IProps {
  title: string
  buttonText: string
  togglePopup: () => void
  handleForward: (option?: any) => void
  loading?: boolean
}

function ForwardMessagePopup({ title, buttonText, togglePopup, handleForward, loading }: IProps) {
  const dispatch = useDispatch()
  const channels = useSelector(channelsForForwardSelector) || []
  console.log('channels on component s... ', channels)
  const searchValue = useSelector(searchValueSelector) || ''
  const [channelIds, setChannelIds] = useState<string[]>([])

  const handleDelete = () => {
    handleForward(channelIds)
    togglePopup()
  }

  const handleChoseChannel = (e: any, channelId: string) => {
    if (e.target.checked) {
      setChannelIds((prevState) => [...prevState, channelId])
    }
  }

  const handleSearchValueChange = (e: any) => {
    const { value } = e.target
    dispatch(getChannelsForForwardAC(value))
  }

  const getMyChannels = () => {
    dispatch(getChannelsForForwardAC())
  }

  useEffect(() => {
    dispatch(getChannelsForForwardAC())
  }, [])
  return (
    <PopupContainer>
      <Popup maxWidth='460px' minWidth='460px' isLoading={loading} padding='0'>
        <PopupBody padding={24}>
          <CloseIcon onClick={() => togglePopup()} />
          <PopupName isDelete marginBottom='20px'>
            {title}
          </PopupName>

          <ForwardChannelsCont>
            <ChannelSearch
              searchValue={searchValue}
              handleSearchValueChange={handleSearchValueChange}
              getMyChannels={getMyChannels}
            />
            {channels.map((channel: IChannel) => (
              <Channel key={channel.id} onClick={(e: any) => handleChoseChannel(e, channel.id)}>
                {channel.subject}{' '}
              </Channel>
            ))}
          </ForwardChannelsCont>
        </PopupBody>
        <PopupFooter backgroundColor={colors.gray5}>
          <Button type='button' color={colors.gray6} backgroundColor='transparent' onClick={() => togglePopup()}>
            Cancel
          </Button>
          <Button type='button' backgroundColor={colors.primary} borderRadius='8px' onClick={handleDelete}>
            {buttonText || 'Delete'}
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default ForwardMessagePopup

const ForwardChannelsCont = styled.div``

const Channel = styled.div<any>``
