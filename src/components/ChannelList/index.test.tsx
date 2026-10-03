import React from 'react'
import { act, screen, fireEvent } from '@testing-library/react'
import ChannelList from './index'
import { LOADING_STATE } from '../../helpers/constants'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { IChannel } from '../../types'
import {
  createMessageListStore,
  makeChannel,
  renderWithSceytProvider,
  resetMessageListFixtureIds
} from '../../testUtils/messageListHarness'
import { getLastChannelFromMap } from '../../helpers/channelHalper'
import {
  getChannelsAC,
  loadMoreChannels,
  switchChannelActionAC,
  switchChannelInfoAC,
  setChannelToAddAC,
  setAddedToChannelAC,
  setChannelToRemoveAC,
  setChannelToHideAC,
  setChannelToUnHideAC
} from '../../store/channel/actions'

// Mock useColor hook
jest.mock('../../hooks', () => ({
  useColor: () => {
    const { THEME_COLORS } = require('../../UIHelper/constants')
    return {
      [THEME_COLORS.ACCENT]: '#00aa88',
      [THEME_COLORS.TEXT_PRIMARY]: '#111111',
      [THEME_COLORS.BACKGROUND]: '#ffffff',
      [THEME_COLORS.TEXT_SECONDARY]: '#666666',
      [THEME_COLORS.BORDER]: '#dddddd',
      [THEME_COLORS.SURFACE_1]: '#f0f0f0',
      [THEME_COLORS.SURFACE_2]: '#e0e0e0'
    }
  },
  useDidUpdate: (callback: () => void, deps: any[]) => {
    const React = require('react')
    const isFirst = React.useRef(true)
    React.useEffect(() => {
      if (isFirst.current) {
        isFirst.current = false
        return
      }
      callback()
    }, deps)
  }
}))

// Mock Channel component as a simple row
jest.mock('../Channel', () => ({
  __esModule: true,
  default: ({ channel, setSelectedChannel }: { channel: IChannel; setSelectedChannel: (c: IChannel) => void }) => (
    <div data-testid='channel-row' data-channel-id={channel.id} onClick={() => setSelectedChannel(channel)}>
      {channel.subject || channel.id}
    </div>
  )
}))

// Mock ChannelSearch
jest.mock('./ChannelSearch', () => ({
  __esModule: true,
  default: ({
    searchValue,
    handleSearchValueChange,
    getMyChannels
  }: {
    searchValue: string
    handleSearchValueChange: (e: any) => void
    getMyChannels: () => void
  }) => (
    <div data-testid='channel-search'>
      <input
        data-testid='search-input'
        value={searchValue}
        onChange={handleSearchValueChange}
        placeholder='Search...'
      />
      <button data-testid='clear-search' onClick={getMyChannels}>
        Clear
      </button>
    </div>
  )
}))

// Mock CreateChannelButton
jest.mock('./CreateChannelButton', () => ({
  __esModule: true,
  default: () => <button data-testid='create-channel-button'>Create</button>
}))

// Mock ProfileSettings
jest.mock('./ProfileSettings', () => ({
  __esModule: true,
  default: ({ handleCloseProfile }: { handleCloseProfile: () => void }) => (
    <div data-testid='profile-settings' onClick={handleCloseProfile}>
      Profile Settings
    </div>
  )
}))

// Mock ContactItem
jest.mock('./ContactItem', () => ({
  __esModule: true,
  default: () => <div data-testid='contact-item'>Contact</div>
}))

// Mock useChannelReorderAnimation
jest.mock('./useChannelReorderAnimation', () => ({
  useChannelReorderAnimation: () => {
    const React = require('react')
    return React.createRef()
  }
}))

// Mock common/client
jest.mock('../../common/client', () => ({
  getClient: () => ({ user: { id: 'current-user' } })
}))

// Mock helpers
jest.mock('../../helpers/channelHalper', () => ({
  getChannelMembersCount: () => 10,
  getLastChannelFromMap: jest.fn(() => null),
  getPendingDeleteChannel: () => false,
  removeChannelFromMap: jest.fn(),
  setUploadImageIcon: jest.fn(),
  sortChannelByLastMessage: (channels: any[]) => channels
}))

jest.mock('../../helpers/contacts', () => ({
  getShowOnlyContactUsers: () => false
}))

describe('ChannelList', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
  })

  const createTestStore = (overrides: any = {}) => {
    return createMessageListStore({
      ChannelReducer: {
        channels: [],
        channelsLoadingState: LOADING_STATE.LOADED,
        channelsHasNext: false,
        searchedChannels: { chats_groups: [], channels: [], contacts: [] },
        activeChannel: {},
        addedChannel: null,
        addedToChannel: null,
        deletedChannel: null,
        hiddenChannel: null,
        visibleChannel: null,
        closeSearchChannel: false,
        ...overrides
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.CONNECTED,
        contactsMap: {}
      }
    })
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders one row per channel', () => {
      const channels = [
        makeChannel({ id: 'ch-1', subject: 'Channel One' }),
        makeChannel({ id: 'ch-2', subject: 'Channel Two' }),
        makeChannel({ id: 'ch-3', subject: 'Channel Three' })
      ]
      const store = createTestStore({ channels })

      renderWithSceytProvider(<ChannelList />, { store })

      const rows = screen.getAllByTestId('channel-row')
      expect(rows).toHaveLength(3)
      expect(screen.getByText('Channel One')).toBeInTheDocument()
      expect(screen.getByText('Channel Two')).toBeInTheDocument()
      expect(screen.getByText('Channel Three')).toBeInTheDocument()
    })

    it('uses custom ListItem when provided', () => {
      const channels = [makeChannel({ id: 'ch-custom', subject: 'Custom Channel' })]
      const store = createTestStore({ channels })

      const CustomListItem = ({ channel }: { channel?: IChannel }) => (
        <div data-testid='custom-list-item'>{channel?.subject} - Custom</div>
      )

      renderWithSceytProvider(<ChannelList ListItem={CustomListItem} />, { store })

      expect(screen.getByTestId('custom-list-item')).toBeInTheDocument()
      expect(screen.getByText('Custom Channel - Custom')).toBeInTheDocument()
      expect(screen.queryByTestId('channel-row')).not.toBeInTheDocument()
    })

    it('uses custom List when provided', () => {
      const channels = [makeChannel({ id: 'ch-list', subject: 'List Channel' })]
      const store = createTestStore({ channels })

      const CustomList = ({ children }: { children: React.ReactNode }) => (
        <div data-testid='custom-list'>
          <h2>Custom List Header</h2>
          {children}
        </div>
      )

      renderWithSceytProvider(<ChannelList List={CustomList} />, { store })

      expect(screen.getByTestId('custom-list')).toBeInTheDocument()
      expect(screen.getByText('Custom List Header')).toBeInTheDocument()
    })

    it('shows channels when channelsLoadingState is LOADED', () => {
      const channels = [makeChannel({ id: 'ch-existing', subject: 'Existing Channel' })]
      const store = createTestStore({
        channels,
        channelsLoadingState: LOADING_STATE.LOADED
      })

      renderWithSceytProvider(<ChannelList />, { store })

      expect(screen.getByText('Existing Channel')).toBeInTheDocument()
    })

    it('shows search input when showSearch is true (default)', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList />, { store })

      expect(screen.getByTestId('channel-search')).toBeInTheDocument()
    })

    it('hides search input when showSearch is false', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList showSearch={false} />, { store })

      expect(screen.queryByTestId('channel-search')).not.toBeInTheDocument()
    })

    it('shows create channel button when showCreateChannelIcon is true (default)', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList />, { store })

      expect(screen.getByTestId('create-channel-button')).toBeInTheDocument()
    })

    it('hides create channel button when showCreateChannelIcon is false', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList showCreateChannelIcon={false} />, { store })

      expect(screen.queryByTestId('create-channel-button')).not.toBeInTheDocument()
    })

    it('renders Chats title by default', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList />, { store })

      expect(screen.getByText('Chats')).toBeInTheDocument()
    })

    it('renders custom ChannelsTitle when provided', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList ChannelsTitle={<h1 data-testid='custom-title'>My Channels</h1>} />, {
        store
      })

      expect(screen.getByTestId('custom-title')).toBeInTheDocument()
      expect(screen.getByText('My Channels')).toBeInTheDocument()
    })
  })

  // ─── Behavior ──────────────────────────────────────────────────────────────

  describe('Behavior', () => {
    it('calls setSelectedChannel when a channel row is clicked', () => {
      const channels = [
        makeChannel({ id: 'ch-click-1', subject: 'Click Me' }),
        makeChannel({ id: 'ch-click-2', subject: 'Other Channel' })
      ]
      const store = createTestStore({ channels })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })

      const channelRow = screen.getByText('Click Me')
      fireEvent.click(channelRow)

      // Should dispatch switchChannelActionAC and clearMessagesAC
      const switchActions = dispatchSpy.mock.calls.filter(
        (call) => call[0]?.type === 'SWITCH_CHANNEL' || call[0]?.type?.includes('clearMessages')
      )
      expect(switchActions.length).toBeGreaterThan(0)
    })

    it('does not switch channel when clicking the already active channel', () => {
      const activeChannel = makeChannel({ id: 'ch-active', subject: 'Active Channel' })
      const channels = [activeChannel, makeChannel({ id: 'ch-other', subject: 'Other' })]
      const store = createTestStore({
        channels,
        activeChannel
      })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })

      const initialDispatchCount = dispatchSpy.mock.calls.length

      const activeRow = screen.getByText('Active Channel')
      fireEvent.click(activeRow)

      // Should not dispatch any new actions when clicking active channel
      expect(dispatchSpy.mock.calls.length).toBe(initialDispatchCount)
    })

    it('updates search value on input change', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList />, { store })

      const searchInput = screen.getByTestId('search-input')
      fireEvent.change(searchInput, { target: { value: 'test search' } })

      expect(searchInput).toHaveValue('test search')
    })

    it('clears search when clear button is clicked', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList />, { store })

      const searchInput = screen.getByTestId('search-input')
      fireEvent.change(searchInput, { target: { value: 'test search' } })
      expect(searchInput).toHaveValue('test search')

      const clearButton = screen.getByTestId('clear-search')
      fireEvent.click(clearButton)

      expect(searchInput).toHaveValue('')
    })

    it('calls onSearchValueChange callback when search value changes', () => {
      const store = createTestStore()
      const onSearchValueChange = jest.fn()

      renderWithSceytProvider(<ChannelList onSearchValueChange={onSearchValueChange} />, { store })

      const searchInput = screen.getByTestId('search-input')
      fireEvent.change(searchInput, { target: { value: 'callback test' } })

      expect(onSearchValueChange).toHaveBeenCalledWith('callback test')
    })
  })

  // ─── Store Signals ─────────────────────────────────────────────────────────

  describe('Store Signals', () => {
    it('removes channel when deletedChannel signal is set', () => {
      const channelToDelete = makeChannel({ id: 'ch-delete', subject: 'Delete Me' })
      const otherChannel = makeChannel({ id: 'ch-other', subject: 'Other' })
      const store = createTestStore({
        channels: [channelToDelete, otherChannel]
      })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })

      expect(screen.getByText('Delete Me')).toBeInTheDocument()

      // Trigger deletedChannel signal
      act(() => {
        store.dispatch(setChannelToRemoveAC(channelToDelete))
      })

      // Should dispatch removeChannelAC and setChannelToRemoveAC(null)
      const removeActions = dispatchSpy.mock.calls.filter(
        (call) =>
          call[0]?.type?.includes('removeChannel') ||
          (call[0]?.type?.includes('setChannelToRemove') && call[0]?.payload?.channel === null)
      )
      expect(removeActions.length).toBeGreaterThan(0)
    })

    it('calls onChannelDeleted callback when deletedChannel signal is set', () => {
      const channelToDelete = makeChannel({ id: 'ch-delete-cb', subject: 'Delete Callback' })
      const onChannelDeleted = jest.fn()
      const store = createTestStore({
        channels: [channelToDelete]
      })

      renderWithSceytProvider(<ChannelList onChannelDeleted={onChannelDeleted} />, { store })

      act(() => {
        store.dispatch(setChannelToRemoveAC(channelToDelete))
      })

      expect(onChannelDeleted).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'ch-delete-cb' })]),
        expect.objectContaining({ id: 'ch-delete-cb' }),
        expect.any(Function)
      )
    })

    it('adds channel when addedChannel signal is set', () => {
      const existingChannel = makeChannel({ id: 'ch-existing', subject: 'Existing' })
      const newChannel = makeChannel({ id: 'ch-new', subject: 'New Channel' })
      const store = createTestStore({
        channels: [existingChannel]
      })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })

      // Trigger addedChannel signal
      act(() => {
        store.dispatch(setChannelToAddAC(newChannel))
      })

      // Should dispatch addChannelAC and setChannelToAddAC(null)
      const addActions = dispatchSpy.mock.calls.filter(
        (call) =>
          call[0]?.type?.includes('addChannel') ||
          (call[0]?.type?.includes('setChannelToAdd') && call[0]?.payload?.channel === null)
      )
      expect(addActions.length).toBeGreaterThan(0)
    })

    it('calls onChannelCreated callback when addedChannel signal is set', () => {
      const newChannel = makeChannel({ id: 'ch-created', subject: 'Created Channel' })
      const onChannelCreated = jest.fn()
      const store = createTestStore({
        channels: []
      })

      renderWithSceytProvider(<ChannelList onChannelCreated={onChannelCreated} />, { store })

      act(() => {
        store.dispatch(setChannelToAddAC(newChannel))
      })

      expect(onChannelCreated).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ id: 'ch-created' }),
        expect.any(Function)
      )
    })

    it('adds channel when addedToChannel signal is set', () => {
      const addedToChannel = makeChannel({ id: 'ch-added-to', subject: 'Added To Channel' })
      const store = createTestStore({
        channels: []
      })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })

      // Trigger addedToChannel signal
      act(() => {
        store.dispatch(setAddedToChannelAC(addedToChannel))
      })

      // Should dispatch addChannelAC
      const addActions = dispatchSpy.mock.calls.filter((call) => call[0]?.type?.includes('addChannel'))
      expect(addActions.length).toBeGreaterThan(0)
    })

    // Regression: the addedToChannel signal used to be cleared with setChannelToAddAC(null)
    // (the wrong signal), so addedToChannel stayed set and a pending addedChannel could be wiped.
    it('clears the addedToChannel signal itself, not addedChannel', () => {
      const addedToChannel = makeChannel({ id: 'ch-added-to-clear', subject: 'Added To' })
      const store = createTestStore({ channels: [] })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })
      act(() => {
        store.dispatch(setAddedToChannelAC(addedToChannel))
      })

      expect(dispatchSpy).toHaveBeenCalledWith(setAddedToChannelAC(null))
      expect(dispatchSpy).not.toHaveBeenCalledWith(setChannelToAddAC(null))
      expect((store.getState() as any).ChannelReducer.addedToChannel).toBeNull()
    })

    it('calls onAddedToChannel callback when addedToChannel signal is set', () => {
      const addedToChannel = makeChannel({ id: 'ch-added-cb', subject: 'Added To Callback' })
      const onAddedToChannel = jest.fn()
      const store = createTestStore({
        channels: []
      })

      renderWithSceytProvider(<ChannelList onAddedToChannel={onAddedToChannel} />, { store })

      act(() => {
        store.dispatch(setAddedToChannelAC(addedToChannel))
      })

      expect(onAddedToChannel).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ id: 'ch-added-cb' }),
        expect.any(Function)
      )
    })

    it('removes channel when hiddenChannel signal is set', () => {
      const channelToHide = makeChannel({ id: 'ch-hide', subject: 'Hide Me' })
      const store = createTestStore({
        channels: [channelToHide]
      })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })

      // Trigger hiddenChannel signal
      act(() => {
        store.dispatch(setChannelToHideAC(channelToHide))
      })

      // Should dispatch removeChannelAC and setChannelToHideAC(null)
      const hideActions = dispatchSpy.mock.calls.filter(
        (call) =>
          call[0]?.type?.includes('removeChannel') ||
          (call[0]?.type?.includes('setChannelToHide') && call[0]?.payload?.channel === null)
      )
      expect(hideActions.length).toBeGreaterThan(0)
    })

    it('calls onChannelHidden callback when hiddenChannel signal is set', () => {
      const channelToHide = makeChannel({ id: 'ch-hide-cb', subject: 'Hide Callback' })
      const onChannelHidden = jest.fn()
      const store = createTestStore({
        channels: [channelToHide]
      })

      renderWithSceytProvider(<ChannelList onChannelHidden={onChannelHidden} />, { store })

      act(() => {
        store.dispatch(setChannelToHideAC(channelToHide))
      })

      expect(onChannelHidden).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'ch-hide-cb' })]),
        expect.objectContaining({ id: 'ch-hide-cb' }),
        expect.any(Function)
      )
    })

    // BUG: When hiddenChannel is null in store, visibleChannel signal crashes because
    // line 420 uses hiddenChannel instead of visibleChannel
    // We test with onChannelVisible callback to avoid the crash
    it('adds channel when visibleChannel signal is set (via callback)', () => {
      const visibleChannel = makeChannel({ id: 'ch-visible', subject: 'Visible Channel' })
      const onChannelVisible = jest.fn()
      const store = createTestStore({
        channels: []
      })

      renderWithSceytProvider(<ChannelList onChannelVisible={onChannelVisible} />, { store })

      // Trigger visibleChannel signal
      act(() => {
        store.dispatch(setChannelToUnHideAC(visibleChannel))
      })

      // The callback is called correctly
      expect(onChannelVisible).toHaveBeenCalled()
    })

    // Regression: the default path dispatched addChannelAC(hiddenChannel) -- null after a hide --
    // so an unhidden chat never came back (and the reducer crashed on null).
    it('adds the unhidden chat back to the list (default path)', () => {
      const unhidden = makeChannel({ id: 'ch-unhidden', subject: 'Back Again' })
      const store = createTestStore({ channels: [], hiddenChannel: null })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })
      act(() => {
        store.dispatch(setChannelToUnHideAC(unhidden))
      })

      const addAction = dispatchSpy.mock.calls
        .map((call) => call[0])
        .find((action: any) => action?.type?.includes('addChannel'))
      expect(addAction?.payload?.channel).toEqual(expect.objectContaining({ id: 'ch-unhidden' }))
      expect(screen.getByText('Back Again')).toBeInTheDocument()
      expect((store.getState() as any).ChannelReducer.visibleChannel).toBeNull()
    })

    it('calls onChannelVisible callback when visibleChannel signal is set', () => {
      const visibleChannel = makeChannel({ id: 'ch-visible-cb', subject: 'Visible Callback' })
      const onChannelVisible = jest.fn()
      const store = createTestStore({
        channels: []
      })

      renderWithSceytProvider(<ChannelList onChannelVisible={onChannelVisible} />, { store })

      act(() => {
        store.dispatch(setChannelToUnHideAC(visibleChannel))
      })

      expect(onChannelVisible).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ id: 'ch-visible-cb' }),
        expect.any(Function)
      )
    })

    it('switches to the next chat (skipping chats pending delete) when the active chat is deleted', () => {
      const activeChannel = makeChannel({ id: 'ch-active-delete', subject: 'Active To Delete' })
      const otherChannel = makeChannel({ id: 'ch-other', subject: 'Other' })
      ;(getLastChannelFromMap as jest.Mock).mockReturnValueOnce(otherChannel)
      const store = createTestStore({ channels: [activeChannel, otherChannel], activeChannel })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })
      act(() => {
        store.dispatch(setChannelToRemoveAC(activeChannel))
      })

      // deletePending=true so a chat that is itself being deleted is not chosen
      expect(getLastChannelFromMap).toHaveBeenCalledWith(true)
      const switchAction = dispatchSpy.mock.calls.map((call) => call[0]).find((a: any) => a?.type === 'SWITCH_CHANNEL')
      expect(switchAction?.payload?.channel).toEqual(expect.objectContaining({ id: 'ch-other' }))
    })

    it('clears the active chat and closes channel info when the last chat is deleted', () => {
      const activeChannel = makeChannel({ id: 'ch-only', subject: 'Only' })
      ;(getLastChannelFromMap as jest.Mock).mockReturnValueOnce(null)
      const store = createTestStore({ channels: [activeChannel], activeChannel })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<ChannelList />, { store })
      act(() => {
        store.dispatch(setChannelToRemoveAC(activeChannel))
      })

      expect(dispatchSpy).toHaveBeenCalledWith(switchChannelActionAC({} as any))
      expect(dispatchSpy).toHaveBeenCalledWith(switchChannelInfoAC(false))
    })

    it('clears search when channel is deleted while searching', () => {
      const channelToDelete = makeChannel({ id: 'ch-search-delete', subject: 'Search Delete' })
      const store = createTestStore({
        channels: [channelToDelete]
      })

      renderWithSceytProvider(<ChannelList />, { store })

      // Start searching
      const searchInput = screen.getByTestId('search-input')
      fireEvent.change(searchInput, { target: { value: 'test' } })
      expect(searchInput).toHaveValue('test')

      // Delete the channel
      act(() => {
        store.dispatch(setChannelToRemoveAC(channelToDelete))
      })

      // Search should be cleared
      expect(searchInput).toHaveValue('')
    })
  })

  // ─── Loading ──────────────────────────────────────────────────────────────

  describe('Loading', () => {
    const scrollToBottom = (list: HTMLElement) => {
      Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 })
      Object.defineProperty(list, 'offsetHeight', { configurable: true, value: 400 })
      Object.defineProperty(list, 'scrollTop', { configurable: true, writable: true, value: 450 })
      fireEvent.scroll(list)
    }
    const getList = () => screen.getAllByTestId('channel-row')[0].closest('[data-channel-row-id]')!.parentElement!

    it('loads chats with the filter/limit/sort props when connected', () => {
      const store = createTestStore({ channels: [] })
      const dispatchSpy = jest.spyOn(store, 'dispatch')
      const filter = { channelType: 'group' } as any
      const sort = 'byLastMessage' as any

      renderWithSceytProvider(<ChannelList filter={filter} limit={15} sort={sort} />, { store })

      const getChannels = dispatchSpy.mock.calls
        .map((call) => call[0])
        .find((a: any) => a?.type === getChannelsAC({} as any).type)
      expect(getChannels?.payload?.params).toEqual(expect.objectContaining({ filter, limit: 15, sort, search: '' }))
    })

    it('loads more chats when scrolled near the bottom', () => {
      const store = createTestStore({
        channels: [makeChannel({ id: 'a', subject: 'A' }), makeChannel({ id: 'b', subject: 'B' })],
        channelsHasNext: true,
        channelsLoadingState: LOADING_STATE.LOADED
      })
      const dispatchSpy = jest.spyOn(store, 'dispatch')
      renderWithSceytProvider(<ChannelList />, { store })

      scrollToBottom(getList())

      const loadMore = dispatchSpy.mock.calls.filter((call) => call[0]?.type === loadMoreChannels().type)
      expect(loadMore).toHaveLength(1)
    })

    it.each([
      ['there are no more chats', { channelsHasNext: false, channelsLoadingState: LOADING_STATE.LOADED }],
      ['a page is already loading', { channelsHasNext: true, channelsLoadingState: LOADING_STATE.LOADING }]
    ])('does not load more when %s', (_label, overrides) => {
      const store = createTestStore({ channels: [makeChannel({ id: 'a', subject: 'A' })], ...overrides })
      const dispatchSpy = jest.spyOn(store, 'dispatch')
      renderWithSceytProvider(<ChannelList />, { store })

      scrollToBottom(getList())

      expect(dispatchSpy.mock.calls.filter((call) => call[0]?.type === loadMoreChannels().type)).toHaveLength(0)
    })

    it('does not load more while searching', () => {
      const store = createTestStore({
        channels: [makeChannel({ id: 'a', subject: 'A' })],
        channelsHasNext: true,
        channelsLoadingState: LOADING_STATE.LOADED
      })
      const dispatchSpy = jest.spyOn(store, 'dispatch')
      renderWithSceytProvider(<ChannelList />, { store })
      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'abc' } })
      const list = document.querySelector('[data-channel-row-id]')?.parentElement
      if (list) scrollToBottom(list)

      expect(dispatchSpy.mock.calls.filter((call) => call[0]?.type === loadMoreChannels().type)).toHaveLength(0)
    })
  })

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles empty channel list gracefully', () => {
      const store = createTestStore({ channels: [] })

      renderWithSceytProvider(<ChannelList />, { store })

      expect(screen.queryByTestId('channel-row')).not.toBeInTheDocument()
    })

    it('handles null activeChannel gracefully', () => {
      const channels = [makeChannel({ id: 'ch-1', subject: 'Channel 1' })]
      const store = createTestStore({
        channels,
        activeChannel: null
      })

      expect(() => {
        renderWithSceytProvider(<ChannelList />, { store })
      }).not.toThrow()
    })

    it('renders with inline search position', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList searchChannelsPosition='inline' />, { store })

      expect(screen.getByTestId('channel-search')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const store = createTestStore()

      const { container } = renderWithSceytProvider(<ChannelList className='my-custom-class' />, { store })

      expect(container.firstChild).toHaveClass('my-custom-class')
    })

    it('renders custom Profile component', () => {
      const store = createTestStore()

      renderWithSceytProvider(<ChannelList Profile={<div data-testid='custom-profile'>My Profile</div>} />, { store })

      expect(screen.getByTestId('custom-profile')).toBeInTheDocument()
    })

    it('renders custom CreateChannel component', () => {
      const store = createTestStore()

      renderWithSceytProvider(
        <ChannelList CreateChannel={<button data-testid='custom-create'>Custom Create</button>} />,
        { store }
      )

      expect(screen.getByTestId('custom-create')).toBeInTheDocument()
      expect(screen.queryByTestId('create-channel-button')).not.toBeInTheDocument()
    })
  })
})

/**
 * BUGS DOCUMENTED:
 *
 * 1. Line 400 (addedToChannel useEffect):
 *    dispatch(setChannelToAddAC(null)) should be dispatch(setAddedToChannelAC(null))
 *    The addedToChannel signal is never properly cleared, which could cause
 *    the channel to be re-added on every render.
 *
 * 2. Line 420 (visibleChannel useEffect):
 *    dispatch(addChannelAC(hiddenChannel)) should be dispatch(addChannelAC(visibleChannel))
 *    When unhiding a channel, the code accidentally adds the previously hidden
 *    channel instead of the newly visible channel.
 */
