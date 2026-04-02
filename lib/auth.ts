const ASCII_REGEX = /^[\x20-\x7E]*$/;

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("access_token");
  if (!raw) return process.env.NEXT_PUBLIC_DEFAULT_JWT || null;

  let token = raw.trim();
  // Remove wrapping quotes if any
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }

  // Ensure it's purely ascii
  if (!ASCII_REGEX.test(token)) {
    clearAccessToken();
    return null;
  }

  return token;
}

export function setAccessToken(token: string) {
  if (typeof window === "undefined") return;
  const safeToken = token.replace(/[^\x20-\x7E]/g, '').trim();
  localStorage.setItem("access_token", safeToken);
  document.cookie = `access_token=${safeToken}; path=/; max-age=86400`; // 1 day
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  document.cookie = 'access_token=; path=/; max-age=0';
}
