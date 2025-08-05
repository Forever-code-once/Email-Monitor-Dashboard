export interface TruckAvailability {
  id: string
  customer: string
  customerEmail: string
  date: string
  city: string
  state: string
  additionalInfo?: string
  emailId: string
  emailSubject: string
  emailDate: Date
  isChecked: boolean
}

export interface CustomerCard {
  customer: string
  customerEmail: string
  trucks: TruckAvailability[]
  lastEmailDate: Date
}

// New interface for sender-based email cards
export interface EmailSenderCard {
  senderName: string
  senderEmail: string
  emails: EmailItem[]
  lastEmailDate: Date
  totalEmails: number
}

export interface EmailItem {
  id: string
  subject: string
  bodyPreview: string
  receivedDateTime: string
  isChecked: boolean
  isForwarded: boolean
  originalSender?: {
    name: string
    email: string
  }
}

export interface ParsedEmailData {
  customer: string
  customerEmail: string
  trucks: Array<{
    date: string
    city: string
    state: string
    additionalInfo?: string
  }>
}

export interface EmailMessage {
  id: string
  subject: string
  bodyPreview: string
  body: {
    content: string
    contentType: string
  }
  from: {
    emailAddress: {
      address: string
      name: string
    }
  }
  receivedDateTime: string
} 