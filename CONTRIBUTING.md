# Contributing

Thank you for contributing! Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). For security issues use the private reporting process in [SECURITY.md](SECURITY.md), not a public issue.

1. Discuss substantial changes in an issue before starting, especially authentication, privacy, emergency behavior and protocol changes.
2. Use Node.js 18 or newer. Run `npm ci`, `npm run check`, and `npm test` before submitting a pull request.
3. Include focused tests for fixes and document compatibility, privacy, and operational impacts. Do not claim features are reliable without testing their real browser, device and network requirements.
4. Describe the change, testing performed, known limitations, and any migration or configuration steps in the pull request. Keep changes scoped and avoid committing secrets, location data, or generated dependencies.

Review the known blockers in [AUDIT.md](AUDIT.md). For browser-facing changes, test permission denial, reconnect, mobile viewport, and accessibility as appropriate; the Node suite does not cover these. Maintainers review contributions as time permits.
