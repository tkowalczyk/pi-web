import { useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/lib/validation/auth-schemas";
import { checkRateLimit } from "@/middleware/rate-limit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTermsAgreement } from "@/lib/hooks";

export function EmailLogin() {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useTermsAgreement();

  const mutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      rememberMe: boolean;
    }) => {
      const identifier = `login:${data.email}`;
      if (!checkRateLimit(identifier, 5)) {
        throw new Error(t("error.rateLimitExceeded"));
      }

      const result = await authClient.signIn.email({
        ...data,
        callbackURL: "/app",
      });

      if (result.error) {
        throw result.error;
      }

      return result;
    },
    onError: (err: { message?: string; code?: string }) => {
      const errorMessage = err.message?.toLowerCase() || "";
      const errorCode = err.code?.toLowerCase() || "";

      if (errorMessage.includes("rate limit")) {
        setError(t("error.rateLimitExceeded"));
      } else if (
        errorCode.includes("invalid_email_or_password") ||
        errorMessage.includes("credential") ||
        errorMessage.includes("invalid")
      ) {
        setError(t("error.invalidCredentials"));
      } else {
        setError(t("error.defaultMessage"));
      }
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const rememberMe = formData.get("rememberMe") === "on";

    const result = loginSchema.safeParse({ email, password });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = t(err.message);
        }
      });
      setFieldErrors(errors);
      return;
    }

    mutation.mutate({ email, password, rememberMe });
  };

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/app",
    });
  };

  return (
    <div className="flex items-center justify-center p-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-balance">
            {t("auth.signIn")}
          </CardTitle>
          <CardDescription>{t("auth.signInDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="rememberMe" name="rememberMe" />
              <Label
                htmlFor="rememberMe"
                className="text-sm font-normal cursor-pointer"
              >
                {t("auth.rememberMe")}
              </Label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <Label
                htmlFor="terms"
                className="text-sm font-normal leading-none cursor-pointer"
              >
                {t("auth.agreeToTerms")}{" "}
                <Link to="/terms-of-service" className="text-primary hover:underline">
                  {t("legal.termsOfService")}
                </Link>
                {", "}
                <Link to="/cookie-policy" className="text-primary hover:underline">
                  {t("legal.cookiePolicy")}
                </Link>
                {" "}{t("auth.and")}{" "}
                <Link to="/privacy-policy" className="text-primary hover:underline">
                  {t("legal.privacyPolicy")}
                </Link>
              </Label>
            </div>

            <Button
              type="submit"
              disabled={mutation.isPending || !agreedToTerms}
              className="w-full"
            >
              {mutation.isPending ? "..." : t("auth.signIn")}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t("auth.orContinueWith")}
              </span>
            </div>
          </div>

          <Button
            onClick={handleGoogleSignIn}
            className="w-full"
            variant="outline"
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t("auth.continueWithGoogle")}
          </Button>

          <div className="text-center text-sm">
            <Link to="/auth/register" className="text-primary hover:underline">
              {t("auth.noAccount")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
