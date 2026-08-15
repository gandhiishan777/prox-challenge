import fs from "node:fs/promises";
import path from "node:path";

import { NextRequest } from "next/server";

import { KNOWLEDGE_DIR } from "@/lib/agent/knowledge";

/**
 * Serves figure and page images out of the committed knowledge pack.
 *
 * They live in `knowledge/` rather than `public/` because that directory is the
 * pipeline's output and is addressed by the same relative paths the manifest
 * uses, which keeps one source of truth for where an image lives.
 */
export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const resolved = path.resolve(KNOWLEDGE_DIR, relative);

  // Path traversal guard: the resolved path must stay inside the pack, and only
  // image files are servable.
  if (!resolved.startsWith(path.resolve(KNOWLEDGE_DIR) + path.sep)) {
    return new Response("Not found", { status: 404 });
  }
  const ext = path.extname(resolved).toLowerCase();
  if (!MIME[ext]) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(resolved);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": MIME[ext],
        // Committed, content-addressed by path, and never mutated at runtime.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
