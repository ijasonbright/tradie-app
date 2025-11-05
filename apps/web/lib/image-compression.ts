import sharp from 'sharp'

/**
 * Configuration for image compression in PDFs
 * Optimized for AWS SES 10MB email limit while maintaining visual quality
 */
export const COMPRESSION_CONFIG = {
  // Maximum dimensions (maintains aspect ratio)
  maxWidth: 1024,
  maxHeight: 1024,

  // JPEG quality settings
  jpegQuality: 75, // Good balance of quality vs size (~60% reduction)
  jpegProgressive: true,

  // PNG compression
  pngQuality: 80,
  pngCompressionLevel: 9,

  // Size thresholds
  largeImageThreshold: 500000, // 500KB - trigger compression
  maxImageSize: 3000000, // 3MB - warn if compression doesn't reduce below this
}

/**
 * Compress an image buffer to reduce PDF file size
 * Resizes to max 1024px and reduces quality for optimal size/quality balance
 *
 * @param imageBuffer - Original image buffer from fetch
 * @param imageUrl - URL for logging purposes
 * @returns Compressed image buffer and format
 */
export async function compressImageBuffer(
  imageBuffer: ArrayBuffer,
  imageUrl: string
): Promise<{ buffer: Buffer; format: 'jpeg' | 'png' }> {
  try {
    const originalSize = imageBuffer.byteLength
    const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2)

    console.log(`[Image Compression] Processing image: ${imageUrl}`)
    console.log(`[Image Compression] Original size: ${originalSizeMB} MB`)

    // Convert ArrayBuffer to Buffer
    const inputBuffer = Buffer.from(imageBuffer)

    // Get image metadata to determine format
    const metadata = await sharp(inputBuffer).metadata()
    const isTransparent = metadata.hasAlpha

    console.log(
      `[Image Compression] Format: ${metadata.format}, Dimensions: ${metadata.width}x${metadata.height}, Alpha: ${isTransparent}`
    )

    // Resize and compress
    let compressedBuffer: Buffer
    let outputFormat: 'jpeg' | 'png'

    if (isTransparent || metadata.format === 'png') {
      // PNG with transparency - preserve alpha channel
      compressedBuffer = await sharp(inputBuffer)
        .resize(COMPRESSION_CONFIG.maxWidth, COMPRESSION_CONFIG.maxHeight, {
          fit: 'inside', // Maintain aspect ratio
          withoutEnlargement: true, // Don't upscale small images
        })
        .png({
          quality: COMPRESSION_CONFIG.pngQuality,
          compressionLevel: COMPRESSION_CONFIG.pngCompressionLevel,
        })
        .toBuffer()
      outputFormat = 'png'
    } else {
      // JPEG compression for photos (better compression ratio)
      compressedBuffer = await sharp(inputBuffer)
        .resize(COMPRESSION_CONFIG.maxWidth, COMPRESSION_CONFIG.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: COMPRESSION_CONFIG.jpegQuality,
          progressive: COMPRESSION_CONFIG.jpegProgressive,
        })
        .toBuffer()
      outputFormat = 'jpeg'
    }

    const compressedSize = compressedBuffer.byteLength
    const compressedSizeMB = (compressedSize / 1024 / 1024).toFixed(2)
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1)

    console.log(`[Image Compression] Compressed size: ${compressedSizeMB} MB`)
    console.log(`[Image Compression] Compression ratio: ${compressionRatio}% reduction`)

    // Warn if compressed image is still very large
    if (compressedSize > COMPRESSION_CONFIG.maxImageSize) {
      console.warn(
        `[Image Compression] WARNING: Compressed image is still large (${compressedSizeMB} MB). PDF may approach size limits.`
      )
    }

    return {
      buffer: compressedBuffer,
      format: outputFormat,
    }
  } catch (error) {
    console.error('[Image Compression] Failed to compress image:', error)
    throw new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Check if an image needs compression based on size threshold
 */
export function shouldCompressImage(size: number): boolean {
  return size > COMPRESSION_CONFIG.largeImageThreshold
}
