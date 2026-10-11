import { announcementParagraphs } from "./announcement-text";

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong" | "em" | "u"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };
export type MarkupBlock = { type: "paragraph"; lines: InlineNode[][] } | { type: "list"; items: InlineNode[][] };

// Order matters when two patterns start at the same place: links, then bold, then underline, then italic.
const PATTERNS = [
  { type: "link", regex: /\[([^\]\n]+)\]\((https?:\/\/[^\s()]+)\)/ },
  { type: "strong", regex: /\*\*(\S(?:[^\n]*?\S)?)\*\*/ },
  { type: "u", regex: /\+\+(\S(?:[^\n]*?\S)?)\+\+/ },
  { type: "em", regex: /\*([^*\s](?:[^*\n]*?[^*\s])?)\*/ },
] as const;

/** Inline formatting. Never produces HTML: anything that is not a complete, safe marker stays literal text. */
export function parseInline(input: string): InlineNode[] {
  let best: { index: number; match: RegExpExecArray; type: (typeof PATTERNS)[number]["type"] } | null = null;
  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(input);
    if (match && (best === null || match.index < best.index)) best = { index: match.index, match, type: pattern.type };
  }
  if (!best) return input ? [{ type: "text", text: input }] : [];
  const before = input.slice(0, best.index);
  const after = input.slice(best.index + best.match[0].length);
  const node: InlineNode = best.type === "link"
    ? { type: "link", href: best.match[2]!, children: parseInline(best.match[1]!) }
    : { type: best.type, children: parseInline(best.match[1]!) };
  return [...(before ? [{ type: "text" as const, text: before }] : []), node, ...parseInline(after)];
}

const BULLET = /^- (.*)$/;

export function parseAnnouncementMarkup(body: string): MarkupBlock[] {
  const blocks: MarkupBlock[] = [];
  for (const lines of announcementParagraphs(body)) {
    let current: MarkupBlock | null = null;
    for (const line of lines) {
      const bullet = BULLET.exec(line);
      if (bullet) {
        if (current?.type !== "list") { current = { type: "list", items: [] }; blocks.push(current); }
        current.items.push(parseInline(bullet[1]!));
      } else {
        if (current?.type !== "paragraph") { current = { type: "paragraph", lines: [] }; blocks.push(current); }
        current.lines.push(parseInline(line));
      }
    }
  }
  return blocks;
}

function plain(nodes: InlineNode[]): string {
  return nodes.map((node) => (node.type === "text" ? node.text : plain(node.children))).join("");
}

export function stripAnnouncementMarkup(text: string) {
  return text.split("\n").map((line) => plain(parseInline(line.replace(BULLET, "$1")))).join("\n");
}

const MARKERS = { bold: "**", italic: "*", underline: "++" } as const;

export function applyMarkup(value: string, start: number, end: number, action: "bold" | "italic" | "underline" | "list" | "link", url?: string) {
  if (action === "list") {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
    const block = value.slice(lineStart, lineEnd).split("\n").map((line) => (line.startsWith("- ") ? line : `- ${line}`)).join("\n");
    const next = value.slice(0, lineStart) + block + value.slice(lineEnd);
    return { value: next, selectionStart: lineStart, selectionEnd: lineStart + block.length };
  }
  const selected = value.slice(start, end);
  if (action === "link") {
    const label = selected || url || "";
    const inserted = `[${label}](${url ?? ""})`;
    return { value: value.slice(0, start) + inserted + value.slice(end), selectionStart: start + 1, selectionEnd: start + 1 + label.length };
  }
  const marker = MARKERS[action];
  return { value: value.slice(0, start) + marker + selected + marker + value.slice(end), selectionStart: start + marker.length, selectionEnd: end + marker.length };
}
