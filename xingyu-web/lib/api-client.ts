export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  requestId?: string;
};

export class ApiError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ApiError";
  }
}

const TOKEN_KEY = "xingyu-satoken";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function resolveApiUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function hasStoredSession(): boolean {
  return !!getStoredToken();
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  token?: string | null;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  const token = options.token ?? getStoredToken();
  if (token) headers.satoken = token;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const response = await fetch(resolveApiUrl(path), {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const responseToken = response.headers.get("satoken");
  if (responseToken) setStoredToken(responseToken);

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) setStoredToken(null);
    throw new ApiError(
      (data as ProblemDetails) ?? {
        type: "about:blank",
        title: "Request failed",
        status: response.status,
        detail: response.statusText,
        code: "UNKNOWN",
      }
    );
  }
  return data as T;
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) headers.satoken = token;

  const response = await fetch(resolveApiUrl(path), {
    method: "POST",
    headers,
    credentials: "include",
    body: (() => {
      const form = new FormData();
      form.append("file", file);
      return form;
    })(),
  });

  const responseToken = response.headers.get("satoken");
  if (responseToken) setStoredToken(responseToken);

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) setStoredToken(null);
    throw new ApiError(
      (data as ProblemDetails) ?? {
        type: "about:blank",
        title: "Upload failed",
        status: response.status,
        detail: response.statusText,
        code: "UNKNOWN",
      }
    );
  }
  return data as T;
}
