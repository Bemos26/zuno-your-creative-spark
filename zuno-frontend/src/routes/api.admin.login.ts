import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import {
  buildClearSessionCookie,
  buildSessionCookie,
  createSessionToken,
  safeCompare,
} from "@/lib/admin-session.server";

export const Route = createFileRoute("/api/admin/login")({
  server: {
    handlers: {
      // POST { password } -> sets a session cookie if it matches
      // ADMIN_DASHBOARD_PASSWORD.
      POST: async ({ request }) => {
        const expected = process.env.ADMIN_DASHBOARD_PASSWORD;
        if (!expected) {
          return Response.json(
            { success: false, message: "Admin dashboard is not configured." },
            { status: 500 },
          );
        }

        const body = await request.json().catch(() => null);
        const password = typeof body?.password === "string" ? body.password : "";

        if (!password || !safeCompare(password, expected)) {
          return Response.json(
            { success: false, message: "That password isn't right." },
            { status: 401 },
          );
        }

        const token = await createSessionToken();
        return Response.json(
          { success: true, message: "Signed in." },
          { status: 200, headers: { "Set-Cookie": buildSessionCookie(token) } },
        );
      },
      // POST is used for login; DELETE clears the session (logout).
      DELETE: async () => {
        return Response.json(
          { success: true, message: "Signed out." },
          { status: 200, headers: { "Set-Cookie": buildClearSessionCookie() } },
        );
      },
    },
  },
});
