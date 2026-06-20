// Tiny fetch wrapper for the Finanx REST API.
// JWT lives in localStorage; SSR is guarded.
const STORAGE_KEY = "finanx.token";
const DEFAULT_API_BASE_URL = "http://localhost:8080";
const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

function resolveApiBaseUrl(): string {
  if (!rawApiBaseUrl) return DEFAULT_API_BASE_URL;
  if (import.meta.env.DEV && rawApiBaseUrl === "/api") return DEFAULT_API_BASE_URL;
  return rawApiBaseUrl;
}

export const API_BASE_URL: string = resolveApiBaseUrl();

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(STORAGE_KEY, token);
  else window.localStorage.removeItem(STORAGE_KEY);
}

export interface ApiErrorBody {
  timestamp?: number;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | string | null;
  constructor(status: number, message: string, body: ApiErrorBody | string | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = API_BASE_URL.replace(/\/?$/, "/");
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = new URL(path.replace(/^\//, ""), base.startsWith("http") ? base : new URL(base, origin));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body,
      signal: opts.signal,
    });
  } catch (e) {
    throw new ApiError(0, "Sem conexão com a API. Verifique VITE_API_BASE_URL.", String(e));
  }

  if ((res.status === 401 || res.status === 403) && path !== "/auth/login") {
    setToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
      window.location.href = "/auth/login";
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    let msg = res.statusText || "Erro inesperado";
    if (parsed && typeof parsed === "object" && typeof (parsed as ApiErrorBody).message === "string") {
      msg = (parsed as ApiErrorBody).message as string;
    } else if (parsed && typeof parsed === "object" && typeof (parsed as ApiErrorBody).error === "string") {
      msg = (parsed as ApiErrorBody).error as string;
    } else if (typeof parsed === "string" && parsed) {
      msg = parsed;
    }
    throw new ApiError(res.status, msg, parsed as ApiErrorBody | string);
  }

  return parsed as T;
}
