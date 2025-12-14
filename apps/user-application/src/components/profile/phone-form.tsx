import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMyPhone } from "@/core/functions/profile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { type UserProfileResponse } from "@repo/data-ops/zod-schema/user";

export function PhoneForm({ user }: { user: UserProfileResponse | undefined }) {
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { phone: string }) => await updateMyPhone({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Phone number updated successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update phone number");
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
        <Label htmlFor="phone">Phone Number</Label>
        <p className="text-sm text-gray-600 mb-2">
          Required for SMS notifications. Accepts: 606181071
        </p>
        <Input
          id="phone"
          name="phone"
          defaultValue={user?.phone || ""}
          placeholder="606 181 071"
          required
        />
        {mutation.isError && (
          <p className="text-sm text-red-600 mt-1">{mutation.error.message}</p>
        )}
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Save Phone"}
      </Button>
    </form>
  );
}
