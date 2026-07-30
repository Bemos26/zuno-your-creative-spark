import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { proxyAdminRequest } from "@/lib/admin-backend.server";

export const Route = createFileRoute("/api/admin/waitlist/$id/points")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) =>
        proxyAdminRequest(request, `/waitlist/${encodeURIComponent(params.id)}/points`),
    },
  },
});
