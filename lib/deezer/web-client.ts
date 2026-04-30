const DEEZER_WEB_GATEWAY_URL =
  'https://www.deezer.com/ajax/gw-light.php';

const SAFE_ARL_REGEXP = /^[A-Za-z0-9_.=-]+$/;
const MIN_ARL_LENGTH = 32;
const MAX_ARL_LENGTH = 512;

export interface DeezerSessionInfo {
  deezerUserId: string;
  displayName?: string;
  apiToken: string;
}

export class DeezerArlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeezerArlValidationError';
  }
}

export function normalizeArl(arl: unknown) {
  if (typeof arl !== 'string') {
    throw new DeezerArlValidationError('Deezer ARL must be a string.');
  }

  const trimmed = arl.trim();
  if (
    trimmed.length < MIN_ARL_LENGTH ||
    trimmed.length > MAX_ARL_LENGTH ||
    !SAFE_ARL_REGEXP.test(trimmed)
  ) {
    throw new DeezerArlValidationError('Deezer ARL has an invalid format.');
  }

  return trimmed;
}

export async function deezerGatewayRequest<T>(
  arl: string,
  method: string,
  body: unknown,
  apiToken = '',
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const normalizedArl = normalizeArl(arl);
  const url = new URL(DEEZER_WEB_GATEWAY_URL);
  url.searchParams.set('method', method);
  url.searchParams.set('input', '3');
  url.searchParams.set('api_version', '1.0');
  url.searchParams.set('api_token', apiToken);

  const response = await fetchImpl(url.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `arl=${normalizedArl}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new DeezerArlValidationError('Deezer rejected the request.');
  }

  return response.json();
}

export async function deezerPublicApiRequest<T>(
  arl: string,
  path: string,
  params: Record<string, string> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const normalizedArl = normalizeArl(arl);
  const url = new URL(`https://api.deezer.com${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      cookie: `arl=${normalizedArl}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new DeezerArlValidationError('Deezer public API request failed.');
  }

  return response.json();
}

export async function verifyDeezerArl(
  arl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DeezerSessionInfo> {
  const payload = await deezerGatewayRequest<any>(arl, 'deezer.getUserData', {}, '', fetchImpl);
  const user = payload?.results?.USER;
  const deezerUserId = user?.USER_ID ? String(user.USER_ID) : '';
  const apiToken = typeof payload?.results?.checkForm === 'string'
    ? payload.results.checkForm
    : '';

  if (!deezerUserId || deezerUserId === '0' || !apiToken) {
    throw new DeezerArlValidationError('Deezer ARL is invalid or expired.');
  }

  return {
    deezerUserId,
    displayName: typeof user.BLOG_NAME === 'string' ? user.BLOG_NAME : undefined,
    apiToken,
  };
}
