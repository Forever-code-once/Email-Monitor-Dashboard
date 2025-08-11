'use client'

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Chip,
  Divider,
  IconButton,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import { Close, Email, Forward, ExpandMore, AccessTime } from '@mui/icons-material'
import { EmailMessage } from '@/types'
import { stripHtmlTags } from '@/lib/emailParser'

interface EmailModalProps {
  open: boolean
  onClose: () => void
  customerName: string
  customerEmail: string
  emails: EmailMessage[]
}

export function EmailModal({ open, onClose, customerName, customerEmail, emails }: EmailModalProps) {
  console.log('📧 EmailModal props:', { open, customerName, customerEmail, emailsCount: emails.length })
  console.log('📧 EmailModal emails:', emails.map(e => ({
    id: e.id,
    subject: e.subject,
    hasContent: !!e.body.content,
    hasPreview: !!e.bodyPreview
  })))
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatEmailContent = (content: string): string => {
    console.log('📧 Formatting email content:', { 
      originalLength: content?.length || 0,
      hasContent: !!content,
      preview: content?.substring(0, 100)
    })
    
    if (!content) {
      console.warn('⚠️ No email content provided to formatEmailContent')
      return 'No content available'
    }
    
    // Strip HTML and clean up the content for better readability
    const cleaned = stripHtmlTags(content)
    const formatted = cleaned
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple line breaks
      .trim()
    
    console.log('📧 Formatted content length:', formatted.length)
    return formatted
  }

  // Sort emails by date (newest first)
  const sortedEmails = [...emails].sort((a, b) => 
    new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime()
  )
  
  console.log('📧 Sorted emails count:', sortedEmails.length)
  console.log('📧 First email details:', sortedEmails[0] ? {
    id: sortedEmails[0].id,
    subject: sortedEmails[0].subject,
    hasContent: !!sortedEmails[0].body.content,
    hasPreview: !!sortedEmails[0].bodyPreview,
    contentLength: sortedEmails[0].body.content?.length || 0
  } : 'No emails')

  console.log('📧 EmailModal render - open:', open, 'emails count:', emails.length)
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { 
          maxHeight: '90vh',
          m: 2,
        }
      }}
      sx={{
        zIndex: 9999,
        '& .MuiDialog-paper': {
          zIndex: 9999,
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" component="div">
              📧 Emails from {customerName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {customerEmail} • {emails.length} email{emails.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        {sortedEmails.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            No emails found for this customer.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sortedEmails.map((email, index) => (
              <Accordion key={email.id} defaultExpanded={index === 0}>
                <AccordionSummary 
                  expandIcon={<ExpandMore />}
                  sx={{ 
                    backgroundColor: 'grey.50',
                    '&:hover': { backgroundColor: 'grey.100' }
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', mr: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Email sx={{ fontSize: 16, color: 'primary.main' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 'medium', flexGrow: 1 }}>
                        {email.subject}
                      </Typography>
                      <Chip 
                        label={index === 0 ? 'Latest' : `${index + 1} of ${emails.length}`}
                        size="small"
                        color={index === 0 ? 'primary' : 'default'}
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(email.receivedDateTime)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        {formatEmailContent(email.bodyPreview).substring(0, 80)}...
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>
                
                <AccordionDetails sx={{ pt: 2 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Email Headers */}
                    <Card variant="outlined" sx={{ backgroundColor: 'grey.50' }}>
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>From:</strong> {email.from.emailAddress.name} &lt;{email.from.emailAddress.address}&gt;
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Subject:</strong> {email.subject}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Date:</strong> {formatDate(email.receivedDateTime)}
                        </Typography>
                      </CardContent>
                    </Card>

                    <Divider />

                    {/* Email Body */}
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                        📄 Email Content:
                      </Typography>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography 
                            variant="body2" 
                            component="pre" 
                            sx={{ 
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              lineHeight: 1.5,
                              maxHeight: '400px',
                              overflow: 'auto',
                              backgroundColor: 'grey.50',
                              p: 2,
                              borderRadius: 1
                            }}
                          >
                            {formatEmailContent(email.body.content)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Box>

                    {/* Email Preview */}
                    {email.bodyPreview && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                          👁️ Preview:
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ 
                          p: 2, 
                          backgroundColor: 'primary.50', 
                          borderRadius: 1,
                          border: 1,
                          borderColor: 'primary.200'
                        }}>
                          {stripHtmlTags(email.bodyPreview)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
          💡 This shows all emails from {customerName} in your mailbox
        </Typography>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
} 