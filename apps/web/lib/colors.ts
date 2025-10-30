import * as Vibrant from 'node-vibrant'

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
 * Extract dominant colors from an image buffer
 */
export async function extractColorsFromImage(imageBuffer: Buffer): Promise<ExtractedColor[]> {
  const palette = await Vibrant.from(imageBuffer).getPalette()

  const colors: ExtractedColor[] = []

  // Extract all available swatches
  const swatchNames: Array<keyof typeof palette> = [
    'Vibrant',
    'DarkVibrant',
    'LightVibrant',
    'Muted',
    'DarkMuted',
    'LightMuted',
  ]

  for (const swatchName of swatchNames) {
    const swatch = palette[swatchName]
    if (swatch) {
      const hex = swatch.getHex()
      const rgb = swatch.getRgb()
      colors.push({
        hex,
        rgb: rgb as [number, number, number],
        population: swatch.getPopulation(),
        isDark: isDarkEnough(hex),
        name: swatchName,
      })
    }
  }

  // Sort by population (most common first), but prioritize dark colors
  colors.sort((a, b) => {
    // Heavily favor dark colors
    if (a.isDark && !b.isDark) return -1
    if (!a.isDark && b.isDark) return 1

    // Then sort by population
    return b.population - a.population
  })

  return colors
}

/**
 * Get the best color for branding (darkest acceptable color, or fallback)
 */
export function getBestBrandColor(colors: ExtractedColor[], fallback = '#1E40AF'): string {
  const darkColor = colors.find(c => c.isDark)
  return darkColor ? darkColor.hex : fallback
}
