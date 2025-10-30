import sharp from 'sharp'

export interface ExtractedColor {
  hex: string
  rgb: [number, number, number]
  population: number
  isDark: boolean
  name: string
}

/**
 * Check if a color is dark enough for white text to be readable on it.
 * Uses WCAG contrast ratio guidelines (AA standard requires 4.5:1 for normal text)
 */
export function isDarkEnough(hex: string): boolean {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Dark enough if luminance < 0.5 (roughly means contrast ratio > 4.5:1 with white)
  return luminance < 0.5
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * Extract dominant colors from an image buffer using Sharp
 */
export async function extractColorsFromImage(imageBuffer: Buffer): Promise<ExtractedColor[]> {
  // Use Sharp to get dominant colors via stats
  const image = sharp(imageBuffer)
  const { dominant, channels } = await image.stats()

  const colors: ExtractedColor[] = []

  // Add the dominant color
  if (dominant) {
    const hex = rgbToHex(dominant.r, dominant.g, dominant.b)
    colors.push({
      hex,
      rgb: [dominant.r, dominant.g, dominant.b],
      population: 100,
      isDark: isDarkEnough(hex),
      name: 'Dominant',
    })
  }

  // Extract colors from channel means (approximation of palette)
  if (channels) {
    const meanColor = rgbToHex(
      channels[0]?.mean || 0,
      channels[1]?.mean || 0,
      channels[2]?.mean || 0
    )

    if (meanColor !== colors[0]?.hex) {
      colors.push({
        hex: meanColor,
        rgb: [
          Math.round(channels[0]?.mean || 0),
          Math.round(channels[1]?.mean || 0),
          Math.round(channels[2]?.mean || 0),
        ],
        population: 80,
        isDark: isDarkEnough(meanColor),
        name: 'Average',
      })
    }
  }

  // Create darker and lighter variations
  if (colors.length > 0) {
    const baseColor = colors[0]

    // Darker variant (multiply by 0.7)
    const darkerHex = rgbToHex(
      baseColor.rgb[0] * 0.7,
      baseColor.rgb[1] * 0.7,
      baseColor.rgb[2] * 0.7
    )
    colors.push({
      hex: darkerHex,
      rgb: [
        Math.round(baseColor.rgb[0] * 0.7),
        Math.round(baseColor.rgb[1] * 0.7),
        Math.round(baseColor.rgb[2] * 0.7),
      ],
      population: 60,
      isDark: isDarkEnough(darkerHex),
      name: 'Dark',
    })

    // Lighter variant (mix with white)
    const lighterHex = rgbToHex(
      baseColor.rgb[0] * 0.7 + 255 * 0.3,
      baseColor.rgb[1] * 0.7 + 255 * 0.3,
      baseColor.rgb[2] * 0.7 + 255 * 0.3
    )
    colors.push({
      hex: lighterHex,
      rgb: [
        Math.round(baseColor.rgb[0] * 0.7 + 255 * 0.3),
        Math.round(baseColor.rgb[1] * 0.7 + 255 * 0.3),
        Math.round(baseColor.rgb[2] * 0.7 + 255 * 0.3),
      ],
      population: 40,
      isDark: isDarkEnough(lighterHex),
      name: 'Light',
    })
  }

  // Sort by isDark first (dark colors first), then by population
  colors.sort((a, b) => {
    if (a.isDark && !b.isDark) return -1
    if (!a.isDark && b.isDark) return 1
    return b.population - a.population
  })

  // Remove duplicates
  const uniqueColors = colors.filter((color, index, self) =>
    index === self.findIndex(c => c.hex === color.hex)
  )

  return uniqueColors
}

/**
 * Get the best color for branding (darkest acceptable color, or fallback)
 */
export function getBestBrandColor(colors: ExtractedColor[], fallback = '#1E40AF'): string {
  const darkColor = colors.find(c => c.isDark)
  return darkColor ? darkColor.hex : fallback
}
