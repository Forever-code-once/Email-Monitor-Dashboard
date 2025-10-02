'use client'

import { useState, useEffect, useCallback } from 'react'
import { Box, Alert, Typography, CircularProgress } from '@mui/material'
import { DateNavigation } from './DateNavigation'
import { TruckMap } from './TruckMap'
import { TruckDetailCard } from './TruckDetailCard'
import { LoadDetailCard } from './LoadDetailCard'
import { MapPin, AnyMapPin } from '@/types/map'
import { TruckAvailability, LoadData } from '@/types'
import { geocodeAddress, preCacheCommonCities } from '@/lib/geocoding'
import { convertLoadsToPins, LoadPin } from '@/lib/loadGeocoding'

/**
 * Get the next business day (Monday-Friday)
 */
function getNextBusinessDay(): Date {
  const today = new Date()
  const nextDay = new Date(today)
  nextDay.setDate(today.getDate() + 1)
  
  // Keep adding days until we find a business day (Monday = 1, Friday = 5)
  while (nextDay.getDay() === 0 || nextDay.getDay() === 6) { // Sunday = 0, Saturday = 6
    nextDay.setDate(nextDay.getDate() + 1)
  }
  
  return nextDay
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): { distance: number; unit: string } {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c
  
  if (distance < 1) {
    return { distance: distance * 5280, unit: 'ft' } // Convert to feet
  } else {
    return { distance: Math.round(distance * 10) / 10, unit: 'mi' } // Round to 1 decimal place
  }
}

interface MapViewProps {
  customerCards: any[] // Using existing customer cards data
  onViewEmails?: (customerEmail: string) => void
  mapRefreshTrigger?: number
  onDateChange?: (date: Date) => void
  onLoadsCountChange?: (count: number) => void
  onTruckDeleted?: () => void
}

export function MapView({ customerCards, onViewEmails, mapRefreshTrigger = 0, onDateChange, onLoadsCountChange, onTruckDeleted }: MapViewProps) {
  
  // Helper function to parse dates in local timezone
  const parseDateForTimezone = (dateStr: string): Date => {
    if (!dateStr) return new Date()
    
    // Handle different date formats
    if (dateStr.includes('T')) {
      // ISO format - extract date components directly to avoid timezone conversion
      const datePart = dateStr.split('T')[0] // Get "2025-09-23" from "2025-09-23T00:00:00.000Z"
      const [year, month, day] = datePart.split('-').map(Number)
      return new Date(year, month - 1, day) // month is 0-indexed
    } else if (dateStr.includes('-')) {
      // YYYY-MM-DD format - parse as local time
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day)
    } else {
      // Fallback
      return new Date(dateStr)
    }
  }

  // Helper function to compare dates (ignoring time)
  const compareDatesOnly = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)
  
  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastMidnightCheck, setLastMidnightCheck] = useState<Date>(new Date())
  const [dateOffset, setDateOffset] = useState<number>(0) // Track manual offset from today

  // Wrapper function to update selectedDate and calculate offset
  const updateSelectedDate = useCallback((newDate: Date) => {
    setSelectedDate(newDate)
    
    // Calculate offset from today
    const today = new Date()
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const newDateOnly = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
    
    const timeDiff = newDateOnly.getTime() - todayOnly.getTime()
    const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24))
    
    setDateOffset(daysDiff)
  }, [])
  
  // Distance measurement state
  const [selectedLoad, setSelectedLoad] = useState<LoadPin | null>(null)
  const [selectedTruck, setSelectedTruck] = useState<MapPin | null>(null)
  const [distanceMeasurement, setDistanceMeasurement] = useState<{
    distance: number
    unit: string
    fromLoad: string
    toTruck: string
  } | null>(null)
  
  const [pins, setPins] = useState<MapPin[]>([])
  const [loadPins, setLoadPins] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingLoads, setLoadingLoads] = useState(false)
  const [selectedPin, setSelectedPin] = useState<AnyMapPin | null>(null)
  const [detailCardOpen, setDetailCardOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  
  // Cache for loads data
  const [loadsCache, setLoadsCache] = useState<{
    data: LoadData[]
    timestamp: number
    expiresAt: number
  } | null>(null)

  // Debug: Log customer cards data
  useEffect(() => {
    // Customer cards logging removed
  }, [customerCards])

  // Auto-refresh logic: Check for midnight and advance date while preserving offset
  useEffect(() => {
    if (!autoRefresh) return

    const checkMidnight = () => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const lastCheck = new Date(lastMidnightCheck.getFullYear(), lastMidnightCheck.getMonth(), lastMidnightCheck.getDate())
      
      // Check if we've crossed midnight since last check
      if (today.getTime() > lastCheck.getTime()) {
        
        // Calculate new date with preserved offset
        const newDate = new Date(today)
        newDate.setDate(today.getDate() + dateOffset)
        
        
        updateSelectedDate(newDate)
        setLastMidnightCheck(now)
        
        // Trigger data refresh
        if (onDateChange) {
          onDateChange(newDate)
        }
      }
    }

    // Check immediately
    checkMidnight()
    
    // Set up interval to check every minute
    const interval = setInterval(checkMidnight, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [autoRefresh, lastMidnightCheck, dateOffset, selectedDate, onDateChange])

  // Check if cache is valid
  const isCacheValid = useCallback(() => {
    if (!loadsCache) return false
    const now = Date.now()
    return now < loadsCache.expiresAt
  }, [loadsCache])

  // Load from cache or localStorage
  const loadFromCache = useCallback(() => {
    // First check in-memory cache
    if (isCacheValid()) {
      return loadsCache!.data
    }

    // Try localStorage as fallback
    try {
      const cached = localStorage.getItem('loads-cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        const now = Date.now()
        if (now < parsed.expiresAt) {
          setLoadsCache(parsed)
          return parsed.data
        } else {
          localStorage.removeItem('loads-cache')
        }
      }
    } catch (error) {
      console.warn('🗺️ Error loading from localStorage cache:', error)
    }

    return null
  }, [loadsCache, isCacheValid])

  // Save to cache and localStorage
  const saveToCache = useCallback((data: LoadData[]) => {
    const now = Date.now()
    const expiresAt = now + (5 * 60 * 1000) // 5 minutes
    const cacheData = { data, timestamp: now, expiresAt }
    
    setLoadsCache(cacheData)
    
    try {
      localStorage.setItem('loads-cache', JSON.stringify(cacheData))
    } catch (error) {
      console.warn('🗺️ Error saving to localStorage cache:', error)
    }
  }, [])

  // Fetch loads from database and create pins with date filtering
  const fetchAndCreateLoadPins = useCallback(async (date: Date, range?: { start: Date; end: Date }) => {
    setLoadingLoads(true)
    try {
      // Date logging removed

      // Try to load from cache first
      const cachedData = loadFromCache()
      let loads: LoadData[] = []

      if (cachedData) {
        loads = cachedData
      } else {
        // Fetch from API if no valid cache
        const response = await fetch('/api/loads')
        const data = await response.json()
        
        if (data.success && data.loads) {
          loads = data.loads
          
          // Save to cache
          saveToCache(loads)
        } else {
          console.error('❌ Failed to fetch loads:', data.error)
          setLoadPins([])
          return
        }
      }
      
      if (loads.length > 0) {
        
        // Filter loads by date range or selected date
        const filteredLoads = loads.filter((load: LoadData) => {
          // Use DEPART_DATE as the primary date field for filtering
          const dateField = load.DEPART_DATE || load.pu_drop_date1
          if (!dateField) {
            return false
          }
          
          // Check if this is the default SQL Server date (1753-01-01) - treat as next business day
          const isDefaultDate = dateField === '1753-01-01T00:00:00.000Z' || dateField === '1753-01-01'
          
          if (isDefaultDate) {
            // For default date loads, use next business day
            const nextBusinessDay = getNextBusinessDay()
            const nextBusinessDayOnly = new Date(nextBusinessDay.getFullYear(), nextBusinessDay.getMonth(), nextBusinessDay.getDate())
            
            if (range) {
              // Check if next business day falls within the range
              const rangeIncludesNextBusinessDay = nextBusinessDayOnly >= range.start && nextBusinessDayOnly <= range.end
              return rangeIncludesNextBusinessDay
            } else {
              // Check if selected date matches next business day
              const selectedDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
              return compareDatesOnly(selectedDateOnly, nextBusinessDayOnly)
            }
          } else {
            // For regular dates, parse and compare normally
            const loadDate = parseDateForTimezone(dateField)
            if (isNaN(loadDate.getTime())) {
              return false
            }
            
            if (range) {
              // For regular dates, check if they fall within the range
              const matches = loadDate >= range.start && loadDate <= range.end
              return matches
            } else {
              // Check if load date matches selected date (ignore time)
              const selectedDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
              return compareDatesOnly(loadDate, selectedDateOnly)
            }
          }
        })
        
        
        // If no loads found for the selected date, show available dates
        if (filteredLoads.length === 0) {
          const availableDates = loads
            .filter((load: LoadData) => {
              const dateField = load.DEPART_DATE || load.pu_drop_date1
              return dateField && dateField !== '1753-01-01T00:00:00.000Z' && dateField !== '1753-01-01'
            })
            .map((load: LoadData) => new Date(load.DEPART_DATE || load.pu_drop_date1!).toISOString().split('T')[0])
            .filter((date: string, index: number, array: string[]) => array.indexOf(date) === index)
            .sort()
        }
        
        const loadPins = await convertLoadsToPins(filteredLoads)
        setLoadPins(loadPins)
      } else {
        setLoadPins([])
      }
    } catch (error) {
      console.error('❌ Error fetching loads:', error)
      setLoadPins([])
    } finally {
      setLoadingLoads(false)
    }
  }, [loadFromCache, saveToCache])

  // Fetch loads when date changes
  useEffect(() => {
    if (initialized && !isNaN(selectedDate.getTime())) {
      fetchAndCreateLoadPins(selectedDate, dateRange || undefined)
    }
  }, [selectedDate, dateRange, fetchAndCreateLoadPins, initialized])

  // Notify parent component when selected date changes
  useEffect(() => {
    if (onDateChange) {
      onDateChange(selectedDate)
    }
  }, [selectedDate, onDateChange])

  // Notify parent component when loads count changes
  useEffect(() => {
    if (onLoadsCountChange) {
      // Calculate total individual loads across all pins, not just number of pins
      const totalLoads = loadPins.reduce((sum, pin) => sum + pin.loadCount, 0)
      onLoadsCountChange(totalLoads)
    }
  }, [loadPins, onLoadsCountChange])



  // Get all available dates from customer cards
  const availableDates = useCallback(() => {
    const dates = new Set<string>()
    customerCards.forEach(card => {
      card.trucks.forEach((truck: TruckAvailability) => {
        dates.add(truck.date)
      })
    })
    
    // Filter and validate dates with proper parsing
    const validDates = Array.from(dates)
      .filter(dateStr => {
        if (!dateStr || typeof dateStr !== 'string') return false
        
        // Handle MM/DD format properly
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/')
          if (parts.length === 2) {
            const month = parseInt(parts[0])
            const day = parseInt(parts[1])
            return month >= 1 && month <= 12 && day >= 1 && day <= 31
          }
        }
        
        // Handle YYYY-MM-DD format
        if (dateStr.includes('-')) {
          const date = new Date(dateStr)
          return !isNaN(date.getTime())
        }
        
        return false
      })
      .map(dateStr => {
        // Parse dates properly
        if (dateStr.includes('/')) {
          // Handle MM/DD format - assume current year
          const parts = dateStr.split('/')
          const currentYear = new Date().getFullYear()
          const month = parseInt(parts[0]) - 1 // month is 0-indexed
          const day = parseInt(parts[1])
          return new Date(currentYear, month, day)
        } else {
          // Handle YYYY-MM-DD format
          return new Date(dateStr)
        }
      })
      .sort((a, b) => a.getTime() - b.getTime())
    
    return validDates
  }, [customerCards])

  // Convert truck data to map pins
  const createMapPins = useCallback(async (date: Date, range?: { start: Date; end: Date } | null) => {
    
    if (customerCards.length === 0) {
      setPins([])
      return
    }
    
    // Validate date parameters
    if (isNaN(date.getTime())) {
      setPins([])
      return
    }
    
    if (range && (isNaN(range.start.getTime()) || isNaN(range.end.getTime()))) {
      setPins([])
      return
    }
    
    setLoading(true)
    
    try {
      let trucksForDate: TruckAvailability[] = []
      
      // Debug: Log first few customer cards
      if (customerCards.length > 0) {
        // Customer cards logging removed
      }
      
      if (range) {
        // Filter trucks for the date range
        // Convert range dates to MM/DD format for comparison
        const startMonth = (range.start.getMonth() + 1).toString()
        const startDay = range.start.getDate().toString()
        const startStr = `${startMonth}/${startDay}`
        
        const endMonth = (range.end.getMonth() + 1).toString()
        const endDay = range.end.getDate().toString()
        const endStr = `${endMonth}/${endDay}`
        
        
        customerCards.forEach(card => {
          card.trucks.forEach((truck: TruckAvailability) => {
            let truckDateStr = truck.date
            
            // If truck date is in YYYY-MM-DD format, convert to MM/DD
            if (truckDateStr.includes('-') && truckDateStr.length > 5) {
              const [year, month, day] = truckDateStr.split('-')
              truckDateStr = `${parseInt(month)}/${parseInt(day)}`
            }
            
            // Simple string comparison for MM/DD format
            if (truckDateStr >= startStr && truckDateStr <= endStr) {
              trucksForDate.push(truck)
            }
          })
        })
      } else {
        // Filter trucks for the selected date
        // Convert selected date to MM/DD format to match truck dates
        const month = (date.getMonth() + 1).toString() // getMonth() is 0-indexed
        const day = date.getDate().toString()
        const dateStr = `${month}/${day}` // MM/DD format
        
        
        customerCards.forEach(card => {
          card.trucks.forEach((truck: TruckAvailability) => {
                         // Handle different date formats in truck data
             let truckDateStr = truck.date
             
             // If truck date is in YYYY-MM-DD format, convert to MM/DD
             if (truckDateStr.includes('-') && truckDateStr.length > 5) {
               const [year, month, day] = truckDateStr.split('-')
               truckDateStr = `${parseInt(month)}/${parseInt(day)}`
             }
             
             // Normalize date format to remove leading zeros for comparison
             const normalizeDate = (dateStr: string) => {
               if (dateStr.includes('/')) {
                 const [month, day] = dateStr.split('/')
                 return `${parseInt(month)}/${parseInt(day)}`
               }
               return dateStr
             }
             
             const normalizedTruckDate = normalizeDate(truckDateStr)
             const normalizedTargetDate = normalizeDate(dateStr)
             
             if (normalizedTruckDate === normalizedTargetDate) {
               trucksForDate.push(truck)
             }
          })
        })
      }

      if (trucksForDate.length === 0) {
         setPins([])
         return
       }

               // Filter out deleted trucks from localStorage
         const filteredTrucks = trucksForDate.filter(truck => {
           try {
             // Use simplified storage key (location only)
             const storageKey = `truck-state-${truck.city}-${truck.state}`
             const deletedTrucksData = localStorage.getItem(`${storageKey}-deleted`)
             const deletedTrucks = deletedTrucksData ? JSON.parse(deletedTrucksData) : []
          
          if (!Array.isArray(deletedTrucks)) {
            console.warn('Invalid deleted trucks data, clearing corrupted data')
            localStorage.removeItem(`${storageKey}-deleted`)
            return true // Show the truck if data is corrupted
          }
          
          const isDeleted = deletedTrucks.includes(truck.id)
          if (isDeleted) {
            // Truck deletion logging removed
          }
          
          return !isDeleted
        } catch (error) {
          console.error('Error checking deleted trucks:', error)
          return true // Show the truck if there's an error
        }
      })


      // Group trucks by location only (not by customer email)
      const locationGroups = new Map<string, TruckAvailability[]>()
      
      filteredTrucks.forEach(truck => {
        // Group by location only - all customers at same location will be in one pin
        const key = `${truck.city}, ${truck.state}`.toLowerCase()
        if (!locationGroups.has(key)) {
          locationGroups.set(key, [])
        }
        locationGroups.get(key)!.push(truck)
      })

      // Geocode locations and create pins
      const pinPromises = Array.from(locationGroups.entries()).map(async ([locationKey, trucks]) => {
        const [city, state] = locationKey.split(', ')
        
        // Geocode the location
        const geocodeResult = await geocodeAddress(city, state)
        
        if (geocodeResult) {
          return {
            id: locationKey,
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            city: trucks[0].city,
            state: trucks[0].state,
            trucks: trucks,
            date: range ? 
              `${range.start.getMonth() + 1}/${range.start.getDate()} - ${range.end.getMonth() + 1}/${range.end.getDate()}` : 
              `${date.getMonth() + 1}/${date.getDate()}`,
            truckCount: trucks.length
          } as MapPin
        }
        
        return null
      })

      const pinResults = await Promise.all(pinPromises)
      const validPins = pinResults.filter(pin => pin !== null) as MapPin[]
      
      setPins(validPins)
                  const dateDisplay = range ? 
              `${isNaN(range.start.getTime()) ? new Date().toISOString().split('T')[0] : range.start.toISOString().split('T')[0]} - ${isNaN(range.end.getTime()) ? new Date().toISOString().split('T')[0] : range.end.toISOString().split('T')[0]}` : 
              (isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0])
      
    } catch (error) {
      console.error('❌ Error creating map pins:', error)
    } finally {
      setLoading(false)
    }
  }, [customerCards])

  // Initialize with today's date (always start with current day)
  useEffect(() => {
    if (!initialized) {
      updateSelectedDate(new Date()) // Always start with today
      setInitialized(true)
    }
  }, [initialized, updateSelectedDate])

  // Update pins when date or date range changes
  useEffect(() => {
    if (initialized && !isNaN(selectedDate.getTime())) {
      createMapPins(selectedDate, dateRange)
    }
  }, [selectedDate, dateRange, createMapPins, initialized])

  // Pre-cache common cities on component mount
  useEffect(() => {
    preCacheCommonCities()
  }, [])

  // Handle real-time map refresh trigger
  useEffect(() => {
    if (mapRefreshTrigger > 0 && initialized) {
      // Refresh both truck pins and load pins
      createMapPins(selectedDate, dateRange || undefined)
      fetchAndCreateLoadPins(selectedDate, dateRange || undefined)
    }
  }, [mapRefreshTrigger, initialized, selectedDate, dateRange, createMapPins, fetchAndCreateLoadPins])

  const handlePreviousDay = () => {
    if (!isNaN(selectedDate.getTime())) {
      const prevDate = new Date(selectedDate)
      prevDate.setDate(prevDate.getDate() - 1)
      updateSelectedDate(prevDate)
    }
    setDateRange(null) // Clear date range when using single date navigation
  }

  const handleNextDay = () => {
    if (!isNaN(selectedDate.getTime())) {
      const nextDate = new Date(selectedDate)
      nextDate.setDate(nextDate.getDate() + 1)
      updateSelectedDate(nextDate)
    }
    setDateRange(null) // Clear date range when using single date navigation
  }

  const handleDateSelect = (date: Date, range?: { start: Date; end: Date }) => {
    if (!isNaN(date.getTime())) {
      updateSelectedDate(date)
    }
    if (range && !isNaN(range.start.getTime()) && !isNaN(range.end.getTime())) {
      setDateRange(range)
    } else {
      setDateRange(null)
    }
  }

  const handlePinClick = (pin: MapPin | any) => {
    setSelectedPin(pin)
    setDetailCardOpen(true)
  }

  const handleCloseDetailCard = () => {
    setDetailCardOpen(false)
    setSelectedPin(null)
  }

  const handleTruckDeleted = () => {
    // DO NOT refresh the map - just notify parent component
    
    // Notify parent component (Dashboard) - but no system refresh
    if (onTruckDeleted) {
      onTruckDeleted()
    }
  }

  // Distance measurement handlers
  const handleLoadRightClick = (loadPin: LoadPin) => {
    setSelectedLoad(loadPin)
    
    // If we have a selected truck, calculate distance immediately
    if (selectedTruck) {
      const distance = calculateDistance(
        loadPin.latitude,
        loadPin.longitude,
        selectedTruck.latitude,
        selectedTruck.longitude
      )
      
      setDistanceMeasurement({
        distance: distance.distance,
        unit: distance.unit,
        fromLoad: `${loadPin.city}, ${loadPin.state}`,
        toTruck: `${selectedTruck.city}, ${selectedTruck.state}`
      })
    }
  }

  const handleTruckRightClick = (truckPin: MapPin) => {
    setSelectedTruck(truckPin)
    
    // If we have a selected load, calculate distance immediately
    if (selectedLoad) {
      const distance = calculateDistance(
        selectedLoad.latitude,
        selectedLoad.longitude,
        truckPin.latitude,
        truckPin.longitude
      )
      
      setDistanceMeasurement({
        distance: distance.distance,
        unit: distance.unit,
        fromLoad: `${selectedLoad.city}, ${selectedLoad.state}`,
        toTruck: `${truckPin.city}, ${truckPin.state}`
      })
    }
  }

  const clearDistanceMeasurement = () => {
    setSelectedLoad(null)
    setSelectedTruck(null)
    setDistanceMeasurement(null)
  }

  const dates = availableDates()

  if (customerCards.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          The map will display truck availability pins for different cities across the USA.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <DateNavigation
        selectedDate={selectedDate}
        onPreviousDay={handlePreviousDay}
        onNextDay={handleNextDay}
        onDateSelect={handleDateSelect}
        availableDates={dates}
      />
      
      <TruckMap
        selectedDate={selectedDate}
        onDateChange={updateSelectedDate}
        onPinClick={handlePinClick}
        pins={pins}
        loadPins={loadPins}
        loading={loading || loadingLoads}
        onLoadRightClick={handleLoadRightClick}
        onTruckRightClick={handleTruckRightClick}
        selectedLoad={selectedLoad}
        selectedTruck={selectedTruck}
        distanceMeasurement={distanceMeasurement}
        onClearDistanceMeasurement={clearDistanceMeasurement}
      />
      
             {selectedPin && (
               <Box
                 sx={{
                   position: 'absolute',
                   top: 20,
                   right: 20,
                   zIndex: 1000,
                   maxWidth: 400,
                 }}
               >
                 {'type' in selectedPin && selectedPin.type === 'load' ? (
                   <LoadDetailCard
                     load={selectedPin}
                     onClose={handleCloseDetailCard}
                     open={detailCardOpen}
                   />
                 ) : (
                   <TruckDetailCard
                     pin={selectedPin as MapPin}
                     onClose={handleCloseDetailCard}
                     open={detailCardOpen}
                     onTruckDeleted={handleTruckDeleted}
                     onViewEmails={onViewEmails}
                   />
                 )}
               </Box>
             )}
    </Box>
  )
} 