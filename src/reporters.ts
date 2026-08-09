import type { AuditReport, DiffReport, Finding, Severity } from "./types.js";

export type OutputFormat = "console" | "json" | "markdown" | "html";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function plural(
  value: number,
  singular: string,
  pluralValue = `${singular}s`,
): string {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

function duration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  if (hours === 0) return `${sign}${rest}m`;
  if (rest === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${rest}m`;
}

function severityRank(severity: Severity): number {
  return { error: 0, warning: 1, info: 2 }[severity];
}

function formatFindingConsole(finding: Finding): string {
  const evidence = Object.entries(finding.evidence)
    .filter(([key, value]) => key !== "eventLabels" && value !== undefined)
    .map(
      ([key, value]) =>
        `${key}=${Array.isArray(value) ? value.join(",") : value}`,
    )
    .join(" ");
  return [
    `[${finding.severity.toUpperCase()}] ${finding.ruleId} ${finding.title}`,
    `  ${finding.message}`,
    `  Repair: ${finding.repair}`,
    ...(evidence ? [`  Evidence: ${evidence}`] : []),
  ].join("\n");
}

export function renderAuditConsole(report: AuditReport): string {
  const lines = [
    `RhythmLint ${report.toolVersion} | ${report.window.from} -> ${report.window.toExclusive} | ${report.window.timezone}`,
    `Score ${report.summary.score}/100 | ${plural(report.summary.errors, "error")} | ${plural(report.summary.warnings, "warning")} | ${plural(report.summary.info, "info")}`,
    `Meetings ${report.metrics.meetingCount} / ${duration(report.metrics.meetingMinutes)} | Focus capacity ${duration(report.metrics.availableFocusMinutes)} | Protected ${duration(report.metrics.protectedFocusMinutes)} | Fragments ${duration(report.metrics.fragmentMinutes)}`,
  ];
  if (report.diagnostics.length > 0) {
    lines.push("", "Parser diagnostics:");
    for (const item of report.diagnostics) {
      lines.push(
        `  [${item.severity.toUpperCase()}] ${item.code} ${item.source}: ${item.message}`,
      );
    }
  }
  if (report.findings.length === 0) {
    lines.push("", "No schedule-policy findings in the audited window.");
  } else {
    lines.push("", "Findings:", ...report.findings.map(formatFindingConsole));
  }
  return `${lines.join("\n")}\n`;
}

export function renderAuditMarkdown(report: AuditReport): string {
  const findings = report.findings
    .map(
      (item) =>
        `### ${item.ruleId} · ${escapeMarkdown(item.title)}\n\n` +
        `- Severity: **${item.severity}**\n` +
        `- Evidence: ${escapeMarkdown(item.message)}\n` +
        `- Repair: ${escapeMarkdown(item.repair)}\n` +
        `- Fingerprint: \`${item.fingerprint}\`\n`,
    )
    .join("\n");
  const days = report.metrics.days
    .map(
      (day) =>
        `| ${day.date} | ${duration(day.meetingMinutes)} | ${duration(day.availableFocusMinutes)} | ${day.protectedFocusBlocks} | ${duration(day.fragmentMinutes)} | ${day.contextSwitches} |`,
    )
    .join("\n");
  const diagnostics = report.diagnostics.length
    ? report.diagnostics
        .map(
          (item) =>
            `- **${item.severity} ${item.code}** (${escapeMarkdown(item.source)}): ${escapeMarkdown(item.message)}`,
        )
        .join("\n")
    : "- None";
  return (
    `# RhythmLint audit\n\n` +
    `- Window: **${report.window.from}** to **${report.window.toExclusive}** (exclusive)\n` +
    `- Timezone: **${report.window.timezone}**\n` +
    `- Score: **${report.summary.score}/100**\n` +
    `- Findings: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.info} info\n` +
    `- Meeting time: **${duration(report.metrics.meetingMinutes)}**\n` +
    `- Available focus capacity: **${duration(report.metrics.availableFocusMinutes)}**\n` +
    `- Protected focus: **${duration(report.metrics.protectedFocusMinutes)}**\n\n` +
    `## Daily shape\n\n` +
    `| Date | Meetings | Focus capacity | Protected blocks | Fragments | Switches |\n` +
    `|---|---:|---:|---:|---:|---:|\n${days || "| — | — | — | — | — | — |"}\n\n` +
    `## Parser diagnostics\n\n${diagnostics}\n\n` +
    `## Findings\n\n${findings || "No schedule-policy findings in the audited window.\n"}`
  );
}

function metricCard(label: string, value: string, note: string): string {
  return `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
}

function findingHtml(finding: Finding): string {
  const evidence = Object.entries(finding.evidence)
    .filter(([key, value]) => key !== "eventLabels" && value !== undefined)
    .map(
      ([key, value]) =>
        `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(Array.isArray(value) ? value.join(", ") : String(value))}</dd></div>`,
    )
    .join("");
  return `<article class="finding ${finding.severity}">
    <div class="finding-head"><span class="pill">${finding.ruleId}</span><span class="severity">${finding.severity}</span><code>${finding.fingerprint}</code></div>
    <h3>${escapeHtml(finding.title)}</h3>
    <p>${escapeHtml(finding.message)}</p>
    <p class="repair"><strong>Repair</strong> ${escapeHtml(finding.repair)}</p>
    ${evidence ? `<dl>${evidence}</dl>` : ""}
  </article>`;
}

function reportStyles(): string {
  return `
    :root{color-scheme:light dark;--ink:#17202a;--muted:#637083;--paper:#f4f1e8;--panel:#fffdf8;--line:#d8d1c2;--accent:#096b67;--accent2:#e0633b;--error:#b42318;--warning:#a15c00;--info:#2563a6;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(145deg,#e9e2d3 0,#f7f4ed 48%,#dfece8 100%);color:var(--ink);min-height:100vh}.wrap{max-width:1120px;margin:auto;padding:48px 24px 72px}.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-weight:800;color:var(--accent);font-size:.78rem}h1{font-family:Georgia,serif;font-size:clamp(2.4rem,7vw,5.5rem);line-height:.9;margin:.25rem 0 1rem;letter-spacing:-.055em;max-width:850px}.lead{font-size:1.12rem;max-width:760px;color:var(--muted);line-height:1.6}.scoreline{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0}.score{font:800 2rem/1 Georgia,serif;background:var(--ink);color:var(--paper);padding:16px 18px;border-radius:4px}.counts{display:flex;align-items:center;gap:12px;border:1px solid var(--line);background:#fff9;padding:12px 16px;border-radius:4px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{background:var(--panel);border:1px solid var(--line);padding:18px;min-height:130px;display:flex;flex-direction:column;box-shadow:3px 3px 0 #c9c1b2}.metric span{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:800;color:var(--muted)}.metric strong{font:700 2.1rem Georgia,serif;margin:auto 0 2px}.metric small{color:var(--muted)}section{margin-top:44px}h2{font:700 1.65rem Georgia,serif;border-bottom:2px solid var(--ink);padding-bottom:8px}.table-wrap{overflow:auto;background:var(--panel);border:1px solid var(--line)}table{width:100%;border-collapse:collapse;min-width:720px}th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line)}th{font-size:.73rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}td.num{text-align:right;font-variant-numeric:tabular-nums}.bar{height:8px;background:#e3ded4;width:120px;display:inline-block;vertical-align:middle;margin-left:8px}.bar i{display:block;height:100%;background:var(--accent);max-width:100%}.findings{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.finding{background:var(--panel);border:1px solid var(--line);border-top:5px solid var(--info);padding:18px}.finding.error{border-top-color:var(--error)}.finding.warning{border-top-color:var(--warning)}.finding h3{font:700 1.25rem Georgia,serif;margin:.7rem 0}.finding p{line-height:1.55}.finding-head{display:flex;align-items:center;gap:8px}.finding-head code{font-size:.7rem;color:var(--muted);margin-left:auto}.pill,.severity{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.pill{background:var(--ink);color:var(--paper);padding:4px 6px}.severity{color:var(--muted)}.repair{border-left:3px solid var(--accent);padding-left:10px}.finding dl{font-size:.8rem;color:var(--muted)}.finding dl div{display:grid;grid-template-columns:110px 1fr}.finding dt{font-weight:800}.finding dd{margin:0;overflow-wrap:anywhere}.empty{padding:28px;background:var(--panel);border:1px dashed var(--line)}.diag{background:var(--panel);border:1px solid var(--line);padding:12px 16px;margin:8px 0}.footer{margin-top:54px;color:var(--muted);font-size:.82rem}.delta.good{color:var(--accent)}.delta.bad{color:var(--error)}@media(max-width:820px){.grid{grid-template-columns:repeat(2,1fr)}.findings{grid-template-columns:1fr}}@media(max-width:480px){.wrap{padding:32px 16px}.grid{grid-template-columns:1fr}.counts{width:100%}}
    @media(prefers-color-scheme:dark){:root{--ink:#edf4f2;--muted:#aab7b5;--paper:#17211f;--panel:#1e2b28;--line:#40514d;--accent:#71d4c9;--accent2:#ff9d7a;--error:#ff8d82;--warning:#f7bb63;--info:#84b9ff}body{background:linear-gradient(145deg,#17211f,#101817 55%,#1e2d2b)}.score{background:#edf4f2;color:#17211f}.counts{background:#1e2b28}.bar{background:#40514d}.pill{background:#edf4f2;color:#17211f}}
    @media print{body{background:white}.wrap{max-width:none;padding:0}.metric,.finding{box-shadow:none;break-inside:avoid}.footer{display:none}}
  `;
}

function htmlShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${escapeHtml(title)}</title><style>${reportStyles()}</style></head>
<body><main class="wrap">${body}<footer class="footer">Generated locally by RhythmLint. No calendar data was uploaded. Review reports before sharing.</footer></main></body></html>\n`;
}

export function renderAuditHtml(report: AuditReport): string {
  const maxMeeting = Math.max(
    1,
    ...report.metrics.days.map((day) => day.meetingMinutes),
  );
  const dayRows = report.metrics.days
    .map(
      (day) =>
        `<tr><td>${day.date}</td><td class="num">${duration(day.meetingMinutes)} <span class="bar"><i style="width:${Math.round((day.meetingMinutes / maxMeeting) * 100)}%"></i></span></td><td class="num">${duration(day.availableFocusMinutes)}</td><td class="num">${day.protectedFocusBlocks}</td><td class="num">${duration(day.fragmentMinutes)}</td><td class="num">${day.contextSwitches}</td></tr>`,
    )
    .join("");
  const diagnostics = report.diagnostics.length
    ? report.diagnostics
        .map(
          (item) =>
            `<div class="diag"><strong>${escapeHtml(item.severity.toUpperCase())} ${escapeHtml(item.code)}</strong> · ${escapeHtml(item.source)}<br>${escapeHtml(item.message)}</div>`,
        )
        .join("")
    : `<div class="empty">No parser diagnostics.</div>`;
  const findings = report.findings.length
    ? [...report.findings]
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
        .map(findingHtml)
        .join("")
    : `<div class="empty">No schedule-policy findings in the audited window.</div>`;
  return htmlShell(
    "RhythmLint audit",
    `<header><div class="eyebrow">Calendar policy · local audit</div><h1>Your week has a shape.</h1><p class="lead">RhythmLint measured the schedule you exported—not a connected account. This report covers <strong>${report.window.from}</strong> through <strong>${report.window.toExclusive}</strong> (exclusive) in ${escapeHtml(report.window.timezone)}.</p><div class="scoreline"><div class="score">${report.summary.score}/100</div><div class="counts"><strong>${report.summary.errors}</strong> errors · <strong>${report.summary.warnings}</strong> warnings · <strong>${report.summary.info}</strong> info</div></div></header>
    <div class="grid">${metricCard("Meeting load", duration(report.metrics.meetingMinutes), `${report.metrics.meetingCount} meeting occurrences`)}${metricCard("Focus capacity", duration(report.metrics.availableFocusMinutes), "qualifying open or protected blocks")}${metricCard("Protected focus", duration(report.metrics.protectedFocusMinutes), "explicit focus reservations")}${metricCard("Fragment tax", duration(report.metrics.fragmentMinutes), `${report.metrics.contextSwitches} context switches`)}</div>
    <section><h2>Daily shape</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Meeting load</th><th>Focus capacity</th><th>Protected blocks</th><th>Fragments</th><th>Switches</th></tr></thead><tbody>${dayRows || '<tr><td colspan="6">No configured workdays in this window.</td></tr>'}</tbody></table></div></section>
    <section><h2>Findings</h2><div class="findings">${findings}</div></section>
    <section><h2>Parser diagnostics</h2>${diagnostics}</section>`,
  );
}

function signed(value: number, unit = ""): string {
  return `${value > 0 ? "+" : ""}${value}${unit}`;
}

export function renderDiffConsole(report: DiffReport): string {
  const lines = [
    `RhythmLint diff | ${report.before.window.from} -> ${report.before.window.toExclusive}`,
    `Score ${report.before.summary.score} -> ${report.after.summary.score} (${signed(report.deltas.score)})`,
    `Meeting minutes ${signed(report.deltas.meetingMinutes, "m")} | Focus capacity ${signed(report.deltas.availableFocusMinutes, "m")} | Protected focus ${signed(report.deltas.protectedFocusMinutes, "m")} | Fragments ${signed(report.deltas.fragmentMinutes, "m")}`,
    `${plural(report.resolvedFindings.length, "finding")} resolved | ${plural(report.introducedFindings.length, "finding")} introduced | ${report.unchangedFindingCount} unchanged`,
  ];
  if (report.resolvedFindings.length)
    lines.push(
      "",
      "Resolved:",
      ...report.resolvedFindings.map(formatFindingConsole),
    );
  if (report.introducedFindings.length)
    lines.push(
      "",
      "Introduced:",
      ...report.introducedFindings.map(formatFindingConsole),
    );
  return `${lines.join("\n")}\n`;
}

export function renderDiffMarkdown(report: DiffReport): string {
  const rows = Object.entries(report.deltas)
    .map(([name, value]) => `| ${name} | ${value > 0 ? "+" : ""}${value} |`)
    .join("\n");
  const findingList = (items: Finding[]): string =>
    items.length
      ? items
          .map(
            (item) =>
              `- **${item.ruleId} ${escapeMarkdown(item.title)}** — ${escapeMarkdown(item.message)}`,
          )
          .join("\n")
      : "- None";
  return (
    `# RhythmLint calendar diff\n\n` +
    `Score: **${report.before.summary.score} → ${report.after.summary.score}** (${signed(report.deltas.score)})\n\n` +
    `| Metric | Delta |\n|---|---:|\n${rows}\n\n` +
    `## Resolved findings\n\n${findingList(report.resolvedFindings)}\n\n` +
    `## Introduced findings\n\n${findingList(report.introducedFindings)}\n\n` +
    `Unchanged findings: ${report.unchangedFindingCount}\n`
  );
}

export function renderDiffHtml(report: DiffReport): string {
  const deltaCards = [
    [
      "Score",
      signed(report.deltas.score),
      `${report.before.summary.score} → ${report.after.summary.score}`,
    ],
    [
      "Meeting load",
      duration(report.deltas.meetingMinutes),
      "after minus before",
    ],
    [
      "Focus capacity",
      duration(report.deltas.availableFocusMinutes),
      "after minus before",
    ],
    [
      "Fragment tax",
      duration(report.deltas.fragmentMinutes),
      "after minus before",
    ],
  ]
    .map(([label, value, note]) =>
      metricCard(label ?? "", value ?? "", note ?? ""),
    )
    .join("");
  const list = (items: Finding[], empty: string): string =>
    items.length
      ? items.map(findingHtml).join("")
      : `<div class="empty">${escapeHtml(empty)}</div>`;
  return htmlShell(
    "RhythmLint calendar diff",
    `<header><div class="eyebrow">Calendar diff · same policy</div><h1>Did the week get better?</h1><p class="lead">Compared the same ${report.before.window.from}–${report.before.window.toExclusive} window before and after schedule changes.</p></header><div class="grid">${deltaCards}</div><section><h2>Resolved findings</h2><div class="findings">${list(report.resolvedFindings, "No findings were resolved.")}</div></section><section><h2>Introduced findings</h2><div class="findings">${list(report.introducedFindings, "No new findings were introduced.")}</div></section><section><h2>Unchanged</h2><div class="empty">${report.unchangedFindingCount} finding(s) remain unchanged.</div></section>`,
  );
}

export function renderAudit(report: AuditReport, format: OutputFormat): string {
  switch (format) {
    case "console":
      return renderAuditConsole(report);
    case "json":
      return `${JSON.stringify(report, null, 2)}\n`;
    case "markdown":
      return renderAuditMarkdown(report);
    case "html":
      return renderAuditHtml(report);
  }
}

export function renderDiff(report: DiffReport, format: OutputFormat): string {
  switch (format) {
    case "console":
      return renderDiffConsole(report);
    case "json":
      return `${JSON.stringify(report, null, 2)}\n`;
    case "markdown":
      return renderDiffMarkdown(report);
    case "html":
      return renderDiffHtml(report);
  }
}
