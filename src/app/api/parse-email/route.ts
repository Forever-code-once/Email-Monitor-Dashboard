import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { subject, body, from } = await request.json()

    const prompt = `
You are an AI assistant that extracts truck availability information from emails that may be forwarded. 

IMPORTANT: When emails are forwarded to the monitoring inbox, the actual CUSTOMER is the ORIGINAL sender at the bottom of the forwarding chain, NOT the person who forwarded the email.

Given this email:
Subject: ${subject}
From: ${from.name} <${from.address}>
Body: ${body}

Instructions:
1. Look for forwarded email patterns (lines starting with "From:", "Sent:", forwarding headers)
2. If this is a forwarded email, find the ORIGINAL sender (customer) at the bottom of the forwarding chain
3. The customer name should be extracted from the ORIGINAL sender, not the forwarder
4. Extract truck availability information organized by dates

Look for patterns like:
- "Friday 7/25" followed by locations
- "Monday 7/28" followed by locations  
- City, State combinations like "Gallipolis, OH" or "Greenville, SC"
- Forwarding headers like "From: Customer Name <customer@email.com>"

For forwarded emails, look for the original email signature/sender information at the bottom.

Return ONLY a valid JSON object in this format:
{
  "customer": "Original Customer Company Name (cleaned up, remove Inc/LLC/Dispatch/etc)",
  "customerEmail": "original_customer@email.com",
  "trucks": [
    {
      "date": "Friday 7/25",
      "city": "Gallipolis", 
      "state": "OH",
      "additionalInfo": "any extra details like times, truck numbers"
    }
  ]
}

If no truck availability information is found, return:
{
  "customer": "Customer Name", 
  "customerEmail": "customer@email.com",
  "trucks": []
}

For forwarded emails, prioritize the ORIGINAL sender as the customer, not the forwarder.
`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at parsing transportation and logistics emails, especially forwarded emails. You can identify the original sender (customer) versus the forwarder. Always return valid JSON and focus on the original customer at the bottom of forwarding chains."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Parse the JSON response
    const parsedData = JSON.parse(content)
    
    // Ensure customerEmail is set - fallback to from address if needed
    if (!parsedData.customerEmail) {
      parsedData.customerEmail = from.address
    }

    return NextResponse.json(parsedData)
  } catch (error) {
    console.error('Error parsing email with AI:', error)
    return NextResponse.json(
      { error: 'Failed to parse email' },
      { status: 500 }
    )
  }
} 