import { Fragment, type ReactNode } from "react";

import { parseAnnouncementMarkup, type InlineNode } from "@/lib/public-site/announcement-markup";
import { cn } from "@/lib/utils";

function renderInline(nodes: InlineNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.type === "text") return <Fragment key={index}>{node.text}</Fragment>;
    if (node.type !== "link") {
      const Tag = node.type;
      return <Tag key={index}>{renderInline(node.children)}</Tag>;
    }
    return <a className="font-semibold underline underline-offset-4" href={node.href} key={index} rel="noopener noreferrer" target="_blank">{renderInline(node.children)}</a>;
  });
}

/**
 * An announcement body. Blank lines start paragraphs, newlines become line breaks, "- " lines become
 * bullets, and the HR toolbar's **bold**, *italic*, ++underline++ and [link](https://…) markers are
 * formatted. Never renders HTML: anything else is shown as typed.
 */
export function AnnouncementBody({ body, className }: { body: string; className?: string }) {
  return (
    <div className={cn("space-y-4 text-base leading-8 [overflow-wrap:anywhere]", className)}>
      {parseAnnouncementMarkup(body).map((block, blockIndex) => block.type === "list" ? (
        <ul className="list-disc space-y-1 pl-6" key={blockIndex}>
          {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ul>
      ) : (
        <p key={blockIndex}>
          {block.lines.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 ? <br /> : null}
              {renderInline(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
