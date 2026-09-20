/*
 * API transport layer (migrated from Legacy lib/api-client.ts).
 * Contracts preserved: /api/v1/* base path, `satoken` header passthrough,
 * token refresh from response header or body, 401 clears the session.
 * Only the transport + shared error types live here; domain APIs live in api/<domain>/.
 */
import { getStoredToken, setStoredToken } from "@/lib/storage";

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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function resolveApiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function extractTokenFromBody(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const token = (data as { token?: unknown }).token;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  token?: string | null;
  headers?: Record<string, string>;
};

function buildHeaders(options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  const token = options.token ?? getStoredToken();
  if (token) headers.satoken = token;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  return headers;
}

function toProblemDetails(data: unknown, status: number, statusText: string): ProblemDetails {
  return (
    (data as ProblemDetails) ?? {
      type: "about:blank",
      title: "Request failed",
      status,
      detail: statusText,
      code: "UNKNOWN",
    }
  );
}

function persistTokenFromResponse(response: Response, data: unknown): void {
  const responseToken = response.headers.get("satoken");
  if (responseToken) {
    setStoredToken(responseToken);
    return;
  }
  const bodyToken = extractTokenFromBody(data);
  if (bodyToken) setStoredToken(bodyToken);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.token ?? getStoredToken();
  const response = await fetch(resolveApiUrl(path), {
    method: options.method ?? "GET",
    headers: buildHeaders(options),
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const data = await response.json().catch(() => null);
  persistTokenFromResponse(response, data);

  if (response.status === 204) {
    return undefined as T;
  }
  if (!response.ok) {
    if (response.status === 401 && token) setStoredToken(null);
    throw new ApiError(toProblemDetails(data, response.status, response.statusText));
  }
  return data as T;
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.satoken = token;

  const form = new FormData();
  form.append("file", file);

  const response = await fetch(resolveApiUrl(path), {
    method: "POST",
    headers,
    credentials: "include",
    body: form,
  });

  const data = await response.json().catch(() => null);
  persistTokenFromResponse(response, data);

  if (response.status === 204) {
    return undefined as T;
  }
  if (!response.ok) {
    if (response.status === 401 && token) setStoredToken(null);
    throw new ApiError(toProblemDetails(data, response.status, response.statusText));
  }
  return data as T;
}
