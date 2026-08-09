# Privacy and security boundary

Calendar exports can reveal names, relationships, locations, meeting URLs, customer names,
health appointments, travel, and working patterns. Treat an ICS file as sensitive even if
it contains no password.

## What RhythmLint does

- Reads only ICS and JSON paths named by the command.
- Performs parsing, recurrence expansion, rule evaluation, diffing, and report generation
  inside the local Node.js process.
- Writes only an explicit `--out` path or an `init` path.
- Hashes full input bytes with SHA-256 so a report can identify its source snapshot.

## What it does not do

- No fetch, HTTP client, OAuth, CalDAV, provider SDK, analytics, telemetry, crash upload,
  remote font, CDN, account, or background watcher.
- No mutation of Google, Outlook, Apple, or any other calendar.
- No invitations, declines, attendee notifications, or automatic import.
- No AI classification of event meaning.

## Report contents

By default, a private report retains event titles where evidence needs them. `--redact`
replaces each title with a stable label derived from its local occurrence ID.
`--redact-locations` removes locations from the report event model. Input filenames,
timings, counts, policy, hashes, and structural findings remain; those can still identify a
person or organization.

Redaction is best-effort minimization, not anonymization. Review every report manually
before publishing or attaching it to an issue.

## HTML

Generated HTML is self-contained and contains no script. Dynamic strings are escaped, and
the document declares a CSP with `default-src 'none'`. Opening a report does not contact
RhythmLint or a third party.

## Repair overlay

Overlay titles disclose only that a focus or lunch hold was suggested. UIDs are hashes of
the interval and policy. The file contains exact times and therefore still exposes working
patterns. All events are `TENTATIVE` and should be reviewed in a separate calendar before
importing into a primary calendar.

## Public bug reports

Never attach a real calendar. Reduce the issue to a synthetic VEVENT with fictional UID,
title, attendee domain, URL, and location. Private vulnerability reports are described in
[SECURITY.md](../SECURITY.md).
