import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";

interface PasswordPolicyDisplayProps {
  password: string;
}

export function PasswordPolicyDisplay({ password }: PasswordPolicyDisplayProps) {
  const { t } = useTranslation();

  const checks = [
    {
      test: (pwd: string) => pwd.length >= 8,
      label: t("auth.passwordPolicy.minLength"),
    },
    {
      test: (pwd: string) => /[A-Z]/.test(pwd),
      label: t("auth.passwordPolicy.uppercase"),
    },
    {
      test: (pwd: string) => /[a-z]/.test(pwd),
      label: t("auth.passwordPolicy.lowercase"),
    },
    {
      test: (pwd: string) => /[0-9]/.test(pwd),
      label: t("auth.passwordPolicy.number"),
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        {t("auth.passwordPolicy.title")}:
      </p>
      <ul className="space-y-1">
        {checks.map((check, index) => {
          const passed = check.test(password);
          return (
            <li key={index} className="flex items-center gap-2 text-sm">
              {passed ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={passed ? "text-foreground" : "text-muted-foreground"}>
                {check.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
