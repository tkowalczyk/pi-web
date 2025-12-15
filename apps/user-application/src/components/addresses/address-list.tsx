import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type AddressResponse, type CityResponse, type StreetResponse } from "@repo/data-ops/zod-schema/address";
import { updateMyAddress, deleteMyAddress } from "@/core/functions/addresses";
import { AlertCircle } from "lucide-react";

export function AddressList({ addresses }: { addresses: AddressResponse[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMyAddress({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setDeleteConfirmId(null);
    },
  });

  if (addresses.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        No addresses yet. Add your first address below.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.map((addr) => (
        <div key={addr.id} className="p-4 border rounded-lg">
          {editingId === addr.id ? (
            <EditAddressForm
              address={addr}
              onCancel={() => setEditingId(null)}
              onSuccess={() => setEditingId(null)}
            />
          ) : deleteConfirmId === addr.id ? (
            <div className="space-y-3">
              <div className="flex gap-2 items-start p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-900">Delete address?</p>
                  <p className="text-red-700 mt-1">
                    {addr.cityName}, {addr.streetName}
                  </p>
                  <p className="text-red-600 mt-2">
                    You won't receive notifications for this address
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(addr.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirmId(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">
                  {addr.cityName}, {addr.streetName}
                  {addr.isDefault && (
                    <Badge className="ml-2" variant="secondary">Default</Badge>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Notifications: 19:00 day before, 7:00 same day
                </div>
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingId(addr.id)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirmId(addr.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EditAddressForm({
  address,
  onCancel,
  onSuccess,
}: {
  address: AddressResponse;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [cityId, setCityId] = useState<number>(address.cityId);
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
    mutationFn: (data: { cityId: number; streetId: number }) =>
      updateMyAddress({
        data: {
          id: address.id,
          data: {
            cityId: data.cityId,
            streetId: data.streetId,
            isDefault: address.isDefault,
          },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const cityId = Number(formData.get("cityId"));
    const streetId = Number(formData.get("streetId"));

    if (!cityId || !streetId) return;

    mutation.mutate({ cityId, streetId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="cityId">City</Label>
        <Select
          name="cityId"
          defaultValue={address.cityId.toString()}
          onValueChange={(val) => setCityId(Number(val))}
        >
          <SelectTrigger>
            <SelectValue />
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

      <div>
        <Label htmlFor="streetId">Street</Label>
        <Select name="streetId" defaultValue={address.streetId.toString()}>
          <SelectTrigger>
            <SelectValue />
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

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
