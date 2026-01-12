import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { awsDatabaseQueries } from '@/lib/awsDatabase'
import { extractImagesFromEmail, hasImages, isValidImage, formatImageForVision, getImageStats } from '@/lib/imageExtractor'

// Cache for AI processing results
const aiCache = new Map<string, any>()

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

function normalizeCityName(city: string, state: string): string {
  return city.trim()
}

async function storeTruckDataToDatabase(parsedData: any, emailData: any) {
  try {
    // LATEST EMAIL ONLY LOGIC: Check if this email is newer than existing data
    const existingLatestEmailDate = await awsDatabaseQueries.getCustomerLatestEmail(parsedData.customerEmail)
    const newEmailDate = emailData.receivedDateTime || new Date().toISOString()
    
    console.log(`📧 Customer ${parsedData.customerEmail}:`)
    console.log(`   - Existing latest: ${existingLatestEmailDate}`)
    console.log(`   - New email: ${newEmailDate}`)
    
    // Only proceed if this is a new email or newer than existing
    if (existingLatestEmailDate) {
      const existingDate = new Date(existingLatestEmailDate)
      const newDate = new Date(newEmailDate)
      
      if (newDate <= existingDate) {
        console.log(`⏭️  Skipping older/duplicate email for ${parsedData.customerEmail}`)
        return
      }
      
      console.log(`🗑️  Deleting older data and keeping new email data`)
      // Delete only older data
      await awsDatabaseQueries.deleteOlderTrucksForCustomer(parsedData.customerEmail, newEmailDate)
      await awsDatabaseQueries.deleteOlderEmailsForCustomer(parsedData.customerEmail, newEmailDate)
    } else {
      console.log(`✨ First email from this customer`)
    }
    
    const emailRecord = {
      emailId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      subject: emailData.subject,
      fromEmail: emailData.from.address,
      fromName: emailData.from.name || emailData.from.address.split('@')[0],
      body: emailData.body,
      receivedDateTime: emailData.receivedDateTime || new Date().toISOString(),
      isForwarded: emailData.subject.toLowerCase().includes('fw:') || emailData.subject.toLowerCase().includes('fwd:'),
      originalSender: undefined
    }
    
    await awsDatabaseQueries.saveEmail(emailRecord)
    
    const customerRecord = {
      customerName: parsedData.customer,
      customerEmail: parsedData.customerEmail,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    }
    
    await awsDatabaseQueries.saveCustomer(customerRecord)
    
    if (parsedData.trucks && Array.isArray(parsedData.trucks)) {
      for (const truck of parsedData.trucks) {
        const normalizedCity = normalizeCityName(truck.city, truck.state)
        
        const truckRecord = {
          customer: parsedData.customer,
          customerEmail: parsedData.customerEmail,
          date: truck.date,
          city: normalizedCity,
          state: truck.state,
          additionalInfo: truck.additionalInfo || '',
          emailId: emailRecord.emailId,
          emailSubject: emailData.subject,
          emailDate: emailData.receivedDateTime || new Date().toISOString()
        }
        
        await awsDatabaseQueries.saveTruckAvailability(truckRecord)
      }
    }
    
  } catch (error) {
    console.error('❌ Error storing truck data to database:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { subject, body, from, receivedDateTime, images: providedImages, attachments } = await request.json()

    console.log('🖼️  VISION PARSER: Starting image-based email analysis...')
    console.log(`📧 Email received at: ${receivedDateTime}`)

    // Create cache key
    const cacheKey = `vision-${from.address}-${subject}-${body.substring(0, 100)}`
    
    if (aiCache.has(cacheKey)) {
      console.log('✅ VISION PARSER: Cache hit')
      return NextResponse.json(aiCache.get(cacheKey))
    }

    // Extract images from email
    let images = providedImages || []
    
    // If images not provided, try to extract from email object
    if (images.length === 0 && body) {
      const emailObj = { body: { content: body }, attachments }
      images = extractImagesFromEmail(emailObj)
    }

    console.log(`🖼️  VISION PARSER: Found ${images.length} images`)

    // Filter valid images
    const validImages = images.filter((img: any) => isValidImage(img))
    
    if (validImages.length === 0) {
      console.warn('⚠️  VISION PARSER: No valid images found')
      return NextResponse.json({
        customer: from.name || from.address.split('@')[0],
        customerEmail: from.address,
        trucks: [],
        error: 'No valid images found in email'
      })
    }

    const imageStats = getImageStats(validImages)
    console.log('📊 VISION PARSER: Image statistics:')
    console.log(`  - Valid images: ${imageStats.validForVision}/${imageStats.total}`)
    console.log(`  - Total size: ${imageStats.totalSizeMB.toFixed(2)}MB`)

    // Build vision prompt
    const prompt = `Analyze this image which contains truck availability information from an email.

EMAIL CONTEXT:
Subject: ${subject}
From: ${from.name} <${from.address}>

TASK:
Extract ALL truck availability data from the image. Look for:
- Dates (any format: MM/DD, M/D, Month Day, etc.)
- Locations (City, State)
- Tables, lists, or any structured data
- Route information (origin → destination)
- Quantity multipliers (e.g., "X 4" means 4 trucks)

INSTRUCTIONS:
1. Read ALL text in the image carefully
2. Extract every truck location mentioned
3. Associate locations with their dates
4. For tables, process every row
5. For quantity multipliers, create that many truck entries
6. Skip entries marked as "Covered", "Booked", "Assigned"
7. COMPACT TABLE FORMAT: If image shows format like "Date | Type | Origin City, State | Destination States":
   - Extract the ORIGIN location (3rd column) as truck location
   - Convert dates like "Jan 12" to "1/12" format
   - Add truck type and destination states to additionalInfo
   - Example: "Jan 12 - Jan 12 | V | Three Rivers, MI | WI, MN" 
     → {"date": "1/12", "city": "Three Rivers", "state": "MI", "additionalInfo": "Type: V → WI, MN"}

Return ONLY valid JSON in this exact format:
{
  "customer": "Company Name",
  "customerEmail": "${from.address}",
  "trucks": [
    {
      "date": "MM/DD",
      "city": "City Name",
      "state": "ST",
      "additionalInfo": "optional details"
    }
  ]
}

If no truck data found, return: {"customer": "${from.name || from.address.split('@')[0]}", "customerEmail": "${from.address}", "trucks": []}`

    // Call OpenAI Vision API
    console.log('🤖 VISION PARSER: Calling OpenAI Vision API...')
    
    const openai = getOpenAIClient()
    
    // Prepare messages with images
    const imageContents = validImages.slice(0, 10).map((img: any) => ({ // Max 10 images
      type: 'image_url' as const,
      image_url: {
        url: formatImageForVision(img),
        detail: 'high' as const // Use high detail for better text recognition
      }
    }))

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // GPT-4o has vision capabilities
      messages: [
        {
          role: "system",
          content: "You are a precise truck availability data extractor. Extract EVERY truck mentioned from images. Return ONLY valid JSON."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            ...imageContents
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0,
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) {
      throw new Error('No response from OpenAI Vision')
    }
    
    console.log('🤖 VISION PARSER: Received response from OpenAI')

    // Clean up response
    let cleanContent = content
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/```json\n?/, '').replace(/\n?```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/```\n?/, '').replace(/\n?```$/, '')
    }

    // Parse JSON
    let parsedData
    try {
      parsedData = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('❌ VISION PARSER: JSON parsing failed:', parseError)
      parsedData = {
        customer: from.name || from.address.split('@')[0],
        customerEmail: from.address,
        trucks: []
      }
    }
    
    // Ensure required fields
    if (!parsedData.customer || !parsedData.customerEmail) {
      parsedData.customer = from.name || from.address.split('@')[0]
      parsedData.customerEmail = from.address
    }
    
    if (!parsedData.trucks || !Array.isArray(parsedData.trucks)) {
      parsedData.trucks = []
    }

    console.log(`🤖 VISION PARSER: Extracted ${parsedData.trucks.length} trucks from images`)

    // Store to database
    if (parsedData.trucks.length > 0) {
      console.log('💾 VISION PARSER: Storing to database...')
      await storeTruckDataToDatabase(parsedData, { subject, body, from, receivedDateTime })
    }

    // Add metadata
    parsedData.visionParsing = {
      imagesProcessed: validImages.length,
      totalImages: images.length,
      imageSizeMB: imageStats.totalSizeMB
    }

    // Cache result
    aiCache.set(cacheKey, parsedData)

    console.log('✅ VISION PARSER: Complete!')
    console.log(`   - Images processed: ${validImages.length}`)
    console.log(`   - Trucks extracted: ${parsedData.trucks.length}`)

    return NextResponse.json(parsedData)
  } catch (error) {
    console.error('❌ VISION PARSER: Error:', error)
    
    const { from } = await request.json()
    return NextResponse.json({
      customer: from.name || from.address.split('@')[0],
      customerEmail: from.address,
      trucks: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

