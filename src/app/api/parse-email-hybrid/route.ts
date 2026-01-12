import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { awsDatabaseQueries } from '@/lib/awsDatabase'
import { 
  extractAllPatterns, 
  formatPatternsForPrompt,
  type ExtractedPattern 
} from '@/lib/emailPatternExtractor'
import { 
  validateTruckLocations, 
  getValidationStats,
  correctCityName 
} from '@/lib/locationValidator'
import {
  chunkEmailContent,
  estimateTokens,
  mergeParsedTruckData,
  type ParsedChunkData,
  type EmailChunk
} from '@/lib/emailChunker'

// Simple in-memory cache for AI processing results
const aiCache = new Map<string, any>()

// Function to normalize city names for consistent storage
function normalizeCityName(city: string, state: string): string {
  return correctCityName(city, state)
}

// Lazy initialize OpenAI client to avoid build-time errors
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// Helper function to process a single chunk of email content
async function processEmailChunk(
  chunk: EmailChunk,
  emailMetadata: { subject: string; from: any; receivedDateTime: string },
  openai: OpenAI
): Promise<ParsedChunkData> {
  const { subject, from } = emailMetadata
  
  // Extract patterns for this chunk
  const patterns: ExtractedPattern = extractAllPatterns(chunk.content)
  const patternHints = formatPatternsForPrompt(patterns)
  
  const enhancedPrompt = `Extract truck availability from this email chunk (${chunk.chunkIndex + 1}/${chunk.totalChunks}). I've pre-analyzed the content and found some patterns to help you.

${patternHints}

Email Details:
Subject: ${subject}
From: ${from.name} <${from.address}>
Chunk: ${chunk.chunkIndex + 1} of ${chunk.totalChunks}

Email Content (Chunk ${chunk.chunkIndex + 1}):
${chunk.content}

INSTRUCTIONS:
1. Use the pre-extracted patterns above as hints, but verify them against the email content
2. Extract ALL truck availability data (date, city, state)
3. For quantity multipliers (e.g., "X 4"), create that many separate truck entries
4. For routes (e.g., "Nashville → Memphis, TN"), extract the ORIGIN city
5. Skip entries marked "Covered", "Booked", "Assigned", "Not Available"
6. Extract the original sender from forwarded emails (look for "From:" in body)
7. If no original sender found, use: "${from.address}"
8. COMPACT TABLE FORMAT: If email has format like "Date | Type | Origin City, State | Destination States":
   - Extract the ORIGIN location (3rd column) as truck location
   - Convert dates like "Jan 12" to "1/12" format
   - Add truck type and destination states to additionalInfo
   - Example: "Jan 12 - Jan 12 | V | Three Rivers, MI | WI, MN" 
     → {"date": "1/12", "city": "Three Rivers", "state": "MI", "additionalInfo": "Type: V → WI, MN"}

Return ONLY valid JSON in this exact format:
{
  "customer": "Company Name",
  "customerEmail": "email@domain.com",
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

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a precise truck availability data extractor. Use pre-extracted pattern hints to improve accuracy. Extract EVERY truck mentioned. Return ONLY valid JSON."
      },
      {
        role: "user",
        content: enhancedPrompt
      }
    ],
    temperature: 0,
    max_tokens: 10000,
  })

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('No response from OpenAI')
  }
  
  // Clean up the response
  let cleanContent = content
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.replace(/```json\n?/, '').replace(/\n?```$/, '')
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/```\n?/, '').replace(/\n?```$/, '')
  }

  // Parse the JSON response
  let parsedData: ParsedChunkData
  try {
    parsedData = JSON.parse(cleanContent)
  } catch (parseError) {
    console.error('❌ HYBRID PARSER: JSON parsing failed for chunk:', parseError)
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
  
  return parsedData
}

// Function to store parsed truck data to database
async function storeTruckDataToDatabase(parsedData: any, emailData: any) {
  try {
    console.log(`\n🔍 [HYBRID-TRUCK DATA STORAGE] Starting for customer: ${parsedData.customerEmail}`)
    
    // LATEST EMAIL ONLY LOGIC: Check if this email is newer than existing data
    const existingLatestEmailDate = await awsDatabaseQueries.getCustomerLatestEmail(parsedData.customerEmail)
    const newEmailDate = emailData.receivedDateTime || new Date().toISOString()
    
    console.log(`📧 Customer ${parsedData.customerEmail}:`)
    console.log(`   - Existing latest: ${existingLatestEmailDate}`)
    console.log(`   - New email: ${newEmailDate}`)
    console.log(`   - Email has ${parsedData.trucks?.length || 0} trucks`)
    
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
      const trucksDeleted: any = await awsDatabaseQueries.deleteOlderTrucksForCustomer(parsedData.customerEmail, newEmailDate)
      const emailsDeleted: any = await awsDatabaseQueries.deleteOlderEmailsForCustomer(parsedData.customerEmail, newEmailDate)
      console.log(`   ✅ Deleted ${trucksDeleted?.affectedRows || 0} old trucks, ${emailsDeleted?.affectedRows || 0} old emails`)
    } else {
      console.log(`✨ First email from this customer`)
    }
    
    // First, save the email record
    const emailRecord = {
      emailId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      subject: emailData.subject,
      fromEmail: emailData.from.address,
      fromName: emailData.from.name || emailData.from.address.split('@')[0],
      body: emailData.body,
      receivedDateTime: emailData.receivedDateTime || new Date().toISOString(),
      isForwarded: emailData.subject.toLowerCase().includes('fw:') || emailData.subject.toLowerCase().includes('fwd:'),
      originalSender: extractOriginalSender(emailData.body) || undefined
    }
    
    await awsDatabaseQueries.saveEmail(emailRecord)
    
    // Save customer record
    const customerRecord = {
      customerName: parsedData.customer,
      customerEmail: parsedData.customerEmail,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    }
    
    await awsDatabaseQueries.saveCustomer(customerRecord)
    
    // Save each truck availability record
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

// Extract original sender from forwarded email body
function extractOriginalSender(body: string): string | null {
  const forwardPatterns = [
    /From:\s*([^\r\n<]+)/i,
    /Sent by:\s*([^\r\n<]+)/i,
    /Originally sent by:\s*([^\r\n<]+)/i
  ]
  
  for (const pattern of forwardPatterns) {
    const match = body.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { subject, body, from, receivedDateTime } = await request.json()

    console.log('🔍 HYBRID PARSER: Starting email analysis...')
    console.log(`📧 Email received at: ${receivedDateTime}`)

    // Create cache key based on email content
    const cacheKey = `hybrid-${from.address}-${subject}-${body.substring(0, 1000)}`
    
    // Check cache first
    if (aiCache.has(cacheKey)) {
      console.log('✅ HYBRID PARSER: Cache hit')
      return NextResponse.json(aiCache.get(cacheKey))
    }

    // Strip HTML tags and decode HTML entities
    const stripHtml = (html: string) => {
      return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
    }
    
    const cleanBody = stripHtml(body)
    const estimatedTotalTokens = estimateTokens(cleanBody)
    
    console.log(`📊 Email size: ${cleanBody.length} chars (~${estimatedTotalTokens} tokens)`)

    // STEP 1 & 2: Chunk email content and process each chunk
    console.log('🔍 HYBRID PARSER: Step 1 - Chunking email content...')
    const chunks = chunkEmailContent(cleanBody)
    
    console.log(`📄 Split into ${chunks.length} chunk(s)`)
    
    // STEP 2: Process each chunk with AI
    console.log('🤖 HYBRID PARSER: Step 2 - Processing chunks with AI...')
    const openai = getOpenAIClient()
    const chunkResults: ParsedChunkData[] = []
    
    for (const chunk of chunks) {
      console.log(`   Processing chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} (~${chunk.estimatedTokens} tokens)...`)
      const chunkResult = await processEmailChunk(
        chunk,
        { subject, from, receivedDateTime },
        openai
      )
      console.log(`   ✓ Chunk ${chunk.chunkIndex + 1} extracted ${chunkResult.trucks.length} trucks`)
      chunkResults.push(chunkResult)
    }
    
    // STEP 3: Merge results from all chunks
    console.log('🔗 HYBRID PARSER: Step 3 - Merging chunk results...')
    let parsedData = mergeParsedTruckData(chunkResults)
    
    console.log(`🤖 HYBRID PARSER: AI extracted ${parsedData.trucks.length} trucks (from ${chunks.length} chunks)`)

    // STEP 4: Validate locations using geocoding
    if (parsedData.trucks.length > 0) {
      console.log('📍 HYBRID PARSER: Step 4 - Validating locations with geocoding...')
      
      const validatedTrucks = await validateTruckLocations(parsedData.trucks)
      const stats = getValidationStats(validatedTrucks)
      
      console.log('📊 HYBRID PARSER: Validation results:')
      console.log(`  - Total trucks: ${stats.total}`)
      console.log(`  - Valid: ${stats.valid}`)
      console.log(`  - Needs review: ${stats.needsReview}`)
      console.log(`  - Invalid: ${stats.invalid}`)
      console.log(`  - Average confidence: ${(stats.averageConfidence * 100).toFixed(0)}%`)
      
      // Update parsed data with validated trucks
      parsedData.trucks = validatedTrucks.map(truck => ({
        date: truck.date,
        city: truck.city,
        state: truck.state,
        additionalInfo: truck.additionalInfo || '',
        validationConfidence: truck.validationConfidence,
        needsReview: truck.needsReview
      }))
      
      // Add validation metadata
      parsedData.validation = {
        totalTrucks: stats.total,
        validTrucks: stats.valid,
        needsReview: stats.needsReview,
        invalidTrucks: stats.invalid,
        averageConfidence: stats.averageConfidence
      }
    }

    // STEP 5: Store to database
    console.log('💾 HYBRID PARSER: Step 5 - Storing to database...')
    await storeTruckDataToDatabase(parsedData, { subject, body, from, receivedDateTime })

    // Cache the result
    aiCache.set(cacheKey, parsedData)

    console.log('✅ HYBRID PARSER: Complete!')
    console.log(`   - Chunks processed: ${chunks.length}`)
    console.log(`   - Extracted: ${parsedData.trucks.length} trucks`)
    console.log(`   - Validation confidence: ${parsedData.validation ? (parsedData.validation.averageConfidence * 100).toFixed(0) : 'N/A'}%`)

    return NextResponse.json(parsedData)
  } catch (error) {
    console.error('❌ HYBRID PARSER: Error:', error)
    
    const { from } = await request.json()
    return NextResponse.json({
      customer: from.name || from.address.split('@')[0],
      customerEmail: from.address,
      trucks: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

