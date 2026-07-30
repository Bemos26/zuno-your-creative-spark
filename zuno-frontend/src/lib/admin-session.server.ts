// Server-only session helpers for /admin/waitlist.
//
// IMPORTANT: this file must only ever be imported from route `server.handlers`
// (see src/routes/api.admin.*.ts). TanStack Start compiles handler code as
// server-only, so none of this — including the env vars it reads — ends up
// in the client bundle. Do NOT import this from a React component.
//
// This is a lightweight signed-cookie session, not a full auth system:
// one shared dashboard password, one session secret. That's a reasonable
// step up from a passcode hardcoded in client JS, but if this dashboard
// ever needs per-admin accounts, audit trails tied to a real identity, or
// password reset, replace this with real authenticated login.

const SESSION_COOKIE_NAME = "zuno_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

function getSessionSecret(): string {
  // Reuses ADMIN_API_KEY as the HMAC secret so there's one fewer env var to
  // manage. This value never leaves the server: it's used to sign a cookie
  // token, not sent to the browser or to the backend.
  const secret = process.env.ADMIN_API_KEY;
  if (!secret) {
    throw new Error("ADMIN_API_KEY is not configured on the server");
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Creates a signed session token: base64url(payload) + "." + base64url(signature). */
export async function createSessionToken(): Promise<string> {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_SECONDS * 1000 });
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload));
  const key = await hmacKey(getSessionSecret());
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${payloadB64}.${sigB64}`;
}

/** Verifies a session token's signature and expiry. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;

  try {
    const key = await hmacKey(getSessionSecret());
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(payloadB64),
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getSessionTokenFromRequest(request: Request): string | undefined {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies[SESSION_COOKIE_NAME];
}

export async function isRequestAuthenticated(request: Request): Promise<boolean> {
  return verifySessionToken(getSessionTokenFromRequest(request));
}

export function buildSessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function buildClearSessionCookie(): string {
  return [`${SESSION_COOKIE_NAME}=`, "HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=0"].join("; ");
}

/** Constant-time-ish string compare for the dashboard password check. */
export function safeCompare(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}
