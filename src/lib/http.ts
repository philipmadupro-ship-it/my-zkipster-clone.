type JsonRecord = Record<string, unknown>;

async function parseJsonSafely(res: Response): Promise<JsonRecord | null> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  try {
    return (await res.json()) as JsonRecord;
  } catch {
    return null;
  }
}

export async function getApiResult(res: Response): Promise<{
  ok: boolean;
  data: JsonRecord | null;
  error: string | null;
}> {
  const data = await parseJsonSafely(res);
  const responseError =
    typeof data?.error === 'string'
      ? data.error
      : typeof data?.message === 'string'
        ? data.message
        : null;

  if (res.ok) {
    return { ok: true, data, error: null };
  }

  return {
    ok: false,
    data,
    error: responseError ?? `Request failed (${res.status})`,
  };
}
