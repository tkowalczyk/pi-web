import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { LogOut, Palette, Languages, Key } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageToggle } from "@/components/language/language-toggle";
import { ChangePassword } from "./change-password";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

interface AccountDialogProps {
  children: React.ReactNode;
}

export function AccountDialog({ children }: AccountDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const { data: credentialCheck } = useQuery({
    queryKey: ["has-credential-account", session?.user.id],
    queryFn: async () => {
      if (!session?.user.id) return { hasCredentialAccount: false };
      const res = await fetch("/api/user/has-credential-account");
      if (!res.ok) return { hasCredentialAccount: false };
      return res.json() as Promise<{ hasCredentialAccount: boolean }>;
    },
    enabled: !!session?.user.id,
  });

  const signOut = async () => {
    await authClient.signOut();
    navigate({ to: "/auth/login" });
  };

  if (!session) {
    return null;
  }

  const user = session.user;
  const fallbackText = user.name
    ? user.name.charAt(0).toUpperCase()
    : user.email?.charAt(0).toUpperCase() || "U";

  const hasCredentialAccount = credentialCheck?.hasCredentialAccount ?? false;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-4">
          <DialogTitle>{t("nav.account")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-6 py-6">
          <Avatar className="h-20 w-20">
            <AvatarImage
              src={user.image || undefined}
              alt={user.name || "User"}
            />
            <AvatarFallback className="text-2xl font-semibold">
              {fallbackText}
            </AvatarFallback>
          </Avatar>
          <div className="text-center space-y-1">
            {user.name && (
              <div className="text-lg font-semibold">{user.name}</div>
            )}
            {user.email && (
              <div className="text-sm text-muted-foreground">{user.email}</div>
            )}
          </div>
          <div className="flex flex-col gap-4 w-full mt-6">
            <div className="flex items-center justify-between w-full py-3 px-4 rounded-lg border bg-card">
              <span className="text-sm font-medium flex items-center gap-2">
                <Languages className="h-4 w-4" />
                {t("language.label")}
              </span>
              <LanguageToggle />
            </div>
            <div className="flex items-center justify-between w-full py-3 px-4 rounded-lg border bg-card">
              <span className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t("theme.toggle")}
              </span>
              <ThemeToggle />
            </div>
            {hasCredentialAccount && (
              <ChangePassword
                trigger={
                  <Button variant="outline" size="lg" className="w-full gap-2">
                    <Key className="h-5 w-5" />
                    {t("auth.changePassword")}
                  </Button>
                }
              />
            )}
            <Button
              onClick={signOut}
              variant="outline"
              size="lg"
              className="w-full gap-2"
            >
              <LogOut className="h-5 w-5" />
              {t("nav.signOut")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}