export type Severity = "error" | "warning" | "info";
export type RuleLevel = Severity | "off";
export type EventKind = "meeting" | "appointment" | "focus" | "ignored";

export interface LunchPolicy {
  earliest: string;
  latest: string;
  minimumMinutes: number;
}

export interface WorkweekConfig {
  days: number[];
  start: string;
  end: string;
  lunch: LunchPolicy;
}

export interface PolicyConfig {
  overlap: RuleLevel;
  minimumTransitionMinutes: number;
  dailyMeetingBudgetMinutes: number;
  weeklyMeetingBudgetMinutes: number;
  maximumConsecutiveMeetingMinutes: number;
  minimumFocusBlockMinutes: number;
  minimumFocusBlocksPerWeek: number;
  maximumFragmentMinutesPerDay: number;
  outsideWorkHours: RuleLevel;
}

export interface MatchingConfig {
  ignoreTitlePatterns: string[];
  focusTitlePatterns: string[];
  meetingTitlePatterns: string[];
  countAppointmentsAsMeetings: boolean;
}

export interface PrivacyConfig {
  redactTitles: boolean;
  redactLocations: boolean;
}

export interface RhythmLintConfig {
  $schema?: string;
  version: 1;
  timezone: string;
  workweek: WorkweekConfig;
  policy: PolicyConfig;
  matching: MatchingConfig;
  privacy: PrivacyConfig;
}

export interface AuditWindow {
  from: Date;
  to: Date;
  fromDate: string;
  toDateExclusive: string;
  days: number;
  timezone: string;
}

export interface CalendarEvent {
  id: string;
  uid: string;
  recurrenceId?: string;
  summary: string;
  location: string;
  start: Date;
  end: Date;
  allDay: boolean;
  transparent: boolean;
  cancelled: boolean;
  recurring: boolean;
  attendees: number;
  source: string;
  kind: EventKind;
}

export interface ParseDiagnostic {
  source: string;
  severity: "warning" | "error";
  code: string;
  message: string;
  uid?: string;
}

export interface ParseResult {
  events: CalendarEvent[];
  diagnostics: ParseDiagnostic[];
  inputHashes: Array<{ source: string; sha256: string }>;
}

export interface Interval {
  start: Date;
  end: Date;
  eventIds?: string[];
  kind?: EventKind;
}

export interface FindingEvidence {
  date?: string;
  minutes?: number;
  limitMinutes?: number;
  gapMinutes?: number;
  count?: number;
  requiredCount?: number;
  eventLabels?: string[];
  window?: string;
  [key: string]: string | number | string[] | undefined;
}

export interface Finding {
  fingerprint: string;
  ruleId: string;
  severity: Severity;
  title: string;
  message: string;
  repair: string;
  eventIds: string[];
  evidence: FindingEvidence;
}

export interface DayMetrics {
  date: string;
  workMinutes: number;
  busyMinutes: number;
  meetingMinutes: number;
  protectedFocusMinutes: number;
  availableFocusMinutes: number;
  qualifyingFocusBlocks: number;
  protectedFocusBlocks: number;
  fragmentMinutes: number;
  longestFocusBlockMinutes: number;
  contextSwitches: number;
}

export interface WeekMetrics {
  weekStart: string;
  workdays: number;
  meetingMinutes: number;
  qualifyingFocusBlocks: number;
  protectedFocusBlocks: number;
  availableFocusMinutes: number;
}

export interface AuditMetrics {
  eventCount: number;
  meetingCount: number;
  recurringOccurrenceCount: number;
  meetingMinutes: number;
  busyMinutes: number;
  availableFocusMinutes: number;
  protectedFocusMinutes: number;
  fragmentMinutes: number;
  contextSwitches: number;
  days: DayMetrics[];
  weeks: WeekMetrics[];
}

export interface AuditReport {
  schemaVersion: "rhythmlint.audit.v1";
  toolVersion: string;
  window: {
    from: string;
    toExclusive: string;
    days: number;
    timezone: string;
  };
  config: RhythmLintConfig;
  inputs: Array<{ source: string; sha256: string }>;
  diagnostics: ParseDiagnostic[];
  metrics: AuditMetrics;
  findings: Finding[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
    score: number;
  };
  events: CalendarEvent[];
}

export interface MetricDeltas {
  meetingMinutes: number;
  busyMinutes: number;
  availableFocusMinutes: number;
  protectedFocusMinutes: number;
  fragmentMinutes: number;
  contextSwitches: number;
  errors: number;
  warnings: number;
  score: number;
}

export interface DiffReport {
  schemaVersion: "rhythmlint.diff.v1";
  toolVersion: string;
  before: AuditReport;
  after: AuditReport;
  deltas: MetricDeltas;
  resolvedFindings: Finding[];
  introducedFindings: Finding[];
  unchangedFindingCount: number;
}

export interface RuleDefinition {
  id: string;
  name: string;
  defaultSeverity: Severity;
  description: string;
}
