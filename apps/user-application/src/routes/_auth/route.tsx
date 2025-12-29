import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

function RouteComponent() {
  const session = authClient.useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      navigate({ to: "/auth/login", replace: true });
    }
  }, [session.isPending, session.data, navigate]);

  if (session.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session.data) {
    return null;
  }

  return <Outlet />;
}
