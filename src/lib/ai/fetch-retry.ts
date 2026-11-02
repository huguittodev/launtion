/**
 * fetch-retry.ts
 *
 * Retries transient Gemini failures (429 / 500 / 502 / 503 / 504) with exponential backoff.
 * Gemini regularly answers 503 "high demand" for a few seconds; without a retry every such
 * blip silently degraded the result to the generic deterministic template.
 */

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export interface RetryOptions {
  /** Extra attempts after the first one. Default 2. */
  retries?: number;
  /** First backoff in ms (doubles each attempt). Default 1200. */
  baseDelayMs?: number;
  /** Max milliseconds to spend across all attempts. Default 120000. */
  totalBudgetMs?: number;
}

export async function fetchWithRetry(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit & { timeoutMs: number },
  options: RetryOptions = {}
): Promise<Response> {
  const retries = options.retries ?? 2;
  const base = options.baseDelayMs ?? 1200;
  const deadline = Date.now() + (options.totalBudgetMs ?? 120000);
  const { timeoutMs, ...rest } = init;

  let last: Response | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      last = await fetchFn(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
      if (last.ok || !RETRYABLE.has(last.status) || attempt === retries) return last;
    } catch (err) {
      if (attempt === retries) throw err;
    }
    const delay = base * 2 ** attempt;
    if (Date.now() + delay >= deadline) break;
    await new Promise((r) => setTimeout(r, delay));
  }
  if (last) return last;
  throw new Error('GEMINI_RETRY_EXHAUSTED');
}
