/**
 * Truck Type Detector
 * Detects truck type from additionalInfo field and returns appropriate icon
 */

export type TruckType = 'hazmat' | 'reefer' | 'flatbed' | 'van' | 'default'

export interface TruckTypeInfo {
  type: TruckType
  icon: string
  color: string
  label: string
}

/**
 * Detect truck type from additionalInfo text
 */
export function detectTruckType(additionalInfo?: string): TruckType {
  if (!additionalInfo) return 'default'
  
  const info = additionalInfo.toLowerCase()
  
  // Check for hazmat
  if (info.includes('hazmat') || info.includes('haz mat') || info.includes('dangerous')) {
    return 'hazmat'
  }
  
  // Check for refrigerated/reefer
  if (info.includes('reefer') || info.includes('refrigerator') || info.includes('refrig') || 
      info.includes('temp control') || info.includes('temperature control') || info.includes('cold')) {
    return 'reefer'
  }
  
  // Check for flatbed
  if (info.includes('flatbed') || info.includes('flat bed') || info.includes('flat-bed') ||
      info.includes('stepdeck') || info.includes('step deck') || info.includes('lowboy')) {
    return 'flatbed'
  }
  
  // Check for van (dry van, box truck, etc.)
  if (info.includes('van') || info.includes('dry van')) {
    return 'van'
  }
  
  return 'default'
}

/**
 * Get truck type information including icon and color
 */
export function getTruckTypeInfo(additionalInfo?: string): TruckTypeInfo {
  const type = detectTruckType(additionalInfo)
  
  switch (type) {
    case 'hazmat':
      return {
        type: 'hazmat',
        icon: '☢️', // Hazmat symbol
        color: '#FF6B00', // Orange
        label: 'Hazmat'
      }
    
    case 'reefer':
      return {
        type: 'reefer',
        icon: '❄️', // Snowflake for refrigerated
        color: '#2196F3', // Blue
        label: 'Refrigerated'
      }
    
    case 'flatbed':
      return {
        type: 'flatbed',
        icon: '📦', // Package/flat surface
        color: '#795548', // Brown
        label: 'Flatbed'
      }
    
    case 'van':
      return {
        type: 'van',
        icon: '🚐', // Van icon
        color: '#4CAF50', // Green
        label: 'Van'
      }
    
    default:
      return {
        type: 'default',
        icon: '🚛', // Standard truck
        color: '#1976d2', // Blue
        label: 'Truck'
      }
  }
}

/**
 * Detect dominant truck type from an array of trucks
 * Returns the most common type, or 'default' if mixed
 */
export function detectDominantTruckType(trucks: Array<{ additionalInfo?: string }>): TruckTypeInfo {
  if (!trucks || trucks.length === 0) {
    return getTruckTypeInfo()
  }
  
  // Count occurrences of each type
  const typeCounts = new Map<TruckType, number>()
  
  trucks.forEach(truck => {
    const type = detectTruckType(truck.additionalInfo)
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
  })
  
  // Find the most common type
  let dominantType: TruckType = 'default'
  let maxCount = 0
  
  typeCounts.forEach((count, type) => {
    if (count > maxCount) {
      maxCount = count
      dominantType = type
    }
  })
  
  // If all trucks are the same type, use that type
  // Otherwise, if mixed, use default
  if (typeCounts.size === 1) {
    return getTruckTypeInfo(trucks[0].additionalInfo)
  }
  
  // If one type is dominant (>50%), use it
  if (maxCount > trucks.length / 2) {
    // Find a truck with this type to get its additionalInfo
    const dominantTruck = trucks.find(t => detectTruckType(t.additionalInfo) === dominantType)
    return getTruckTypeInfo(dominantTruck?.additionalInfo)
  }
  
  // Mixed types, use default
  return getTruckTypeInfo()
}

/**
 * Get all truck types present in a group of trucks
 */
export function getAllTruckTypes(trucks: Array<{ additionalInfo?: string }>): TruckTypeInfo[] {
  const types = new Set<TruckType>()
  
  trucks.forEach(truck => {
    const type = detectTruckType(truck.additionalInfo)
    types.add(type)
  })
  
  return Array.from(types).map(type => {
    const truck = trucks.find(t => detectTruckType(t.additionalInfo) === type)
    return getTruckTypeInfo(truck?.additionalInfo)
  })
}

