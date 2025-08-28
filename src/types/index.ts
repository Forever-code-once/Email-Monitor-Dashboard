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

export interface LoadData {
  ref_number: string
  company_name: string
  use_depart_date: string
  pu_drop_date1: string
  pu_drop_time1: string
  dropoff_date: string
  dropoff_time: string
  dispatcher_initials: string
  notes: string
  // Add other fields from avalload table as needed
  origin_city?: string
  origin_state?: string
  destination_city?: string
  destination_state?: string
}

export interface MapPin {
  id: string
  type: 'truck' | 'load'
  latitude: number
  longitude: number
  title: string
  data: TruckAvailability | LoadData
} 