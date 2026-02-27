"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Send,
  RotateCcw,
  Search,
  FolderOpen,
  FileText,
  MessageSquareCode,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Suggested questions for empty state
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "How does the admin authentication work?",
  "How does the CSV device import work?",
  "How does the system prevent duplicate device IDs?",
  "Explain how the pricing system works",
  "What API routes are available for managing quotes?",
  "How is the partner commission calculated?",
];

// ---------------------------------------------------------------------------
// Simple markdown-ish rendering for assistant text
// ---------------------------------------------------------------------------

function renderText(text: string) {
  // Split on code fences
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const lines = part.slice(3, -3).split("\n");
      const lang = lines[0]?.trim() || "";
      const code = (lang ? lines.slice(1) : lines).join("\n");
      return (
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-md bg-background p-3 text-sm"
        >
          <code>{code}</code>
        </pre>
      );
    }
    // Inline code
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((ip, j) =>
          ip.startsWith("`") && ip.endsWith("`") ? (
            <code
              key={j}
              className="rounded bg-background px-1 py-0.5 text-sm"
            >
              {ip.slice(1, -1)}
            </code>
          ) : (
            <span key={j} className="whitespace-pre-wrap">
              {ip}
            </span>
          )
        )}
      </span>
    );
  });
}

// ---------------------------------------------------------------------------
// Tool call indicator
// ---------------------------------------------------------------------------

function ToolIndicator({
  toolName,
  args,
}: {
  toolName: string;
  args: Record<string, unknown>;
}) {
  const icon =
    toolName === "search_code" ? (
      <Search className="h-3 w-3" />
    ) : toolName === "list_files" ? (
      <FolderOpen className="h-3 w-3" />
    ) : (
      <FileText className="h-3 w-3" />
    );

  const label =
    toolName === "search_code"
      ? `Searching: "${args.query}"`
      : toolName === "list_files"
        ? `Listing: ${(args.directory as string) || "/"}`
        : `Reading: ${args.path}`;

  return (
    <div className="my-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return <div key={i}>{renderText(part.text)}</div>;
          }
          if (part.type === "dynamic-tool") {
            return (
              <ToolIndicator
                key={i}
                toolName={part.toolName}
                args={
                  (part as unknown as { input: Record<string, unknown> })
                    .input ?? {}
                }
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CodebaseChatPage() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/admin/chat" }),
    []
  );
  const { messages, sendMessage, setMessages, status, error, clearError } =
    useChat({
      transport,
    });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  function handleSuggestion(text: string) {
    sendMessage({ text });
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Codebase Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask questions about how the codebase works. Claude can search and
            read source files to answer.
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMessages([])}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <MessageSquareCode className="h-10 w-10" />
              <p className="text-sm">
                Ask anything about the codebase
              </p>
            </div>
            <div className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="rounded-lg border border-border bg-background p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading &&
              messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error.message}</span>
          <button
            onClick={clearError}
            className="text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the codebase..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
