import { createFileRoute } from "@tanstack/react-router";
import { hasCredentialAccount } from "@repo/data-ops/queries/user";
import { getAuth } from "@repo/data-ops/auth/server";

export const Route = createFileRoute("/api/user/has-credential-account")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = getAuth();
        const session = await auth.api.getSession({ headers: request.headers });

        if (!session?.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const hasCredentials = await hasCredentialAccount(session.user.id);
        return Response.json({ hasCredentialAccount: hasCredentials });
      },
    },
  },
});
