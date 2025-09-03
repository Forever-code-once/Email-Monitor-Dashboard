'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  IconButton,
  Collapse,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material'
import {
  Close,
  LocalShipping,
  LocationOn,
  Schedule,
  Business,
  Person,
  Notes,
  ExpandMore,
  ExpandLess,
  Inventory,
} from '@mui/icons-material'
import { LoadData } from '@/types'
import { formatLoadInfo } from '@/lib/loadGeocoding'

interface LoadDetailCardProps {
  load: LoadData | any // Can be single load or grouped load pin
  onClose?: () => void
  open?: boolean
}

export function LoadDetailCard({ load, onClose, open = true }: LoadDetailCardProps) {
  const [expanded, setExpanded] = useState(false)
  
  // Handle both single load and grouped load pin structures
  const isGroupedPin = load && 'loads' in load && Array.isArray(load.loads)
  const loads = isGroupedPin ? load.loads : [load]
  const firstLoad = loads[0]
  const loadInfo = formatLoadInfo(firstLoad)

  const handleExpandClick = () => {
    setExpanded(!expanded)
  }

  // Group loads by company
  const companyGroups = loads.reduce((groups: any, load: LoadData) => {
    const company = load.company_name || 'Unknown Company'
    if (!groups[company]) {
      groups[company] = []
    }
    groups[company].push(load)
    return groups
  }, {})

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
              {isGroupedPin ? `${load.city}, ${load.state}` : `${loadInfo.startLocation}`}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <LocalShipping sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="body2" color="text.secondary">
            {loads.length} load{loads.length !== 1 ? 's' : ''} available
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {/* Available Loads Section */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LocalShipping sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight="medium">
              Available Loads
            </Typography>
          </Box>
          <Chip 
            label={isGroupedPin ? load.date : loadInfo.startDate} 
            color="primary" 
            variant="outlined"
            size="small"
          />
        </Box>

        {/* Loads List */}
        <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          {Object.entries(companyGroups).map(([company, companyLoads]: [string, any]) => (
            <Box key={company}>
              {/* Company Header */}
              <ListItem sx={{ py: 1, bgcolor: 'grey.50' }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business sx={{ color: 'primary.main', fontSize: 16 }} />
                      <Typography variant="subtitle2" fontWeight="bold">
                        {company}
                      </Typography>
                    </Box>
                  }
                  secondary={`${companyLoads.length} load${companyLoads.length !== 1 ? 's' : ''}`}
                />
              </ListItem>
              
              {/* Loads for this company */}
              {companyLoads.map((loadItem: LoadData, index: number) => {
                const itemInfo = formatLoadInfo(loadItem)
                return (
                  <ListItem key={`${loadItem.REF_NUMBER}-${index}`} sx={{ pl: 4, py: 1 }}>
                    <ListItemIcon>
                      <Inventory sx={{ color: 'text.secondary', fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            Load #{itemInfo.refNumber}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {itemInfo.startLocation} → {itemInfo.endLocation}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              Pickup: {itemInfo.startDate}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              Delivery: {itemInfo.endDate}
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                )
              })}
              
              {Object.keys(companyGroups).indexOf(company) < Object.keys(companyGroups).length - 1 && (
                <Divider />
              )}
            </Box>
          ))}
        </List>

        {/* Notes Section (if any loads have notes) */}
        {loads.some((loadItem: LoadData) => loadItem.notes && loadItem.notes !== 'No notes available') && (
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
                  {loads.map((loadItem: LoadData, index: number) => {
                    const itemInfo = formatLoadInfo(loadItem)
                    if (itemInfo.notes !== 'No notes available') {
                      return (
                        <Box key={index} sx={{ mb: 1 }}>
                          <Typography variant="caption" fontWeight="bold" color="primary">
                            Load #{itemInfo.refNumber}:
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {itemInfo.notes}
                          </Typography>
                        </Box>
                      )
                    }
                    return null
                  })}
                </Box>
              </Collapse>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" startIcon={<Close />}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}