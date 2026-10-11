"use client";

import { Link2, List } from "lucide-react";
import type { RefObject } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { applyMarkup } from "@/lib/public-site/announcement-markup";

type Action = "bold" | "italic" | "underline" | "list" | "link";

const button = "flex size-7 items-center justify-center rounded-md text-slate-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600";

/** The B / I / U / list / link toolbar from PDF pp. 35–36. It inserts safe markers into the plain-text body. */
export function MarkupToolbar({ textareaRef, textareaId, value, onChange }: { textareaRef: RefObject<HTMLTextAreaElement | null>; textareaId: string; value: string; onChange: (next: string) => void }) {
  function run(action: Action) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let url: string | undefined;
    if (action === "link") {
      const answer = window.prompt("Link address (https://…)")?.trim();
      if (!answer) return;
      if (!/^https?:\/\/\S+$/i.test(answer)) {
        notifyStaff({ title: "Links must start with https:// or http://", tone: "error" });
        return;
      }
      url = answer;
    }
    const next = applyMarkup(value, textarea.selectionStart, textarea.selectionEnd, action, url);
    onChange(next.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }

  return (
    <div aria-label="Text formatting" className="flex items-center gap-1 rounded-t-xl border border-b-0 border-slate-200 bg-slate-100 px-2 py-1.5" role="toolbar">
      <button aria-controls={textareaId} aria-label="Bold" className={`${button} font-bold`} onClick={() => run("bold")} type="button">B</button>
      <button aria-controls={textareaId} aria-label="Italic" className={`${button} italic`} onClick={() => run("italic")} type="button">I</button>
      <button aria-controls={textareaId} aria-label="Underline" className={`${button} underline`} onClick={() => run("underline")} type="button">U</button>
      <span aria-hidden="true" className="mx-1 h-4 w-px bg-slate-300" />
      <button aria-controls={textareaId} aria-label="Bulleted list" className={button} onClick={() => run("list")} type="button"><List aria-hidden="true" className="size-3.5" /></button>
      <button aria-controls={textareaId} aria-label="Insert link" className={button} onClick={() => run("link")} type="button"><Link2 aria-hidden="true" className="size-3.5" /></button>
    </div>
  );
}
