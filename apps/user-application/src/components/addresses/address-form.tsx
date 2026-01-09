import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMyAddress } from "@/core/functions/addresses";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { type CreateAddressInput, type CityResponse, type StreetResponse } from "@repo/data-ops/zod-schema/address";
import { useTranslation } from "react-i18next";

export function AddressForm() {
  const { t } = useTranslation();
  const [cityId, setCityId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();

  const { data: cities = [] } = useQuery<CityResponse[]>({
    queryKey: ["cities"],
    queryFn: async () => {
      const res = await fetch("/api/cities");
      return res.json();
    },
  });

  const { data: streets = [] } = useQuery<StreetResponse[]>({
    queryKey: ["streets", cityId],
    queryFn: async () => {
      if (!cityId) return [];
      const res = await fetch(`/api/cities/${cityId}/streets`);
      return res.json();
    },
    enabled: !!cityId,
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateAddressInput) =>
      await createMyAddress({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      queryClient.invalidateQueries({ queryKey: ["waste-schedule"] });
      formRef.current?.reset();
      setCityId(null);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const cityId = Number(formData.get("cityId"));
    const streetId = Number(formData.get("streetId"));

    if (!cityId || !streetId) return;

    mutation.mutate({
      cityId,
      streetId,
      isDefault: true
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <Label htmlFor="cityId">{t("address.city")}</Label>
        <p className="text-sm text-gray-600 mb-2">
          {t("address.cityDescription")}
        </p>
        <Select
          name="cityId"
          onValueChange={(val) => setCityId(Number(val))}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("address.selectCity")} />
          </SelectTrigger>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem key={city.id} value={city.id.toString()}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div key={cityId}>
        <Label htmlFor="streetId">{t("address.street")}</Label>
        <Select
          name="streetId"
          disabled={!cityId}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("address.selectStreet")} />
          </SelectTrigger>
          <SelectContent>
            {streets.map((street) => (
              <SelectItem key={street.id} value={street.id.toString()}>
                {street.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={!cityId || mutation.isPending}>
        {mutation.isPending ? t("address.adding") : t("address.add")}
      </Button>
    </form>
  );
}
