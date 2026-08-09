# Contributing

Thank you for improving RhythmLint.

1. Fork the repository and create a focused branch.
2. Run `npm ci` and `npm run check` before opening a pull request.
3. Add the smallest synthetic ICS fixture that demonstrates a parser or rule change.
4. Update English and Simplified Chinese user documentation for user-visible changes.
5. Never commit real calendar exports, attendee addresses, meeting links, or secrets.

Rule changes must preserve stable rule IDs, include evidence-based tests, and explain
whether the change is breaking. Parser changes must document the relevant RFC 5545
boundary. Generated demo artifacts must be regenerated with `npm run demo`.
