import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type AddressResponse } from "@repo/data-ops/zod-schema/address";

export function AddressList({ addresses }: { addresses: AddressResponse[] }) {
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
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="outline" size="sm">Delete</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
