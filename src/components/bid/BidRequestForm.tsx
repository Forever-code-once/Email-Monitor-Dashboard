'use client'

import { useState } from 'react'
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper,
  Alert,
  Slider,
  useTheme
} from '@mui/material'
import { BidRequestFormData } from '@/types/bid'
import { useTheme as useCustomTheme } from '@/components/providers/ThemeProvider'

interface BidRequestFormProps {
  onSubmit: (data: BidRequestFormData) => void
  loading?: boolean
}

export function BidRequestForm({ onSubmit, loading = false }: BidRequestFormProps) {
  const [formData, setFormData] = useState<BidRequestFormData>({
    customerName: '',
    pickupCity: '',
    destinationCity: '',
    timerInput: '',
    radiusMiles: 50
  })
  const [error, setError] = useState<string>('')
  const theme = useTheme()
  const { darkMode } = useCustomTheme()

  const parseTimerInput = (input: string): number => {
    if (!input.trim()) return 0
    
    const inputLower = input.toLowerCase().trim()
    let totalMinutes = 0
    
    // Parse hours (h)
    const hourMatch = inputLower.match(/(\d+)h/)
    if (hourMatch) {
      totalMinutes += parseInt(hourMatch[1]) * 60
    }
    
    // Parse minutes (m)
    const minuteMatch = inputLower.match(/(\d+)m/)
    if (minuteMatch) {
      totalMinutes += parseInt(minuteMatch[1])
    }
    
    return totalMinutes
  }

  const validateForm = (): boolean => {
    if (!formData.customerName.trim()) {
      setError('Customer name is required')
      return false
    }
    
    if (!formData.pickupCity.trim()) {
      setError('Pickup city is required')
      return false
    }
    
    if (!formData.destinationCity.trim()) {
      setError('Destination city is required')
      return false
    }
    
    const minutes = parseTimerInput(formData.timerInput)
    if (minutes <= 0) {
      setError('Timer must be greater than 0 (e.g., 1h, 15m, 1h 15m)')
      return false
    }
    
    if ((formData.radiusMiles || 50) < 1 || (formData.radiusMiles || 50) > 3000) {
      setError('Radius must be between 1 and 3000 miles')
      return false
    }
    
    setError('')
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    onSubmit(formData)
    
    // Reset form
    setFormData({
      customerName: '',
      pickupCity: '',
      destinationCity: '',
      timerInput: '',
      radiusMiles: 50
    })
  }

  const handleInputChange = (field: keyof BidRequestFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
    if (error) setError('') // Clear error when user starts typing
  }

  const handleRadiusChange = (_: Event, value: number | number[]) => {
    setFormData(prev => ({
      ...prev,
      radiusMiles: value as number
    }))
  }

  return (
    <Paper sx={{ 
      p: 3, 
      mb: 3,
      borderRadius: 3,
      border: `1px solid ${darkMode ? theme.palette.divider : '#e3f2fd'}`,
      boxShadow: darkMode 
        ? '0 2px 8px rgba(0,0,0,0.3)' 
        : '0 2px 8px rgba(0,0,0,0.08)',
      background: darkMode 
        ? `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
        : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
      transition: 'all 0.3s ease-in-out'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box sx={{ 
          width: 32, 
          height: 32, 
          borderRadius: '50%', 
          backgroundColor: darkMode ? theme.palette.primary.main : '#1976d2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 2,
          transition: 'all 0.3s ease-in-out'
        }}>
          <Typography sx={{ color: 'white', fontSize: '1.2rem' }}>+</Typography>
        </Box>
        <Typography variant="h6" sx={{ 
          fontWeight: 'bold', 
          color: darkMode ? theme.palette.primary.light : '#1976d2',
          transition: 'all 0.3s ease-in-out'
        }}>
          Add Bid Request
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Customer Name *"
          value={formData.customerName}
          onChange={handleInputChange('customerName')}
          margin="normal"
          required
          disabled={loading}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: darkMode ? theme.palette.background.paper : 'white',
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: darkMode ? theme.palette.primary.light : '#1976d2',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: darkMode ? theme.palette.primary.light : '#1976d2',
                borderWidth: 2,
              },
            },
            '& .MuiInputLabel-root': {
              color: darkMode ? theme.palette.text.primary : 'inherit',
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: darkMode ? theme.palette.primary.light : '#1976d2',
            },
          }}
        />
        
        <TextField
          fullWidth
          label="Pickup City/State *"
          value={formData.pickupCity}
          onChange={handleInputChange('pickupCity')}
          margin="normal"
          required
          disabled={loading}
          placeholder="e.g., Nashville, TN"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: darkMode ? theme.palette.background.paper : 'white',
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: darkMode ? theme.palette.primary.light : '#1976d2',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: darkMode ? theme.palette.primary.light : '#1976d2',
                borderWidth: 2,
              },
            },
            '& .MuiInputLabel-root': {
              color: darkMode ? theme.palette.text.primary : 'inherit',
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: darkMode ? theme.palette.primary.light : '#1976d2',
            },
          }}
        />
        
        <TextField
          fullWidth
          label="Destination City/State *"
          value={formData.destinationCity}
          onChange={handleInputChange('destinationCity')}
          margin="normal"
          required
          disabled={loading}
          placeholder="e.g., Norfolk, VA"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: darkMode ? theme.palette.background.paper : 'white',
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: darkMode ? theme.palette.primary.light : '#1976d2',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: darkMode ? theme.palette.primary.light : '#1976d2',
                borderWidth: 2,
              },
            },
            '& .MuiInputLabel-root': {
              color: darkMode ? theme.palette.text.primary : 'inherit',
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: darkMode ? theme.palette.primary.light : '#1976d2',
            },
          }}
        />
        
        <TextField
          fullWidth
          label="Bid Timer *"
          value={formData.timerInput}
          onChange={handleInputChange('timerInput')}
          margin="normal"
          required
          disabled={loading}
          placeholder="e.g., 1h, 15m, 1h 15m"
          helperText="Format: 1h = 1 hour, 15m = 15 minutes, 1h 15m = 1 hour 15 minutes"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: darkMode ? theme.palette.background.paper : 'white',
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: darkMode ? theme.palette.primary.light : '#1976d2',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: darkMode ? theme.palette.primary.light : '#1976d2',
                borderWidth: 2,
              },
            },
            '& .MuiInputLabel-root': {
              color: darkMode ? theme.palette.text.primary : 'inherit',
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: darkMode ? theme.palette.primary.light : '#1976d2',
            },
            '& .MuiFormHelperText-root': {
              fontSize: '0.75rem',
              color: darkMode ? theme.palette.text.secondary : '#666',
            },
          }}
        />
        
        <Box sx={{ 
          mt: 3, 
          mb: 2,
          p: 2,
          backgroundColor: darkMode ? theme.palette.background.default : '#f8f9fa',
          borderRadius: 2,
          border: `1px solid ${darkMode ? theme.palette.divider : '#e3f2fd'}`,
          transition: 'all 0.3s ease-in-out'
        }}>
          <Typography variant="body2" gutterBottom sx={{ 
            fontWeight: 'medium', 
            color: darkMode ? theme.palette.primary.light : '#1976d2',
            transition: 'all 0.3s ease-in-out'
          }}>
            🔍 Search Radius: {formData.radiusMiles} miles
          </Typography>
          <Slider
            value={formData.radiusMiles}
            onChange={handleRadiusChange}
            min={1}
            max={3000}
            step={10}
            marks={[
              { value: 50, label: '50' },
              { value: 100, label: '100' },
              { value: 500, label: '500' },
              { value: 1000, label: '1000' }
            ]}
            disabled={loading}
            sx={{
              '& .MuiSlider-thumb': {
                backgroundColor: darkMode ? theme.palette.primary.light : '#1976d2',
                '&:hover': {
                  backgroundColor: darkMode ? theme.palette.primary.main : '#1565c0',
                },
              },
              '& .MuiSlider-track': {
                backgroundColor: darkMode ? theme.palette.primary.light : '#1976d2',
              },
              '& .MuiSlider-rail': {
                backgroundColor: darkMode ? theme.palette.divider : '#e3f2fd',
              },
            }}
          />
        </Box>
        
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ 
            mt: 3,
            py: 1.5,
            borderRadius: 2,
            background: darkMode 
              ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
              : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            boxShadow: darkMode 
              ? '0 4px 12px rgba(144, 202, 249, 0.3)'
              : '0 4px 12px rgba(25, 118, 210, 0.3)',
            '&:hover': {
              background: darkMode 
                ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
                : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
              boxShadow: darkMode 
                ? '0 6px 16px rgba(144, 202, 249, 0.4)'
                : '0 6px 16px rgba(25, 118, 210, 0.4)',
            },
            '&:disabled': {
              background: darkMode ? theme.palette.action.disabled : '#e0e0e0',
              boxShadow: 'none',
            },
            transition: 'all 0.3s ease-in-out'
          }}
          disabled={loading}
          size="medium"
        >
          {loading ? '⏳ Adding...' : '🚛 Add Bid Request'}
        </Button>
      </Box>
    </Paper>
  )
}