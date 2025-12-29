import { useState, useRef } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
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
import { registerSchema } from "@/lib/validation/auth-schemas";
import { PasswordStrengthIndicator } from "./password-strength-indicator";
import { PasswordPolicyDisplay } from "./password-policy-display";
import { checkRateLimit } from "@/middleware/rate-limit";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EmailRegister() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      password: string;
    }) => {
      const identifier = `register:${data.email}`;
      if (!checkRateLimit(identifier, 3)) {
        throw new Error(t("error.rateLimitExceeded"));
      }

      const result = await authClient.signUp.email({
        ...data,
        callbackURL: "/app",
      });

      if (result.error) {
        throw result.error;
      }

      return result;
    },
    onSuccess: () => {
      navigate({ to: "/app" });
    },
    onError: (err: { message?: string; code?: string }) => {
      const errorMessage = err.message?.toLowerCase() || "";
      const errorCode = err.code?.toLowerCase() || "";

      if (errorMessage.includes("rate limit")) {
        setError(t("error.rateLimitExceeded"));
      } else if (errorCode.includes("email_already_exists")) {
        setError(t("error.emailAlreadyExists"));
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
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    const result = registerSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
    });

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

    mutation.mutate({ name, email, password });
  };

  return (
    <div className="flex items-center justify-center p-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {t("auth.createAccount")}
          </CardTitle>
          <CardDescription>{t("auth.createAccountDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.fullName")}</Label>
              <Input
                id="name"
                name="name"
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name && (
                <p className="text-sm text-destructive">{fieldErrors.name}</p>
              )}
            </div>

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
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
              {password && <PasswordStrengthIndicator password={password} />}
            </div>

            <PasswordPolicyDisplay password={password} />

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                aria-invalid={!!fieldErrors.confirmPassword}
              />
              {fieldErrors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {fieldErrors.confirmPassword}
                </p>
              )}
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
              {mutation.isPending ? "..." : t("auth.signUp")}
            </Button>

            <div className="text-center text-sm">
              <Link to="/auth/login" className="text-primary hover:underline">
                {t("auth.alreadyHaveAccount")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
