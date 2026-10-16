// Extract a page's visible prose as markdown, one line per block, for a prose linter such as Vale.
//
// Each `<section>` with an id becomes a `## id` heading; a page without sections is one block. Scripts and
// styles are dropped, SVG keeps its `<text>` labels, inline markup is flattened, whitespace is collapsed, and
// lines under three characters are skipped. A `.kicker` paragraph is a navigation label, not prose, and is
// dropped. Every line ends with two spaces so markdown keeps it on its own
// line and a finding's line number maps back to one block.
import { unescapeHtml } from "./bundle.ts";

const BLOCK = /<(?:h[1-6]|p|li|td|th|dt|dd|figcaption|blockquote|span class="chip[^"]*"|div class="(?:note|lbl|bignum|card|head|tag|caption)[^"]*")[^>]*>(.*?)<\/(?:h[1-6]|p|li|td|th|dt|dd|figcaption|blockquote|span|div)>/gs;

export function clean(fragment: string): string {
  const text = unescapeHtml(fragment.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return text.replace(/\s+([.,;:!?)\]])/g, "$1");
}

export function blocks(fragment: string): string[] {
  fragment = fragment.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  fragment = fragment.replace(/<svg[\s\S]*?<\/svg>/g, (m) => [...m.matchAll(/<text[^>]*>(.*?)<\/text>/gs)].map((t) => `<p>${t[1]}</p>`).join(" "));
  fragment = fragment.replace(/<(?:pre|code)\b[\s\S]*?<\/(?:pre|code)>/gi, "");
  fragment = fragment.replace(/<p class="kicker[^"]*"[^>]*>[\s\S]*?<\/p>/g, "");
  let found = [...fragment.matchAll(BLOCK)].map((m) => clean(m[1]));
  if (!found.length) found = [clean(fragment)];
  return found.filter((line) => line.length > 2);
}

export function extract(text: string, title = "Page"): string {
  const out = ["# " + title, ""];
  let sections = [...text.matchAll(/<section[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => [m[1], m[2]] as const);
  if (!sections.length) sections = [["page", text]];
  sections.forEach(([sid, body], index) => {
    const lines = blocks(body);
    if (!lines.length) return;
    out.push(sections.length > 1 ? `## ${index + 1} ${sid}` : "## " + sid, "");
    out.push(...lines.map((line) => line + "  "), "");
  });
  return out.join("\n");
}
