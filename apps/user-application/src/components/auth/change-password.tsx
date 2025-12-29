import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { changePasswordSchema } from "@/lib/validation/auth-schemas";
import { PasswordStrengthIndicator } from "./password-strength-indicator";
import { PasswordPolicyDisplay } from "./password-policy-display";
import { checkRateLimit } from "@/middleware/rate-limit";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ChangePasswordProps {
  trigger?: React.ReactNode;
}

export function ChangePassword({ trigger }: ChangePasswordProps) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);

  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const identifier = `change-password:${Date.now()}`;
      if (!checkRateLimit(identifier, 5)) {
        throw new Error(t("error.rateLimitExceeded"));
      }

      const result = await authClient.changePassword({
        ...data,
        revokeOtherSessions: true,
      });

      if (result.error) {
        throw result.error;
      }

      return result;
    },
    onSuccess: () => {
      setSuccess(true);
      formRef.current?.reset();
      setNewPassword("");
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 2000);
    },
    onError: (err: { message?: string; code?: string }) => {
      const errorMessage = err.message?.toLowerCase() || "";
      const errorCode = err.code?.toLowerCase() || "";

      if (errorMessage.includes("rate limit")) {
        setError(t("error.rateLimitExceeded"));
      } else if (
        errorCode.includes("invalid_password") ||
        errorMessage.includes("credential") ||
        errorMessage.includes("invalid")
      ) {
        setError(t("error.invalidCredentials"));
      } else {
        setError(t("auth.passwordChangeFailed"));
      }
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    const result = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
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

    mutation.mutate({ currentPassword, newPassword });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">{t("auth.changePassword")}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("auth.changePassword")}</DialogTitle>
          <DialogDescription>
            {t("auth.createAccountDescription")}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {success && (
            <Alert>
              <AlertDescription>{t("auth.passwordChanged")}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t("auth.currentPassword")}</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              aria-invalid={!!fieldErrors.currentPassword}
            />
            {fieldErrors.currentPassword && (
              <p className="text-sm text-destructive">
                {fieldErrors.currentPassword}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("auth.newPassword")}</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              onChange={(e) => setNewPassword(e.target.value)}
              aria-invalid={!!fieldErrors.newPassword}
            />
            {fieldErrors.newPassword && (
              <p className="text-sm text-destructive">
                {fieldErrors.newPassword}
              </p>
            )}
            {newPassword && <PasswordStrengthIndicator password={newPassword} />}
          </div>

          <PasswordPolicyDisplay password={newPassword} />

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t("auth.confirmNewPassword")}
            </Label>
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

          <Button
            type="submit"
            disabled={mutation.isPending || success}
            className="w-full"
          >
            {mutation.isPending ? "..." : t("auth.changePassword")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
