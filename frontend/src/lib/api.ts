const BASE_URL = "http://localhost:8001/api";

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

// Auth API calls
export async function apiSignUp(email: string, password: string) {
  const res = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Sign up failed");
  return data;
}

export async function apiSignIn(email: string, password: string) {
  const res = await apiFetch("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Sign in failed");
  return data;
}

export async function apiGetMe() {
  const res = await apiFetch("/auth/me");
  if (!res.ok) return null;
  return res.json();
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Bias audit failed");
  return data;
}

// Analysis history API
export async function apiFetchAnalyses(mode?: string, limit: number = 100) {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  params.set("limit", String(limit));
  const res = await apiFetch(`/analyses?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to fetch analyses");
  return data;
}
