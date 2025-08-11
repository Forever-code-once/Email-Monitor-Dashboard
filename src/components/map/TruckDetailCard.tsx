'use client'

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
} from '@mui/material'
import {
  Close,
  LocationOn,
  LocalShipping,
  CalendarToday,
  Email,
  Business,
} from '@mui/icons-material'
import { TruckDetailCardProps } from '@/types/map'

export function TruckDetailCard({ pin, onClose, open }: TruckDetailCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
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
            {pin.truckCount} truck{pin.truckCount !== 1 ? 's' : ''} available
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
          {pin.trucks.map((truck, index) => (
            <Box key={index}>
              <ListItem sx={{ py: 2 }}>
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
              </ListItem>
              {index < pin.trucks.length - 1 && <Divider />}
            </Box>
          ))}
        </List>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
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