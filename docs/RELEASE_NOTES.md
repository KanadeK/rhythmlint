# RhythmLint v0.1.0

RhythmLint turns exported calendars into a deterministic, local schedule-health audit.

Highlights:

- expands RRULE/RDATE/EXDATE and recurrence exceptions from real ICS files;
- evaluates nine schedule policies with stable IDs and CI exit codes;
- emits console, JSON, Markdown, and self-contained script-free HTML;
- compares before/after weeks and fingerprints resolved or introduced findings;
- creates a deterministic tentative focus/lunch overlay only from verified free capacity;
- ships 28 tests with 95.34% line, 89.08% branch, and 96.92% function coverage;
- includes a standalone Node 20+ asset, npm-compatible tarball, demo report, repair ICS,
  manifest, and SHA-256 checksums.

The examples are synthetic. RhythmLint has no OAuth, upload, analytics, telemetry, or live
calendar mutation path.
