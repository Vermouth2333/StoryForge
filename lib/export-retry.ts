export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delaysMs: number[] = [1000, 2000],
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delaysMs[attempt] ?? delaysMs[delaysMs.length - 1]));
      }
    }
  }
  throw last;
}
