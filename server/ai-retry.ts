/**
 * Exponential backoff retry for OpenAI / Perplexity API calls.
 * Retries on 429 (rate limit) and 5xx (server error) responses.
 * Max 3 retries: waits 1s → 2s → 4s between attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  label = "AI call"
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      const status = err?.status ?? err?.statusCode ?? err?.response?.status;
      const isRateLimit = status === 429;
      const isServerError = status >= 500 && status < 600;

      if ((isRateLimit || isServerError) && attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 16_000);
        console.warn(
          `[ai-retry] ${label} failed (HTTP ${status}), attempt ${attempt + 1}/${maxRetries}. Retrying in ${delayMs}ms…`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
