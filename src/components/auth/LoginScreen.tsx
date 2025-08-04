'use client'

import { useMsal } from '@azure/msal-react'
import { loginRequest } from '@/lib/msalConfig'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Paper,
} from '@mui/material'
import { Email, TrendingUp, Security } from '@mui/icons-material'

export function LoginScreen() {
  const { instance } = useMsal()

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => {
      console.error('Login failed:', e)
    })
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={0} sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ mb: 4 }}>
          <Email color="primary" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h4" gutterBottom color="primary" fontWeight="bold">
            Email Monitor Dashboard
          </Typography>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            AI-Powered Truck Availability Monitoring
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Card sx={{ mb: 2, p: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TrendingUp color="success" />
              <Typography variant="body1">
                Real-time email monitoring and data extraction
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ mb: 2, p: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Security color="primary" />
              <Typography variant="body1">
                Secure Microsoft Graph API integration
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Button
          variant="contained"
          size="large"
          onClick={handleLogin}
          sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
          fullWidth
        >
          Sign in with Microsoft
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Sign in to access your email monitoring dashboard
        </Typography>
      </Paper>
    </Container>
  )
} 