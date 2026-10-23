# Security

Please use GitHub's **Report a vulnerability** feature for security reports. Do not disclose credentials, recordings, or sensitive details in a public issue.

## Scope and data handling

- Ring tokens and AWS credentials are used by server-side routes. Configure them through local environment variables such as `.env.local`; never commit or paste them into issues.
- The public Vercel demo uses recorded Ring Developer Playground frames and simulated restaurant data. Its demo board is stored in the visitor's browser.
- During live operation, the browser samples the Ring video and sends cropped JPEG frames with vehicle observations to the local application server. If Amazon Bedrock is configured, the server may also send those cropped frames for model inference.
- Live observations can contain a JPEG thumbnail. They are held in the application's in-memory board. If `ARRIVALOPS_DATA_DIR` is configured, the live board, including recent observations and their thumbnails, can also be saved to `state.json` on disk. Do not enable this persistence for real customer footage without appropriate storage, access, retention, and deletion controls.
- Vehicle analysis is restricted to coarse vehicle attributes. ArrivalOps does not intentionally identify people or read licence plates.

## Deployment boundaries

Live Ring mode is intended for the local desk machine. The application restricts live HTTP access to loopback hosts by default. Do not expose it publicly by setting `ARRIVALOPS_ALLOW_REMOTE=1` without adding authentication, authorization, and access controls.

The inherited sample webhook endpoints are **not** part of ArrivalOps' working pickup detection path. They should not be used for production Ring notifications without implementing Ring's required `X-Signature` HMAC-SHA256 verification.

See [README.md](README.md) for the distinction between tested live capabilities and the hosted replay.
