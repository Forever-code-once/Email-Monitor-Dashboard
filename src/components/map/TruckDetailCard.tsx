'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Paper,
  Checkbox,
  ListItemIcon,
} from '@mui/material'
import {
  Close,
  LocationOn,
  LocalShipping,
  CalendarToday,
  Email,
  Business,
  Delete,
} from '@mui/icons-material'
import { TruckDetailCardProps } from '@/types/map'
import { TruckAvailability } from '@/types'
import { useTheme } from '@/components/providers/ThemeProvider'
import { normalizeCityName } from '@/lib/geocoding'

export function TruckDetailCard({ pin, onClose, open, onTruckDeleted, onViewEmails }: TruckDetailCardProps) {
  const { darkMode } = useTheme()
  const [visibleTrucks, setVisibleTrucks] = useState<TruckAvailability[]>([])
  const [checkedTrucks, setCheckedTrucks] = useState<Set<string>>(new Set())

  // Load persistent state from localStorage
  useEffect(() => {
    if (open && pin) {
      // Pin ID is now just "city, state" format
      const storageKey = `truck-state-${pin.city}-${pin.state}`
      
      try {
        // Load deleted trucks from localStorage with error handling
        const deletedTrucksData = localStorage.getItem(`${storageKey}-deleted`)
        const deletedTrucks = deletedTrucksData ? JSON.parse(deletedTrucksData) : []
        
        if (!Array.isArray(deletedTrucks)) {
          console.warn('Invalid deleted trucks data, resetting to empty array')
          localStorage.removeItem(`${storageKey}-deleted`)
        }
        
        const filteredTrucks = pin.trucks.filter(truck => 
          !deletedTrucks.includes(truck.id)
        )
        setVisibleTrucks(filteredTrucks)

        // Load checked trucks from localStorage with error handling
        const checkedData = localStorage.getItem(`${storageKey}-checked`)
        const checked = checkedData ? JSON.parse(checkedData) : []
        
        if (!Array.isArray(checked)) {
          console.warn('Invalid checked trucks data, resetting to empty array')
          localStorage.removeItem(`${storageKey}-checked`)
          setCheckedTrucks(new Set())
        } else {
          setCheckedTrucks(new Set(checked))
        }
      } catch (error) {
        console.error('Error loading localStorage data:', error)
        // Clear corrupted data
        localStorage.removeItem(`${storageKey}-deleted`)
        localStorage.removeItem(`${storageKey}-checked`)
        setVisibleTrucks(pin.trucks)
        setCheckedTrucks(new Set())
      }
    }
  }, [open, pin])

  // Save state to localStorage
  const saveState = (deletedIds: string[], checkedIds: string[]) => {
    if (!pin) return
    
    try {
      // Pin ID is now just "city, state" format
      const storageKey = `truck-state-${pin.city}-${pin.state}`
      
      // Validate data before saving
      if (!Array.isArray(deletedIds) || !Array.isArray(checkedIds)) {
        console.error('Invalid data for localStorage, skipping save')
        return
      }
      
      localStorage.setItem(`${storageKey}-deleted`, JSON.stringify(deletedIds))
      localStorage.setItem(`${storageKey}-checked`, JSON.stringify(checkedIds))
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }

  const handleCheckboxChange = (truckId: string, checked: boolean) => {
    const newChecked = new Set(checkedTrucks)
    if (checked) {
      newChecked.add(truckId)
    } else {
      newChecked.delete(truckId)
    }
    setCheckedTrucks(newChecked)
    
    // Save to localStorage
    const deletedTrucks = JSON.parse(localStorage.getItem(`truck-state-${pin.city}-${pin.state}-deleted`) || '[]')
    saveState(deletedTrucks, Array.from(newChecked))
  }

  const handleDeleteTruck = async (truckId: string) => {
    try {
      
      // Call AWS RDS delete API
      const response = await fetch('/api/trucks/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ truckId }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        
        // Remove from visible trucks immediately (UI only)
        setVisibleTrucks(prev => prev.filter(truck => truck.id !== truckId))
        
        // Remove from checked trucks
        const newChecked = new Set(checkedTrucks)
        newChecked.delete(truckId)
        setCheckedTrucks(newChecked)
        
        // DO NOT refresh the system - just update UI locally
      } else {
        throw new Error(result.error || 'Failed to delete truck')
      }
    } catch (error) {
      console.error('❌ Error deleting truck:', error)
      alert('Failed to delete truck. Please try again.')
    }
  }

  const formatDate = (dateString: string) => {
    try {
      // Handle different date formats to prevent timezone issues
      let date: Date
      
      // For dates like "8/12" or "2024-08-12", parse carefully
      if (dateString.includes('/')) {
        // Handle MM/DD format - assume current year if not specified
        const parts = dateString.split('/')
        if (parts.length === 2) {
          // Add current year if not present
          const currentYear = new Date().getFullYear()
          const month = parseInt(parts[0])
          const day = parseInt(parts[1])
          
          // Validate month and day
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            date = new Date(currentYear, month - 1, day) // month is 0-indexed
          } else {
            console.warn('Invalid month/day in date string:', dateString)
            return dateString
          }
        } else {
          console.warn('Unexpected date format:', dateString)
          return dateString
        }
      } else if (dateString.includes('-')) {
        // Handle YYYY-MM-DD format
        const [year, month, day] = dateString.split('-').map(Number)
        if (year && month && day) {
          date = new Date(year, month - 1, day) // month is 0-indexed
        } else {
          console.warn('Invalid date format:', dateString)
          return dateString
        }
      } else {
        // Fallback to original parsing
        date = new Date(dateString)
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString)
        return dateString // Return original string if parsing fails
      }
      
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      return formattedDate
    } catch (error) {
      console.error('Error formatting date:', error, 'dateString:', dateString)
      return dateString // Return original string if formatting fails
    }
  }

  // Group trucks by customer and remove duplicates
  const groupTrucksByCustomer = () => {
    const customerGroups = new Map<string, TruckAvailability[]>()
    
    visibleTrucks.forEach(truck => {
      const customerKey = `${truck.customer}-${truck.customerEmail}`
      if (!customerGroups.has(customerKey)) {
        customerGroups.set(customerKey, [])
      }
      customerGroups.get(customerKey)!.push(truck)
    })
    
    return Array.from(customerGroups.entries()).map(([customerKey, trucks]) => {
      const firstTruck = trucks[0]
      
      // Remove duplicate trucks within the same customer
      const uniqueTrucks = trucks.filter((truck, index, self) => {
        // Find the first occurrence of this truck ID
        const firstIndex = self.findIndex(t => t.id === truck.id)
        
        // Keep only the first occurrence
        return index === firstIndex
      })
      
      
      return {
        customer: firstTruck.customer,
        email: firstTruck.customerEmail,
        trucks: uniqueTrucks
      }
    })
  }

  const customerGroups = groupTrucksByCustomer()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh',
          backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
          color: darkMode ? '#ffffff' : '#000000'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOn sx={{ color: 'primary.main' }} />
            <Typography variant="h6">
              {normalizeCityName(pin.city, pin.state)}, {pin.state}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
           <LocalShipping sx={{ color: 'text.secondary', fontSize: 20 }} />
           <Typography variant="body2" color="text.secondary">
             {customerGroups.reduce((total, group) => total + group.trucks.length, 0)} truck{customerGroups.reduce((total, group) => total + group.trucks.length, 0) !== 1 ? 's' : ''} available
           </Typography>
         </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CalendarToday sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight="medium">
              Available Trucks
            </Typography>
          </Box>
          <Chip 
            label={formatDate(pin.date)} 
            color="primary" 
            variant="outlined"
            size="small"
          />
        </Box>

                 <List sx={{ 
                   bgcolor: darkMode ? 'grey.900' : 'background.paper', 
                   borderRadius: 1, 
                   border: 1, 
                   borderColor: darkMode ? 'grey.700' : 'divider' 
                 }}>
           {customerGroups.map((customerGroup, customerIndex) => (
             <Box key={`${customerGroup.customer}-${customerGroup.email}`}>
               {/* Customer Header */}
               <ListItem sx={{ 
                 py: 1, 
                 bgcolor: darkMode ? 'grey.800' : 'grey.50',
                 color: darkMode ? 'text.primary' : 'text.primary'
               }}>
                 <ListItemText
                   primary={
                     <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                       <Business sx={{ 
                         color: darkMode ? 'primary.light' : 'primary.main', 
                         fontSize: 16 
                       }} />
                       <Typography 
                         variant="subtitle2" 
                         fontWeight="medium"
                         sx={{ color: darkMode ? 'text.primary' : 'text.primary' }}
                       >
                         {customerGroup.customer}
                       </Typography>
                     </Box>
                   }
                   secondary={
                     <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                       <Email sx={{ 
                         color: darkMode ? 'text.secondary' : 'text.secondary', 
                         fontSize: 14 
                       }} />
                       <Typography 
                         variant="body2" 
                         sx={{ color: darkMode ? 'text.secondary' : 'text.secondary' }}
                       >
                         {customerGroup.email}
                       </Typography>
                     </Box>
                   }
                 />
               </ListItem>
               
               {/* Customer's Trucks */}
               {customerGroup.trucks.map((truck, truckIndex) => (
                 <Box key={truck.id}>
                   <ListItem sx={{ py: 2, pl: 4 }}>
                     <ListItemIcon>
                       <Checkbox
                         edge="start"
                         checked={checkedTrucks.has(truck.id)}
                         onChange={(e) => handleCheckboxChange(truck.id, e.target.checked)}
                         color="primary"
                       />
                     </ListItemIcon>
                     <ListItemText
                       primary={
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                           <LocalShipping sx={{ color: 'primary.main', fontSize: 18 }} />
                           <Typography variant="subtitle2" fontWeight="medium">
                            {normalizeCityName(truck.city, truck.state)}, {truck.state}
                           </Typography>
                         </Box>
                       }
                       secondary={
                         <Box>
                           <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                             <strong>Date:</strong> {formatDate(truck.date)}
                           </Typography>
                           {truck.additionalInfo && (
                             <Typography variant="body2" color="text.secondary">
                               <strong>Additional Info:</strong> {truck.additionalInfo}
                             </Typography>
                           )}
                         </Box>
                       }
                     />
                     <IconButton
                       edge="end"
                       onClick={() => handleDeleteTruck(truck.id)}
                       color="error"
                       size="small"
                       sx={{ ml: 1 }}
                     >
                       <Delete />
                     </IconButton>
                   </ListItem>
                   {truckIndex < customerGroup.trucks.length - 1 && <Divider sx={{ ml: 4 }} />}
                 </Box>
               ))}
               
               {/* Divider between customers */}
               {customerIndex < customerGroups.length - 1 && <Divider />}
             </Box>
           ))}
         </List>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button 
          onClick={() => {
            setCheckedTrucks(new Set())
            saveState([], [])
          }} 
          variant="outlined"
          size="small"
        >
          Clear All Checkboxes
        </Button>
        <Button 
          onClick={() => {
            // Restore all deleted trucks
            const storageKey = `truck-state-${pin.city}-${pin.state}`
            localStorage.removeItem(`${storageKey}-deleted`)
            setVisibleTrucks(pin.trucks)
            if (onTruckDeleted) {
              onTruckDeleted()
            }
          }} 
          variant="outlined"
          size="small"
        >
          Restore Deleted
        </Button>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
                 <Button 
           variant="contained" 
           onClick={() => {
             if (customerGroups.length > 0 && onViewEmails) {
               onViewEmails(customerGroups[0].email)
             }
           }}
           disabled={customerGroups.length === 0 || !onViewEmails}
           title={`customerGroups: ${customerGroups.length}, onViewEmails: ${!!onViewEmails}`}
         >
           View Emails
         </Button>
      </DialogActions>
    </Dialog>
  )
} 