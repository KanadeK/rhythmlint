# Security policy

## Supported versions

Security fixes are provided for the latest tagged release.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Do not include
real calendar exports, attendee addresses, meeting URLs, access tokens, or private
event titles in a public issue. A minimal synthetic ICS reproduction is preferred.

## Security boundary

RhythmLint reads local files and writes only paths explicitly requested by the user.
It has no calendar login, network client, analytics, telemetry, remote fonts, or
upload endpoint. Reports may still contain sensitive event data unless redaction is
enabled; review every artifact before sharing it.
