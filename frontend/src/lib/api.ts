export function getApiBaseUrl(): string {
  return import.meta.env.VITE_APP_BACKEND_URL?.trim().replace(/\/$/, "") || "";
}

const BASE_URL = getApiBaseUrl() || "/api";

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("auth_token");
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

async function handleResponse(res: Response, defaultError: string) {
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || defaultError);
    }
    return data;
  } else {
    // Handle non-JSON responses (like Render 502/504 gateways or 404 HTML pages)
    console.error(`Received non-JSON response (${res.status})`);
    throw new Error(`Server Error (${res.status}): Please make sure the backend is running and the backend URL is set correctly in settings.`);
  }
}

// Auth API calls
export async function apiSignUp(email: string, password: string) {
  const res = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res, "Sign up failed");
}

export async function apiSignIn(email: string, password: string) {
  const res = await apiFetch("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res, "Sign in failed");
}

export async function apiGetMe() {
  const res = await apiFetch("/auth/me");
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return null;
}

// Bias audit API
export async function apiBiasAudit(
  resumeText: string,
  jobDescription?: string | null,
  geminiApiKey?: string | null,
  modelName?: string
) {
  const res = await apiFetch("/audit-bias", {
    method: "POST",
    body: JSON.stringify({
      resumeText,
      jobDescription: jobDescription || null,
      geminiApiKey: geminiApiKey || null,
      modelName: modelName || "gemini-2.5-flash-lite",
    }),
  });
  return handleResponse(res, "Bias audit failed");
}

// Analysis history API
export async function apiFetchAnalyses(mode?: string, limit: number = 100) {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  params.set("limit", String(limit));
  const res = await apiFetch(`/analyses?${params.toString()}`);
  return handleResponse(res, "Failed to fetch analyses");
}
