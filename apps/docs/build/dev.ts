import { resolve, extname } from "node:path";
import { watch } from "node:fs";
import { build, DIST_DIR, CONTENT_DIR, PUBLIC_DIR, DOCS_ROOT } from './build.ts';

const PORT = 3001;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

// Livereload snippet injected into HTML responses
const LIVERELOAD_SCRIPT = `<script>new EventSource("/__livereload").addEventListener("reload",()=>location.reload())</script>`;

// SSE clients waiting for reload signals
const clients = new Set<ReadableStreamDefaultController>();

function notifyClients() {
  for (const controller of clients) {
    try {
      controller.enqueue("event: reload\ndata: \n\n");
    } catch {
      clients.delete(controller);
    }
  }
}

// Debounced rebuild
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    rebuildTimer = null;
    console.log("\nFile changed, rebuilding...");
    try {
      await build();
      notifyClients();
    } catch (err) {
      console.error("Rebuild failed:", err);
    }
  }, 100);
}

// Initial build
await build();

// Watch content/, public/, and src/ for changes
for (const dir of [CONTENT_DIR, PUBLIC_DIR, resolve(DOCS_ROOT, 'src')]) {
  watch(dir, { recursive: true }, (_event, _filename) => {
    scheduleRebuild();
  });
}

// Also watch build scripts themselves
watch(resolve(import.meta.dir), { recursive: false }, (_event, filename) => {
  if (filename && !filename.startsWith("dev")) {
    scheduleRebuild();
  }
});

console.log(`\nDev server running at http://localhost:${PORT}`);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // SSE endpoint for livereload
    if (url.pathname === "/__livereload") {
      const stream = new ReadableStream({
        start(controller) {
          clients.add(controller);
          controller.enqueue(": connected\n\n");
        },
        cancel(controller) {
          clients.delete(controller);
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Resolve file path
    let pathname = url.pathname;
    if (pathname === "/") pathname = "/index.html";
    if (!extname(pathname)) pathname += ".html";

    const filePath = resolve(DIST_DIR, pathname.slice(1));

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response("Not Found", { status: 404 });
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    // Inject livereload script into HTML
    if (ext === ".html") {
      const html = await file.text();
      return new Response(html.replace("</body>", `${LIVERELOAD_SCRIPT}</body>`), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  },
});
