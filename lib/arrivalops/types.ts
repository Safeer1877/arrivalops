// ArrivalOps domain types: pickup orders, camera observations, and the review cases that connect them.

export type CheckInSource = 'pos' | 'staff_rescue'

export interface Order {
  id: string
  code: string // what the customer reads out, e.g. "1042"
  customer: string
  items: string[]
  totalCents: number
  readyAt: string // ISO
  pickupAt: string // promised pickup time, ISO
  vehicleHint?: string // optional, customer-provided at checkout ("silver hatchback")
  checkIn?: { at: string; source: CheckInSource }
  handedOverAt?: string
}

export type ObservationSource = 'ring_live' | 'replay' | 'synthetic'

export interface VisionResult {
  vehiclePresent: boolean | 'unclear'
  stopped: boolean | 'unclear' // parked/waiting vs passing through
  colour?: string
  vehicleType?: string
  confidence: number // 0..1
  model: string
  latencyMs: number
  error?: string
}

export interface Observation {
  id: string
  at: string
  source: ObservationSource
  deviceId: string
  deviceName?: string
  frame?: string // data URL thumbnail kept for staff review
  vision: VisionResult
}

export type CaseStatus = 'needs_review' | 'matched' | 'handed_over' | 'dismissed'
export type DismissReason = 'not_a_customer' | 'already_served' | 'false_detection'

export interface ReviewCase {
  id: string
  observationIds: string[]
  status: CaseStatus
  candidateOrderIds: string[]
  matchedOrderId?: string
  openedAt: string
  matchedAt?: string
  resolvedAt?: string
  dismissReason?: DismissReason
  chimeAnnouncedAt?: string
}

export interface ActivityEntry {
  id: string
  at: string
  kind:
    | 'observation'
    | 'case_opened'
    | 'case_updated'
    | 'matched'
    | 'handed_over'
    | 'dismissed'
    | 'check_in'
    | 'undo'
    | 'chime'
    | 'vision_error'
  text: string
  caseId?: string
  orderId?: string
}

export interface State {
  orders: Order[]
  observations: Observation[]
  cases: ReviewCase[]
  activity: ActivityEntry[]
  // Snapshot taken before each staff action so the last one can be undone.
  undo?: { label: string; snapshot: Omit<State, 'undo'> }
}
