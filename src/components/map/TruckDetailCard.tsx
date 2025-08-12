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

export function TruckDetailCard({ pin, onClose, open, onTruckDeleted }: TruckDetailCardProps) {
  const [visibleTrucks, setVisibleTrucks] = useState<TruckAvailability[]>([])
  const [checkedTrucks, setCheckedTrucks] = useState<Set<string>>(new Set())

  // Load persistent state from localStorage
  useEffect(() => {
    if (open && pin) {
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

  const handleDeleteTruck = (truckId: string) => {
    // Remove from visible trucks
    setVisibleTrucks(prev => prev.filter(truck => truck.id !== truckId))
    
    // Remove from checked trucks
    const newChecked = new Set(checkedTrucks)
    newChecked.delete(truckId)
    setCheckedTrucks(newChecked)
    
    // Save to localStorage
    const deletedTrucks = JSON.parse(localStorage.getItem(`truck-state-${pin.city}-${pin.state}-deleted`) || '[]')
    const newDeleted = [...deletedTrucks, truckId]
    saveState(newDeleted, Array.from(newChecked))
    
    // Notify parent component to refresh map
    if (onTruckDeleted) {
      onTruckDeleted()
    }
  }

  const formatDate = (dateString: string) => {
    try {
      // Handle different date formats to prevent timezone issues
      let date: Date
      
      // If it's already a valid date string, use it directly
      if (dateString.includes('-') || dateString.includes('/')) {
        // For dates like "8/12" or "2024-08-12", parse carefully
        if (dateString.includes('/')) {
          // Handle MM/DD format - assume current year if not specified
          const parts = dateString.split('/')
          if (parts.length === 2) {
            // Add current year if not present
            const currentYear = new Date().getFullYear()
            dateString = `${currentYear}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
          }
        }
        
        // Create date in local timezone to avoid timezone shifts
        const [year, month, day] = dateString.split('-').map(Number)
        date = new Date(year, month - 1, day) // month is 0-indexed
      } else {
        // Fallback to original parsing
        date = new Date(dateString)
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString)
        return dateString // Return original string if parsing fails
      }
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (error) {
      console.error('Error formatting date:', error, 'dateString:', dateString)
      return dateString // Return original string if formatting fails
    }
  }

  const getCustomerInfo = () => {
    if (pin.trucks.length === 0) return null
    
    const firstTruck = pin.trucks[0]
    return {
      customer: firstTruck.customer || 'Unknown Customer',
      email: firstTruck.customerEmail || 'No email available'
    }
  }

  const customerInfo = getCustomerInfo()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOn sx={{ color: 'primary.main' }} />
            <Typography variant="h6">
              {pin.city}, {pin.state}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <LocalShipping sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="body2" color="text.secondary">
            {visibleTrucks.length} truck{visibleTrucks.length !== 1 ? 's' : ''} available
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Box sx={{ mb: 3 }}>
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Business sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight="medium">
                Customer Information
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ mb: 1 }}>
              {customerInfo?.customer}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Email sx={{ color: 'text.secondary', fontSize: 16 }} />
              <Typography variant="body2" color="text.secondary">
                {customerInfo?.email}
              </Typography>
            </Box>
          </Paper>
        </Box>

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

        <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          {visibleTrucks.map((truck, index) => (
            <Box key={truck.id}>
              <ListItem sx={{ py: 2 }}>
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
                        Truck {index + 1}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        <strong>Location:</strong> {truck.city}, {truck.state}
                      </Typography>
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
              {index < visibleTrucks.length - 1 && <Divider />}
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
            if (customerInfo?.email) {
              // You can implement email viewing functionality here
              console.log('View emails for:', customerInfo.email)
            }
          }}
          disabled={!customerInfo?.email}
        >
          View Emails
        </Button>
      </DialogActions>
    </Dialog>
  )
} 