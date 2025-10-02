'use client'

import { useState, useEffect } from 'react'
import { useMsal } from '@azure/msal-react'
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
} from '@mui/material'
import { Logout, Key, Menu, ChevronLeft } from '@mui/icons-material'
import { DarkModeToggle } from '../ui/DarkModeToggle'

interface HeaderProps {
  lastRefresh: Date
  wsConnected: boolean
  onLogout: () => void
  onSendToken: () => void
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function Header({ lastRefresh, wsConnected, onLogout, onSendToken, sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  return (
    <AppBar 
      position="static" 
      elevation={0} 
      sx={{ 
        width: '100vw',
        left: 0,
        right: 0
      }}
    >
      <Toolbar>
        {/* Sidebar Toggle Button */}
        <IconButton 
          onClick={onToggleSidebar}
          sx={{ 
            color: 'white',
            mr: 2,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          {sidebarCollapsed ? <Menu /> : <ChevronLeft />}
        </IconButton>
        
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Mr. Conard AI Truck & Loads Monitor
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box 
              sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                backgroundColor: wsConnected ? 'success.main' : 'error.main',
                animation: wsConnected ? 'pulse 2s infinite' : 'none'
              }} 
            />
            <Typography variant="body2" color={wsConnected ? 'success.main' : 'error.main'}>
              {wsConnected ? 'Real-time Active' : 'Manual Refresh Only'}
            </Typography>
            {!wsConnected && (
              <Typography variant="caption" color="warning.main">
                (Click refresh to retry)
              </Typography>
            )}
          </Box>
          <IconButton 
            color="inherit" 
            onClick={onSendToken} 
            disabled={false} 
            title="Send Access Token / Test Connection"
            sx={{ 
              color: 'inherit',
              opacity: 1
            }}
          >
            <Key />
          </IconButton>
          <DarkModeToggle />
          <IconButton color="inherit" onClick={onLogout}>
            <Logout />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  )
}