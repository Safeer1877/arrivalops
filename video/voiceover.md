# Voice-over script for arrivalops-demo.mp4 (2:13)

Read each line when its caption appears. The captions are burned into the video, so the voice-over can follow them word for word or say the same thing in your own words. Start times are approximate.

| Start | Say |
|---|---|
| 0:00 | The order is ready. The customer is outside. But nobody checked in. |
| 0:08 | Ordering systems only know about customers who tap "I'm here". |
| 0:13 | ArrivalOps watches the shop's own Ring camera for the ones who don't. |
| 0:18 | This is real Ring Developer Playground footage, replayed in a staged order. The orders and customers are simulated. |
| 0:24 | A detector in the browser checks the marked pickup bay every three seconds. |
| 0:30 | One look is never enough. It needs a second sighting of a stopped car. |
| 0:36 | Now it's an exception: a car has waited past the limit, and ready orders are unclaimed. |
| 0:42 | Staff get one card: the car, how long it has waited, and the orders it could be. |
| 0:48 | Sarah said "grey hatchback" at checkout, so she ranks first. That's a hint, not an identification. |
| 0:54 | The camera never decides who the driver is. Staff ask their name and confirm the order. |
| 0:58 | Handed over. A wrong tap can be undone. |
| 1:02 | And it's measured: rescued today goes up, uncollected value goes down, and the time from arrival to handover is recorded. |
| 1:09 | If nobody comes out, the driver may leave. |
| 1:23 | ArrivalOps doesn't assume it was a customer. Staff confirm it first. |
| 1:28 | Only then does it count as missed, with the order and the number to call back. |
| 1:34 | The owner marks the pickup bay once. |
| 1:37 | A car anywhere else is ignored. |
| 1:47 | In live mode, the same desk takes a Ring Playground stream through the Ring Partner API. |
| 1:55 | Amazon Bedrock checks the detector's answer. Here it got the parked car right, and it also saw a car in an empty bay. |
| 2:01 | So the on-device detector decides, and Bedrock's verdict is shown beside it as agreed or disagreed. |
| 2:07 | ArrivalOps: rescue the pickups nobody checked in for. Everything real, staged and simulated is listed in the README. |

Between 1:09 and 1:23 the replay runs again with no new caption. You can pause there, or say: "Here's the same arrival again, and this time nobody comes out."

## How it was made

- The video was recorded with Playwright from the local app in replay mode, at a 1440×810 viewport, then scaled to 1080p.
- The captions and cards are overlays added during recording. The app itself is unchanged.
- The live-mode card uses a real screenshot from the Mac, `docs/screenshots/live-3a.png`, taken with an earlier build.
- The Bedrock card shows the real output of `npm run bedrock:check` from 2026-10-23.
