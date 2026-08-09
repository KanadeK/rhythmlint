# Failure repair guide

Start with the narrow command that failed. Preserve its complete output; do not delete the
lockfile, weaken a policy, or regenerate evidence until the cause is known.

| Symptom                           | Diagnosis                                                                      | Repair                                                                                               | Recheck                                            |
| --------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `npm ci` cannot reach a mirror    | Inspect `npm config get registry` and the network error                        | Retry with `--registry=https://registry.npmjs.org/`; do not replace the lockfile                     | `npm ci` then `npm audit --omit=dev`               |
| esbuild binary missing            | npm blocked or skipped install scripts                                         | Review the exact `esbuild@0.25.12` script and run the npm-approved script flow, then reinstall       | `npm run build` and standalone `--version`         |
| TypeScript error                  | Read the first source error; later errors may cascade                          | Fix the typed boundary; do not add `any` or disable strict options to silence it                     | `npm run typecheck`                                |
| ICS parse exit `2`                | Run one input at a time and keep the smallest synthetic failing VEVENT         | Fix malformed folding/component structure or file a parser issue with synthetic data                 | `audit fixture.ics --fail-on none`                 |
| `ICS_UNKNOWN_TZID`                | Check whether the export includes VTIMEZONE and whether TZID is IANA-valid     | Re-export with timezone definitions or set the intended policy timezone; do not guess an offset      | JSON report has no timezone diagnostic             |
| `ICS_RECURRENCE_LIMIT`            | Inspect RRULE frequency/start and audit window                                 | Narrow `--from/--days` or repair the recurrence; never raise the cap just to pass                    | Audit the bounded window twice                     |
| Unexpected meeting classification | Inspect attendee presence and matching regex order                             | Anchor or narrow `meetingTitlePatterns`, `focusTitlePatterns`, or ignore patterns                    | Add a synthetic classification test                |
| Policy exit `1`                   | Read finding IDs and evidence                                                  | Change the schedule or reviewed policy; `--fail-on none` is only for observation                     | Default audit exits `0`                            |
| Overlay exit `1`                  | Read `unresolvedFocusBlocks` in stderr                                         | Move/batch meetings to create a qualifying free interval, then regenerate                            | Re-audit imported candidate in a separate calendar |
| Test failure                      | Run `node --test <exact test file>` after build                                | Fix the smallest behavioral regression and add/adjust a synthetic fixture                            | `npm test`                                         |
| Coverage threshold failure        | Read uncovered module rows                                                     | Add behavior-focused tests for missed branches; do not exclude core modules or lower thresholds      | `npm run test:coverage`                            |
| `demo:check` says stale           | Confirm a deliberate semantic or fixture change                                | Run `npm run demo`, inspect every generated diff, then rerun check                                   | Two consecutive `demo:check` runs pass             |
| HTML looks broken                 | Open `docs/index.html` at desktop and narrow viewport; inspect escaped content | Fix `reporters.ts`, not generated HTML; add reporter assertion                                       | `npm run demo && npm test`                         |
| `npm pack` omits a file           | Inspect `npm pack --dry-run --json` and `package.json#files`                   | Add only the required runtime/schema/docs path                                                       | Install the tarball in a fresh temp directory      |
| SHA mismatch                      | Compare asset name, size, local digest, and release manifest                   | Stop publication; rebuild from the tagged commit and upload a new, correctly versioned release       | Download again and run checksum verification       |
| CI fails only on Node 20          | Check whether a development-only coverage flag leaked into the matrix          | Matrix uses `npm test`; enforced coverage runs only on Node 24                                       | Re-run the failed workflow                         |
| Pages 404                         | Inspect Pages workflow, environment, and repository Pages build type           | Set Pages source to GitHub Actions and rerun `pages.yml`                                             | HTTP GET returns 200 and demo content              |
| Release workflow lacks permission | Inspect job `contents: write` and tag provenance                               | Restore least-required permission and rerun from the same immutable tag                              | `gh release view` lists every asset                |
| `gh auth status` invalid          | Authentication is external state, not a code failure                           | Run `gh auth login -h github.com`, then recheck scopes `repo` and `workflow`                         | `gh auth status` is green before push              |
| Contributor mismatch              | Compare author, committer, shortlog, API contributors, and trailers            | Correct local Git identity before the first public push; do not rewrite a published release silently | Hygiene commands in acceptance section agree       |

## Clean temporary verification

Use a new temporary directory for downloaded assets or tarball installation. Verify the
resolved path is inside that temporary directory before recursively removing it. Never
clean the repository root, a home directory, or a path derived from an empty variable.

## When to open an issue

Include version, Node version, OS, command, exit code, and a minimal synthetic ICS. For a
semantic dispute, state the rule ID and expected interval math. Never attach a real export.
