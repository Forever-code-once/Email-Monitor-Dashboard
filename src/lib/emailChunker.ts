/**
 * Email content chunker for handling very long emails
 * Splits email content into manageable chunks that can be processed by AI
 * while maintaining context and preventing token limit issues
 */

export interface EmailChunk {
  content: string
  chunkIndex: number
  totalChunks: number
  estimatedTokens: number
}

// Rough estimation: 1 token ≈ 4 characters
const CHARS_PER_TOKEN = 4

// Conservative limits to account for prompt overhead
const MAX_TOKENS_PER_CHUNK = 6000 // Leave room for prompt (total limit is ~8k for gpt-4o-mini input)
const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN // ~24,000 chars

/**
 * Estimate token count from character count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Find good breakpoints in text (prefer paragraph boundaries)
 */
function findBreakpoint(text: string, targetLength: number): number {
  // Try to break at paragraph boundary (double newline)
  const doubleNewline = text.lastIndexOf('\n\n', targetLength)
  if (doubleNewline > targetLength * 0.7) {
    return doubleNewline + 2
  }
  
  // Try to break at single newline
  const singleNewline = text.lastIndexOf('\n', targetLength)
  if (singleNewline > targetLength * 0.8) {
    return singleNewline + 1
  }
  
  // Try to break at sentence boundary
  const period = text.lastIndexOf('.', targetLength)
  if (period > targetLength * 0.8) {
    return period + 1
  }
  
  // Last resort: break at word boundary
  const space = text.lastIndexOf(' ', targetLength)
  if (space > targetLength * 0.9) {
    return space + 1
  }
  
  // Absolute last resort: hard break
  return targetLength
}

/**
 * Split email content into manageable chunks
 */
export function chunkEmailContent(content: string): EmailChunk[] {
  const cleanContent = content.trim()
  const totalLength = cleanContent.length
  
  // If content is small enough, return as single chunk
  if (totalLength <= MAX_CHARS_PER_CHUNK) {
    return [{
      content: cleanContent,
      chunkIndex: 0,
      totalChunks: 1,
      estimatedTokens: estimateTokens(cleanContent)
    }]
  }
  
  // Split into multiple chunks
  const chunks: EmailChunk[] = []
  let currentPosition = 0
  let chunkIndex = 0
  
  while (currentPosition < totalLength) {
    const remainingLength = totalLength - currentPosition
    const chunkSize = Math.min(MAX_CHARS_PER_CHUNK, remainingLength)
    
    // Find a good breakpoint
    let breakpoint: number
    if (remainingLength <= MAX_CHARS_PER_CHUNK) {
      // Last chunk - take everything
      breakpoint = remainingLength
    } else {
      // Find smart breakpoint
      const searchText = cleanContent.substring(currentPosition, currentPosition + chunkSize)
      const relativeBreakpoint = findBreakpoint(searchText, chunkSize)
      breakpoint = relativeBreakpoint
    }
    
    const chunkContent = cleanContent.substring(currentPosition, currentPosition + breakpoint).trim()
    
    chunks.push({
      content: chunkContent,
      chunkIndex,
      totalChunks: 0, // Will be updated after all chunks are created
      estimatedTokens: estimateTokens(chunkContent)
    })
    
    currentPosition += breakpoint
    chunkIndex++
  }
  
  // Update total chunks count
  const totalChunks = chunks.length
  chunks.forEach(chunk => {
    chunk.totalChunks = totalChunks
  })
  
  return chunks
}

/**
 * Process email in chunks and merge results
 */
export async function processEmailInChunks<T>(
  content: string,
  processChunk: (chunk: EmailChunk) => Promise<T>,
  mergeResults: (results: T[]) => T
): Promise<T> {
  const chunks = chunkEmailContent(content)
  
  console.log(`📄 Email chunking: Split into ${chunks.length} chunks`)
  chunks.forEach((chunk, i) => {
    console.log(`   Chunk ${i + 1}: ${chunk.content.length} chars (~${chunk.estimatedTokens} tokens)`)
  })
  
  // Process all chunks
  const results: T[] = []
  for (const chunk of chunks) {
    console.log(`🔄 Processing chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}...`)
    const result = await processChunk(chunk)
    results.push(result)
  }
  
  // Merge results
  console.log(`🔗 Merging results from ${results.length} chunks...`)
  return mergeResults(results)
}

/**
 * Merge parsed truck data from multiple chunks
 */
export interface ParsedChunkData {
  customer: string
  customerEmail: string
  trucks: Array<{
    date: string
    city: string
    state: string
    additionalInfo?: string
    validationConfidence?: number
    needsReview?: boolean
  }>
  validation?: {
    totalTrucks: number
    validTrucks: number
    needsReview: number
    invalidTrucks: number
    averageConfidence: number
  }
}

export function mergeParsedTruckData(results: ParsedChunkData[]): ParsedChunkData {
  if (results.length === 0) {
    return {
      customer: '',
      customerEmail: '',
      trucks: []
    }
  }
  
  // Use the first result as base
  const merged: ParsedChunkData = {
    customer: results[0].customer,
    customerEmail: results[0].customerEmail,
    trucks: []
  }
  
  // Merge trucks from all chunks, removing duplicates
  const truckMap = new Map<string, typeof merged.trucks[0]>()
  
  for (const result of results) {
    for (const truck of result.trucks) {
      // Create unique key for deduplication
      const key = `${truck.date}-${truck.city}-${truck.state}`.toLowerCase()
      
      // Only add if not already present
      if (!truckMap.has(key)) {
        truckMap.set(key, truck)
      } else {
        // If duplicate found, merge additional info
        const existing = truckMap.get(key)!
        if (truck.additionalInfo && truck.additionalInfo !== existing.additionalInfo) {
          existing.additionalInfo = [existing.additionalInfo, truck.additionalInfo]
            .filter(Boolean)
            .join(' | ')
        }
      }
    }
  }
  
  merged.trucks = Array.from(truckMap.values())
  
  console.log(`✅ Merged ${merged.trucks.length} unique trucks from ${results.length} chunks`)
  
  return merged
}

