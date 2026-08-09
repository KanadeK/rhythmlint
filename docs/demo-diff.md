# RhythmLint calendar diff

Score: **0 → 100** (+100)

| Metric | Delta |
|---|---:|
| meetingMinutes | -880 |
| busyMinutes | -580 |
| availableFocusMinutes | +1430 |
| protectedFocusMinutes | +300 |
| fragmentMinutes | -550 |
| contextSwitches | -13 |
| errors | -3 |
| warnings | -20 |
| score | +100 |

## Resolved findings

- **RL001 Active events overlap** — Daily Standup and Product Review overlap for 10 minutes.
- **RL001 Active events overlap** — Focus Block and Architecture Review overlap for 30 minutes.
- **RL001 Active events overlap** — Regional Call and Daily Standup overlap for 15 minutes.
- **RL002 Transition buffer is too short** — Project Sync leaves 0 minutes before Partner Call; policy requires 10.
- **RL002 Transition buffer is too short** — Product Review leaves 5 minutes before Roadmap Sync; policy requires 10.
- **RL002 Transition buffer is too short** — Roadmap Sync leaves 5 minutes before Customer Call; policy requires 10.
- **RL002 Transition buffer is too short** — Customer Call leaves 0 minutes before Hiring Review; policy requires 10.
- **RL002 Transition buffer is too short** — Daily Standup leaves 0 minutes before Focus Block; policy requires 10.
- **RL003 Daily meeting budget exceeded** — 290 meeting minutes exceed the 210-minute daily budget on 2026-08-03.
- **RL003 Daily meeting budget exceeded** — 390 meeting minutes exceed the 210-minute daily budget on 2026-08-04.
- **RL003 Daily meeting budget exceeded** — 270 meeting minutes exceed the 210-minute daily budget on 2026-08-05.
- **RL003 Daily meeting budget exceeded** — 270 meeting minutes exceed the 210-minute daily budget on 2026-08-07.
- **RL004 Weekly meeting budget exceeded** — 1430 meeting minutes exceed the 780-minute budget for the 5-day audited portion of week 2026-08-03.
- **RL005 Consecutive meeting run is too long** — 5 meetings occupy 300 consecutive minutes on 2026-08-03; policy allows 120.
- **RL005 Consecutive meeting run is too long** — 3 meetings occupy 180 consecutive minutes on 2026-08-04; policy allows 120.
- **RL006 Not enough focus capacity** — Week 2026-08-03 has 1 protected focus blocks; 3 are required for its 5 audited workdays.
- **RL007 Free time is fragmented** — 150 free minutes are split into blocks shorter than 90 minutes on 2026-08-05.
- **RL007 Free time is fragmented** — 150 free minutes are split into blocks shorter than 90 minutes on 2026-08-07.
- **RL007 Free time is fragmented** — 120 free minutes are split into blocks shorter than 90 minutes on 2026-08-04.
- **RL007 Free time is fragmented** — 150 free minutes are split into blocks shorter than 90 minutes on 2026-08-06.
- **RL008 Lunch window is squeezed** — The longest free interval between 11:30 and 14:00 is 20 minutes on 2026-08-04; policy requires 30.
- **RL008 Lunch window is squeezed** — The longest free interval between 11:30 and 14:00 is 0 minutes on 2026-08-03; policy requires 30.
- **RL009 Event falls outside working hours** — Regional Call is not fully contained in the configured work window on 2026-08-05.

## Introduced findings

- None

Unchanged findings: 0
