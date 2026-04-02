const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

function sanitizeToken(raw: string | null): string | null {
  if (!raw) return null;
  let token = raw.trim();

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice("bearer ".length).trim();
  }

  if (!token) return null;

  // Prevent invalid header values (newlines / non-ascii control chars)
  for (let i = 0; i < token.length; i++) {
    const code = token.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return null;
  }
  if (token.includes("\n") || token.includes("\r")) return null;

  return token;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sanitizeToken(localStorage.getItem(ACCESS_TOKEN_KEY));
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sanitizeToken(localStorage.getItem(REFRESH_TOKEN_KEY));
}

export function setTokens(access: string, refresh: string): void {
  if (typeof window === "undefined") return;
  const safeAccess = sanitizeToken(access);
  const safeRefresh = sanitizeToken(refresh);
  if (!safeAccess || !safeRefresh) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, safeAccess);
  localStorage.setItem(REFRESH_TOKEN_KEY, safeRefresh);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAuthHeader(): HeadersInit {
  const token = getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
