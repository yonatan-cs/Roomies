// Simple exponential backoff retry helper
export async function retryWithBackoff<T>(fn: () => Promise<T>, attempts = 3, baseMs = 500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const wait = baseMs * Math.pow(2, i);
      await new Promise(res => setTimeout(res, wait));
    }
  }
  throw lastErr;
}



