import { TruckAvailability } from './index'

export interface MapPin {
  id: string
  latitude: number
  longitude: number
  city: string
  state: string
  trucks: TruckAvailability[]
  date: string
  truckCount: number
}

export interface MapViewProps {
  customerCards: any[] // Using existing customer cards data
  onViewEmails?: (customerEmail: string) => void
}

export interface DateNavigationProps {
  selectedDate: Date
  onPreviousDay: () => void
  onNextDay: () => void
  onDateSelect: (date: Date, range?: { start: Date; end: Date }) => void
  availableDates: Date[]
}

export interface TruckDetailCardProps {
  pin: MapPin
  onClose: () => void
  open: boolean
  onTruckDeleted?: () => void
}

export interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress: string
}

export interface MapState {
  selectedDate: Date
  pins: MapPin[]
  loading: boolean
  error: string | null
} 