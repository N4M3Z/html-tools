// Turn a Claude Code `--output-format stream-json --verbose` log into asciicast v2 text. Timing comes from
// the event timestamps, so the cast replays the run at its real pace. Subagents (Agent tool) become coloured
// lanes from their own streamed events; a Workflow run's agents become lanes from the `task_progress` events,
// which carry each agent's start, last progress and finish in epoch milliseconds. `# Scenario:` lines name the
// chapters that cast-player and agg both read.

type Block = { type: string; name?: string; text?: string; input?: Record<string, unknown>; id?: string; tool_use_id?: string; content?: unknown };
type Ev = {
  type: string; subtype?: string; timestamp?: string; parent_tool_use_id?: string | null;
  message?: { content?: Block[] | string }; result?: string; duration_ms?: number; num_turns?: number;
  workflow_progress?: WorkflowAgent[];
};
type WorkflowAgent = {
  type: string; label?: string; model?: string; state?: string; startedAt?: number; lastProgressAt?: number;
  lastToolName?: string; lastToolSummary?: string; toolCalls?: number; durationMs?: number; phaseTitle?: string; agentId?: string;
};
export type CastOptions = {
  cols?: number; rows?: number; title?: string; prompt?: string;
  /** Shorten every silent gap longer than this many seconds, like `agg --idle-time-limit`. */
  maxGap?: number;
  /** Play the whole cast this many times faster, like `agg --speed`. */
  speed?: number;
  /** "last-workflow" starts the cast at the last Workflow call, so a run whose first attempt failed shows one take. */
  trim?: "none" | "last-workflow";
};
export type CastResult = { cast: string; events: number; agents: number; seconds: number };

const ESC = "\u001b[";
const dim = (s: string) => `${ESC}2m${s}${ESC}0m`;
const bold = (s: string) => `${ESC}1m${s}${ESC}0m`;
const color = (n: number, s: string) => `${ESC}${n}m${s}${ESC}0m`;
const LANE_COLORS = [36, 35, 33, 32, 34, 91, 95, 93, 92, 94];
const lanePrefix = (lane: number) => (lane ? color(LANE_COLORS[(lane - 1) % LANE_COLORS.length], `track ${lane} ▏`) : "");
const modelShort = (m = "") => m.replace(/^claude-/, "").replace(/-(\d+)-(\d+)$/, " $1.$2");

export function shortArg(name: string, input: Record<string, unknown> = {}): string {
  const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v));
  switch (name) {
    case "Agent": return s(input.description || input.name || input.subagent_type);
    case "WebFetch": return s(input.url);
    case "WebSearch": return s(input.query);
    case "Read": case "Write": case "Edit": return s(input.file_path).split("/").slice(-2).join("/");
    case "Glob": case "Grep": return s(input.pattern);
    case "Skill": return s(input.skill);
    case "Workflow": { const m = /name:\s*'([^']+)'/.exec(s(input.script)); return m ? m[1] : s(input.name); }
    case "Bash": return s(input.description || input.command);
    default: return s(Object.values(input)[0]).slice(0, 60);
  }
}

export function wrap(text: string, width: number, indent: string, first = indent): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r/g, "").split("\n")) {
    if (!para.trim()) { out.push(""); continue; }
    const limit = width - (out.length ? indent : first).length;
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (line && (line + " " + word).length > limit) { out.push(line); line = word; }
      else line = line ? line + " " + word : word;
    }
    if (line) out.push(line);
  }
  return out.map((l, i) => (i === 0 ? first : indent) + l);
}

/** Shorten gaps over `maxGap` seconds and divide every time by `speed`, in place, on time-sorted rows. */
export function retime(rows: [number, string, string][], maxGap = 0, speed = 1): void {
  if (maxGap > 0) {
    let shift = 0;
    let previous = rows.length ? rows[0][0] : 0;
    for (let i = 1; i < rows.length; i++) {
      const original = rows[i][0];
      if (original - previous > maxGap) shift += original - previous - maxGap;
      rows[i][0] = original - shift;
      previous = original;
    }
  }
  if (speed > 0 && speed !== 1) for (const row of rows) row[0] = row[0] / speed;
  for (const row of rows) row[0] = Math.round(row[0] * 1000) / 1000;
}

export function convert(streamText: string, options: CastOptions = {}): CastResult {
  const cols = options.cols ?? 120;
  const rows = options.rows ?? 36;
  const width = cols - 2;
  const events: Ev[] = [];
  for (const line of streamText.split("\n")) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* a partial last line */ }
  }
  if (options.trim === "last-workflow") {
    let at = -1;
    events.forEach((e, i) => {
      const c = e.message?.content;
      if (e.type === "assistant" && Array.isArray(c) && c.some((b) => b.type === "tool_use" && b.name === "Workflow")) at = i;
    });
    if (at > 0) events.splice(0, at);
  }
  const stamped = events.filter((e) => e.timestamp);
  if (!stamped.length) throw new Error("no timestamped events in the stream");
  const t0 = Date.parse(stamped[0].timestamp!) - 1500;

  const out: [number, string, string][] = [];
  const emit = (t: number, lines: string[]) => { if (lines.length) out.push([Math.max(0, t), "o", lines.join("\r\n") + "\r\n"]); };

  const toolNames = new Map<string, string>();
  const toolDesc = new Map<string, string>();
  const lanes = new Map<string, number>();
  const laneByLabel = new Map<string, number>();
  const agentSeen = new Map<string, { state: string; tool: string }>();
  const phasesSeen = new Set<string>();
  let agentLaunches = 0;
  let handBacks = 0;
  const laneFor = (label: string) => { if (!laneByLabel.has(label)) laneByLabel.set(label, laneByLabel.size + lanes.size + 1); return laneByLabel.get(label)!; };
  const scenario = (title: string, t: number) => { if (!phasesSeen.has(title)) { phasesSeen.add(title); emit(t, ["", dim(`# Scenario: ${title}`)]); } };

  // Workflow progress: the per-agent fields draw the parallel tracks of a Workflow run.
  const walk = (e: Ev) => {
    for (const w of e.workflow_progress || []) {
      if (w.type !== "workflow_agent" || !w.label || !w.agentId) continue;
      const prev = agentSeen.get(w.agentId);
      const pre = lanePrefix(laneFor(w.label));
      const t = ((w.lastProgressAt || w.startedAt || 0) - t0) / 1000;
      if (!prev) {
        agentSeen.set(w.agentId, { state: w.state || "", tool: w.lastToolName || "" });
        const ts = ((w.startedAt || 0) - t0) / 1000;
        if (w.phaseTitle) scenario(w.phaseTitle, ts - 0.01);
        emit(ts, [pre + "▶ " + bold(w.phaseTitle || "") + dim(" · ") + w.label + dim(" · " + modelShort(w.model))]);
        continue;
      }
      if (w.lastToolName && w.lastToolName !== prev.tool && w.state !== "done") {
        const what = w.lastToolSummary ? dim(" · ") + w.lastToolSummary.slice(0, width - 40) : "";
        emit(t, [pre + "  " + dim("⎿ ") + w.lastToolName + what]);
        prev.tool = w.lastToolName;
      }
      if (w.state === "done" && prev.state !== "done") {
        const secs = w.durationMs ? Math.round(w.durationMs / 1000) : 0;
        emit(t, [pre + "✓ " + w.label + dim(` · ${w.toolCalls ?? 0} tool calls · ${secs} s`)]);
        prev.state = "done";
      }
    }
  };

  const prompt = (options.prompt || "").trim();
  if (prompt) emit(0, [...wrap(prompt + dim('"'), width, "  ", dim("$ ") + bold("claude") + " " + dim('"')), ""]);

  for (const e of events) {
    if (e.type === "system" && e.subtype === "task_progress") { walk(e); continue; }
    if (!e.timestamp) continue;
    const t = (Date.parse(e.timestamp) - t0) / 1000;
    const parent = e.parent_tool_use_id || "";
    // Events under a tool that is not an Agent call (WebFetch's own summariser, for one) are internals, not tracks.
    if (parent && toolNames.get(parent) && toolNames.get(parent) !== "Agent") continue;
    if (parent && !lanes.has(parent)) {
      lanes.set(parent, lanes.size + laneByLabel.size + 1);
      emit(t - 0.01, [lanePrefix(lanes.get(parent)!) + "▶ " + bold("Agent") + dim(" · ") + (toolDesc.get(parent) || "subagent")]);
    }
    const lane = parent ? lanes.get(parent)! : 0;
    const pre = lanePrefix(lane);
    const content = e.message?.content;
    if (e.type === "assistant" && Array.isArray(content)) {
      for (const b of content) {
        if (lane === 0 && b.type === "text" && b.text?.trim() && agentLaunches > 0 && handBacks >= agentLaunches) scenario("Synthesis", t - 0.01);
        if (lane === 0 && b.type === "tool_use" && b.name === "Agent") { scenario("Fan-out", t - 0.01); agentLaunches += 1; }
        if (b.type === "text" && b.text?.trim()) emit(t, wrap(b.text.trim(), width, pre + "  ", pre + "● "));
        else if (b.type === "tool_use" && b.name) {
          if (b.id) { toolNames.set(b.id, b.name); toolDesc.set(b.id, shortArg(b.name, b.input)); }
          emit(t, [pre + "● " + bold(b.name) + dim("(") + shortArg(b.name, b.input).slice(0, width - 20) + dim(")")]);
        }
      }
    } else if (e.type === "user" && Array.isArray(content)) {
      for (const b of content) {
        if (b.type !== "tool_result") continue;
        const c = b.content;
        const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((x: any) => (x && x.type === "text" ? x.text : "")).join("\n") : "";
        if (lane === 0 && b.tool_use_id && toolNames.get(b.tool_use_id) === "Agent") {
          const n = text.replace(/^\[Subagent hand-back\][^\n]*\n+/, "").split("\n").filter((l) => l.trim()).length;
          emit(t, ["  " + dim("⎿ ") + "returned" + dim(` · ${toolDesc.get(b.tool_use_id) || "agent"} · ${n} lines`)]);
          handBacks += 1;
          continue;
        }
        const all = text.split("\n").filter((l) => l.trim());
        const head = (all[0] || "").replace(/\s*\(This tool result is internal metadata.*$/, "").slice(0, width - 14);
        emit(t, [pre + "  " + dim("⎿ ") + dim(head) + (all.length > 1 ? dim(`  … ${all.length} lines`) : "")]);
      }
    } else if (e.type === "result") {
      const t2 = t || (Date.parse(stamped[stamped.length - 1].timestamp!) - t0) / 1000 + 0.5;
      emit(t2, ["", dim("─".repeat(width))]);
      if (e.result) emit(t2 + 0.1, e.result.split("\n").flatMap((l) => (l.length > width ? wrap(l, width, "") : [l])));
      const secs = e.duration_ms ? Math.round(e.duration_ms / 1000) : 0;
      emit(t2 + 0.2, ["", dim(`done · ${secs} s · ${e.num_turns ?? "?"} turns · ${lanes.size + laneByLabel.size} agents`)]);
    }
  }
  // Workflow timing can precede the event that carried it, so sort by time before retiming.
  out.sort((a, b) => a[0] - b[0]);
  retime(out, options.maxGap ?? 0, options.speed ?? 1);
  const header = { version: 2, width: cols, height: rows, timestamp: Math.floor(t0 / 1000), title: options.title || "claude code · event log", env: { TERM: "xterm-256color", SHELL: "/bin/zsh" } };
  const cast = [JSON.stringify(header), ...out.map((row) => JSON.stringify(row))].join("\n") + "\n";
  return { cast, events: out.length, agents: lanes.size + laneByLabel.size, seconds: out.length ? Math.round(out[out.length - 1][0]) : 0 };
}
