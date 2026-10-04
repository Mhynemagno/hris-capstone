/**
 * A plain-text announcement body as paragraphs of lines: a blank line starts a new paragraph and a
 * single newline is a line break. The result is rendered as text, never as HTML.
 */
export function announcementParagraphs(body: string): string[][] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split("\n").map((line) => line.trimEnd()))
    .filter((lines) => lines.some((line) => line.trim()));
}
