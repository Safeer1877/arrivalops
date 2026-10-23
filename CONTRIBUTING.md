# Contributing to ArrivalOps

ArrivalOps is a prototype developed for the Amazon Build, Ship, Shape 2026 hackathon. Contributions that improve reliability, accessibility, testing, or documentation are welcome.

## Reporting an issue

Search existing issues before opening a new one. Include:

- The steps needed to reproduce the problem.
- Whether you used the browser-based replay or local Ring live mode.
- Your browser, operating system, and Node.js version when relevant.
- The expected and actual behavior.

Do not post Ring access tokens, AWS credentials, unredacted camera footage, or customer information.

For security concerns, use GitHub's **Report a vulnerability** feature rather than a public issue. See [SECURITY.md](SECURITY.md).

## Submitting changes

1. Fork the repository and create a focused branch.
2. Keep changes small and explain their effect on the pickup workflow.
3. Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
4. Open a pull request describing the change and how you tested it.

Please distinguish genuine Ring API activity from staged replay footage in any new documentation or examples. The demo uses simulated orders and customer details.

## Code of conduct and license

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [LICENSE](LICENSE). ArrivalOps builds on Amazon's MIT-licensed [Ring Hello World starter](https://github.com/AmazonAppDev/ring-api-helloworld).
