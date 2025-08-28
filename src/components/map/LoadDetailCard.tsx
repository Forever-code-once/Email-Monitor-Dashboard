'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Divider,
  IconButton,
  Collapse,
  Grid,
} from '@mui/material'
import {
  LocalShipping,
  LocationOn,
  Schedule,
  Business,
  Person,
  Notes,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material'
import { LoadData } from '@/types'
import { formatLoadInfo } from '@/lib/loadGeocoding'

interface LoadDetailCardProps {
  load: LoadData
  onClose?: () => void
}

export function LoadDetailCard({ load, onClose }: LoadDetailCardProps) {
  const [expanded, setExpanded] = useState(false)
  const loadInfo = formatLoadInfo(load)

  const handleExpandClick = () => {
    setExpanded(!expanded)
  }

  return (
    <Card sx={{ 
      minWidth: 300, 
      maxWidth: 400,
      boxShadow: 3,
      border: '2px solid #1976d2'
    }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <LocalShipping sx={{ color: '#1976d2', mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Load #{loadInfo.refNumber}
          </Typography>
          <Chip 
            label="Available Load" 
            color="primary" 
            size="small"
            icon={<LocalShipping />}
          />
        </Box>

        {/* Company Info */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Business sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
            <Typography variant="subtitle1" fontWeight="bold">
              {loadInfo.company}
            </Typography>
          </Box>
          {loadInfo.dispatcher !== 'N/A' && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Person sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Dispatcher: {loadInfo.dispatcher}
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Pickup Information */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
            Pickup Details
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LocationOn sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2">
                  {loadInfo.startLocation}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2">
                  Date: {loadInfo.startDate}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Time: {loadInfo.startTime}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Delivery Information */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
            Delivery Details
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LocationOn sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2">
                  {loadInfo.endLocation}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2">
                  Date: {loadInfo.endDate}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Time: {loadInfo.endTime}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Departure Date */}
        {loadInfo.departDate !== 'TBD' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
              Departure
            </Typography>
            <Typography variant="body2">
              {loadInfo.departDate}
            </Typography>
          </Box>
        )}

        {/* Expandable Notes Section */}
        {loadInfo.notes !== 'No notes available' && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={handleExpandClick}>
                <Notes sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                <Typography variant="subtitle2" fontWeight="bold" color="primary">
                  Notes
                </Typography>
                <IconButton size="small" sx={{ ml: 'auto' }}>
                  {expanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {loadInfo.notes}
                  </Typography>
                </Box>
              </Collapse>
            </Box>
          </>
        )}

        {/* Close Button */}
        {onClose && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <IconButton 
              onClick={onClose}
              size="small"
              sx={{ 
                bgcolor: 'grey.100',
                '&:hover': { bgcolor: 'grey.200' }
              }}
            >
              ✕
            </IconButton>
          </Box>
        )}
      </CardContent>
    </Card>
  )
} 