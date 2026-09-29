/** Retry only temporary transport/server failures and malformed RSS responses. */
export function isTransientSourceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|timed? ?out|abort|HTTP (?:429|5\d\d)\b|Invalid or unsupported RSS XML/i.test(message);
}

export async function retryTransient<T>(
  operation: () => Promise<T>,
  label: string,
  delaysMs: readonly number[] = [1_000, 2_000]
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      if (attempt >= delaysMs.length || !isTransientSourceError(error)) throw error;
      console.warn(`${label}: temporary source error; retrying (${attempt + 1}/${delaysMs.length}).`);
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
}
