import { isLocalNetworkUrl, publicUrlOrUndefined, withoutLocalNetworkImages } from './localNetworkUrl'

describe('isLocalNetworkUrl', () => {
  it.each([
    'http://172.16.1.227:3000/public/img/fav32.png',
    'http://172.31.255.1/a.png',
    'http://10.0.0.5/icon.ico',
    'https://192.168.1.1/',
    'http://127.0.0.1:8080/x',
    'http://169.254.10.1/',
    'http://100.64.0.1/',
    'http://localhost:3000/favicon.ico',
    'http://printer.local/logo.png',
    'http://[::1]/a.png',
    'http://[fd12:3456::1]/a.png',
    'http://[fe80::1]/a.png'
  ])('a link preview image on %s is on the local network', (url) => {
    expect(isLocalNetworkUrl(url)).toBe(true)
  })

  it.each([
    'https://example.com/favicon.ico',
    'https://cdn.example.com/og.png',
    'http://172.15.0.1/a.png',
    'http://172.32.0.1/a.png',
    'http://8.8.8.8/a.png',
    'https://[2001:4860:4860::8888]/a.png',
    'data:,',
    'not a url',
    ''
  ])('a link preview image on %s is not on the local network', (url) => {
    expect(isLocalNetworkUrl(url)).toBe(false)
  })

  it('keeps a public URL and drops a local-network one', () => {
    expect(publicUrlOrUndefined('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(publicUrlOrUndefined('http://192.168.1.10/a.png')).toBeUndefined()
    expect(publicUrlOrUndefined(undefined)).toBeUndefined()
  })
})

describe('withoutLocalNetworkImages', () => {
  it('drops the images and favicon on a local-network host from link preview data', () => {
    const metadata = {
      url: 'http://172.16.1.227:3000/d/dashboard',
      og: {
        title: 'Grafana',
        image: [{ url: 'http://172.16.1.227:3000/og.png' }, { url: 'https://cdn.example.com/og.png' }],
        favicon: { url: 'http://172.16.1.227:3000/public/img/fav32.png' }
      }
    }

    expect(withoutLocalNetworkImages(metadata)).toEqual({
      url: 'http://172.16.1.227:3000/d/dashboard',
      og: { title: 'Grafana', image: [{ url: 'https://cdn.example.com/og.png' }], favicon: undefined }
    })
  })

  it('keeps public images and favicon as they are', () => {
    const metadata = { og: { title: 'Example', image: [], favicon: { url: 'https://example.com/favicon.ico' } } }

    expect(withoutLocalNetworkImages(metadata)).toEqual(metadata)
  })
})
