# Friction log

Format per entry: task · steps · expected vs actual · severity · workaround · suggestion.

## 1. Playground simulations don't produce motion events
- **Task:** Trigger the pickup workflow from a Ring vehicle event.
- **Steps:** Started the Developer Playground "Vehicle" simulation; listed event history for the device.
- **Expected:** A `motion_detected` event (sub_type vehicle) or a webhook, as a real camera would send.
- **Actual:** Other entrants report the simulations appear as `on_demand` live views (to be confirmed in our own run).
- **Severity:** Major for event-driven apps.
- **Workaround:** Sample frames from the WHEP stream in the client, filter by scene change, and classify those.
- **Suggestion:** Let the Playground emit signed sample webhooks (motion with vehicle/package sub_types) alongside each simulated stream.

## 2. 30-minute Playground tokens can't be refreshed
- **Task:** Keep a hosted demo live for judging through Nov 20.
- **Steps:** Read the Playground and auth docs.
- **Expected:** A long-lived sandbox credential or refresh flow for demos.
- **Actual:** Tokens last about 30 minutes with no refresh; judges can't be asked to paste their own.
- **Severity:** Major for hackathons and sales demos.
- **Workaround:** A labelled Replay mode using a recorded Playground session.
- **Suggestion:** A "demo key" scoped to the Playground's simulated devices with a long lifetime.

## 3. Ring API not reachable from cloud dev sandboxes
- **Task:** Develop with an AI coding agent in a cloud container.
- **Steps:** `curl https://api.amazonvision.com/v1/devices` from the container.
- **Expected:** A 401 without a token.
- **Actual:** Connection refused by the container's egress policy (not Ring's fault, but common for agent workflows).
- **Severity:** Minor.
- **Workaround:** Ran the live proof on a local Mac.
- **Suggestion:** Publish an OpenAPI spec and a local mock server so agents can build against the contract offline.

## 4. Hackathon AWS credits ran out
- **Task:** Request AWS credits for Bedrock.
- **Expected:** A credit form on the Resources page.
- **Actual:** The Oct 7 update says codes ran out.
- **Severity:** Minor (Nova Lite costs fractions of a cent per frame).
- **Workaround:** Personal AWS account, scene-change filtering to cut calls.
- **Suggestion:** Hold back credits for the final two weeks.
