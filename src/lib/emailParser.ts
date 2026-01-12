import { ParsedEmailData, EmailMessage } from '@/types'
import { hasImages, extractImagesFromEmail } from '@/lib/imageExtractor'

export async function parseEmailWithAI(email: EmailMessage): Promise<ParsedEmailData[]> {
  try {
    // Check if email has images
    const emailHasImages = hasImages(email)
    
    if (emailHasImages) {
      console.log('🖼️  Email contains images, using vision parser...')
      
      // Extract images from email
      const images = extractImagesFromEmail(email)
      
      // Try vision parser first
      try {
        const visionResponse = await fetch('/api/parse-email-vision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: email.subject,
            body: email.body.content,
            from: email.from.emailAddress,
            receivedDateTime: email.receivedDateTime,
            images: images,
            attachments: (email as any).attachments || []
          }),
        })
        
        if (visionResponse.ok) {
          const visionData = await visionResponse.json()
          
          // If vision parser found trucks, use it
          if (visionData.trucks && visionData.trucks.length > 0) {
            console.log(`✅ Vision parser extracted ${visionData.trucks.length} trucks`)
            return Array.isArray(visionData) ? visionData : [visionData]
          }
          
          console.log('⚠️  Vision parser found no trucks, falling back to text parser')
        }
      } catch (visionError) {
        console.warn('Vision parser failed, falling back to text parser:', visionError)
      }
    }
    
    // Use hybrid parser for text-based parsing
    console.log('📝 Using hybrid text parser...')
    const response = await fetch('/api/parse-email-hybrid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: email.subject,
        body: email.body.content,
        from: email.from.emailAddress,
        receivedDateTime: email.receivedDateTime,
      }),
    })

    if (!response.ok) {
      console.warn('Hybrid parser failed, falling back to standard parser')
      
      // Fallback to standard parser
      const fallbackResponse = await fetch('/api/parse-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: email.subject,
          body: email.body.content,
          from: email.from.emailAddress,
          receivedDateTime: email.receivedDateTime,
        }),
      })
      
      if (!fallbackResponse.ok) {
        throw new Error('All parsers failed')
      }
      
      const fallbackData = await fallbackResponse.json()
      return Array.isArray(fallbackData) ? fallbackData : [fallbackData]
    }

    const parsedData = await response.json()
    
    // Log validation results if available
    if (parsedData.validation) {
      console.log('📊 Validation Results:', parsedData.validation)
      if (parsedData.validation.needsReview > 0) {
        console.warn(`⚠️ ${parsedData.validation.needsReview} trucks need manual review`)
      }
    }
    
    // Handle single customer response - convert to array
    if (parsedData && !Array.isArray(parsedData)) {
      return [parsedData]
    }
    
    // Handle array response
    return Array.isArray(parsedData) ? parsedData : []
  } catch (error) {
    console.error('Error parsing email:', error)
    return []
  }
}

export function stripHtmlTags(html: string): string {
  // Remove HTML tags and decode HTML entities
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace encoded ampersands
    .replace(/&lt;/g, '<') // Replace encoded less than
    .replace(/&gt;/g, '>') // Replace encoded greater than
    .replace(/&quot;/g, '"') // Replace encoded quotes
    .replace(/&#39;/g, "'") // Replace encoded apostrophes
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim()
}

export function extractCustomerName(fromAddress: { address: string; name: string }): string {
  // Extract customer name from email sender
  if (fromAddress.name && fromAddress.name.trim()) {
    // Remove common email suffixes and clean up
    return fromAddress.name
      .replace(/\s+(dispatch|inc|llc|corp|company|carriers|trucking)/gi, '')
      .trim()
  }
  
  // Fallback to domain name
  const domain = fromAddress.address.split('@')[1]
  return domain.split('.')[0].toUpperCase()
}

export function extractOriginalSenderFromForwardedEmail(emailBody: string): { name: string; email: string } | null {
  // Clean HTML first
  const cleanBody = stripHtmlTags(emailBody)
  
  // Look for forwarded email patterns
  const forwardedPatterns = [
    /From:\s*([^<\r\n]+)<([^>\r\n]+)>/gi, // From: Name <email@domain.com>
    /From:\s*([^\r\n<]+)[\r\n]/gi, // From: Name or email
    /Original Message[\s\S]*?From:\s*([^<\r\n]+)<([^>\r\n]+)>/gi, // Original message forwarding
    /-----Original Message-----[\s\S]*?From:\s*([^<\r\n]+)<([^>\r\n]+)>/gi, // Outlook style
  ]

  for (const pattern of forwardedPatterns) {
    const matches = Array.from(cleanBody.matchAll(pattern))
    if (matches.length > 0) {
      // Get the last match (original sender at bottom of chain)
      const lastMatch = matches[matches.length - 1]
      if (lastMatch[2]) {
        // Has email in angle brackets
        return {
          name: lastMatch[1].trim(),
          email: lastMatch[2].trim()
        }
      } else if (lastMatch[1]) {
        // Check if the name contains an email
        const emailMatch = lastMatch[1].match(/([^\s]+@[^\s]+)/gi)
        if (emailMatch) {
          return {
            name: lastMatch[1].replace(emailMatch[0], '').trim(),
            email: emailMatch[0]
          }
        }
      }
    }
  }

  return null
}

export function isForwardedEmail(emailBody: string): boolean {
  const cleanBody = stripHtmlTags(emailBody)
  
  const forwardedIndicators = [
    /forwarded message/gi,
    /original message/gi,
    /from:\s*[^@]+@[^@]+/gi,
    /sent:\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
    /subject:\s*.+/gi,
    /-----original message-----/gi,
    /begin forwarded message/gi
  ]

  return forwardedIndicators.some(pattern => pattern.test(cleanBody))
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

export function generateTruckId(email: EmailMessage, city: string, state: string, date: string): string {
  // Create a more robust unique ID by including normalized values and timestamp
  const normalizedCity = city.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const normalizedState = state.trim().toUpperCase().replace(/[^A-Z]/g, '')
  const normalizedDate = date.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  
  // Add timestamp and random component to ensure uniqueness even for duplicates
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  
  return `${email.id}-${normalizedCity}-${normalizedState}-${normalizedDate}-${timestamp}-${random}`
} 