"use client";

import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationChip } from "@/components/CitationChip";
import type { Citation } from "@/lib/types";

interface MessageContentProps {
  content: string;
  citations?: Citation[];
  onOpenCitation: (citation: Citation) => void;
}

function replaceCitations(
  text: string,
  takeCitation: (number: number) => Citation | undefined,
  onOpenCitation: (citation: Citation) => void,
): Array<string | ReactNode> {
  const parts: Array<string | ReactNode> = [];
  const pattern = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match = pattern.exec(text);
  let key = 0;

  while (match) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const number = Number(match[1]);
    const citation = takeCitation(number);

    if (citation) {
      parts.push(
        <CitationChip
          key={`cite-${citation.id}-${key}`}
          citation={citation}
          onOpen={onOpenCitation}
        />,
      );
    } else {
      parts.push(match[0]);
    }

    key += 1;
    lastIndex = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function MessageContent({
  content,
  citations = [],
  onOpenCitation,
}: MessageContentProps) {
  const unused = [...citations];
  const takeCitation = (number: number) => {
    const index = unused.findIndex((item) => item.number === number);

    if (index === -1) {
      return citations.find((item) => item.number === number);
    }

    return unused.splice(index, 1)[0];
  };

  const components: Components = {
    p({ children }) {
      return <p>{mapChildren(children, takeCitation, onOpenCitation)}</p>;
    },
    li({ children }) {
      return <li>{mapChildren(children, takeCitation, onOpenCitation)}</li>;
    },
    td({ children }) {
      return <td>{mapChildren(children, takeCitation, onOpenCitation)}</td>;
    },
    h2({ children }) {
      return <h2>{mapChildren(children, takeCitation, onOpenCitation)}</h2>;
    },
    h3({ children }) {
      return <h3>{mapChildren(children, takeCitation, onOpenCitation)}</h3>;
    },
    strong({ children }) {
      return <strong>{mapChildren(children, takeCitation, onOpenCitation)}</strong>;
    },
  };

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function mapChildren(
  children: ReactNode,
  takeCitation: (number: number) => Citation | undefined,
  onOpenCitation: (citation: Citation) => void,
): ReactNode {
  return Array.isArray(children)
    ? children.map((child, index) => {
        if (typeof child === "string") {
          return (
            <span key={`t-${index}`}>
              {replaceCitations(child, takeCitation, onOpenCitation)}
            </span>
          );
        }

        return child;
      })
    : typeof children === "string"
      ? replaceCitations(children, takeCitation, onOpenCitation)
      : children;
}
