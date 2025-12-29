import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { requireSession } from "@/core/functions/session";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    try {
      const session = await requireSession();
      return { user: session.user };
    } catch {
      throw redirect({ to: "/auth/login", replace: true });
    }
  },
  component: Outlet,
});
