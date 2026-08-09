import type {
  AuditReport,
  DiffReport,
  Finding,
  MetricDeltas,
} from "./types.js";

function byFingerprint(findings: Finding[]): Map<string, Finding> {
  return new Map(findings.map((finding) => [finding.fingerprint, finding]));
}

function subtract(after: number, before: number): number {
  return after - before;
}

export function diffReports(
  before: AuditReport,
  after: AuditReport,
): DiffReport {
  if (
    before.window.from !== after.window.from ||
    before.window.toExclusive !== after.window.toExclusive ||
    before.window.timezone !== after.window.timezone
  ) {
    throw new Error(
      "Calendar diff requires identical audit windows and timezones",
    );
  }
  const beforeFindings = byFingerprint(before.findings);
  const afterFindings = byFingerprint(after.findings);
  const resolvedFindings = before.findings.filter(
    (finding) => !afterFindings.has(finding.fingerprint),
  );
  const introducedFindings = after.findings.filter(
    (finding) => !beforeFindings.has(finding.fingerprint),
  );
  const unchangedFindingCount = after.findings.filter((finding) =>
    beforeFindings.has(finding.fingerprint),
  ).length;
  const deltas: MetricDeltas = {
    meetingMinutes: subtract(
      after.metrics.meetingMinutes,
      before.metrics.meetingMinutes,
    ),
    busyMinutes: subtract(
      after.metrics.busyMinutes,
      before.metrics.busyMinutes,
    ),
    availableFocusMinutes: subtract(
      after.metrics.availableFocusMinutes,
      before.metrics.availableFocusMinutes,
    ),
    protectedFocusMinutes: subtract(
      after.metrics.protectedFocusMinutes,
      before.metrics.protectedFocusMinutes,
    ),
    fragmentMinutes: subtract(
      after.metrics.fragmentMinutes,
      before.metrics.fragmentMinutes,
    ),
    contextSwitches: subtract(
      after.metrics.contextSwitches,
      before.metrics.contextSwitches,
    ),
    errors: subtract(after.summary.errors, before.summary.errors),
    warnings: subtract(after.summary.warnings, before.summary.warnings),
    score: subtract(after.summary.score, before.summary.score),
  };
  return {
    schemaVersion: "rhythmlint.diff.v1",
    toolVersion: after.toolVersion,
    before,
    after,
    deltas,
    resolvedFindings,
    introducedFindings,
    unchangedFindingCount,
  };
}
