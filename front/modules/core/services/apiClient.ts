/**
 * apiClient.ts
 * Cliente HTTP centralizado que substitui o Supabase client.
 * Todas as chamadas ao backend passam por aqui.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3060/api';

let authToken: string | null = null;

export const setApiToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getApiToken = (): string | null => {
  if (authToken) return authToken;
  authToken = localStorage.getItem('auth_token');
  return authToken;
};

const buildHeaders = (extra?: Record<string, string>): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra
  };
  const token = getApiToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { noAuth?: boolean }
): Promise<T> {
  const headers = buildHeaders();
  if (options?.noAuth) delete headers['Authorization'];

  const config: RequestInit = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  };

  const url = `${API_BASE}${path}`;

  try {
    const res = await fetch(url, config);

    if (res.status === 401) {
      // Token expirado — limpar e recarregar para forçar login
      setApiToken(null);
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'token_expired' } }));
      throw new ApiError('Sessão expirada. Faça login novamente.', 401);
    }

    if (!res.ok) {
      let errorMsg = `Erro ${res.status}`;
      try {
        const errData = await res.json();
        errorMsg = errData.error || errData.message || errorMsg;
      } catch {}
      throw new ApiError(errorMsg, res.status);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    const data = await res.json();
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new ApiError('Não foi possível conectar ao servidor. Verifique se o backend está activo.', 0);
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown, opts?: { noAuth?: boolean }) => request<T>('POST', path, body, opts),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

/**
 * Fetches a binary resource (PDF, etc.) with the auth token and triggers a browser download.
 * Use this instead of <a href> for protected endpoints.
 */
export const downloadBlob = async (path: string, filename: string): Promise<void> => {
  const token = getApiToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { const d = await res.json(); msg = d.error || d.message || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export default api;
