'use client'

import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  IconButton,
  Chip,
  Box,
  Divider,
  Collapse,
} from '@mui/material'
import { Delete, Email, Forward, ExpandMore, ExpandLess, AccessTime } from '@mui/icons-material'
import { EmailSenderCard as EmailSenderCardType } from '@/types'
import { useState } from 'react'

interface EmailSenderCardProps {
  senderCard: EmailSenderCardType
  onCheckEmail: (emailId: string) => void
  onDeleteEmail: (emailId: string) => void
}

export function EmailSenderCard({
  senderCard,
  onCheckEmail,
  onDeleteEmail,
}: EmailSenderCardProps) {
  const [expanded, setExpanded] = useState(false)

  const formatEmailDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const formatLastEmailDate = (date: Date): string => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const checkedCount = senderCard.emails.filter(email => email.isChecked).length
  const forwardedCount = senderCard.emails.filter(email => email.isForwarded).length

  // Sort emails by date (newest first)
  const sortedEmails = [...senderCard.emails].sort((a, b) => 
    new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime()
  )

  // Show only the most recent 3 emails when collapsed
  const emailsToShow = expanded ? sortedEmails : sortedEmails.slice(0, 3)

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Typography variant="h6" component="div" noWrap>
            {senderCard.senderName}
          </Typography>
        }
        subheader={
          <Box>
            <Typography variant="body2" color="text.secondary" noWrap>
              {senderCard.senderEmail}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last email: {formatLastEmailDate(senderCard.lastEmailDate)}
            </Typography>
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Chip
              label={`${senderCard.totalEmails} emails`}
              color="primary"
              size="small"
            />
            {forwardedCount > 0 && (
              <Chip
                icon={<Forward />}
                label={`${forwardedCount} forwarded`}
                color="secondary"
                size="small"
              />
            )}
            {checkedCount > 0 && (
              <Chip
                label={`${checkedCount} checked`}
                color="success"
                size="small"
              />
            )}
          </Box>
        }
      />

      <CardContent sx={{ flexGrow: 1, pt: 0 }}>
        {senderCard.emails.length === 0 ? (
          <Typography color="text.secondary" align="center">
            No emails
          </Typography>
        ) : (
          <>
            <List dense disablePadding>
              {emailsToShow.map((email) => (
                <ListItem
                  key={email.id}
                  sx={{
                    py: 1,
                    px: 1,
                    backgroundColor: email.isChecked ? 'action.selected' : 'transparent',
                    borderRadius: 1,
                    mb: 1,
                    border: '1px solid',
                    borderColor: email.isChecked ? 'primary.main' : 'divider',
                  }}
                >
                  <Checkbox
                    edge="start"
                    checked={email.isChecked}
                    onChange={() => onCheckEmail(email.id)}
                    size="small"
                  />
                  
                  <ListItemText
                    primary={email.subject}
                    secondary={
                      <>
                        <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTime sx={{ fontSize: 12 }} />
                          {formatEmailDate(email.receivedDateTime)}
                        </Typography>
                        {email.isForwarded && email.originalSender && (
                          <Typography variant="caption" color="primary" component="span" sx={{ fontWeight: 'bold', display: 'block' }}>
                            Original: {email.originalSender.name}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', mt: 0.5 }}>
                          {email.bodyPreview.substring(0, 80)}...
                        </Typography>
                      </>
                    }
                    primaryTypographyProps={{ 
                      variant: "body2", 
                      fontWeight: "medium", 
                      noWrap: true,
                      sx: { display: 'flex', alignItems: 'center', gap: 0.5 }
                    }}
                    secondaryTypographyProps={{ component: 'div' }}
                    sx={{ ml: 0.5 }}
                  />
                  
                  {email.isForwarded && (
                    <Chip 
                      icon={<Forward />} 
                      label="Fwd" 
                      size="small" 
                      color="secondary"
                      sx={{ fontSize: '0.7rem', height: '20px', mr: 1 }}
                    />
                  )}
                  
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => onDeleteEmail(email.id)}
                      sx={{ color: 'error.main' }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            
            {senderCard.emails.length > 3 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <IconButton
                    onClick={() => setExpanded(!expanded)}
                    size="small"
                    sx={{ color: 'primary.main' }}
                  >
                    {expanded ? <ExpandLess /> : <ExpandMore />}
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                      {expanded ? 'Show Less' : `Show ${senderCard.emails.length - 3} More`}
                    </Typography>
                  </IconButton>
                </Box>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
} 