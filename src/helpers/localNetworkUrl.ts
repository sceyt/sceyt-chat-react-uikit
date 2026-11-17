// A link preview's image or favicon on a local-network host (a private IP address,
// localhost, a .local name) is not loaded: loading it from a web page makes the browser ask
// the user for access to their local network. Such a preview is shown without the image.

const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./ // carrier-grade NAT
]

export const isLocalNetworkUrl = (url: string | undefined | null): boolean => {
  if (!url) return false
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return PRIVATE_IPV4.some((range) => range.test(hostname))
  if (hostname.startsWith('[')) {
    const ipv6 = hostname.slice(1, -1)
    return ipv6 === '::1' || /^f[cd]/.test(ipv6) || /^fe[89ab]/.test(ipv6)
  }
  return false
}

// The URL itself, unless it is on a local-network host.
export const publicUrlOrUndefined = (url: string | undefined | null) =>
  url && !isLocalNetworkUrl(url) ? url : undefined

// Link preview data from the server without the images and favicon on local-network hosts.
export const withoutLocalNetworkImages = <T extends { og?: any } | null | undefined>(metadata: T): T => {
  if (!metadata?.og) return metadata
  const images = Array.isArray(metadata.og.image)
    ? metadata.og.image.filter((image: any) => !isLocalNetworkUrl(image?.url))
    : metadata.og.image
  const favicon = metadata.og.favicon && isLocalNetworkUrl(metadata.og.favicon.url) ? undefined : metadata.og.favicon
  return { ...metadata, og: { ...metadata.og, image: images, favicon } }
}
