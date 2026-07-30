// Server-only proxy to the Flask admin API. Only ever imported from route
// `server.handlers` (see src/routes/api.admin.*.ts) — never from a component.
//
// ADMIN_API_KEY lives here, read from process.env, and is attached to the
// outgoing request to the backend. It is never sent to, or readable by, the
// browser: the browser only ever talks to same-origin /api/admin/* routes
// and authenticates to *those* with the session cookie from
// admin-session.server.ts, not with the backend's key.

import { isRequestAuthenticated } from "@/lib/admin-session.server";

function getWaitlistApiBase(): string {
  return process.env.WAITLIST_API_URL ?? "http://localhost:5000";
}

function getAdminApiKey(): string {
  const key = process.env.ADMIN_API_KEY;
  if (!key) {
    throw new Error("ADMIN_API_KEY is not configured on the server");
  }
  return key;
}

function unauthorized(): Response {
  return Response.json(
    { success: false, message: "Not signed in.", error_code: "UNAUTHORIZED" },
    { status: 401 },
  );
}

/**
 * Forwards an admin request to the Flask backend at
 * `${WAITLIST_API_URL}/api/v1/admin${backendPath}`, after checking the
 * caller has a valid session cookie. Streams the backend's JSON response
 * (body + status) straight back — the backend already owns the response
 * shape (see zuno-backend's app/utils/responses.py).
 */
export async function proxyAdminRequest(request: Request, backendPath: string): Promise<Response> {
  if (!(await isRequestAuthenticated(request))) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const target = `${getWaitlistApiBase()}/api/v1/admin${backendPath}${url.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": getAdminApiKey(),
    },
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(target, init);
  } catch {
    return Response.json(
      { success: false, message: "Couldn't reach the waitlist backend." },
      { status: 502 },
    );
  }

  const body = await backendResponse.text();
  return new Response(body, {
    status: backendResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}
