import assert from "node:assert/strict";
import test from "node:test";

import { resolveAuditWindow } from "../dist/config.js";
import { makeSyntheticCalendar, parseCalendarInputs } from "../dist/ics.js";
import { utcConfig } from "./helpers.mjs";

const config = utcConfig();
const window = resolveAuditWindow(config, "2026-08-03", 7);

test("parses and classifies a timed event", () => {
  const text = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:one\nDTSTART:20260803T090000Z\nDTEND:20260803T100000Z\nSUMMARY:Design Review\nATTENDEE:mailto:a@example.test\nEND:VEVENT\nEND:VCALENDAR\n`;
  const result = parseCalendarInputs(
    [{ source: "one.ics", text }],
    window,
    config,
  );
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].kind, "meeting");
  assert.equal(result.events[0].attendees, 1);
  assert.equal(result.inputHashes[0].sha256.length, 64);
});

test("expands RRULE and honors EXDATE", () => {
  const text = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:series\nDTSTART:20260803T090000Z\nDTEND:20260803T093000Z\nRRULE:FREQ=DAILY;COUNT=5\nEXDATE:20260805T090000Z\nSUMMARY:Daily Standup\nEND:VEVENT\nEND:VCALENDAR\n`;
  const result = parseCalendarInputs(
    [{ source: "series.ics", text }],
    window,
    config,
  );
  assert.equal(result.events.length, 4);
  assert.ok(result.events.every((event) => event.recurring));
  assert.ok(
    !result.events.some((event) =>
      event.start.toISOString().startsWith("2026-08-05"),
    ),
  );
});

test("applies recurrence exceptions", () => {
  const text = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:series\nDTSTART:20260803T090000Z\nDTEND:20260803T093000Z\nRRULE:FREQ=DAILY;COUNT=3\nSUMMARY:Daily Standup\nEND:VEVENT\nBEGIN:VEVENT\nUID:series\nRECURRENCE-ID:20260804T090000Z\nDTSTART:20260804T100000Z\nDTEND:20260804T103000Z\nSUMMARY:Moved Standup\nEND:VEVENT\nEND:VCALENDAR\n`;
  const result = parseCalendarInputs(
    [{ source: "exception.ics", text }],
    window,
    config,
  );
  assert.equal(result.events.length, 3);
  const moved = result.events.find(
    (event) => event.summary === "Moved Standup",
  );
  assert.equal(moved.start.toISOString(), "2026-08-04T10:00:00.000Z");
});

test("deduplicates an occurrence supplied by multiple files", () => {
  const text = makeSyntheticCalendar([
    {
      start: new Date("2026-08-03T09:00:00Z"),
      end: new Date("2026-08-03T10:00:00Z"),
      summary: "Sync",
      uid: "same",
    },
  ]);
  const result = parseCalendarInputs(
    [
      { source: "a.ics", text },
      { source: "b.ics", text },
    ],
    window,
    config,
  );
  assert.equal(result.events.length, 1);
  assert.equal(result.diagnostics[0].code, "ICS_DUPLICATE_OCCURRENCE");
});

test("retains flags and skips non-positive durations", () => {
  const text = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:cancelled\nDTSTART:20260803T090000Z\nDTEND:20260803T100000Z\nSTATUS:CANCELLED\nSUMMARY:Cancelled Sync\nEND:VEVENT\nBEGIN:VEVENT\nUID:transparent\nDTSTART:20260803T100000Z\nDTEND:20260803T110000Z\nTRANSP:TRANSPARENT\nSUMMARY:FYI\nEND:VEVENT\nBEGIN:VEVENT\nUID:all-day\nDTSTART;VALUE=DATE:20260803\nDTEND;VALUE=DATE:20260804\nSUMMARY:Holiday\nEND:VEVENT\nBEGIN:VEVENT\nUID:broken\nDTSTART:20260803T120000Z\nDTEND:20260803T120000Z\nSUMMARY:Broken\nEND:VEVENT\nEND:VCALENDAR\n`;
  const result = parseCalendarInputs(
    [{ source: "flags.ics", text }],
    window,
    config,
  );
  assert.equal(result.events.length, 3);
  assert.equal(
    result.events.find((event) => event.uid === "cancelled").cancelled,
    true,
  );
  assert.equal(
    result.events.find((event) => event.uid === "transparent").transparent,
    true,
  );
  assert.equal(
    result.events.find((event) => event.uid === "all-day").allDay,
    true,
  );
  assert.ok(
    result.diagnostics.some(
      (item) => item.code === "ICS_NON_POSITIVE_DURATION",
    ),
  );
});

test("rejects malformed input and non-calendar roots", () => {
  assert.throws(
    () =>
      parseCalendarInputs(
        [{ source: "bad.ics", text: "not ics" }],
        window,
        config,
      ),
    /Unable to parse/,
  );
  assert.throws(
    () =>
      parseCalendarInputs(
        [{ source: "event.ics", text: "BEGIN:VEVENT\nUID:x\nEND:VEVENT" }],
        window,
        config,
      ),
    /VCALENDAR root/,
  );
});
