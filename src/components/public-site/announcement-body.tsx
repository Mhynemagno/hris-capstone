import { Fragment } from "react";

import { announcementParagraphs } from "@/lib/public-site/announcement-text";
import { cn } from "@/lib/utils";

/** A plain-text announcement body. Blank lines start paragraphs and newlines become line breaks. Never renders HTML. */
export function AnnouncementBody({ body, className }: { body: string; className?: string }) {
  return (
    <div className={cn("space-y-4 text-base leading-8 [overflow-wrap:anywhere]", className)}>
      {announcementParagraphs(body).map((lines, paragraphIndex) => (
        <p key={paragraphIndex}>
          {lines.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
