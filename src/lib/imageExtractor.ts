/**
 * Image Extractor for Email Attachments
 * Extracts images from email body and attachments
 */

export interface EmailImage {
  contentType: string
  contentBytes: string  // base64 encoded
  filename?: string
  isInline: boolean
  contentId?: string
  size: number
}

/**
 * Extract inline images from HTML email body
 */
export function extractInlineImages(htmlBody: string): EmailImage[] {
  const images: EmailImage[] = []
  
  // Pattern 1: <img src="data:image/...;base64,..." />
  const base64Pattern = /<img[^>]+src=["']data:image\/([^;]+);base64,([^"']+)["'][^>]*>/gi
  const base64Matches = htmlBody.matchAll(base64Pattern)
  
  for (const match of Array.from(base64Matches)) {
    const contentType = `image/${match[1]}`
    const contentBytes = match[2]
    
    images.push({
      contentType,
      contentBytes,
      isInline: true,
      size: contentBytes.length
    })
  }
  
  // Pattern 2: <img src="cid:..." /> with embedded images
  // Note: These need to be matched with email attachments
  const cidPattern = /<img[^>]+src=["']cid:([^"']+)["'][^>]*>/gi
  const cidMatches = htmlBody.matchAll(cidPattern)
  
  for (const match of Array.from(cidMatches)) {
    const contentId = match[1]
    // Store CID reference - will be matched with attachments
    images.push({
      contentType: 'image/unknown',
      contentBytes: '',
      contentId,
      isInline: true,
      size: 0
    })
  }
  
  return images
}

/**
 * Check if email has images
 */
export function hasImages(email: any): boolean {
  // Check for inline base64 images
  if (email.body?.content) {
    const hasBase64Images = /<img[^>]+src=["']data:image\/[^"']+["']/i.test(email.body.content)
    if (hasBase64Images) return true
  }
  
  // Check for image attachments
  if (email.attachments && Array.isArray(email.attachments)) {
    return email.attachments.some((att: any) => 
      att.contentType?.startsWith('image/')
    )
  }
  
  // Check for embedded images (hasAttachments flag)
  if (email.hasAttachments) return true
  
  return false
}

/**
 * Extract images from Microsoft Graph email object
 */
export function extractImagesFromEmail(email: any): EmailImage[] {
  const images: EmailImage[] = []
  
  // Extract inline images from HTML body
  if (email.body?.content) {
    const inlineImages = extractInlineImages(email.body.content)
    images.push(...inlineImages)
  }
  
  // Extract image attachments
  if (email.attachments && Array.isArray(email.attachments)) {
    for (const attachment of email.attachments) {
      if (attachment.contentType?.startsWith('image/')) {
        images.push({
          contentType: attachment.contentType,
          contentBytes: attachment.contentBytes || '',
          filename: attachment.name,
          isInline: attachment.isInline || false,
          contentId: attachment.contentId,
          size: attachment.size || 0
        })
      }
    }
  }
  
  return images
}

/**
 * Validate image for processing
 */
export function isValidImage(image: EmailImage): boolean {
  // Must have content
  if (!image.contentBytes || image.contentBytes.length === 0) {
    return false
  }
  
  // Must be a supported image type
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!supportedTypes.some(type => image.contentType.includes(type))) {
    return false
  }
  
  // Check size (max 20MB for OpenAI)
  const sizeInMB = (image.contentBytes.length * 0.75) / (1024 * 1024) // base64 to bytes
  if (sizeInMB > 20) {
    console.warn(`Image too large: ${sizeInMB.toFixed(2)}MB (max 20MB)`)
    return false
  }
  
  return true
}

/**
 * Format image for OpenAI Vision API
 */
export function formatImageForVision(image: EmailImage): string {
  // Ensure proper data URI format
  if (image.contentBytes.startsWith('data:')) {
    return image.contentBytes
  }
  
  return `data:${image.contentType};base64,${image.contentBytes}`
}

/**
 * Get image statistics
 */
export function getImageStats(images: EmailImage[]): {
  total: number
  inline: number
  attachments: number
  validForVision: number
  totalSizeMB: number
} {
  const inline = images.filter(img => img.isInline).length
  const attachments = images.filter(img => !img.isInline).length
  const validForVision = images.filter(img => isValidImage(img)).length
  
  const totalSizeBytes = images.reduce((sum, img) => {
    // base64 string length * 0.75 = approximate byte size
    return sum + (img.contentBytes.length * 0.75)
  }, 0)
  const totalSizeMB = totalSizeBytes / (1024 * 1024)
  
  return {
    total: images.length,
    inline,
    attachments,
    validForVision,
    totalSizeMB
  }
}

