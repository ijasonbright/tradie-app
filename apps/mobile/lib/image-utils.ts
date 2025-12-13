import * as ImageManipulator from 'expo-image-manipulator'

/**
 * Normalizes image orientation by applying a 0-degree rotation.
 * This forces the image to be re-rendered with the EXIF orientation
 * baked into the actual pixel data, ensuring the image displays correctly
 * on systems that don't respect EXIF orientation (like TradieConnect).
 *
 * Note: Using an empty actions array doesn't always work reliably on all devices.
 * Applying a 0-degree rotation forces the transformation to be applied.
 *
 * @param imageUri - The URI of the image to normalize
 * @param quality - JPEG quality (0-1), defaults to 0.85
 * @returns The URI of the normalized image
 */
export async function normalizeImageOrientation(
  imageUri: string,
  quality: number = 0.85
): Promise<string> {
  try {
    // Apply a 0-degree rotation to force the image to be re-rendered
    // with correct orientation baked into the pixels.
    // This is more reliable than an empty actions array.
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ rotate: 0 }], // 0-degree rotation forces orientation to be applied
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    )

    console.log('Image orientation normalized:', {
      original: imageUri.substring(imageUri.length - 50),
      normalized: result.uri.substring(result.uri.length - 50),
      width: result.width,
      height: result.height,
    })

    return result.uri
  } catch (error) {
    console.error('Failed to normalize image orientation:', error)
    // If normalization fails, return the original URI
    return imageUri
  }
}

/**
 * Resizes an image while normalizing its orientation.
 * Useful for creating thumbnails or reducing upload size.
 *
 * Uses a 0-degree rotation to force EXIF orientation to be baked into pixels
 * before resizing, ensuring correct orientation on all systems.
 *
 * @param imageUri - The URI of the image to resize
 * @param maxWidth - Maximum width in pixels
 * @param maxHeight - Maximum height in pixels
 * @param quality - JPEG quality (0-1), defaults to 0.85
 * @returns The URI of the resized image
 */
export async function resizeAndNormalizeImage(
  imageUri: string,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.85
): Promise<string> {
  try {
    // First rotate 0 degrees to normalize orientation, then resize
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        { rotate: 0 }, // Force orientation to be applied first
        { resize: { width: maxWidth, height: maxHeight } }
      ],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    )

    console.log('Image resized and normalized:', {
      original: imageUri.substring(imageUri.length - 50),
      resized: result.uri.substring(result.uri.length - 50),
      width: result.width,
      height: result.height,
    })

    return result.uri
  } catch (error) {
    console.error('Failed to resize image:', error)
    return imageUri
  }
}
