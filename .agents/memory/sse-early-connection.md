---
name: SSE early connection for long pipelines
description: SSE headers must be sent before any long async work (e.g. research pipeline) or the dev proxy silently kills the connection due to timeout.
---

## Rule
For any SSE streaming route that does async work before the AI stream (e.g. a research pipeline), send `Content-Type: text/event-stream` headers and an initial `status` event at the very top of the streaming path — before any `await`.

**Why:** Replit's dev proxy (and many reverse proxies) have a timeout for HTTP connections that send no data. The draft/memo research pipeline takes 8–10s, the AI time-to-first-token adds 15–25s more. Total silence before first chunk: 25–40s. Proxy timeout killed it silently with no error shown to the user.

**How to apply:** In any Express SSE route that does upfront async work:
1. Set SSE headers immediately when `stream === true` (before any `await`).
2. Send `sendSse(res, "status", { stage: "research" })` right after headers.
3. After async work, send `sendSse(res, "status", { stage: "writing" })` before the AI stream.
4. Frontend SSE readers should handle `event: status` to update stage display — do NOT hardcode `setGeneratingStage("writing")` before the reader loop.

**Affected routes (as of fix):** `/api/drafts/generate`, `/api/memos/generate`
