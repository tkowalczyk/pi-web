import { createFileRoute } from "@tanstack/react-router";
import { getCities } from "@repo/data-ops/queries/address";

export const Route = createFileRoute("/api/cities/")({
  server: {
    handlers: {
      GET: async () => {
        const cities = await getCities();
        return Response.json(cities);
      },
    },
  },
});
