interface IRGB {
  r: number
  g: number
  b: number
}

function hexToRgb(hex: string): IRGB {
  hex = hex.replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('')
  }
  const bigint = parseInt(hex, 16)
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
}

function blendColors(color1: IRGB, color2: IRGB, opacity: number) {
  const blended = {
    r: Math.round(color1.r * (1 - opacity) + color2.r * opacity),
    g: Math.round(color1.g * (1 - opacity) + color2.g * opacity),
    b: Math.round(color1.b * (1 - opacity) + color2.b * opacity)
  }
  return rgbToHex(blended.r, blended.g, blended.b)
}

export const moderateColor = (hexColor: string, transparency: number) => {
  const originalColor = hexToRgb(hexColor)
  const whiteColor = { r: 255, g: 255, b: 255 } // Using white as the background
  return blendColors(originalColor, whiteColor, transparency)
}
