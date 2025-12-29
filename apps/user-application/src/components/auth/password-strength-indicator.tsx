import { useTranslation } from "react-i18next";

type PasswordStrength = "weak" | "normal" | "strong";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({
  password,
}: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation();

  const getPasswordStrength = (pwd: string): PasswordStrength => {
    if (pwd.length < 8) return "weak";

    const hasUppercase = /[A-Z]/.test(pwd);
    const hasLowercase = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);

    const hasAllRequired = hasUppercase && hasLowercase && hasNumber;

    if (!hasAllRequired) return "weak";
    if (pwd.length >= 12) return "strong";
    return "normal";
  };

  const strength = getPasswordStrength(password);

  const strengthColors = {
    weak: "bg-red-500",
    normal: "bg-yellow-500",
    strong: "bg-green-500",
  };

  const strengthWidth = {
    weak: "w-1/3",
    normal: "w-2/3",
    strong: "w-full",
  };

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t("auth.passwordStrength.label")}:
        </span>
        <span className="text-sm font-medium">
          {t(`auth.passwordStrength.${strength}`)}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${strengthColors[strength]} ${strengthWidth[strength]}`}
        />
      </div>
    </div>
  );
}
