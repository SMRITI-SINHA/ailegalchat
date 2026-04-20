/**
 * Concurrency limiter for AI API calls.
 * Allows at most MAX_CONCURRENT simultaneous OpenAI / Perplexity calls.
 * Extra requests queue and are processed as slots free up.
 * Queued requests time out after QUEUE_TIMEOUT_MS with a user-friendly error.
 */
import OpenAI from "openai";
import { withRetry } from "./ai-retry";

const MAX_CONCURRENT = parseInt(process.env.AI_MAX_CONCURRENT ?? "10", 10);
const QUEUE_TIMEOUT_MS = parseInt(process.env.AI_QUEUE_TIMEOUT_MS ?? "30000", 10);

class ConcurrencyQueue {
  private active = 0;
  private readonly max: number;
  private readonly timeoutMs: number;
  private pending: Array<{ resolve: () => void; reject: (e: Error) => void; timer: NodeJS.Timeout }> = [];

  constructor(max: number, timeoutMs: number) {
    this.max = max;
    this.timeoutMs = timeoutMs;
  }

  async run<T>(fn: () => Promise<T>, label = "AI call"): Promise<T> {
    await this.acquire(label);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(label: string): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.pending.findIndex((p) => p.resolve === resolve);
        if (idx !== -1) this.pending.splice(idx, 1);
        reject(
          Object.assign(new Error("AI service is busy, please try again in a moment."), {
            status: 503,
          })
        );
      }, this.timeoutMs);

      this.pending.push({ resolve, reject, timer });
      console.log(`[ai-queue] ${label} queued (${this.pending.length} waiting, ${this.active}/${this.max} active)`);
    });
  }

  private release(): void {
    const next = this.pending.shift();
    if (next) {
      clearTimeout(next.timer);
      this.active++;
      next.resolve();
    } else {
      this.active--;
    }
  }

  stats() {
    return { active: this.active, queued: this.pending.length, max: this.max };
  }
}

export const aiQueue = new ConcurrencyQueue(MAX_CONCURRENT, QUEUE_TIMEOUT_MS);

/**
 * Drop-in replacement for openai.chat.completions.create() that goes through
 * the concurrency queue and retries on 429 / 5xx automatically.
 */
export async function callAI(
  openai: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  label = "chat.completions"
): Promise<OpenAI.Chat.ChatCompletion> {
  return aiQueue.run(
    () => withRetry(() => openai.chat.completions.create(params) as Promise<OpenAI.Chat.ChatCompletion>, 3, label),
    label
  );
}

/**
 * Same as callAI but for streaming responses.
 * Queue slot is held for the full stream duration.
 */
export async function callAIStream(
  openai: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsStreaming,
  label = "chat.completions.stream"
): Promise<AsyncIterable<OpenAI.Chat.ChatCompletionChunk>> {
  return aiQueue.run(
    () =>
      withRetry(
        () => openai.chat.completions.create(params) as Promise<AsyncIterable<OpenAI.Chat.ChatCompletionChunk>>,
        2,
        label
      ),
    label
  );
}
