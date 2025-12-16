import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMyPhone } from "@/core/functions/profile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { type UserProfileResponse } from "@repo/data-ops/zod-schema/user";
import { useTranslation } from "react-i18next";

export function PhoneForm({ user }: { user: UserProfileResponse | undefined }) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();

  const getTranslatedError = (message: string) => {
    if (message.includes("Invalid phone number length")) return t("phone.invalidLength");
    if (message.includes("Phone number must contain only digits")) return t("phone.invalidDigits");
    if (message.includes("Phone number is required")) return t("phone.required");
    if (message.includes("Invalid Polish phone format")) return t("phone.invalidFormat");
    return message;
  };

  const mutation = useMutation({
    mutationFn: async (data: { phone: string }) => await updateMyPhone({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("phone.updateSuccess"));
    },
    onError: (err: Error) => {
      toast.error(getTranslatedError(err.message) || t("phone.updateError"));
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phone = formData.get("phone") as string;

    mutation.mutate({ phone });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <Label htmlFor="phone">{t("phone.label")}</Label>
        <p className="text-sm text-gray-600 mb-2">
          {t("phone.description")}
        </p>
        <Input
          id="phone"
          name="phone"
          defaultValue={user?.phone || ""}
          placeholder={t("phone.placeholder")}
          required
        />
        {mutation.isError && (
          <p className="text-sm text-red-600 mt-1">{getTranslatedError(mutation.error.message)}</p>
        )}
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t("phone.saving") : t("phone.save")}
      </Button>
    </form>
  );
}
