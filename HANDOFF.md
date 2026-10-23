# Handoff: finishing the ArrivalOps submission

Anyone (human or AI) with access to this repo can finish the entry from this file alone. Last updated 2026-10-23.

## The entry

- **Hackathon:** Amazon "Build, Ship, Shape" on Devpost. **Deadline 2026-10-24 00:00 PKT (GMT+5)**. Aim to submit by 20:00 PKT on Oct 23.
- **Tracks:** Ring track, plus the AWS Builder and Open Source mini challenges.
- **Pitch:** Ring-powered pickup exception desk. "The order is ready. The customer is outside. But nobody checked in."
- **Video:** https://youtu.be/xVGru7-7Pkk
- **Hosted demo:** https://arrivalops.vercel.app. It runs the replay demo entirely in the visitor's browser: each visitor gets their own board, kept in localStorage, and no keys are bundled.
- **Repo:** https://github.com/Safeer1877/arrivalops. It is public.

## State (all done and verified)

- Replay flow end to end: arrival, alert, "This is them", Handed over, Undo, reload keeps state, departure review, bay edit. Each visitor's state is isolated. Ring routes return 404 on the hosted site.
- Live mode on the owner's Mac (`npm run build && npm start`, with `RING_ACCESS_TOKEN` in `.env.local`) streams the Ring Developer Playground camera. The screenshots are `docs/screenshots/live-*.png`.
- The README has an evidence table (real / staged / simulated / unavailable). Keep it honest.
- **Bedrock works through a Bedrock API key** (`BEDROCK_API_KEY` in `.env.local`, OpenAI-compatible `bedrock-mantle` endpoint, model `google.gemma-3-12b-it`).
  - The on-device COCO-SSD detector decides. Bedrock is only recorded as "agreed" or "disagreed" (`combine()` in `lib/arrivalops/vision.ts`).
  - Proof: `npm run bedrock:check`. The request IDs are in the README.
  - Short-term keys expire after 12 h. Make a new one in the AWS console under Bedrock > API keys (management account, us-east-1).
- Friction logs: `FRICTION_LOG.md` and `docs/FRICTION_LOG_MAC.md`.
- Checks: `npm run lint`, `npx tsc --noEmit`, `npm test` (54 tests), `npm run build`.

## What's left, in order

1. **Video.** Done and uploaded: https://youtu.be/xVGru7-7Pkk (with voice-over and music). The source is `video/arrivalops-demo.mp4`, with the script in `video/voiceover.md`.
2. **Open Source mini challenge.** Done: https://github.com/AmazonAppDev/ring-api-helloworld/pull/49 (stalled-stream detection and a Reconnect button, from the branch `Safeer1877:detect-stalled-stream`). Link it on Devpost.
3. **Make the repo public.** Done on 2026-10-23.
4. **Devpost form.** Use the text below. Add the screenshots `docs/screenshots/hd-3-alert.png`, `4-matched.png`, `7-missed.png`, `9-bay-moved-car-ignored.png` and `live-3a.png`.
5. **UI review against the Ring UX guide.** Optional. Only small copy or layout fixes, no new features.

## Rules (don't break these)

- No new features. Don't add hospital, warehouse, Square or other speculative modes.
- Never commit `.env*` or any key or token. Never paste keys in chat. The owner types credentials themselves.
- Never claim Ring sent a vehicle-arrival webhook. The replay is real Playground footage in a staged order, and it was logged as an on-demand stream.
- Orders, customers and phone numbers are simulated, and the app labels them.
- Never say Bedrock identifies cars or decides alerts.
- Don't say the Amazon sample fix was "sent" until the PR is open.

## Devpost text (paste and adjust)

**Inspiration.** Small shops lose pickup orders when a driver waits outside and never taps "I'm here". The food goes cold, the customer leaves, and nobody inside knew.

**What it does.**
- ArrivalOps watches the shop's existing Ring camera for a vehicle that stops in the marked pickup bay.
- When the car has waited and ready orders are still unclaimed, it raises one exception card: the car, how long it has waited, and the orders it could be.
- The camera never decides who the driver is. Staff ask the name, confirm the order and hand it over, and a wrong tap can be undone.
- If the driver leaves first, staff confirm whether it was a missed pickup, and only then is it counted, with the number to call back.
- The desk measures rescued orders, uncollected value and arrival-to-handover time.

**How we built it.**
- Built on Amazon's `ring-api-helloworld` starter: Ring Partner API with a WHEP live stream, Next.js 15 and TypeScript.
- An on-device COCO-SSD detector in TensorFlow.js runs in the staff browser every 3 s and only reports changes.
- Amazon Bedrock (Gemma 3 12B through a Bedrock API key on the bedrock-mantle endpoint) checks the bay crop with a strict JSON schema. Its verdict is recorded beside the detector's.
- Reconciliation rules: two sightings, at least one stopped, fresh within 30 s, then the dwell time.
- The hosted demo runs the same logic in the browser, so each visitor's state stays isolated.

**Challenges.**
- Our member AWS account was refused by Bedrock's Converse API ("Operation not allowed"; support case open). A Bedrock API key on the bedrock-mantle endpoint worked.
- Playground streams freeze after about 20 s, so we added stall detection and a Reconnect button, and sent that fix back to Amazon's sample (https://github.com/AmazonAppDev/ring-api-helloworld/pull/49).
- Gemma once called a grey hatchback a black SUV at 95% confidence. That is why the detector decides and Bedrock only checks.

**What we learned.** Keep the AI's claim narrow (a vehicle is in the bay) and keep humans on identity. That is what makes it safe to act on.

**What's next.** Real orders from a POS, and Ring vehicle-event webhooks to start the check instead of polling.

## How to run

```
npm install
npm run dev                 # replay mode at localhost:3000, no keys needed
npm run build && npm start  # live mode with RING_ACCESS_TOKEN in .env.local (binds 127.0.0.1)
npm run bedrock:check       # needs BEDROCK_API_KEY in .env.local
```
