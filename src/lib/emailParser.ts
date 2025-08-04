import { ParsedEmailData, EmailMessage } from '@/types'

export async function parseEmailWithAI(email: EmailMessage): Promise<ParsedEmailData | null> {
  try {
    const response = await fetch('/api/parse-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: email.subject,
        body: email.body.content,
        from: email.from.emailAddress,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to parse email')
    }

    const parsedData = await response.json()
    return parsedData
  } catch (error) {
    console.error('Error parsing email:', error)
    return null
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
  return `${email.id}-${city}-${state}-${date}`.replace(/\s+/g, '-')
} 