import { describe, expect, test } from "bun:test";
import { convert, retime, shortArg, wrap } from "../htmltools/cast.ts";

const at = (s: number) => new Date(Date.UTC(2026, 9, 9, 17, 0, s)).toISOString();
const line = (o: unknown) => JSON.stringify(o);
const plain = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");

// A nested session that launches one Agent, gets its report back, then answers; plus one Workflow agent.
const stream = [
  line({ type: "system", subtype: "init", session_id: "s" }),
  line({ type: "assistant", timestamp: at(1), message: { content: [{ type: "tool_use", id: "tu_1", name: "Agent", input: { description: "Research critics" } }] } }),
  line({ type: "assistant", timestamp: at(2), parent_tool_use_id: "tu_1", message: { content: [{ type: "tool_use", id: "tu_2", name: "WebFetch", input: { url: "https://example.com/a" } }] } }),
  line({ type: "user", timestamp: at(3), parent_tool_use_id: "tu_1", message: { content: [{ type: "tool_result", tool_use_id: "tu_2", content: "first line\nsecond line" }] } }),
  line({ type: "user", timestamp: at(120), message: { content: [{ type: "tool_result", tool_use_id: "tu_1", content: "[Subagent hand-back] note\n\nfinding one\nfinding two" }] } }),
  line({ type: "system", subtype: "task_progress", workflow_progress: [
    { type: "workflow_agent", label: "split", phaseTitle: "Split", agentId: "a1", model: "claude-haiku-5-5", state: "start", startedAt: Date.UTC(2026, 9, 9, 17, 0, 121) },
  ] }),
  line({ type: "system", subtype: "task_progress", workflow_progress: [
    { type: "workflow_agent", label: "split", phaseTitle: "Split", agentId: "a1", model: "claude-haiku-5-5", state: "done", startedAt: Date.UTC(2026, 9, 9, 17, 0, 121), lastProgressAt: Date.UTC(2026, 9, 9, 17, 0, 130), toolCalls: 2, durationMs: 9000 },
  ] }),
  line({ type: "assistant", timestamp: at(131), message: { content: [{ type: "text", text: "Synthesis follows." }] } }),
  line({ type: "result", timestamp: at(132), subtype: "success", duration_ms: 131000, num_turns: 3, result: "The answer." }),
].join("\n");

describe("convert", () => {
  const { cast, events, agents, seconds } = convert(stream, { prompt: "Research this question", cols: 100, rows: 30 });
  const rows = cast.trim().split("\n");
  const header = JSON.parse(rows[0]);
  const body = rows.slice(1).map((r) => JSON.parse(r) as [number, string, string]);
  const text = body.map((r) => plain(r[2])).join("");

  test("writes an asciicast v2 header with the requested size", () => {
    expect(header.version).toBe(2);
    expect(header.width).toBe(100);
    expect(header.height).toBe(30);
  });
  test("keeps real order and timing", () => {
    for (let i = 1; i < body.length; i++) expect(body[i][0]).toBeGreaterThanOrEqual(body[i - 1][0]);
    expect(seconds).toBeGreaterThanOrEqual(130);
  });
  test("draws the prompt, the agent lane, the hand-back and the chapters", () => {
    expect(text).toContain('$ claude "Research this question"');
    expect(text).toContain("# Scenario: Fan-out");
    expect(text).toContain("track 1 ▏▶ Agent · Research critics");
    expect(text).toContain("track 1 ▏● WebFetch(https://example.com/a)");
    expect(text).toContain("⎿ first line  … 2 lines");
    expect(text).toContain("⎿ returned · Research critics · 2 lines");
    expect(text).toContain("# Scenario: Synthesis");
    expect(text).not.toContain("Subagent hand-back");
  });
  test("draws a Workflow agent from its progress events", () => {
    expect(text).toContain("# Scenario: Split");
    expect(text).toContain("track 2 ▏▶ Split · split · haiku 5.5");
    expect(text).toContain("track 2 ▏✓ split · 2 tool calls · 9 s");
    expect(agents).toBe(2);
    expect(events).toBe(body.length);
  });
  test("ends with the result and a summary line", () => {
    expect(text).toContain("The answer.");
    expect(text).toContain("done · 131 s · 3 turns · 2 agents");
  });
});

describe("retime", () => {
  test("shortens silent gaps and scales by speed", () => {
    const rows: [number, string, string][] = [[0, "o", "a"], [1, "o", "b"], [101, "o", "c"], [102, "o", "d"]];
    retime(rows, 2, 2);
    expect(rows.map((r) => r[0])).toEqual([0, 0.5, 1.5, 2]);
  });
});

describe("helpers", () => {
  test("shortArg picks the readable part of each tool's input", () => {
    expect(shortArg("Read", { file_path: "/a/b/c.ts" })).toBe("b/c.ts");
    expect(shortArg("Workflow", { script: "export const meta = { name: 'research-grid' }" })).toBe("research-grid");
    expect(shortArg("Agent", { description: "Look", name: "x" })).toBe("Look");
  });
  test("wrap keeps the first prefix on the first line only", () => {
    expect(wrap("one two three four", 12, "  ", "● ")).toEqual(["● one two", "  three four"]);
  });
});
