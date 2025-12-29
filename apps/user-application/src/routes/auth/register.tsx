import { createFileRoute, redirect } from "@tanstack/react-router";
import { EmailRegister } from "@/components/auth/email-register";
import { LandingNav } from "@/components/navigation/landing-nav";
import { Footer } from "@/components/landing/footer";
import { checkSession } from "@/core/functions/session";

export const Route = createFileRoute("/auth/register")({
  beforeLoad: async () => {
    const session = await checkSession();
    if (session?.user) {
      throw redirect({ to: "/app", replace: true });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingNav />
      <div className="flex-1">
        <EmailRegister />
      </div>
      <Footer />
    </div>
  );
}
