import type { RuleDefinition } from "./types.js";

export const RULES: readonly RuleDefinition[] = [
  {
    id: "RL001",
    name: "event-overlap",
    defaultSeverity: "error",
    description: "Two active timed events overlap.",
  },
  {
    id: "RL002",
    name: "transition-buffer",
    defaultSeverity: "warning",
    description:
      "The gap between consecutive events is shorter than the configured transition buffer.",
  },
  {
    id: "RL003",
    name: "daily-meeting-budget",
    defaultSeverity: "warning",
    description: "Meeting time exceeds the configured daily budget.",
  },
  {
    id: "RL004",
    name: "weekly-meeting-budget",
    defaultSeverity: "warning",
    description:
      "Meeting time exceeds the configured weekly budget, scaled for partial audit weeks.",
  },
  {
    id: "RL005",
    name: "consecutive-meetings",
    defaultSeverity: "warning",
    description:
      "A meeting run exceeds the maximum consecutive-meeting duration.",
  },
  {
    id: "RL006",
    name: "focus-capacity",
    defaultSeverity: "warning",
    description:
      "A week has fewer qualifying focus blocks than required, scaled for partial audit weeks.",
  },
  {
    id: "RL007",
    name: "fragmented-time",
    defaultSeverity: "warning",
    description:
      "Short free gaps consume more minutes than the daily fragmentation budget.",
  },
  {
    id: "RL008",
    name: "lunch-window",
    defaultSeverity: "warning",
    description:
      "No uninterrupted lunch interval satisfies the configured minimum.",
  },
  {
    id: "RL009",
    name: "outside-work-hours",
    defaultSeverity: "warning",
    description:
      "An active timed event falls partly or entirely outside configured working hours.",
  },
] as const;

export function ruleById(id: string): RuleDefinition {
  const rule = RULES.find((item) => item.id === id);
  if (!rule) throw new Error(`Unknown rule: ${id}`);
  return rule;
}
