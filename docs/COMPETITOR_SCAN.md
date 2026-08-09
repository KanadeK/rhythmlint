# Competitor and novelty scan

Scan date: 2026-08-08. The goal was not to claim that no calendar-related code exists; it
was to find a useful combination not already present in the owner's 129 repositories or
the sampled public tools.

## Rejected local directions

- A context-switch resume packet overlapped Worktree Conductor's worktree context and
  handoff recording.
- A cross-application keybinding collision linter overlapped the existing RemapLint
  project.
- Another generic release/pre-push checker overlapped PushReady, Release Ledger,
  ShipReceipt, and OSS First Flight.
- ManualCare exports maintenance reminders to ICS, but does not analyze a user's existing
  schedule. RhythmLint consumes calendar exports and never extracts maintenance tasks.

The exact local and remote name `rhythmlint` was absent. A description scan of 129 current
GitHub repositories found no calendar-health or meeting-budget auditor.

## Adjacent public tools

| Project/product                                                                       | What it already does                                                                          | Boundary kept by RhythmLint                                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [ical.js](https://github.com/mozilla-comm/ical.js)                                    | Standards-focused ICS parser, validator, timezone, and recurrence library                     | RhythmLint uses it as a parser and adds schedule policy, evidence, diff, redaction, CI semantics, and safe repair planning     |
| [Calendar Audit skill](https://playbooks.com/skills/foogunlana/skills/calendar-audit) | Prompt-driven meeting scoring and deep-work suggestions from screenshots or connected sources | RhythmLint is deterministic, offline, ICS-native, testable, and does not ask an LLM to classify value                          |
| [UCals Focus Time Audit](https://ucals.com/tools/focus-time-audit)                    | Browser form that visualizes manually entered meeting fragmentation                           | RhythmLint expands real recurrence, supports multi-export audit, policy files, exit codes, diff, and machine-readable evidence |
| [LifeLoad](https://lifeload.io/)                                                      | Connected commercial calendar analytics, cognitive-load prompts, and focus blocking           | RhythmLint has no account/provider connection or behavioral tracking and can run in local automation                           |
| [Supercal](https://www.supercal.cc/)                                                  | Open-source privacy-oriented scheduling, availability, polls, and calendar sync               | RhythmLint is a read-only linter, not a scheduling or sync server                                                              |
| [gogcli](https://github.com/steipete/gogcli)                                          | Google Workspace CLI with calendar conflict and focus-time operations                         | RhythmLint is provider-independent, export-based, policy-driven, and does not mutate a live account                            |

Research also found broad agreement that meeting fragmentation, buffer loss, and missing
deep-work capacity are real schedule concerns. The [Rhythm of Work study](https://arxiv.org/abs/2309.08104)
reports a gap between information workers' scheduling preferences and actual practice,
with differences associated with meeting load and timezones.

## Search method and limitations

Queries included `calendar linter`, `ICS conflict detector`, `meeting budget calendar`,
`deep work calendar CLI`, `calendar fragmentation`, `schedule policy calendar`,
`calendar analytics meetings deep work`, and exact-name searches for `RhythmLint`.
Sources included public web search, GitHub repository pages, and direct GitHub account
inventory.

The authenticated GitHub Search API hit a documented rate limit during the scan, and the
installed Agent Reach/Exa launchers were unavailable. Public web search and direct GitHub
lookups were used as fallback. Therefore this is a sampled competitor scan, not a proof of
universal absence. Search indexes can miss private, unindexed, renamed, or newly created
projects.

## Defensible differentiation

The v0.1.0 claim is deliberately narrow: the scan did not find an active tool combining
all of these properties:

1. offline multi-ICS input with recurrence exceptions and deduplication;
2. versioned schedule policy with stable CI exit semantics;
3. overlap, buffer, daily/weekly budget, consecutive load, protected focus,
   fragmentation, lunch, and outside-hours rules in one engine;
4. deterministic JSON/Markdown/self-contained HTML evidence and before/after diff;
5. a tentative repair ICS that only uses verified free capacity and reports unresolved
   deficits;
6. no account, OAuth, provider API, AI judgment, or upload.

That combination—not the words “calendar audit” or “focus time”—is RhythmLint's novelty.
