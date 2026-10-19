const AUTH_BASE = "https://developer.api.autodesk.com/authentication/v2";
const TOKEN_KEY = "prisma.acc.token.v1";
const PKCE_KEY = "prisma.acc.pkce.v1";

export interface AccToken {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64Url(bytes.buffer);
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
}

export function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function loadAccToken(): AccToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) {
      return null;
    }
    const token = JSON.parse(raw) as AccToken;
    if (!token.accessToken || !token.expiresAt) {
      return null;
    }
    if (Date.now() >= token.expiresAt - 30_000) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function clearAccToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PKCE_KEY);
}

function saveAccToken(token: AccToken): void {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export function isAccSignedIn(): boolean {
  return loadAccToken() !== null;
}

interface AccPendingLogin {
  state: string;
  clientId: string;
  /** Present for PKCE / public apps. Omitted when a client secret is used. */
  verifier?: string;
  clientSecret?: string;
}

export async function beginAccLogin(
  clientId: string,
  clientSecret = "",
  scopes = "data:read account:read",
): Promise<void> {
  const trimmed = clientId.trim();
  const secret = clientSecret.trim();
  if (!trimmed) {
    throw new Error("Set your Autodesk APS Client ID in Settings first.");
  }
  const state = randomString(16);
  const pending: AccPendingLogin = { state, clientId: trimmed };
  if (secret) {
    pending.clientSecret = secret;
  } else {
    pending.verifier = randomString(64);
  }
  sessionStorage.setItem(PKCE_KEY, JSON.stringify(pending));

  const url = new URL(`${AUTH_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", trimmed);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  if (pending.verifier) {
    const challenge = base64Url(await sha256(pending.verifier));
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  window.location.assign(url.toString());
}

export async function completeAccLoginFromUrl(currentUrl = window.location.href): Promise<boolean> {
  const url = new URL(currentUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) {
    throw new Error(url.searchParams.get("error_description") || error);
  }
  if (!code || !state) {
    return false;
  }

  const raw = sessionStorage.getItem(PKCE_KEY);
  if (!raw) {
    // Another provider (e.g. Microsoft) may own this OAuth callback.
    return false;
  }
  if (typeof state === "string" && state.startsWith("sp.")) {
    return false;
  }
  const pkce = JSON.parse(raw) as AccPendingLogin;
  if (pkce.state !== state) {
    throw new Error("ACC sign-in state mismatch. Try Sign in to ACC again.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (pkce.clientSecret) {
    headers.Authorization = `Basic ${btoa(`${pkce.clientId}:${pkce.clientSecret}`)}`;
  } else {
    body.set("client_id", pkce.clientId);
    if (pkce.verifier) {
      body.set("code_verifier", pkce.verifier);
    }
  }

  const response = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers,
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ACC token exchange failed (${response.status}): ${text}`);
  }
  const json = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  saveAccToken({
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    refreshToken: json.refresh_token,
  });
  sessionStorage.removeItem(PKCE_KEY);

  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  return true;
}

export function requireAccAccessToken(): string {
  const token = loadAccToken();
  if (!token) {
    throw new Error("Sign in to ACC first (Settings → Autodesk Construction Cloud).");
  }
  return token.accessToken;
}
