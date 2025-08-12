import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

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

    // Truncate email body to prevent token limit issues
    const truncatedBody = truncateEmailContent(body)

         const prompt = `Extract truck availability from this email. Look for ALL truck locations mentioned in the email.

Email Details:
Subject: ${subject}
From: ${from.name} <${from.address}>
Body: ${truncatedBody}

Instructions:
1. If forwarded, find the ORIGINAL sender (customer) in the forwarding chain
2. Extract ALL dates and locations for truck availability mentioned in the email
3. Look for patterns like:
   - TABLE FORMAT: "Available Date | Type | City | State | Preferred Destination"
   - DATE COLUMNS: "8/1-8/2", "08/04/2025", "08/07/2025" etc.
   - LOCATION COLUMNS: City and State in separate columns
   - City, State format like "Midland, TX" or "Nashville, TN" ... etc.
   - Multiple locations listed under each date
   - Bullet points or line items with locations
4. For TABLE FORMAT emails, extract each row as a separate truck entry
5. For LONG TABLES (20+ rows), process ALL rows systematically - do not truncate or summarize
6. Each truck entry should be a unique city/state combination for that date
7. Clean up company names (remove Inc/LLC/Dispatch/etc)
8. IMPORTANT: Create separate entries for each location, even if they're on the same date

Example input formats:

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

Both should extract as separate truck entries for each location with their respective dates.

Return ONLY valid JSON:
{
  "customer": "DAGG",
  "customerEmail": "dispatchcw@dagetttruck.com", 
  "trucks": [
    {
      "date": "8/1-8/2",
      "city": "Olney",
      "state": "IL",
      "additionalInfo": "53R to MN"
    },
    {
      "date": "8/4", 
      "city": "Mechanicsville",
      "state": "VA",
      "additionalInfo": "53R to MN"
    },
    {
      "date": "8/7",
      "city": "Fort Mill", 
      "state": "SC",
      "additionalInfo": "53R to MN"
    }
  ]
}

Extract EVERY location as a separate truck entry. Return ONLY valid JSON in this exact format: {"customer": "Company Name", "customerEmail": "email@domain.com", "trucks": [{"date": "MM/DD", "city": "City Name", "state": "ST", "additionalInfo": "optional details"}]}. IMPORTANT: Use MM/DD format for dates (e.g., "8/12" not "2024-08-12") to match the original email format. If no truck data found, return: {"customer": "Company Name", "customerEmail": "email@domain.com", "trucks": []}`

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Better at handling long structured data
      messages: [
        {
          role: "system",
          content: "You extract ALL truck availability data from emails. Process EVERY row in tables, no matter how long. Look for every location mentioned. Return ONLY valid JSON with unique city/state combinations. For table formats with 20+ rows, process ALL rows systematically. For forwarded emails, identify the original sender as the customer. IMPORTANT: Return ONLY the JSON object, no additional text, markdown, or explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 10000, // Increased significantly to handle long truck lists
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) {
      throw new Error('No response from OpenAI')
    }

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
    
    // Ensure customerEmail is set - fallback to from address if needed
    if (!parsedData.customerEmail) {
      parsedData.customerEmail = from.address
    }

    // Ensure trucks array exists and is valid
    if (!parsedData.trucks || !Array.isArray(parsedData.trucks)) {
      parsedData.trucks = []
    } else {
      // Clean up truck data to ensure it's valid
      parsedData.trucks = parsedData.trucks.filter((truck: any) => 
        truck && 
        typeof truck === 'object' && 
        truck.city && 
        truck.state && 
        truck.date
      ).map((truck: any) => ({
        date: truck.date || '',
        city: truck.city || '',
        state: truck.state || '',
        additionalInfo: truck.additionalInfo || ''
      }))
    }

    // Ensure customer name is set
    if (!parsedData.customer) {
      parsedData.customer = from.name || from.address.split('@')[0]
    }

    console.log('✅ Successfully parsed email data:', {
      customer: parsedData.customer,
      email: parsedData.customerEmail,
      truckCount: parsedData.trucks.length
    })

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
          temperature: 0.1,
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