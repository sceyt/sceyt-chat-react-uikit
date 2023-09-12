/**
 * Encodes an RGBA image to a ThumbHash. RGB should not be premultiplied by A.
 *
 * @param w The width of the input image. Must be ≤100px.
 * @param h The height of the input image. Must be ≤100px.
 * @param rgba The pixels in the input image, row-by-row. Must have w*h*4 elements.
 * @returns The ThumbHash as a Uint8Array.
 */
export function rgbaToThumbHash(w, h, rgba) {
  // Encoding an image larger than 100x100 is slow with no benefit
  if (w > 100 || h > 100) throw new Error(`${w}x${h} doesn't fit in 100x100`)
  const { PI, round, max, cos, abs } = Math

  // Determine the average color
  // eslint-disable-next-line camelcase
  let avg_r = 0
  // eslint-disable-next-line camelcase
  let avg_g = 0
  // eslint-disable-next-line camelcase
  let avg_b = 0
  // eslint-disable-next-line camelcase
  let avg_a = 0
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = rgba[j + 3] / 255
    // eslint-disable-next-line camelcase
    avg_r += (alpha / 255) * rgba[j]
    // eslint-disable-next-line camelcase
    avg_g += (alpha / 255) * rgba[j + 1]
    // eslint-disable-next-line camelcase
    avg_b += (alpha / 255) * rgba[j + 2]
    // eslint-disable-next-line camelcase
    avg_a += alpha
  }
  // eslint-disable-next-line camelcase
  if (avg_a) {
    // eslint-disable-next-line camelcase
    avg_r /= avg_a
    // eslint-disable-next-line camelcase
    avg_g /= avg_a
    // eslint-disable-next-line camelcase
    avg_b /= avg_a
  }

  // eslint-disable-next-line camelcase
  const hasAlpha = avg_a < w * h
  // eslint-disable-next-line camelcase
  const l_limit = hasAlpha ? 5 : 7 // Use fewer luminance bits if there's alpha
  // eslint-disable-next-line camelcase
  const lx = max(1, round((l_limit * w) / max(w, h)))
  // eslint-disable-next-line camelcase
  const ly = max(1, round((l_limit * h) / max(w, h)))
  const l = [] // luminance
  const p = [] // yellow - blue
  const q = [] // red - green
  const a = [] // alpha

  // Convert the image from RGBA to LPQA (composite atop the average color)
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = rgba[j + 3] / 255
    // eslint-disable-next-line camelcase
    const r = avg_r * (1 - alpha) + (alpha / 255) * rgba[j]
    // eslint-disable-next-line camelcase
    const g = avg_g * (1 - alpha) + (alpha / 255) * rgba[j + 1]
    // eslint-disable-next-line camelcase
    const b = avg_b * (1 - alpha) + (alpha / 255) * rgba[j + 2]
    l[i] = (r + g + b) / 3
    p[i] = (r + g) / 2 - b
    q[i] = r - g
    a[i] = alpha
  }

  // Encode using the DCT into DC (constant) and normalized AC (varying) terms
  const encodeChannel = (channel, nx, ny) => {
    let dc = 0
    const ac = []
    let scale = 0
    const fx = []
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx * ny < nx * (ny - cy); cx++) {
        let f = 0
        for (let x = 0; x < w; x++) fx[x] = cos((PI / w) * cx * (x + 0.5))
        for (let y = 0; y < h; y++)
          for (let x = 0, fy = cos((PI / h) * cy * (y + 0.5)); x < w; x++) f += channel[x + y * w] * fx[x] * fy
        f /= w * h
        if (cx || cy) {
          ac.push(f)
          scale = max(scale, abs(f))
        } else {
          dc = f
        }
      }
    }
    if (scale) for (let i = 0; i < ac.length; i++) ac[i] = 0.5 + (0.5 / scale) * ac[i]
    return [dc, ac, scale]
  }
  // eslint-disable-next-line camelcase
  const [l_dc, l_ac, l_scale] = encodeChannel(l, max(3, lx), max(3, ly))
  // eslint-disable-next-line camelcase
  const [p_dc, p_ac, p_scale] = encodeChannel(p, 3, 3)
  // eslint-disable-next-line camelcase
  const [q_dc, q_ac, q_scale] = encodeChannel(q, 3, 3)
  // eslint-disable-next-line camelcase
  const [a_dc, a_ac, a_scale] = hasAlpha ? encodeChannel(a, 5, 5) : []

  // Write the constants
  const isLandscape = w > h
  const header24 =
    // eslint-disable-next-line camelcase
    round(63 * l_dc) |
    // eslint-disable-next-line camelcase
    (round(31.5 + 31.5 * p_dc) << 6) |
    // eslint-disable-next-line camelcase
    (round(31.5 + 31.5 * q_dc) << 12) |
    // eslint-disable-next-line camelcase
    (round(31 * l_scale) << 18) |
    (hasAlpha << 23)
  const header16 =
    // eslint-disable-next-line camelcase
    (isLandscape ? ly : lx) | (round(63 * p_scale) << 3) | (round(63 * q_scale) << 9) | (isLandscape << 15)
  const hash = [header24 & 255, (header24 >> 8) & 255, header24 >> 16, header16 & 255, header16 >> 8]
  // eslint-disable-next-line camelcase
  const ac_start = hasAlpha ? 6 : 5
  // eslint-disable-next-line camelcase
  let ac_index = 0
  // eslint-disable-next-line camelcase
  if (hasAlpha) hash.push(round(15 * a_dc) | (round(15 * a_scale) << 4))

  // Write the varying factors
  // eslint-disable-next-line camelcase
  for (const ac of hasAlpha ? [l_ac, p_ac, q_ac, a_ac] : [l_ac, p_ac, q_ac]) {
    // eslint-disable-next-line camelcase
    for (const f of ac) hash[ac_start + (ac_index >> 1)] |= round(15 * f) << ((ac_index++ & 1) << 2)
  }
  return new Uint8Array(hash)
}

/**
 * Decodes a ThumbHash to an RGBA image. RGB is not be premultiplied by A.
 *
 * @param hash The bytes of the ThumbHash.
 * @returns The width, height, and pixels of the rendered placeholder image.
 */
export function thumbHashToRGBA(hash) {
  const { PI, min, max, cos, round } = Math

  // Read the constants
  const header24 = hash[0] | (hash[1] << 8) | (hash[2] << 16)
  const header16 = hash[3] | (hash[4] << 8)
  // eslint-disable-next-line camelcase
  const l_dc = (header24 & 63) / 63
  // eslint-disable-next-line camelcase
  const p_dc = ((header24 >> 6) & 63) / 31.5 - 1
  // eslint-disable-next-line camelcase
  const q_dc = ((header24 >> 12) & 63) / 31.5 - 1
  // eslint-disable-next-line camelcase
  const l_scale = ((header24 >> 18) & 31) / 31
  // eslint-disable-next-line camelcase
  const hasAlpha = header24 >> 23
  // eslint-disable-next-line camelcase
  const p_scale = ((header16 >> 3) & 63) / 63
  // eslint-disable-next-line camelcase
  const q_scale = ((header16 >> 9) & 63) / 63
  const isLandscape = header16 >> 15
  const lx = max(3, isLandscape ? (hasAlpha ? 5 : 7) : header16 & 7)
  const ly = max(3, isLandscape ? header16 & 7 : hasAlpha ? 5 : 7)
  // eslint-disable-next-line camelcase
  const a_dc = hasAlpha ? (hash[5] & 15) / 15 : 1
  // eslint-disable-next-line camelcase
  const a_scale = (hash[5] >> 4) / 15

  // Read the varying factors (boost saturation by 1.25x to compensate for quantization)
  // eslint-disable-next-line camelcase
  const ac_start = hasAlpha ? 6 : 5
  // eslint-disable-next-line camelcase
  let ac_index = 0
  const decodeChannel = (nx, ny, scale) => {
    const ac = []
    for (let cy = 0; cy < ny; cy++)
      for (let cx = cy ? 0 : 1; cx * ny < nx * (ny - cy); cx++)
        // eslint-disable-next-line camelcase
        ac.push((((hash[ac_start + (ac_index >> 1)] >> ((ac_index++ & 1) << 2)) & 15) / 7.5 - 1) * scale)
    return ac
  }
  // eslint-disable-next-line camelcase
  const l_ac = decodeChannel(lx, ly, l_scale)
  // eslint-disable-next-line camelcase
  const p_ac = decodeChannel(3, 3, p_scale * 1.25)
  // eslint-disable-next-line camelcase
  const q_ac = decodeChannel(3, 3, q_scale * 1.25)
  // eslint-disable-next-line camelcase
  const a_ac = hasAlpha && decodeChannel(5, 5, a_scale)

  // Decode using the DCT into RGB
  const ratio = thumbHashToApproximateAspectRatio(hash)
  const w = round(ratio > 1 ? 32 : 32 * ratio)
  const h = round(ratio > 1 ? 32 / ratio : 32)
  const rgba = new Uint8Array(w * h * 4)
  const fx = []
  const fy = []
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      // eslint-disable-next-line camelcase
      let l = l_dc
      // eslint-disable-next-line camelcase
      let p = p_dc
      // eslint-disable-next-line camelcase
      let q = q_dc
      // eslint-disable-next-line camelcase
      let a = a_dc

      // Precompute the coefficients
      for (let cx = 0, n = max(lx, hasAlpha ? 5 : 3); cx < n; cx++) fx[cx] = cos((PI / w) * (x + 0.5) * cx)
      for (let cy = 0, n = max(ly, hasAlpha ? 5 : 3); cy < n; cy++) fy[cy] = cos((PI / h) * (y + 0.5) * cy)

      // Decode L
      for (let cy = 0, j = 0; cy < ly; cy++)
        // eslint-disable-next-line camelcase
        for (let cx = cy ? 0 : 1, fy2 = fy[cy] * 2; cx * ly < lx * (ly - cy); cx++, j++) l += l_ac[j] * fx[cx] * fy2

      // Decode P and Q
      for (let cy = 0, j = 0; cy < 3; cy++) {
        for (let cx = cy ? 0 : 1, fy2 = fy[cy] * 2; cx < 3 - cy; cx++, j++) {
          const f = fx[cx] * fy2
          // eslint-disable-next-line camelcase
          p += p_ac[j] * f
          // eslint-disable-next-line camelcase
          q += q_ac[j] * f
        }
      }

      // Decode A
      if (hasAlpha)
        for (let cy = 0, j = 0; cy < 5; cy++)
          // eslint-disable-next-line camelcase
          for (let cx = cy ? 0 : 1, fy2 = fy[cy] * 2; cx < 5 - cy; cx++, j++) a += a_ac[j] * fx[cx] * fy2

      // Convert to RGB
      const b = l - (2 / 3) * p
      const r = (3 * l - b + q) / 2
      const g = r - q
      rgba[i] = max(0, 255 * min(1, r))
      rgba[i + 1] = max(0, 255 * min(1, g))
      rgba[i + 2] = max(0, 255 * min(1, b))
      rgba[i + 3] = max(0, 255 * min(1, a))
    }
  }
  return { w, h, rgba }
}

/**
 * Extracts the average color from a ThumbHash. RGB is not be premultiplied by A.
 *
 * @param hash The bytes of the ThumbHash.
 * @returns The RGBA values for the average color. Each value ranges from 0 to 1.
 */
export function thumbHashToAverageRGBA(hash) {
  const { min, max } = Math
  const header = hash[0] | (hash[1] << 8) | (hash[2] << 16)
  const l = (header & 63) / 63
  const p = ((header >> 6) & 63) / 31.5 - 1
  const q = ((header >> 12) & 63) / 31.5 - 1
  const hasAlpha = header >> 23
  const a = hasAlpha ? (hash[5] & 15) / 15 : 1
  const b = l - (2 / 3) * p
  const r = (3 * l - b + q) / 2
  const g = r - q
  return {
    r: max(0, min(1, r)),
    g: max(0, min(1, g)),
    b: max(0, min(1, b)),
    a
  }
}

/**
 * Extracts the approximate aspect ratio of the original image.
 *
 * @param hash The bytes of the ThumbHash.
 * @returns The approximate aspect ratio (i.e. width / height).
 */
export function thumbHashToApproximateAspectRatio(hash) {
  const header = hash[3]
  const hasAlpha = hash[2] & 0x80
  const isLandscape = hash[4] & 0x80
  const lx = isLandscape ? (hasAlpha ? 5 : 7) : header & 7
  const ly = isLandscape ? header & 7 : hasAlpha ? 5 : 7
  return lx / ly
}

/**
 * Encodes an RGBA image to a PNG data URL. RGB should not be premultiplied by
 * A. This is optimized for speed and simplicity and does not optimize for size
 * at all. This doesn't do any compression (all values are stored uncompressed).
 *
 * @param w The width of the input image. Must be ≤100px.
 * @param h The height of the input image. Must be ≤100px.
 * @param rgba The pixels in the input image, row-by-row. Must have w*h*4 elements.
 * @returns A data URL containing a PNG for the input image.
 */
export function rgbaToDataURL(w, h, rgba) {
  const row = w * 4 + 1
  const idat = 6 + h * (5 + row)
  const bytes = [
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    0,
    0,
    0,
    13,
    73,
    72,
    68,
    82,
    0,
    0,
    w >> 8,
    w & 255,
    0,
    0,
    h >> 8,
    h & 255,
    8,
    6,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    idat >>> 24,
    (idat >> 16) & 255,
    (idat >> 8) & 255,
    idat & 255,
    73,
    68,
    65,
    84,
    120,
    1
  ]
  const table = [
    0, 498536548, 997073096, 651767980, 1994146192, 1802195444, 1303535960, 1342533948, -306674912, -267414716,
    -690576408, -882789492, -1687895376, -2032938284, -1609899400, -1111625188
  ]
  let a = 1
  let b = 0
  for (let y = 0, i = 0, end = row - 1; y < h; y++, end += row - 1) {
    bytes.push(y + 1 < h ? 0 : 1, row & 255, row >> 8, ~row & 255, (row >> 8) ^ 255, 0)
    for (b = (b + a) % 65521; i < end; i++) {
      const u = rgba[i] & 255
      bytes.push(u)
      a = (a + u) % 65521
      b = (b + a) % 65521
    }
  }
  bytes.push(b >> 8, b & 255, a >> 8, a & 255, 0, 0, 0, 0, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130)
  for (let [start, end] of [
    [12, 29],
    [37, 41 + idat]
  ]) {
    let c = ~0
    for (let i = start; i < end; i++) {
      c ^= bytes[i]
      c = (c >>> 4) ^ table[c & 15]
      c = (c >>> 4) ^ table[c & 15]
    }
    c = ~c
    bytes[end++] = c >>> 24
    bytes[end++] = (c >> 16) & 255
    bytes[end++] = (c >> 8) & 255
    bytes[end++] = c & 255
  }
  return 'data:image/png;base64,' + btoa(String.fromCharCode(...bytes))
}

/**
 * Decodes a ThumbHash to a PNG data URL. This is a convenience function that
 * just calls "thumbHashToRGBA" followed by "rgbaToDataURL".
 *
 * @param hash The bytes of the ThumbHash.
 * @returns A data URL containing a PNG for the rendered ThumbHash.
 */
export function thumbHashToDataURL(hash) {
  const image = thumbHashToRGBA(hash)
  return rgbaToDataURL(image.w, image.h, image.rgba)
}
