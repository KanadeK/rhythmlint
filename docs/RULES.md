# Rule reference

Rules operate on expanded occurrences inside an explicit local-date window. A workday is
one of `workweek.days`; Sunday is `0` and Saturday is `6`. Partial weeks scale weekly
budgets and protected-focus requirements by the number of audited workdays.

## RL001 — event overlap

- Applies to active, timed, non-transparent events, including protected focus.
- Emits one finding per overlapping pair and reports exact overlap minutes.
- Default severity comes from `policy.overlap` and may be `error`, `warning`, `info`, or
  `off`.
- Meeting totals still use interval union, so the overlap is not double-counted as elapsed
  time.

Repair: move, shorten, decline, or deliberately make one event transparent/ignored.

## RL002 — transition buffer

- Sorts active events within each workday.
- Compares a non-overlapping event with the immediately preceding active event.
- Fires when the gap is less than `minimumTransitionMinutes`.
- Overlapping pairs are left to RL001.

Repair: create real preparation, travel, decompression, or context-switch time.

## RL003 — daily meeting budget

- Counts the union of meeting-classified intervals clipped to working hours.
- An event is a meeting when it has attendees, its title matches a meeting pattern, or
  `countAppointmentsAsMeetings` is enabled.
- Fires above `dailyMeetingBudgetMinutes`.

## RL004 — weekly meeting budget

- Sums daily meeting-union minutes by Monday-based week.
- For a partial audit week, the limit is
  `round(weeklyMeetingBudgetMinutes × audited workdays / configured workdays)`.

## RL005 — consecutive meetings

- Builds meeting runs whose gap is no larger than the configured transition minimum.
- Measures the wall-clock span from the first start to the final end.
- Fires above `maximumConsecutiveMeetingMinutes`.

## RL006 — protected focus capacity

- A protected block is an event whose title matches a focus pattern after subtracting any
  overlapping non-focus event.
- The remaining uninterrupted block must be at least `minimumFocusBlockMinutes`.
- For a partial week, the required count is
  `ceil(minimumFocusBlocksPerWeek × audited workdays / configured workdays)`.
- Free qualifying intervals are reported as capacity but do not count as protected until
  they are explicitly reserved.

The overlay can reserve existing free capacity. If no interval fits, it returns exit `1`
and leaves the deficit visible.

## RL007 — fragmented time

- Subtracts meetings and appointments from the workday; protected focus remains usable.
- Sums free intervals shorter than `minimumFocusBlockMinutes`.
- Fires when their sum exceeds `maximumFragmentMinutesPerDay`.

This is a structural heuristic, not a claim that every short interval is worthless.

## RL008 — lunch window

- Subtracts all active events from the configured lunch interval.
- Finds the longest remaining interval.
- Fires when it is shorter than `workweek.lunch.minimumMinutes`.

## RL009 — outside work hours

- Fires when an active timed event is not fully contained in its start date's work window,
  including non-workdays.
- Severity comes from `policy.outsideWorkHours` and may be disabled.

## Classification order

Title patterns are case-insensitive regular expressions and are evaluated in this order:

1. ignored title;
2. protected focus title;
3. attendee, meeting-title match, or `countAppointmentsAsMeetings`;
4. appointment.

The order prevents a focus block with a meeting-like word from being charged as a meeting.
Use narrow anchored patterns when a broad word produces false positives.
