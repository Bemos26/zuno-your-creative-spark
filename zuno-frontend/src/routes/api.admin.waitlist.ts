import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { proxyAdminRequest } from "@/lib/admin-backend.server";

export const Route = createFileRoute("/api/admin/waitlist")({
  server: {
    handlers: {
      // GET ?search= -> proxied to GET /api/v1/admin/waitlist on the backend.
      GET: async ({ request }) => proxyAdminRequest(request, "/waitlist"),
    },
  },
});
