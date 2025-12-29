import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EmailLogin } from "@/components/auth/email-login";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";

export const Route = createFileRoute("/auth/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const session = authClient.useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session.isPending && session.data) {
      navigate({ to: "/app", replace: true });
    }
  }, [session.isPending, session.data, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingNav />
      <div className="flex-1">
        <EmailLogin />
      </div>
      <Footer />
    </div>
  );
}
