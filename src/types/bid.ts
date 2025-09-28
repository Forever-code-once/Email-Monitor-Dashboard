export interface BidRequest {
  id: string
  customerName: string
  pickupCity: string
  destinationCity: string
  timerMinutes: number
  createdAt: Date
  expiresAt: Date
  hasMatchingTruck: boolean
  radiusMiles: number
}

export interface BidRequestFormData {
  customerName: string
  pickupCity: string
  destinationCity: string
  timerInput: string // e.g., "1h", "15m", "1h 15m"
  radiusMiles?: number
}

export interface BidRequestCreateData {
  customerName: string
  pickupCity: string
  destinationCity: string
  timerMinutes: number
  radiusMiles: number
}