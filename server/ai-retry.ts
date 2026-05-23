/**
 * Exponential backoff retry for OpenAI / Perplexity API calls.
 * Retries on 429 (rate limit) and 5xx server errors EXCEPT:
 *   - 504 Gateway Timeout: the upstream is already overwhelmed; retrying immediately never helps.
 *   - Network/DNS errors (ENOTFOUND, ECONNREFUSED, fetch failed): retrying a dead host wastes time.
 * Max 3 retries: waits 1s → 2s → 4s between attempts.
 */

function isNetworkError(err: any): boolean {
  const msg: string = (err?.cause?.message ?? err?.message ?? "").toLowerCase();
  return (
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("getaddrinfo")
  );
}

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
      // 504 = Gateway Timeout — upstream already timed out, no point retrying.
      // Network/DNS errors — host is unreachable, no point retrying.
      const isServerError = status >= 500 && status < 600 && status !== 504;

      if ((isRateLimit || isServerError) && !isNetworkError(err) && attempt < maxRetries) {
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
