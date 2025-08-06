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

function truncateEmailContent(content: string, maxLength: number = 3000): string {
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

    const prompt = `Extract truck availability from this email. Look for forwarded email patterns and identify the ORIGINAL sender as the customer.

Email Details:
Subject: ${subject}
From: ${from.name} <${from.address}>
Body: ${truncatedBody}

Instructions:
1. If forwarded, find ORIGINAL sender (customer) in forwarding chain
2. Extract dates and locations for truck availability
3. Clean up company names (remove Inc/LLC/Dispatch/etc)

Return ONLY valid JSON:
{
  "customer": "Company Name",
  "customerEmail": "email@domain.com", 
  "trucks": [
    {
      "date": "Friday 7/25",
      "city": "Gallipolis",
      "state": "OH",
      "additionalInfo": "optional details"
    }
  ]
}

If no truck data found, return: {"customer": "Company Name", "customerEmail": "email@domain.com", "trucks": []}`

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You extract truck availability data from emails. Always return valid JSON. For forwarded emails, identify the original sender as the customer."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 800, // Reduced from 1000
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
      console.error('Raw content:', cleanContent)
      
      // Fallback: try to extract basic info without JSON
      return NextResponse.json({
        customer: from.name || from.address.split('@')[0],
        customerEmail: from.address,
        trucks: []
      })
    }
    
    // Ensure customerEmail is set - fallback to from address if needed
    if (!parsedData.customerEmail) {
      parsedData.customerEmail = from.address
    }

    // Ensure trucks array exists
    if (!parsedData.trucks || !Array.isArray(parsedData.trucks)) {
      parsedData.trucks = []
    }

    return NextResponse.json(parsedData)
  } catch (error) {
    console.error('Error parsing email with AI:', error)
    
    // If it's a token limit error, try with even shorter content
    if (error instanceof Error && error.message.includes('context_length_exceeded')) {
      try {
        const { subject, body, from } = await request.json()
        const veryShortBody = truncateEmailContent(body, 1000) // Much shorter
        
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
    
    // Final fallback
    const { from } = await request.json()
    return NextResponse.json({
      customer: from.name || from.address.split('@')[0],
      customerEmail: from.address,
      trucks: []
    })
  }
} 