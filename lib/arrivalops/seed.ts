// A demo takeaway's lunch rush, laid out relative to "now" so the board always looks live.
// Clearly labelled as simulated ordering data: ArrivalOps doesn't connect to a real POS in this build.

import type { Order, State } from './types'

const PEOPLE: Array<[string, string[], number, string | undefined]> = [
  ['Sarah M.', ['Chicken shawarma bowl', 'Mint lemonade'], 1850, 'silver hatchback'],
  ['Daniel K.', ['Margherita pizza', 'Garlic knots'], 2690, undefined],
  ['Priya S.', ['Veg thali x2'], 3200, 'red suv'],
  ['Tom W.', ['Fish & chips', 'Coleslaw'], 1575, undefined],
  ['Amina R.', ['Family biryani'], 4400, 'white van'],
  ['Leo B.', ['Club sandwich'], 1095, undefined],
]

// Minutes relative to now: [pickup time, already checked in via the ordering app?, already handed over?]
const TIMING: Array<[number, boolean, boolean]> = [
  [-6, false, false], // ready, past pickup time, no check-in: the one we'll "rescue"
  [-2, false, false],
  [-14, true, false], // checked in through the app, waiting at the counter
  [-35, true, true],
  [12, false, false],
  [40, false, false],
]

export function seedState(now = new Date()): State {
  const at = (min: number) => new Date(now.getTime() + min * 60_000).toISOString()
  const orders: Order[] = PEOPLE.map(([customer, items, totalCents, vehicleHint], i) => {
    const [pickup, checkedIn, handed] = TIMING[i]
    return {
      id: `ord_${1042 + i * 3}`,
      code: String(1042 + i * 3),
      customer,
      items,
      totalCents,
      vehicleHint,
      readyAt: at(pickup - 4),
      pickupAt: at(pickup),
      checkIn: checkedIn ? { at: at(pickup - 1), source: 'pos' } : undefined,
      handedOverAt: handed ? at(pickup + 3) : undefined,
    }
  })
  return { orders, observations: [], cases: [], activity: [] }
}
