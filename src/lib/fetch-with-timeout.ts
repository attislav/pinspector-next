// Fetch wrapper with AbortController timeout

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Zeitüberschreitung nach ${Math.round(timeoutMs / 1000)}s für ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
