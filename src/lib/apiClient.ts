export class ApiUnavailableError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = 'ApiUnavailableError';
    this.status = status;
  }
}

const TRANSIENT_STATUSES = new Set([404, 502, 503, 504]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) return false;
    const raw = await res.text();
    const parsed = tryParseJson(raw);
    return Boolean(parsed && parsed.status === 'ok');
  } catch {
    return false;
  }
}

export async function apiFetchJson<T>(
  url: string,
  init: RequestInit = {},
  fallbackError = 'Terjadi kesalahan saat menghubungi server.'
): Promise<T> {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        cache: 'no-store',
      });
      const raw = await res.text();
      const parsed = tryParseJson(raw);

      if (parsed !== null) {
        if (!res.ok) {
          const errMsg =
            typeof parsed.error === 'string' && parsed.error.trim()
              ? parsed.error
              : fallbackError;
          throw new Error(errMsg);
        }
        return parsed as T;
      }

      // Non-JSON body (e.g. proxy 404 "The page could not be found" or HTML during server restart)
      if (TRANSIENT_STATUSES.has(res.status) && attempt < maxAttempts - 1) {
        await delay(600 * (attempt + 1));
        continue;
      }

      throw new ApiUnavailableError(
        'Server backend login (/api) belum merespons pada alamat pratinjau ini. Pastikan server aktif, muat ulang halaman, atau gunakan Login dengan Google.',
        res.status || 404
      );
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        lastError = err;
        if (attempt < maxAttempts - 1) {
          await delay(600 * (attempt + 1));
          continue;
        }
        throw err;
      }

      // Application-level JSON error (401/403/400/409) should surface immediately without retry
      if (err instanceof Error && !(err instanceof TypeError)) {
        throw err;
      }

      lastError = new ApiUnavailableError(
        'Koneksi ke server terputus sementara. Silakan coba lagi beberapa detik lagi.'
      );
      if (attempt < maxAttempts - 1) {
        await delay(600 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError || new Error(fallbackError);
}
