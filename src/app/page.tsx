'use client'

import { useIsAuthenticated } from '@azure/msal-react'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { Container } from '@mui/material'

export default function Home() {
  const isAuthenticated = useIsAuthenticated()

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Dashboard />
    </Container>
  )
} 