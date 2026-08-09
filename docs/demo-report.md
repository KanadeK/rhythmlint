# RhythmLint audit

- Window: **2026-08-03** to **2026-08-10** (exclusive)
- Timezone: **America/Los_Angeles**
- Score: **0/100**
- Findings: 3 errors, 20 warnings, 0 info
- Meeting time: **23h 50m**
- Available focus capacity: **9h**
- Protected focus: **2h 30m**

## Daily shape

| Date | Meetings | Focus capacity | Protected blocks | Fragments | Switches |
|---|---:|---:|---:|---:|---:|
| 2026-08-03 | 4h 50m | 3h 30m | 1 | 10m | 5 |
| 2026-08-04 | 6h 30m | 0m | 0 | 2h | 6 |
| 2026-08-05 | 4h 30m | 1h 30m | 0 | 2h 30m | 5 |
| 2026-08-06 | 3h 30m | 2h 30m | 0 | 2h 30m | 4 |
| 2026-08-07 | 4h 30m | 1h 30m | 0 | 2h 30m | 4 |

## Parser diagnostics

- None

## Findings

### RL001 · Active events overlap

- Severity: **error**
- Evidence: Daily Standup and Product Review overlap for 10 minutes.
- Repair: Move, shorten, decline, or mark one event transparent; do not hide the conflict by changing the lint threshold.
- Fingerprint: `7fc9bde228e59bff`

### RL001 · Active events overlap

- Severity: **error**
- Evidence: Focus Block and Architecture Review overlap for 30 minutes.
- Repair: Move, shorten, decline, or mark one event transparent; do not hide the conflict by changing the lint threshold.
- Fingerprint: `cdb5b05bc53bf9a0`

### RL001 · Active events overlap

- Severity: **error**
- Evidence: Regional Call and Daily Standup overlap for 15 minutes.
- Repair: Move, shorten, decline, or mark one event transparent; do not hide the conflict by changing the lint threshold.
- Fingerprint: `e671a2dcb6d3210d`

### RL002 · Transition buffer is too short

- Severity: **warning**
- Evidence: Project Sync leaves 0 minutes before Partner Call; policy requires 10.
- Repair: Move or shorten one event to create at least 10 minutes for transition, preparation, or travel.
- Fingerprint: `067d95e29a2d99d8`

### RL002 · Transition buffer is too short

- Severity: **warning**
- Evidence: Product Review leaves 5 minutes before Roadmap Sync; policy requires 10.
- Repair: Move or shorten one event to create at least 10 minutes for transition, preparation, or travel.
- Fingerprint: `0d7d7f576757910a`

### RL002 · Transition buffer is too short

- Severity: **warning**
- Evidence: Roadmap Sync leaves 5 minutes before Customer Call; policy requires 10.
- Repair: Move or shorten one event to create at least 10 minutes for transition, preparation, or travel.
- Fingerprint: `2d9a4356fc301843`

### RL002 · Transition buffer is too short

- Severity: **warning**
- Evidence: Customer Call leaves 0 minutes before Hiring Review; policy requires 10.
- Repair: Move or shorten one event to create at least 10 minutes for transition, preparation, or travel.
- Fingerprint: `334a2caac04afc93`

### RL002 · Transition buffer is too short

- Severity: **warning**
- Evidence: Daily Standup leaves 0 minutes before Focus Block; policy requires 10.
- Repair: Move or shorten one event to create at least 10 minutes for transition, preparation, or travel.
- Fingerprint: `d29ab07986616dbf`

### RL003 · Daily meeting budget exceeded

- Severity: **warning**
- Evidence: 290 meeting minutes exceed the 210-minute daily budget on 2026-08-03.
- Repair: Decline low-value meetings, shorten agendas, or batch movable meetings into a collaboration window.
- Fingerprint: `04362202af203b12`

### RL003 · Daily meeting budget exceeded

- Severity: **warning**
- Evidence: 390 meeting minutes exceed the 210-minute daily budget on 2026-08-04.
- Repair: Decline low-value meetings, shorten agendas, or batch movable meetings into a collaboration window.
- Fingerprint: `0ddf85fa081463da`

### RL003 · Daily meeting budget exceeded

- Severity: **warning**
- Evidence: 270 meeting minutes exceed the 210-minute daily budget on 2026-08-05.
- Repair: Decline low-value meetings, shorten agendas, or batch movable meetings into a collaboration window.
- Fingerprint: `9448fb444f436221`

### RL003 · Daily meeting budget exceeded

- Severity: **warning**
- Evidence: 270 meeting minutes exceed the 210-minute daily budget on 2026-08-07.
- Repair: Decline low-value meetings, shorten agendas, or batch movable meetings into a collaboration window.
- Fingerprint: `a1bfd8c7bbd63aa4`

### RL004 · Weekly meeting budget exceeded

- Severity: **warning**
- Evidence: 1430 meeting minutes exceed the 780-minute budget for the 5-day audited portion of week 2026-08-03.
- Repair: Remove recurring meetings without decisions, shorten default durations, and cluster remaining meetings.
- Fingerprint: `7169647ee9dfb42c`

### RL005 · Consecutive meeting run is too long

- Severity: **warning**
- Evidence: 5 meetings occupy 300 consecutive minutes on 2026-08-03; policy allows 120.
- Repair: Insert a real break or split the run so no consecutive meeting span exceeds 120 minutes.
- Fingerprint: `244dc66f1e2d3fd0`

### RL005 · Consecutive meeting run is too long

- Severity: **warning**
- Evidence: 3 meetings occupy 180 consecutive minutes on 2026-08-04; policy allows 120.
- Repair: Insert a real break or split the run so no consecutive meeting span exceeds 120 minutes.
- Fingerprint: `7209ab90321c0f16`

### RL006 · Not enough focus capacity

- Severity: **warning**
- Evidence: Week 2026-08-03 has 1 protected focus blocks; 3 are required for its 5 audited workdays.
- Repair: Use the overlay command to reserve 2 additional block(s) of at least 90 minutes, then move meetings if free capacity is insufficient.
- Fingerprint: `cdcdbd67b0e003f5`

### RL007 · Free time is fragmented

- Severity: **warning**
- Evidence: 150 free minutes are split into blocks shorter than 90 minutes on 2026-08-05.
- Repair: Batch or move meetings so short gaps combine into one usable focus window.
- Fingerprint: `2010e81aebda20a9`

### RL007 · Free time is fragmented

- Severity: **warning**
- Evidence: 150 free minutes are split into blocks shorter than 90 minutes on 2026-08-07.
- Repair: Batch or move meetings so short gaps combine into one usable focus window.
- Fingerprint: `57f9d7b8ecc3286a`

### RL007 · Free time is fragmented

- Severity: **warning**
- Evidence: 120 free minutes are split into blocks shorter than 90 minutes on 2026-08-04.
- Repair: Batch or move meetings so short gaps combine into one usable focus window.
- Fingerprint: `9e94a4ddc19eb028`

### RL007 · Free time is fragmented

- Severity: **warning**
- Evidence: 150 free minutes are split into blocks shorter than 90 minutes on 2026-08-06.
- Repair: Batch or move meetings so short gaps combine into one usable focus window.
- Fingerprint: `ba4f5b5df12fb8a4`

### RL008 · Lunch window is squeezed

- Severity: **warning**
- Evidence: The longest free interval between 11:30 and 14:00 is 20 minutes on 2026-08-04; policy requires 30.
- Repair: Reserve at least 30 uninterrupted minutes in the lunch window. The overlay command can hold an existing free interval; move events first when no interval fits.
- Fingerprint: `2a24e1bb57c19a55`

### RL008 · Lunch window is squeezed

- Severity: **warning**
- Evidence: The longest free interval between 11:30 and 14:00 is 0 minutes on 2026-08-03; policy requires 30.
- Repair: Reserve at least 30 uninterrupted minutes in the lunch window. The overlay command can hold an existing free interval; move events first when no interval fits.
- Fingerprint: `da15789b113f3cc2`

### RL009 · Event falls outside working hours

- Severity: **warning**
- Evidence: Regional Call is not fully contained in the configured work window on 2026-08-05.
- Repair: Move the event into working hours, mark it transparent/ignored when appropriate, or deliberately adjust the workweek policy.
- Fingerprint: `b2306dbdd0d944bc`
