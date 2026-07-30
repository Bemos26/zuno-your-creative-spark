// Client for the Zuno Waitlist API (Flask + MySQL — see zuno_waitlist_backend).
//
// Base URL comes from VITE_API_BASE_URL (set in .env / .env.local / deploy env).
// Every endpoint responds with the same envelope:
//   success:  { success: true,  message, data }
//   error:    { success: false, message, error_code, errors? }
//
// Endpoints used here:
//   POST /api/v1/waitlist/join                -> create a signup
//   GET  /api/v1/waitlist/count                -> public signup counter
//   GET  /api/v1/waitlist/referral/:code/stats -> a signup's own referral stats
//
// Email verification itself happens via a link the backend emails directly
// to the user (GET /api/v1/waitlist/verify/:token) — that link is clicked
// from the user's inbox, not called from this client. After verifying, the
// backend redirects the browser to {FRONTEND_URL}/waitlist/confirm with
// ?verified=1&code=<referral_code>&name=<full_name>, which is what
// routes/waitlist.confirm.tsx reads.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

type ApiEnvelope<T> =
  | { success: true; message: string; data: T }
  | { success: false; message: string; error_code?: string; errors?: Record<string, string[]> };

async function parseEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  const body = await res.json().catch(() => null);
  if (!body) {
    return { success: false, message: "Unexpected response from the server." };
  }
  return body as ApiEnvelope<T>;
}

export type WaitlistEntry = {
  id: string;
  full_name: string;
  email: string;
  position: number;
  status: string;
  is_verified: boolean;
  referral_code: string;
  points: number;
  created_at: string;
};

export type JoinWaitlistResult =
  | { ok: true; entry: WaitlistEntry }
  | { ok: false; message: string };

export async function joinWaitlist(params: {
  name: string;
  email: string;
  referredBy?: string | null;
}): Promise<JoinWaitlistResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/waitlist/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: params.name,
        email: params.email,
        referral_code: params.referredBy || undefined,
        referral_source: "website",
      }),
    });

    const body = await parseEnvelope<WaitlistEntry>(res);
    if (!body.success) {
      return { ok: false, message: body.message || "Something went wrong. Try again." };
    }
    return { ok: true, entry: body.data };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

export async function getWaitlistCount(): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/waitlist/count`);
    const body = await parseEnvelope<{ total_signups: number }>(res);
    return body.success ? body.data.total_signups : null;
  } catch {
    return null;
  }
}

export type ReferralStats = {
  referral_code: string;
  points: number;
  total_referrals: number;
};

export type ReferralStatsResult =
  | { ok: true; stats: ReferralStats }
  | { ok: false; message: string };

export async function getReferralStats(code: string): Promise<ReferralStatsResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/waitlist/referral/${encodeURIComponent(code)}/stats`);
    const body = await parseEnvelope<ReferralStats>(res);
    if (!body.success) {
      return { ok: false, message: body.message || "Couldn't load referral stats." };
    }
    return { ok: true, stats: body.data };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

/** Builds a shareable referral URL from a code, e.g. https://zuno.app/waitlist?ref=ABC123 */
export function referralUrl(code: string): string {
  if (typeof window === "undefined") return `/waitlist?ref=${code}`;
  return `${window.location.origin}/waitlist?ref=${code}`;
}

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`/api/admin${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

export type AdminAuthResult = { ok: true } | { ok: false; message: string };

export async function adminLogin(password: string): Promise<AdminAuthResult> {
  try {
    const res = await adminFetch("/login", { method: "POST", body: JSON.stringify({ password }) });
    const body = await parseEnvelope<null>(res);
    if (!body.success) {
      return { ok: false, message: body.message || "That password isn't right." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

export async function adminLogout(): Promise<void> {
  await adminFetch("/login", { method: "DELETE" }).catch(() => undefined);
}

export type AdminWaitlistEntry = {
  id: string;
  full_name: string;
  email: string;
  position: number;
  status: string;
  is_verified: boolean;
  referral_code: string;
  referred_by_code: string | null;
  referral_count: number;
  points: number;
  flagged: boolean;
  created_at: string;
};

export type AdminEntryDetail = AdminWaitlistEntry & {
  referred_entries: WaitlistEntry[];
};

type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; unauthorized?: boolean };

export async function getAdminWaitlist(search?: string): Promise<AdminResult<AdminWaitlistEntry[]>> {
  try {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await adminFetch(`/waitlist${qs}`);
    const body = await parseEnvelope<AdminWaitlistEntry[]>(res);
    if (!body.success) {
      return { ok: false, message: body.message || "Couldn't load the waitlist.", unauthorized: res.status === 401 };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

export async function getAdminWaitlistEntry(publicId: string): Promise<AdminResult<AdminEntryDetail>> {
  try {
    const res = await adminFetch(`/waitlist/${encodeURIComponent(publicId)}`);
    const body = await parseEnvelope<AdminEntryDetail>(res);
    if (!body.success) {
      return { ok: false, message: body.message || "Couldn't load that entry.", unauthorized: res.status === 401 };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

export async function setAdminPoints(publicId: string, points: number): Promise<AdminResult<AdminWaitlistEntry>> {
  try {
    const res = await adminFetch(`/waitlist/${encodeURIComponent(publicId)}/points`, {
      method: "PATCH",
      body: JSON.stringify({ points }),
    });
    const body = await parseEnvelope<AdminWaitlistEntry>(res);
    if (!body.success) {
      return { ok: false, message: body.message || "Couldn't update points.", unauthorized: res.status === 401 };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

export async function setAdminVerified(publicId: string, isVerified: boolean): Promise<AdminResult<AdminWaitlistEntry>> {
  try {
    const res = await adminFetch(`/waitlist/${encodeURIComponent(publicId)}/verified`, {
      method: "PATCH",
      body: JSON.stringify({ is_verified: isVerified }),
    });
    const body = await parseEnvelope<AdminWaitlistEntry>(res);
    if (!body.success) {
      return { ok: false, message: body.message || "Couldn't update verification.", unauthorized: res.status === 401 };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

export async function setAdminFlagged(publicId: string, flagged: boolean): Promise<AdminResult<AdminWaitlistEntry>> {
  try {
    const res = await adminFetch(`/waitlist/${encodeURIComponent(publicId)}/flag`, {
      method: "PATCH",
      body: JSON.stringify({ flagged }),
    });
    const body = await parseEnvelope<AdminWaitlistEntry>(res);
    if (!body.success) {
      return { ok: false, message: body.message || "Couldn't update flag status.", unauthorized: res.status === 401 };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}
