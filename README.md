# RhythmLint

**Policy-as-code for calendar health. Export ICS, audit locally, repair the shape of your week.**

[![CI](https://github.com/KanadeK/rhythmlint/actions/workflows/ci.yml/badge.svg)](https://github.com/KanadeK/rhythmlint/actions/workflows/ci.yml)
[![CodeQL](https://github.com/KanadeK/rhythmlint/actions/workflows/security.yml/badge.svg)](https://github.com/KanadeK/rhythmlint/actions/workflows/security.yml)
[![Release](https://img.shields.io/github/v/release/KanadeK/rhythmlint)](https://github.com/KanadeK/rhythmlint/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-096b67.svg)](LICENSE)

[简体中文](README.zh-CN.md) · [Live synthetic report](https://kanadek.github.io/rhythmlint/) ·
[Before/after diff](https://kanadek.github.io/rhythmlint/demo-diff.html) · [Rules](docs/RULES.md)

Calendar apps can show collisions. RhythmLint checks a different contract: whether a week
has enough protected focus, real transition time, a usable lunch window, bounded meeting
load, and free time that is not shredded into unusable fragments. It reads exported
Google Calendar, Outlook, or Apple Calendar `.ics` files without OAuth, an account, or an
upload.

The project is a real CLI and TypeScript library, not a calendar mockup. It expands RFC
5545 recurrence rules, applies recurrence exceptions, deduplicates overlapping exports,
evaluates nine stable rules, compares before/after calendars, and creates a tentative ICS
repair overlay only in slots that are actually free.

## The committed example is executable

The synthetic `before.ics` week contains overlap, overload, missing buffers, fragmented
time, squeezed lunch, an early call, and only one protected focus block. The repaired
`after.ics` batches collaboration and protects five focus blocks.

| Measured result  |  Before |   After |   Change |
| ---------------- | ------: | ------: | -------: |
| RhythmLint score |   0/100 | 100/100 |     +100 |
| Errors           |       3 |       0 |       -3 |
| Warnings         |      20 |       0 |      -20 |
| Meeting load     | 23h 50m |  9h 10m | -14h 40m |
| Protected focus  |  2h 30m |  7h 30m |      +5h |
| Fragment minutes |  9h 40m |     30m |  -9h 10m |

Reproduce that table:

```bash
npm ci
npm run build
node dist/cli.js audit examples/before.ics \
  --config examples/rhythmlint.config.json --from 2026-08-03 --fail-on none
node dist/cli.js diff examples/before.ics examples/after.ics \
  --config examples/rhythmlint.config.json --from 2026-08-03 --fail-on none
```

## Install and run

### Standalone release asset

Download `rhythmlint-0.1.0-standalone.mjs` from the latest GitHub Release. It bundles the
runtime parser and needs only Node.js 20 or newer:

```bash
node rhythmlint-0.1.0-standalone.mjs --version
node rhythmlint-0.1.0-standalone.mjs audit calendar.ics \
  --config rhythmlint.config.json --from 2026-08-03 --format html --out report.html
```

Verify the file against `SHA256SUMS.txt` before running it. The release also includes an
npm-compatible tarball; RhythmLint 0.1.0 is distributed through GitHub Release and is not
claimed to be published on the npm registry.

### From source

```bash
git clone https://github.com/KanadeK/rhythmlint.git
cd rhythmlint
npm ci
npm run check
node dist/cli.js --help
```

Runtime and ordinary tests support Node 20+. The enforced built-in coverage gate requires
Node 22.8+; the release gate is run with Node 24.

## Typical workflow

1. Export one or more calendars as ICS. RhythmLint never asks for calendar credentials.
2. Create and review a policy:

   ```bash
   node dist/cli.js init --out rhythmlint.config.json
   ```

3. Audit a fixed window and keep JSON evidence alongside the human report:

   ```bash
   node dist/cli.js audit work.ics personal.ics \
     --config rhythmlint.config.json --from 2026-08-03 --days 14 \
     --format json --out audit.json --redact --redact-locations
   ```

4. Generate tentative holds from existing free capacity. Import only after review:

   ```bash
   node dist/cli.js overlay work.ics personal.ics \
     --config rhythmlint.config.json --from 2026-08-03 --days 14 \
     --out proposed-holds.ics
   ```

   Exit `1` means the overlay was created but some required focus blocks still need actual
   rescheduling. RhythmLint never creates a conflicting hold to make the report look green.

5. Export the revised calendar and measure the change:

   ```bash
   node dist/cli.js diff before.ics after.ics \
     --config rhythmlint.config.json --from 2026-08-03 --days 14 \
     --format html --out calendar-diff.html
   ```

## Commands

| Command                 | Real behavior                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `audit <ics...>`        | Merge exports, expand occurrences, evaluate policy, write console/JSON/Markdown/HTML       |
| `diff <before> <after>` | Re-audit the same window and report metric deltas plus resolved/introduced fingerprints    |
| `overlay <ics...>`      | Create deterministic tentative focus/lunch holds only in verified free intervals           |
| `init`                  | Write a complete versioned JSON policy without replacing an existing file unless `--force` |
| `rules`                 | List stable rule IDs and semantics for automation                                          |

Important options:

- `--from YYYY-MM-DD` and `--days 1..366` make the audit window explicit.
- `--fail-on error|warning|none` controls CI exit code without changing findings.
- `--redact` replaces titles with stable report-local labels; `--redact-locations` removes
  locations from report event data.
- `--format console|json|markdown|html` selects a deterministic reporter.

Exit codes are stable: `0` passed, `1` policy threshold failed or repair capacity remained,
and `2` means an argument, file, configuration, or parser error.

## Policy example

```json
{
  "$schema": "./rhythmlint.schema.json",
  "version": 1,
  "timezone": "America/Los_Angeles",
  "workweek": {
    "days": [1, 2, 3, 4, 5],
    "start": "09:00",
    "end": "17:30",
    "lunch": { "earliest": "11:30", "latest": "14:00", "minimumMinutes": 30 }
  },
  "policy": {
    "overlap": "error",
    "minimumTransitionMinutes": 10,
    "dailyMeetingBudgetMinutes": 210,
    "weeklyMeetingBudgetMinutes": 780,
    "maximumConsecutiveMeetingMinutes": 120,
    "minimumFocusBlockMinutes": 90,
    "minimumFocusBlocksPerWeek": 3,
    "maximumFragmentMinutesPerDay": 60,
    "outsideWorkHours": "warning"
  }
}
```

Unspecified keys inherit documented defaults. The shipped JSON Schema provides editor
completion; the CLI independently validates value ranges, IANA timezones, clocks, and
regular expressions.

## Rules

| ID    | Finding                                                             |
| ----- | ------------------------------------------------------------------- |
| RL001 | Active timed events overlap                                         |
| RL002 | Consecutive events lack the required transition buffer              |
| RL003 | Daily meeting minutes exceed budget                                 |
| RL004 | Weekly meeting minutes exceed a partial-week-aware budget           |
| RL005 | A consecutive meeting run is too long                               |
| RL006 | Protected focus blocks are below the partial-week-aware requirement |
| RL007 | Short gaps exceed the daily fragmentation budget                    |
| RL008 | No uninterrupted lunch interval satisfies policy                    |
| RL009 | An event falls outside configured work hours                        |

Exact counting, clipping, recurrence, severity, and repair semantics are in
[docs/RULES.md](docs/RULES.md).

## Privacy and safety

- No network client, OAuth flow, analytics, telemetry, remote font, CDN, or upload path.
- Input contents stay in the current process. The CLI reads only named files and writes
  only an explicit output or initialization path.
- HTML is self-contained, script-free, escaped, and protected by a restrictive CSP.
- Titles and locations are sensitive. Redaction is opt-in because a private local report
  is more useful with names; turn it on before creating a shareable artifact.
- The score is a transparent heuristic, not a medical fatigue or burnout diagnosis.
- Overlay files are `TENTATIVE`; RhythmLint does not edit, decline, invite, or notify.

Read [the full privacy boundary](docs/PRIVACY.md) before analyzing a real calendar.

## Supported ICS boundary

RhythmLint supports timed and all-day VEVENTs, UTC/floating/TZID dates, VTIMEZONE,
RRULE, RDATE, EXDATE, and RECURRENCE-ID exceptions through `ical.js`. Unknown TZIDs
produce a diagnostic and fall back to the configured timezone. Cancelled, transparent,
ignored-title, and all-day events are retained as evidence but excluded from timed load.

Recurrence expansion is bounded to 25,000 occurrences per series and audit windows are
limited to 366 days. These limits prevent a hostile or accidental rule from consuming
unbounded time. See [architecture](docs/ARCHITECTURE.md).

## Verification and repair

- [Acceptance commands](docs/ACCEPTANCE.md) — clean-clone, CLI, deterministic demo,
  package, checksum, and release checks.
- [Repair guide](docs/REPAIR_GUIDE.md) — exact recovery steps for install, parser,
  timezone, test, coverage, demo, packaging, CI, Pages, and Release failures.
- [Competitor scan](docs/COMPETITOR_SCAN.md) — adjacent projects, rejected ideas,
  search limitations, and the differentiation claim this release can honestly make.

The release gate is one command:

```bash
npm run release:check
```

It performs format, strict type, static local-only/secret checks, 28 tests with enforced
coverage (95.34% lines, 89.08% branches, 96.92% functions in v0.1.0), byte-for-byte demo
verification, standalone bundling, npm tarball creation, and SHA-256 manifest generation.

## License and dependency

RhythmLint source is MIT licensed. The standalone asset bundles `ical.js` 2.2.1 under
MPL-2.0; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
