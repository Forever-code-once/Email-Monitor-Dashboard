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
import { convertLoadsToPins } from '@/lib/loadGeocoding'

interface MapViewProps {
  customerCards: any[] // Using existing customer cards data
  onViewEmails?: (customerEmail: string) => void
}

export function MapView({ customerCards, onViewEmails }: MapViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)
  
  // Debug: Log selected date on initialization
  useEffect(() => {
    console.log('🗺️ MapView initialized with selectedDate:', {
      date: selectedDate,
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      day: selectedDate.getDate(),
      isoString: selectedDate.toISOString()
    })
  }, [])
  const [pins, setPins] = useState<MapPin[]>([])
  const [loadPins, setLoadPins] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingLoads, setLoadingLoads] = useState(false)
  const [selectedPin, setSelectedPin] = useState<AnyMapPin | null>(null)
  const [detailCardOpen, setDetailCardOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Debug: Log customer cards data
  useEffect(() => {
    console.log('🗺️ MapView received customerCards:', {
      count: customerCards.length,
      sampleCard: customerCards[0] ? {
        customer: customerCards[0].customer,
        email: customerCards[0].customerEmail,
        truckCount: customerCards[0].trucks.length,
        sampleTruck: customerCards[0].trucks[0]
      } : null
    })
  }, [customerCards])

  // Fetch loads from database and create pins with date filtering
  const fetchAndCreateLoadPins = useCallback(async (date: Date, range?: { start: Date; end: Date }) => {
    setLoadingLoads(true)
    try {
      console.log('🗺️ Fetching loads from database for date:', {
        selectedDate: date.toISOString().split('T')[0],
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hasRange: !!range
      })
      const response = await fetch('/api/loads')
      const data = await response.json()
      
      if (data.success && data.loads) {
        console.log(`🗺️ Found ${data.loads.length} total loads from database`)
        
        // Filter loads by date range or selected date
        const filteredLoads = data.loads.filter((load: LoadData) => {
          // Use DEPART_DATE as the primary date field for filtering
          const dateField = load.DEPART_DATE || load.pu_drop_date1
          if (!dateField) {
            console.log(`⚠️ Load ${load.REF_NUMBER} has no start date, excluding`)
            return false
          }
          
          // Check if this is the default SQL Server date (1753-01-01) - treat as current date
          const isDefaultDate = dateField === '1753-01-01T00:00:00.000Z' || dateField === '1753-01-01'
          
          const loadDate = new Date(dateField)
          if (isNaN(loadDate.getTime())) {
            console.log(`⚠️ Load ${load.REF_NUMBER} has invalid date: ${dateField}`)
            return false
          }
          
          if (range) {
            // For default date loads, only include them if the range includes today
            if (isDefaultDate) {
              const today = new Date()
              const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const rangeIncludesToday = todayOnly >= range.start && todayOnly <= range.end
              
              console.log(`🗺️ Load ${load.REF_NUMBER} default date range check:`, {
                today: todayOnly.toISOString().split('T')[0],
                rangeStart: range.start.toISOString().split('T')[0],
                rangeEnd: range.end.toISOString().split('T')[0],
                isDefaultDate: isDefaultDate,
                rangeIncludesToday: rangeIncludesToday,
                matches: rangeIncludesToday
              })
              
              return rangeIncludesToday
            }
            
            // For regular dates, check if they fall within the range
            const matches = loadDate >= range.start && loadDate <= range.end
            console.log(`🗺️ Load ${load.REF_NUMBER} date range check:`, {
              loadDate: loadDate.toISOString().split('T')[0],
              dateField: dateField,
              isDefaultDate: isDefaultDate,
              rangeStart: range.start.toISOString().split('T')[0],
              rangeEnd: range.end.toISOString().split('T')[0],
              matches
            })
            return matches
          } else {
            // Check if load date matches selected date (ignore time)
            const selectedDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
            const loadDateOnly = new Date(loadDate.getFullYear(), loadDate.getMonth(), loadDate.getDate())
            
            // For default date loads, only show them if selected date is today
            if (isDefaultDate) {
              const today = new Date()
              const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const isToday = selectedDateOnly.getTime() === todayOnly.getTime()
              
              console.log(`🗺️ Load ${load.REF_NUMBER} default date check:`, {
                selectedDate: selectedDateOnly.toISOString().split('T')[0],
                today: todayOnly.toISOString().split('T')[0],
                isDefaultDate: isDefaultDate,
                isToday: isToday,
                matches: isToday,
                company: load.company_name?.trim()
              })
              
              return isToday
            }
            
            // For regular dates, check if they match the selected date
            const dateMatches = loadDateOnly.getTime() === selectedDateOnly.getTime()
            
            console.log(`🗺️ Load ${load.REF_NUMBER} date comparison:`, {
              selectedDate: selectedDateOnly.toISOString().split('T')[0],
              loadDate: loadDateOnly.toISOString().split('T')[0],
              dateField: dateField,
              isDefaultDate: isDefaultDate,
              matches: dateMatches,
              company: load.company_name?.trim()
            })
            
            return dateMatches
          }
        })
        
        console.log(`🗺️ Filtered to ${filteredLoads.length} loads for selected date/range`)
        
        // If no loads found for the selected date, show available dates
        if (filteredLoads.length === 0) {
          console.log(`⚠️ No loads found for selected date: ${date.toISOString().split('T')[0]}`)
          console.log(`📅 Available load dates:`, data.loads
            .filter((load: LoadData) => {
              const dateField = load.DEPART_DATE || load.pu_drop_date1
              return dateField && dateField !== '1753-01-01T00:00:00.000Z' && dateField !== '1753-01-01'
            })
            .map((load: LoadData) => new Date(load.DEPART_DATE || load.pu_drop_date1!).toISOString().split('T')[0])
            .filter((date: string, index: number, array: string[]) => array.indexOf(date) === index)
            .sort()
          )
        }
        
        const loadPins = await convertLoadsToPins(filteredLoads)
        setLoadPins(loadPins)
        console.log(`🗺️ Created ${loadPins.length} load pins`)
      } else {
        console.error('❌ Failed to fetch loads:', data.error)
        setLoadPins([])
      }
    } catch (error) {
      console.error('❌ Error fetching loads:', error)
      setLoadPins([])
    } finally {
      setLoadingLoads(false)
    }
  }, [])

  // Fetch loads when date changes
  useEffect(() => {
    if (initialized && !isNaN(selectedDate.getTime())) {
      fetchAndCreateLoadPins(selectedDate, dateRange || undefined)
    }
  }, [selectedDate, dateRange, fetchAndCreateLoadPins, initialized])

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
    
    console.log('🗺️ Available dates from customer cards:', validDates.map(d => d.toISOString().split('T')[0]))
    return validDates
  }, [customerCards])

  // Convert truck data to map pins
  const createMapPins = useCallback(async (date: Date, range?: { start: Date; end: Date } | null) => {
    console.log('🗺️ createMapPins called with:', { date, range, customerCardsLength: customerCards.length })
    
    if (customerCards.length === 0) {
      console.log('🗺️ No customer cards available, skipping pin creation')
      setPins([])
      return
    }
    
    // Validate date parameters
    if (isNaN(date.getTime())) {
      console.log('🗺️ Invalid date provided, skipping pin creation')
      setPins([])
      return
    }
    
    if (range && (isNaN(range.start.getTime()) || isNaN(range.end.getTime()))) {
      console.log('🗺️ Invalid date range provided, skipping pin creation')
      setPins([])
      return
    }
    
    setLoading(true)
    
    try {
      let trucksForDate: TruckAvailability[] = []
      
      console.log('🗺️ Creating map pins for:', { 
        date: isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString().split('T')[0], 
        range 
      })
      console.log('🗺️ Available customer cards:', customerCards.length)
      
      // Debug: Log first few customer cards
      if (customerCards.length > 0) {
        console.log('🗺️ Sample customer card:', {
          customer: customerCards[0].customer,
          email: customerCards[0].customerEmail,
          truckCount: customerCards[0].trucks.length,
          sampleTruck: customerCards[0].trucks[0]
        })
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
        
        console.log('🗺️ Filtering for date range:', startStr, 'to', endStr)
        
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
        
        console.log('🗺️ Filtering for single date:', dateStr)
        
        customerCards.forEach(card => {
          console.log('🗺️ Checking customer card:', {
            customer: card.customer,
            email: card.customerEmail,
            truckCount: card.trucks.length
          })
          
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
             
             console.log('🗺️ Checking truck:', {
               originalDate: truckDateStr,
               normalizedTruckDate,
               normalizedTargetDate,
               city: truck.city,
               state: truck.state,
               matches: normalizedTruckDate === normalizedTargetDate
             })
             
             if (normalizedTruckDate === normalizedTargetDate) {
               trucksForDate.push(truck)
             }
          })
        })
      }

             console.log('🗺️ Found trucks for date/range:', trucksForDate.length)
       console.log('🗺️ All trucks found:', trucksForDate.map(t => ({
         customer: t.customer,
         email: t.customerEmail,
         date: t.date,
         city: t.city,
         state: t.state
       })))

       if (trucksForDate.length === 0) {
         console.log('🗺️ No trucks found for date, setting empty pins')
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
            console.log('🗺️ Debug: Truck filtered out as deleted:', {
              customer: truck.customer,
              email: truck.customerEmail,
              city: truck.city,
              state: truck.state,
              id: truck.id
            })
          }
          
          return !isDeleted
        } catch (error) {
          console.error('Error checking deleted trucks:', error)
          return true // Show the truck if there's an error
        }
      })

      console.log('🗺️ Filtered trucks after removing deleted:', filteredTrucks.length)

      // Group trucks by location only (not by customer email)
      const locationGroups = new Map<string, TruckAvailability[]>()
      
      console.log('🗺️ Debug: Filtered trucks before grouping:', filteredTrucks.map(t => ({
        customer: t.customer,
        email: t.customerEmail,
        city: t.city,
        state: t.state,
        date: t.date
      })))
      
      filteredTrucks.forEach(truck => {
        // Group by location only - all customers at same location will be in one pin
        const key = `${truck.city}, ${truck.state}`.toLowerCase()
        if (!locationGroups.has(key)) {
          locationGroups.set(key, [])
        }
        locationGroups.get(key)!.push(truck)
      })
      
      console.log('🗺️ Debug: Location groups created:', Array.from(locationGroups.entries()).map(([key, trucks]) => ({
        key,
        customerCount: trucks.length,
        customers: trucks.map(t => ({ customer: t.customer, email: t.customerEmail }))
      })))

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
      
      console.log('🗺️ Debug: Final pins created:', validPins.map(pin => ({
        id: pin.id,
        city: pin.city,
        state: pin.state,
        truckCount: pin.truckCount,
        customers: pin.trucks.map(t => ({ customer: t.customer, email: t.customerEmail }))
      })))
      
      setPins(validPins)
                  const dateDisplay = range ? 
              `${isNaN(range.start.getTime()) ? new Date().toISOString().split('T')[0] : range.start.toISOString().split('T')[0]} - ${isNaN(range.end.getTime()) ? new Date().toISOString().split('T')[0] : range.end.toISOString().split('T')[0]}` : 
              (isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0])
      console.log(`🗺️ Created ${validPins.length} map pins for ${dateDisplay}`)
      
    } catch (error) {
      console.error('❌ Error creating map pins:', error)
    } finally {
      setLoading(false)
    }
  }, [customerCards])

  // Initialize with first available date
  useEffect(() => {
    if (!initialized && customerCards.length > 0) {
      const dates = availableDates()
      if (dates.length > 0 && !isNaN(dates[0].getTime())) {
        console.log('🗺️ Initializing with first available date:', dates[0].toISOString().split('T')[0])
        console.log('🗺️ Date details:', {
          year: dates[0].getFullYear(),
          month: dates[0].getMonth() + 1,
          day: dates[0].getDate()
        })
        setSelectedDate(dates[0])
        setInitialized(true)
      }
    }
  }, [customerCards, availableDates, initialized])

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

  const handlePreviousDay = () => {
    if (!isNaN(selectedDate.getTime())) {
      const prevDate = new Date(selectedDate)
      prevDate.setDate(prevDate.getDate() - 1)
      setSelectedDate(prevDate)
    }
    setDateRange(null) // Clear date range when using single date navigation
  }

  const handleNextDay = () => {
    if (!isNaN(selectedDate.getTime())) {
      const nextDate = new Date(selectedDate)
      nextDate.setDate(nextDate.getDate() + 1)
      setSelectedDate(nextDate)
    }
    setDateRange(null) // Clear date range when using single date navigation
  }

  const handleDateSelect = (date: Date, range?: { start: Date; end: Date }) => {
    if (!isNaN(date.getTime())) {
      setSelectedDate(date)
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
    // Refresh the map pins to reflect the deletion
    if (initialized && !isNaN(selectedDate.getTime())) {
      createMapPins(selectedDate, dateRange)
    }
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
          onDateChange={setSelectedDate}
          onPinClick={handlePinClick}
          pins={pins}
          loadPins={loadPins}
          loading={loading || loadingLoads}
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