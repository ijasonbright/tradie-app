import * as ImageManipulator from 'expo-image-manipulator'

/**
 * Normalizes image orientation by re-saving the image.
 * This effectively "bakes in" the EXIF orientation data into the actual pixels,
 * ensuring the image displays correctly on systems that don't respect EXIF orientation.
 *
 * This fixes the common issue where photos taken on mobile devices appear rotated
 * when uploaded to third-party services like TradieConnect.
 *
 * @param imageUri - The URI of the image to normalize
 * @param quality - JPEG quality (0-1), defaults to 0.8
 * @returns The URI of the normalized image
 */
export async function normalizeImageOrientation(
  imageUri: string,
  quality: number = 0.8
): Promise<string> {
  try {
    // Using ImageManipulator with an empty actions array will still process the image,
    // which decodes it, applies the EXIF orientation, and re-encodes it.
    // This effectively "flattens" the orientation into the actual pixels.
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [], // No transformations needed - just re-encoding normalizes orientation
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
 * @param imageUri - The URI of the image to resize
 * @param maxWidth - Maximum width in pixels
 * @param maxHeight - Maximum height in pixels
 * @param quality - JPEG quality (0-1), defaults to 0.8
 * @returns The URI of the resized image
 */
export async function resizeAndNormalizeImage(
  imageUri: string,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.8
): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: maxWidth, height: maxHeight } }],
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
