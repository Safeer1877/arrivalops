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
  vehicleHint?: string // optional, customer-provided at checkout ("grey hatchback")
  phone?: string // from the ordering system, so staff can call a customer who left
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

// watching: a car has stopped in the bay but hasn't stayed long enough to bother staff yet
// left: the car drove off while staff still hadn't come out, a customer we lost
// passed: the car left again before the alert, which is normal traffic and not shown
export type CaseStatus = 'watching' | 'needs_review' | 'matched' | 'handed_over' | 'dismissed' | 'left' | 'passed'
export type DismissReason = 'not_a_customer' | 'already_served' | 'false_detection'

/** The part of the camera picture that is the pickup bay, as fractions of the frame (0 to 1). */
export interface Zone {
  x: number
  y: number
  w: number
  h: number
}

export interface DeskSettings {
  zone: Zone | null // null until the owner marks the bay; the whole frame is checked
  dwellSeconds: number // how long a car must stay stopped before staff are alerted
  calloutSeconds: number // how long an alert can go unanswered before the tablet says it out loud
  demoTiming: boolean // shortened timings for the replay demo, shown on screen
}

export interface ReviewCase {
  id: string
  observationIds: string[]
  status: CaseStatus
  candidateOrderIds: string[]
  matchedOrderId?: string
  firstSeenAt: string // the car stopped in the bay
  openedAt: string // staff were alerted (equal to firstSeenAt while watching)
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
    | 'left'
    | 'settings'
  text: string
  caseId?: string
  orderId?: string
}

export interface State {
  settings?: DeskSettings // absent on boards saved before settings existed; defaults apply
  orders: Order[]
  observations: Observation[]
  cases: ReviewCase[]
  activity: ActivityEntry[]
  // Snapshot taken before each staff action so the last one can be undone.
  undo?: { label: string; snapshot: Omit<State, 'undo'> }
}
