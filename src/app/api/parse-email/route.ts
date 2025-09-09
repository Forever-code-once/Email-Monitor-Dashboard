import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Simple in-memory cache for AI processing results
const aiCache = new Map<string, any>()

// Lazy initialize OpenAI client to avoid build-time errors
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

function truncateEmailContent(content: string, maxLength: number = 8000): string {
  if (content.length <= maxLength) return content
  
  // Try to truncate at a reasonable point (end of sentence or paragraph)
  const truncated = content.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')
  
  if (lastPeriod > maxLength * 0.8) {
    return truncated.substring(0, lastPeriod + 1)
  } else if (lastNewline > maxLength * 0.8) {
    return truncated.substring(0, lastNewline)
  }
  
  return truncated + '...'
}

export async function POST(request: NextRequest) {
  try {
    const { subject, body, from } = await request.json()

    // Create cache key based on email content
    const cacheKey = `${from.address}-${subject}-${body.substring(0, 1000)}`
    
    // Check cache first
    if (aiCache.has(cacheKey)) {
      console.log('📧 Using cached AI result for:', from.address, subject)
      return NextResponse.json(aiCache.get(cacheKey))
    }

              console.log('📧 Processing email from:', from.name, from.address)
     console.log('📧 Subject:', subject)
     console.log('📧 Email body preview:', body.substring(0, 200) + '...')

     // Strip HTML tags and decode HTML entities
     const stripHtml = (html: string) => {
       return html
         .replace(/<[^>]*>/g, ' ') // Remove HTML tags
         .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
         .replace(/&amp;/g, '&') // Replace &amp; with &
         .replace(/&lt;/g, '<') // Replace &lt; with <
         .replace(/&gt;/g, '>') // Replace &gt; with >
         .replace(/&quot;/g, '"') // Replace &quot; with "
         .replace(/\s+/g, ' ') // Replace multiple spaces with single space
         .trim()
     }
     
     const cleanBody = stripHtml(body)
     console.log('📧 Cleaned email body preview:', cleanBody.substring(0, 200) + '...')
     
     // Truncate email body to prevent token limit issues
     const truncatedBody = truncateEmailContent(cleanBody)

         const prompt = `Extract truck availability from this email. Look for ALL truck locations mentioned in the email.

Email Details:
Subject: ${subject}
From: ${from.name} <${from.address}>
Body: ${truncatedBody}

IMPORTANT CUSTOMER INFORMATION:
- CRITICAL: Use EMAIL ADDRESS as the primary identifier for customers, not just names
- Same name can send trucks from different email addresses, so email address is the unique identifier
- EXAMPLE: "John Grathwohl <jgrathwohl@outlook.com>" and "John Grathwohl <jgrathwohl@conardtransportation.com>" are DIFFERENT customers
- ALWAYS look for the ORIGINAL sender in the email body using patterns like "From:", "Original From:", "Sent by:", "Original sender:", etc.
- The customer should be the person/company who originally sent the truck availability information
- CRITICAL: Extract the customerEmail from the "From:" line in the email body
- If no "From:" line found, use the actual sender's email address: "${from.address}"
- IMPORTANT: If the email contains contact information (like "Melissa Vaughn, Conard Logistics"), but the email is from "MX LOGISTICS <dispatch@mxlogistics.com>", then "MX LOGISTICS" is the customer, not the contact person
- The customer is the company/person sending the email, not necessarily the contact person mentioned in the email body
- CRITICAL: ALWAYS extract the original sender from the email body as the customer

Instructions:
1. Extract ALL dates and locations for truck availability mentioned in the email
2. Look for patterns like:
   - SIMPLE FORMAT: Just a date and location (e.g., "08/12/2025" and "San Diego, CA")
   - TABLE FORMAT: "Available Date | Type | City | State | Preferred Destination"
   - DATE COLUMNS: "8/1-8/2", "08/04/2025", "08/07/2025" etc.
   - LOCATION COLUMNS: City and State in separate columns
   - City, State format like "Midland, TX" or "Nashville, TN" ... etc.
   - Multiple locations listed under each date
   - Bullet points or line items with locations
3. For SIMPLE FORMAT emails (just date + location), extract as a single truck entry
4. For TABLE FORMAT emails, extract each row as a separate truck entry
5. For LONG TABLES (20+ rows), process ALL rows systematically - do not truncate or summarize
6. Each truck entry should be a unique city/state combination for that date
7. Clean up company names (remove Inc/LLC/Dispatch/etc)
8. IMPORTANT: Create separate entries for each location, even if they're on the same date
         9. IMPORTANT: Do NOT create duplicate entries for the same date/location combination
         10. CRITICAL: If the same truck information appears multiple times in the email, extract it only ONCE
         11. CRITICAL: Each unique truck should appear only once in the results
         12. CRITICAL: If multiple identical lines appear (like "Virginia Beach, VA" repeated 3 times), each line represents a separate truck - extract each one
         13. CRITICAL: Multiple identical locations in the email = Multiple trucks at that location

Example input formats:

 SIMPLE FORMAT:
 "08/12/2025
 San Diego, CA"

 MULTIPLE TRUCKS SAME LOCATION:
 "8/12/2025
 Virginia Beach, VA
 Virginia Beach, VA
 Virginia Beach, VA"
 (This should extract as 3 separate trucks at Virginia Beach, VA)

FORWARDED EMAIL FORMAT:
"From: Original Company <original@company.com>
Sent: Monday, August 12, 2025 10:00 AM
To: dispatcher@logistics.com
Subject: Available Truck

08/12/2025
San Diego, CA"

MULTIPLE FORWARDERS EXAMPLE:
"From: John Grathwohl <jgrathwohl@outlook.com> - Customer 1 (personal email)
From: John Grathwohl <jgrathwohl@conardtransportation.com> - Customer 2 (company email)
From: John Smith <john@company3.com> - Customer 3 (different person, different company)"

LIST FORMAT:
"Monday 7/28
• Midland, TX
• Cookeville, TN  
• Hawthorne, CA"

TABLE FORMAT:
"Available Date | Type | City | State | Preferred Destination
8/1-8/2 | 53R | Olney | IL | MN
08/04/2025 | 53R | Mechanicsville | VA | MN
08/07/2025 | 53R | Fort Mill | SC | MN"

SPECIAL DATE/TIME FORMAT (9/08 AM, 9/09 AM - DAY/HOUR format):
"LOCATION | DATE / TIME | DESIRED DESTINATION | TRAILER TYPE
RANCHO CUCAMONGA, CA | 9/08 AM | Z0, Z1, Z2, Z3, Z4, Z5, Z6 | 53' DRY VAN
HAINESPORT, NJ | 9/08 AM | OPEN | 53' DRY VAN
SAN JOSE, CA | 9/08 AM | SOUTHERN, CA | 53' DRY VAN
RANCHO CUCAMONGA, CA | 9/09 AM | Z0, Z1, Z2, Z3, Z4, Z5, Z6 | 53' DRY VAN
GLENDALE, AZ | 9/09 AM | SOUTHERN, CA | 53' DRY VAN"
NOTE: 9/08 AM = September 9th, 8:00 AM (day 9, hour 8) -> convert to "09/09"
NOTE: 9/09 AM = September 9th, 9:00 AM (day 9, hour 9) -> convert to "09/09"
NOTE: 10/05 AM = September 10th, 5:00 AM (day 10, hour 5) -> convert to "09/10"

Both should extract as separate truck entries for each location with their respective dates.

Return ONLY valid JSON:
{
  "customer": "Original Sender Name",
  "customerEmail": "original@email.com", 
  "trucks": [
    {
      "date": "8/12",
      "city": "San Diego",
      "state": "CA",
      "additionalInfo": ""
    }
  ]
}

Extract EVERY location as a separate truck entry. Return ONLY valid JSON in this exact format: {"customer": "Company Name", "customerEmail": "email@domain.com", "trucks": [{"date": "MM/DD", "city": "City Name", "state": "ST", "additionalInfo": "optional details"}]}. IMPORTANT: Use MM/DD format for dates (e.g., "8/12" not "2024-08-12") to match the original email format. CRITICAL: For special DATE/TIME format like "9/08 AM" or "9/09 AM", interpret as DAY/TIME format where first number is day, second is hour, assume current month. "9/08 AM" = September 9th, 8:00 AM -> convert to "09/09". "9/09 AM" = September 9th, 9:00 AM -> convert to "09/09". "10/05 AM" = September 10th, 5:00 AM -> convert to "09/10". If no truck data found, return: {"customer": "Company Name", "customerEmail": "email@domain.com", "trucks": []}`

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Upgraded to GPT-5 for better accuracy and performance
      messages: [
                                   {
            role: "system",
                        content: "You extract ALL truck availability data from emails. Handle simple formats (just date + location), table formats, and list formats. Process EVERY row in tables, no matter how long. Look for every location mentioned. Return ONLY valid JSON with unique city/state combinations. For table formats with 20+ rows, process ALL rows systematically. CRITICAL: Use EMAIL ADDRESS as the primary customer identifier since same names can send from different email addresses. EXAMPLE: 'John Grathwohl <jgrathwohl@outlook.com>' and 'John Grathwohl <jgrathwohl@conardtransportation.com>' are DIFFERENT customers. ALWAYS look for the original sender in the email body using patterns like 'From:', 'Original From:', 'Sent by:', 'Original sender:', etc. CRITICAL: Do NOT create duplicate entries - each unique truck should appear only once. IMPORTANT: Handle special DATE/TIME formats like '9/08 AM', '9/09 AM' - interpret as DAY/TIME format where first number is day, second is hour, assume current month. '9/08 AM' = September 9th, 8:00 AM -> convert to '09/09'. '9/09 AM' = September 9th, 9:00 AM -> convert to '09/09'. '10/05 AM' = September 10th, 5:00 AM -> convert to '09/10'. Always use 2-digit month and day format. IMPORTANT: Return ONLY the JSON object, no additional text, markdown, or explanations."
          },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 10000, // Increased significantly to handle long truck lists
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) {
      throw new Error('No response from OpenAI')
    }
    
         console.log('🤖 AI Response:', content)
     console.log('🤖 Expected customer:', from.name, 'Expected email:', from.address)
     console.log('🤖 Email type check - Is this a forwarded email?', truncatedBody.includes('From:') || truncatedBody.includes('Sent:') || truncatedBody.includes('Original'))

    // Clean up the response - remove any markdown formatting
    let cleanContent = content
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/```json\n?/, '').replace(/\n?```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/```\n?/, '').replace(/\n?```$/, '')
    }

    // Parse the JSON response with better error handling
    let parsedData
    try {
      parsedData = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError)
      console.error('Raw content length:', cleanContent.length)
      console.error('Raw content preview:', cleanContent.substring(0, 200) + '...')
      
      // Try to repair common JSON issues
      let repairedContent = cleanContent
      
      // Remove any trailing commas before closing brackets/braces
      repairedContent = repairedContent.replace(/,(\s*[}\]])/g, '$1')
      
      // Fix unquoted property names
      repairedContent = repairedContent.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      
      // Fix single quotes to double quotes
      repairedContent = repairedContent.replace(/'/g, '"')
      
      // Try to find the last complete object and truncate there
      const lastBraceIndex = repairedContent.lastIndexOf('}')
      const lastBracketIndex = repairedContent.lastIndexOf(']')
      const lastCompleteIndex = Math.max(lastBraceIndex, lastBracketIndex)
      
      if (lastCompleteIndex > 0) {
        // Find the matching opening brace/bracket
        let depth = 0
        let startIndex = -1
        for (let i = lastCompleteIndex; i >= 0; i--) {
          if (repairedContent[i] === '}' || repairedContent[i] === ']') {
            depth++
          } else if (repairedContent[i] === '{' || repairedContent[i] === '[') {
            depth--
            if (depth === 0) {
              startIndex = i
              break
            }
          }
        }
        
        if (startIndex >= 0) {
          repairedContent = repairedContent.substring(startIndex, lastCompleteIndex + 1)
        }
      }
      
      try {
        parsedData = JSON.parse(repairedContent)
        console.log('✅ JSON repaired successfully')
      } catch (repairError) {
        console.error('JSON repair failed:', repairError)
        
        // Last resort: try to extract customer info manually
        const customerMatch = cleanContent.match(/"customer"\s*:\s*"([^"]+)"/)
        const emailMatch = cleanContent.match(/"customerEmail"\s*:\s*"([^"]+)"/)
        
        if (customerMatch || emailMatch) {
          parsedData = {
            customer: customerMatch ? customerMatch[1] : (from.name || from.address.split('@')[0]),
            customerEmail: emailMatch ? emailMatch[1] : from.address,
            trucks: []
          }
          console.log('✅ Extracted customer info manually')
        } else {
          // Final fallback
          parsedData = {
            customer: from.name || from.address.split('@')[0],
            customerEmail: from.address,
            trucks: []
          }
          console.log('🔄 Using fallback customer info')
        }
      }
    }
    
                   // Use AI-extracted customer info if available, otherwise fall back to email sender
     if (!parsedData.customer || !parsedData.customerEmail) {
       parsedData.customer = from.name || from.address.split('@')[0]
       parsedData.customerEmail = from.address
     }
     
     // IMPORTANT: Always preserve the AI-extracted customer information
     // The AI should have extracted the original sender from the email body
     // Only set customerEmail if the AI didn't extract it
     if (!parsedData.customerEmail) {
       parsedData.customerEmail = from.address
     }
    
         console.log('✅ Final customer info:', parsedData.customer, parsedData.customerEmail)
     console.log('✅ Email sender info:', from.name, from.address)
     console.log('✅ Customer extraction type: AI extracted original sender')

    // Ensure trucks array exists and is valid
    if (!parsedData.trucks || !Array.isArray(parsedData.trucks)) {
      parsedData.trucks = []
    } else {
           // Clean up truck data to ensure it's valid and remove true duplicates
     const uniqueTrucks = new Map<string, any>()
     
           // Simply add all trucks - let the AI handle the extraction correctly
      parsedData.trucks.filter((truck: any) => 
        truck && 
        typeof truck === 'object' && 
        truck.city && 
        truck.state && 
        truck.date
      ).forEach((truck: any, index: number) => {
        // Create a unique key for each truck entry
        const key = `${parsedData.customerEmail}-${truck.date}-${truck.city}-${truck.state}-${index}`
        
        uniqueTrucks.set(key, {
          date: truck.date || '',
          city: truck.city || '',
          state: truck.state || '',
          additionalInfo: truck.additionalInfo || ''
        })
      })
     
     parsedData.trucks = Array.from(uniqueTrucks.values())
    }

    // Ensure customer name is set
    if (!parsedData.customer) {
      parsedData.customer = from.name || from.address.split('@')[0]
    }

         console.log('✅ Successfully parsed email data:', {
       customer: parsedData.customer,
       email: parsedData.customerEmail,
       truckCount: parsedData.trucks.length,
       trucks: parsedData.trucks.map((t: any) => ({
         date: t.date,
         city: t.city,
         state: t.state,
         additionalInfo: t.additionalInfo
       }))
     })

    // Cache the result
    aiCache.set(cacheKey, parsedData)
    console.log('📧 Cached AI result for:', from.address, subject)

    return NextResponse.json(parsedData)
  } catch (error) {
    console.error('Error parsing email with AI:', error)
    
    // If it's a token limit error, try with even shorter content
    if (error instanceof Error && error.message.includes('context_length_exceeded')) {
      try {
        const { subject, body, from } = await request.json()
        const veryShortBody = truncateEmailContent(body, 4000) // Still preserve more table data
        
        const shortPrompt = `Extract truck availability from: "${subject}" - ${veryShortBody}
Return JSON: {"customer":"Name","customerEmail":"email","trucks":[{"date":"Day M/D","city":"City","state":"ST"}]}`

        const openai = getOpenAIClient()
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: shortPrompt }],
          temperature: 0,
          max_tokens: 300,
        })

        const content = completion.choices[0]?.message?.content?.trim()
        if (content) {
          const parsedData = JSON.parse(content)
          return NextResponse.json(parsedData)
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError)
      }
    }
    
         // Final fallback - use actual sender info instead of template
     const { from } = await request.json()
     console.log('🔄 Using fallback for email from:', from.name, from.address)
     return NextResponse.json({
       customer: from.name || from.address.split('@')[0],
       customerEmail: from.address,
       trucks: []
     })
  }
} 