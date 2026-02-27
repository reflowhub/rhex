import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  listFiles,
  readFile,
  searchCode,
  getSnapshotMeta,
} from "@/lib/codebase-snapshot";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const { messages } = await request.json();

  let meta;
  try {
    meta = getSnapshotMeta();
  } catch (err) {
    return NextResponse.json(
      { error: "Codebase snapshot not found. Run: npm run build:codebase" },
      { status: 500 }
    );
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are a helpful codebase assistant for the rhex admin panel — a Next.js application for managing device trade-ins, pricing, quotes, orders, and inventory.

The codebase snapshot was generated at ${meta.generatedAt} and contains ${meta.totalFiles} files with ${meta.totalLines} total lines of code.

Key architecture:
- Next.js 16 with App Router, React 19, TypeScript
- Tailwind CSS + shadcn/ui components
- Firebase (Firestore + Auth) with firebase-admin for server-side
- Session-based admin auth via cookies (__admin_session)
- Admin API routes at app/api/admin/[resource]/route.ts
- Admin pages at app/admin/[resource]/page.tsx
- Shared lib modules at lib/*.ts

You have three tools to explore the codebase. Use them to find and read specific files to answer questions. Always prefer reading actual source code over guessing. When showing code, reference the file path and line numbers.

You are read-only. You can explore and explain the code but cannot modify it.`,
    messages: await convertToModelMessages(messages),
    tools: {
      list_files: tool({
        description:
          "List all source files, optionally filtered to a directory. Returns file paths.",
        inputSchema: z.object({
          directory: z
            .string()
            .optional()
            .describe(
              "Optional directory prefix to filter by, e.g. 'app/admin' or 'lib'"
            ),
        }),
        execute: async ({ directory }) => {
          const files = listFiles(directory);
          return { files, count: files.length };
        },
      }),
      read_file: tool({
        description:
          "Read the full contents of a source file. Use this to examine specific files.",
        inputSchema: z.object({
          path: z
            .string()
            .describe(
              "File path relative to the project root, e.g. 'lib/admin-auth.ts'"
            ),
        }),
        execute: async ({ path }) => {
          const result = readFile(path);
          if (!result) return { error: `File not found: ${path}` };
          return result;
        },
      }),
      search_code: tool({
        description:
          "Search for a text pattern across all source files. Returns matching lines with file paths and line numbers.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              "The search text to look for (case-insensitive substring match)"
            ),
        }),
        execute: async ({ query }) => {
          const results = searchCode(query);
          return {
            results,
            totalMatches: results.reduce(
              (sum, r) => sum + r.matches.length,
              0
            ),
          };
        },
      }),
    },
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
