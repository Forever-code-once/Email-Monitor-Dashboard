'use client'

import {
  Box,
  Button,
  Typography,
  IconButton,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material'
import { 
  ChevronLeft, 
  ChevronRight, 
  CalendarToday,
  Today,
  CalendarMonth
} from '@mui/icons-material'
import { DateNavigationProps } from '@/types/map'
import { useState } from 'react'

export function DateNavigation({
  selectedDate,
  onPreviousDay,
  onNextDay,
  onDateSelect,
  availableDates
}: DateNavigationProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [dateRangeMode, setDateRangeMode] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    try {
      return selectedDate.toISOString().split('T')[0]
    } catch (error) {
      return new Date().toISOString().split('T')[0]
    }
  })
  const [endDate, setEndDate] = useState(() => {
    try {
      return selectedDate.toISOString().split('T')[0]
    } catch (error) {
      return new Date().toISOString().split('T')[0]
    }
  })
  const [activeDateRange, setActiveDateRange] = useState<{ start: Date; end: Date } | null>(null)
  
  const formatDate = (date: Date): string => {
    try {
      if (isNaN(date.getTime())) {
        return 'Invalid Date'
      }
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch (error) {
      return 'Invalid Date'
    }
  }

  const isToday = (date: Date): boolean => {
    if (isNaN(date.getTime())) return false
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isDateAvailable = (date: Date): boolean => {
    if (isNaN(date.getTime())) return false
    return availableDates.some(availableDate => 
      !isNaN(availableDate.getTime()) && availableDate.toDateString() === date.toDateString()
    )
  }

  const handlePreviousDay = () => {
    if (isNaN(selectedDate.getTime())) {
      console.warn('Invalid selectedDate in handlePreviousDay')
      return
    }
    
    const previousDate = new Date(selectedDate)
    previousDate.setDate(previousDate.getDate() - 1)
    
    // Clear any active date range when using single date navigation
    setActiveDateRange(null)
    
    // Find the most recent available date before the current selection
    const availableBefore = availableDates
      .filter(date => !isNaN(date.getTime()) && date < selectedDate)
      .sort((a, b) => b.getTime() - a.getTime())
    
    if (availableBefore.length > 0) {
      onDateSelect(availableBefore[0])
    } else {
      onPreviousDay()
    }
  }

  const handleNextDay = () => {
    if (isNaN(selectedDate.getTime())) {
      console.warn('Invalid selectedDate in handleNextDay')
      return
    }
    
    const nextDate = new Date(selectedDate)
    nextDate.setDate(nextDate.getDate() + 1)
    
    // Clear any active date range when using single date navigation
    setActiveDateRange(null)
    
    // Find the next available date after the current selection
    const availableAfter = availableDates
      .filter(date => !isNaN(date.getTime()) && date > selectedDate)
      .sort((a, b) => a.getTime() - b.getTime())
    
    if (availableAfter.length > 0) {
      onDateSelect(availableAfter[0])
    } else {
      onNextDay()
    }
  }

  const handleTodayClick = () => {
    const today = new Date()
    
    // Clear any active date range when using Today button
    setActiveDateRange(null)
    
    if (isDateAvailable(today)) {
      onDateSelect(today)
    } else {
      // Find the most recent available date
      const recentDates = availableDates
        .filter(date => !isNaN(date.getTime()) && date <= today)
        .sort((a, b) => b.getTime() - a.getTime())
      
      if (recentDates.length > 0) {
        onDateSelect(recentDates[0])
      }
    }
  }

  const handleCalendarOpen = () => {
    setStartDate(isNaN(selectedDate.getTime()) ? new Date().toISOString().split('T')[0] : selectedDate.toISOString().split('T')[0])
    setEndDate(isNaN(selectedDate.getTime()) ? new Date().toISOString().split('T')[0] : selectedDate.toISOString().split('T')[0])
    setCalendarOpen(true)
  }

  const handleCalendarClose = () => {
    setCalendarOpen(false)
  }

  const handleDateApply = () => {
    const newDate = new Date(startDate)
    if (!isNaN(newDate.getTime())) {
      setActiveDateRange(null) // Clear any active date range
      onDateSelect(newDate)
    }
    setCalendarOpen(false)
  }

  const handleDateRangeApply = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      // Store the active date range
      setActiveDateRange({ start, end })
      
      // Pass the date range to the parent component
      onDateSelect(start, { start, end })
    }
    setCalendarOpen(false)
  }

  return (
    <>
      <Paper 
        elevation={2} 
        sx={{ 
          p: 2, 
          mb: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          flexWrap: 'wrap'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarToday sx={{ color: 'primary.main' }} />
          <Typography variant="h6" component="div">
            Truck Availability Map
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
          <IconButton 
            onClick={handlePreviousDay}
            disabled={isNaN(selectedDate.getTime()) || !isDateAvailable(new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000))}
            size="small"
          >
            <ChevronLeft />
          </IconButton>

          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            minWidth: activeDateRange ? 200 : 120
          }}>
            <Typography variant="body1" fontWeight="medium">
              {activeDateRange && !isNaN(activeDateRange.start.getTime()) && !isNaN(activeDateRange.end.getTime())
                ? `${formatDate(activeDateRange.start)} - ${formatDate(activeDateRange.end)}`
                : formatDate(selectedDate)
              }
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {availableDates.filter(date => !isNaN(date.getTime())).length} dates available
            </Typography>
          </Box>

          <IconButton 
            onClick={handleNextDay}
            disabled={isNaN(selectedDate.getTime()) || !isDateAvailable(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000))}
            size="small"
          >
            <ChevronRight />
          </IconButton>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<Today />}
          onClick={handleTodayClick}
          disabled={!isDateAvailable(new Date())}
          sx={{ textTransform: 'none' }}
        >
          Today
        </Button>

        <Button
          variant="contained"
          size="small"
          startIcon={<CalendarMonth />}
          onClick={handleCalendarOpen}
          sx={{ textTransform: 'none' }}
        >
          Calendar
        </Button>

        {activeDateRange && !isNaN(activeDateRange.start.getTime()) && !isNaN(activeDateRange.end.getTime()) && (
          <Chip 
            label={`${activeDateRange.start.toLocaleDateString()} - ${activeDateRange.end.toLocaleDateString()}`}
            color="secondary" 
            size="small"
            variant="outlined"
          />
        )}

        {!isNaN(selectedDate.getTime()) && isToday(selectedDate) && (
          <Chip 
            label="Current Day" 
            color="primary" 
            size="small"
            variant="outlined"
          />
        )}
      </Paper>

      {/* Calendar Dialog */}
      <Dialog open={calendarOpen} onClose={handleCalendarClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonth sx={{ color: 'primary.main' }} />
            Select Date
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Selection Mode</InputLabel>
              <Select
                value={dateRangeMode ? 'range' : 'single'}
                onChange={(e) => setDateRangeMode(e.target.value === 'range')}
                label="Selection Mode"
              >
                <MenuItem value="single">Single Date</MenuItem>
                <MenuItem value="range">Date Range</MenuItem>
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid item xs={dateRangeMode ? 6 : 12}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              {dateRangeMode && (
                <Grid item xs={6}>
                  <TextField
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              )}
            </Grid>

            {dateRangeMode && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Date range selection will show trucks available between {startDate} and {endDate}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCalendarClose}>Cancel</Button>
          <Button 
            onClick={dateRangeMode ? handleDateRangeApply : handleDateApply}
            variant="contained"
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
} 