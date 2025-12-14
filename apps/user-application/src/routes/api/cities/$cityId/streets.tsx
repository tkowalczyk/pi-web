import { createFileRoute } from "@tanstack/react-router";
import { getStreetsByCityId } from "@repo/data-ops/queries/address";

export const Route = createFileRoute("/api/cities/$cityId/streets")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const streets = await getStreetsByCityId(Number(params.cityId));
        return Response.json(streets);
      },
    },
  },
});
