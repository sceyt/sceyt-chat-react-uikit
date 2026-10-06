import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import Media from './Media'
import Files from './Files'
import Links from './Links'
import Voices from './Voices'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'
import { channelDetailsTabs, DETAILS_TAB_ATTACHMENTS_PAGE_SIZE, LOADING_STATE } from '../../../helpers/constants'
import { getAttachmentsAC } from '../../../store/message/actions'
import { setConnectionStatusAC } from '../../../store/user/actions'
import { CONNECTION_STATUS } from '../../../store/user/constants'

jest.mock('../../../hooks', () => ({
  useDidUpdate: jest.requireActual('../../../hooks/basic/useDidUpdate').default,
  useColor: () => ({
    background: '#fff',
    textPrimary: '#111',
    textSecondary: '#666',
    surface1: '#eee',
    surface2: '#ddd',
    accent: '#0a8',
    iconInactive: '#999',
    backgroundHovered: '#f5f5f5'
  })
}))

jest.mock('../../Attachment', () => ({ __esModule: true, default: () => null }))
jest.mock('../../../common/popups/sliderPopup', () => ({ __esModule: true, default: () => null }))

const channel = { id: 'channel-tabs', type: 'group' } as any

const tabs = [
  {
    name: 'Media',
    // Files / Links / Voices render inside a <ul>; Media's grid is a <div>
    listItem: false,
    noun: 'media',
    type: channelDetailsTabs.media,
    render: (props: any) => <Media channel={channel} {...props} />
  },
  {
    name: 'Files',
    listItem: true,
    noun: 'files',
    type: channelDetailsTabs.file,
    render: (props: any) => <Files channelId={channel.id} {...props} />
  },
  {
    name: 'Links',
    listItem: true,
    noun: 'links',
    type: channelDetailsTabs.link,
    render: (props: any) => <Links channelId={channel.id} {...props} />
  },
  {
    name: 'Voices',
    listItem: true,
    noun: 'voice messages',
    type: channelDetailsTabs.voice,
    render: (props: any) => <Voices channelId={channel.id} {...props} />
  }
]

const storeWith = (attachmentLoadingState: number, activeTabAttachments: any[] = []) =>
  createMessageListStore({ MessageReducer: { attachmentLoadingState, activeTabAttachments } } as any)

describe.each(tabs)('$name tab: first load timed out', ({ noun, type, render, listItem }) => {
  it(`shows "Unable to load ${noun}" and Retry reloads the tab`, () => {
    const store = storeWith(LOADING_STATE.FAILED)
    const dispatchSpy = jest.spyOn(store, 'dispatch')
    renderWithSceytProvider(render({}), { store })

    expect(screen.getByText(`Unable to load ${noun}`)).toBeInTheDocument()
    expect(screen.getByText(`We couldn't load ${noun}. Please try again.`)).toBeInTheDocument()

    dispatchSpy.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(dispatchSpy).toHaveBeenCalledWith(getAttachmentsAC(channel.id, type, DETAILS_TAB_ATTACHMENTS_PAGE_SIZE))
  })

  it("places the error like the tab's empty state", () => {
    renderWithSceytProvider(render({}), { store: storeWith(LOADING_STATE.FAILED) })
    const view = screen.getByTestId('load-error-state')
    expect(view.tagName).toBe(listItem ? 'LI' : 'DIV')
    expect(view).toHaveStyle('margin-top: 100px')
  })

  it('wraps CustomLoadErrorState so it sits like the default view', () => {
    const Custom = ({ title }: any) => <div data-testid='custom-error'>{title}</div>
    renderWithSceytProvider(render({ CustomLoadErrorState: Custom }), { store: storeWith(LOADING_STATE.FAILED) })
    const wrapper = screen.getByTestId('custom-error').parentElement as HTMLElement
    expect(wrapper.tagName).toBe(listItem ? 'LI' : 'DIV')
    expect(wrapper).toHaveStyle('margin-top: 100px')
  })

  it('does not show the error while loading or after a successful empty load', () => {
    const { unmount } = renderWithSceytProvider(render({}), { store: storeWith(LOADING_STATE.LOADING) })
    expect(screen.queryByText(`Unable to load ${noun}`)).not.toBeInTheDocument()
    unmount()
    renderWithSceytProvider(render({}), { store: storeWith(LOADING_STATE.LOADED) })
    expect(screen.queryByText(`Unable to load ${noun}`)).not.toBeInTheDocument()
  })

  it('reloads an empty tab when the connection comes back', () => {
    // A load that failed with a connection error (9903/9904) ends LOADED and empty
    const store = storeWith(LOADING_STATE.LOADED)
    const dispatchSpy = jest.spyOn(store, 'dispatch')
    renderWithSceytProvider(render({}), { store })
    act(() => {
      store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTING))
    })
    dispatchSpy.mockClear()
    act(() => {
      store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    })
    expect(dispatchSpy).toHaveBeenCalledWith(getAttachmentsAC(channel.id, type, DETAILS_TAB_ATTACHMENTS_PAGE_SIZE))
  })

  it('uses CustomLoadErrorState when provided', () => {
    const Custom = ({ title }: any) => <div data-testid='custom-error'>{title}</div>
    renderWithSceytProvider(render({ CustomLoadErrorState: Custom }), { store: storeWith(LOADING_STATE.FAILED) })
    expect(screen.getByTestId('custom-error')).toHaveTextContent(`Unable to load ${noun}`)
    expect(screen.queryByTestId('load-error-state')).not.toBeInTheDocument()
  })
})
