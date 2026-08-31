"use client";

import { useEffect, useRef, useState } from "react";
import { MessageContent } from "@/components/MessageContent";
import { STARTER_SUGGESTIONS, type StarterSuggestion } from "@/lib/suggestions";
import type { ChatMessage, Citation } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  canSend: boolean;
  hasSelectedSources: boolean;
  suggestions: string[];
  onSend: (text: string) => void;
  onStop: () => void;
  onOpenCitation: (citation: Citation) => void;
}

function SuggestionIcon({ icon }: { icon: StarterSuggestion["icon"] }) {
  const color =
    icon === "search"
      ? "#3b82f6"
      : icon === "document"
        ? "#8b5cf6"
        : icon === "compare"
          ? "#f59e0b"
          : icon === "table"
            ? "#22c55e"
            : "#d946ef";

  if (icon === "document") {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path
          d="M7 3.5h7.2L19 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
        />
        <path d="M14 3.5V8h4.5" fill="none" stroke={color} strokeWidth="1.8" />
        <path
          d="M9 12h6M9 15.5h6"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (icon === "compare") {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path
          d="M8 7h9m0 0-3-3m3 3-3 3M16 17H7m0 0 3 3M7 17l3-3"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (icon === "table") {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <rect
          x="4"
          y="5"
          width="16"
          height="14"
          rx="1.5"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
        />
        <path d="M4 10h16M4 15h16M10 5v14M14 5v14" fill="none" stroke={color} strokeWidth="1.8" />
      </svg>
    );
  }

  if (icon === "chat") {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path
          d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4.5 3.2V6.5Z"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <circle cx="11" cy="11" r="6.2" fill="none" stroke={color} strokeWidth="1.8" />
      <path
        d="M16 16.2 20 20"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChatPanel({
  messages,
  isLoading,
  canSend,
  hasSelectedSources,
  suggestions,
  onSend,
  onStop,
  onOpenCitation,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const submit = (text: string) => {
    const trimmed = text.trim();

    if (!trimmed || !canSend || isLoading) {
      return;
    }

    onSend(trimmed);
    setDraft("");
  };

  const composerForm = (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit(draft);
      }}
    >
      <textarea
        value={draft}
        placeholder={
          canSend
            ? "Ask me anything about your docs..."
            : hasSelectedSources
              ? "Waiting for the selected document to finish indexing…"
              : "Add and select a source to start chatting"
        }
        rows={1}
        disabled={!canSend || isLoading}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit(draft);
          }
        }}
      />
      {isLoading ? (
        <button type="button" className="send-button" onClick={onStop}>
          Stop
        </button>
      ) : (
        <button
          type="submit"
          className="send-button"
          aria-label="Send"
          disabled={!canSend || !draft.trim()}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M12 19V5M6 11l6-6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </form>
  );

  return (
    <section className={`chat-panel${isEmpty ? " chat-panel-empty" : ""}`}>
      {isEmpty ? (
        <div className="empty-stage">
          <h3>Chat with your docs</h3>
          <div className="composer-dock">
            {composerForm}
            <div className="suggestion-grid" role="list">
              {STARTER_SUGGESTIONS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="listitem"
                  disabled={!canSend}
                  onClick={() => submit(item.label)}
                >
                  <SuggestionIcon icon={item.icon} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <header className="chat-header">
            <h2>Chat with your docs</h2>
          </header>
          <div className="message-list">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`message message-${message.role}`}
              >
                {message.role === "assistant" ? (
                  <span className="message-avatar avatar-assistant" aria-hidden="true">
                    ✦
                  </span>
                ) : (
                  <span className="message-avatar avatar-user" aria-hidden="true">
                    N
                  </span>
                )}
                <div className="message-content">
                  <span className="message-role">
                    {message.role === "assistant" ? "AI" : "Nathan Sekar"}
                  </span>
                  {message.role === "assistant" ? (
                    <MessageContent
                      content={message.content || (isLoading ? "…" : "")}
                      citations={message.citations}
                      onOpenCitation={onOpenCitation}
                    />
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
              </article>
            ))}
            <div ref={endRef} />
          </div>
          <div className="composer-dock">
            {suggestions.length > 0 && !isLoading ? (
              <div className="suggestions-scroll" role="list">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="listitem"
                    disabled={!canSend}
                    onClick={() => submit(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
            {composerForm}
          </div>
        </>
      )}
    </section>
  );
}
